/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - MODELO ALIMENTACIÓN POR LOTE (CORREGIDO)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * CORRECCIONES:
 * - Middleware pre('save') robusto: valida lote activo antes de crear costo
 * - Lanza error si el lote no existe o está finalizado (falla el save)
 * - Usa lote.save() directo en lugar de actualizarAlimentacion() para evitar
 *   doble guardado y race conditions
 * - Post findOneAndDelete mantiene paridad con la corrección del middleware
 * ═══════════════════════════════════════════════════════════════════════
 */

const mongoose = require('mongoose');

const alimentacionLoteSchema = new mongoose.Schema({
  // ═══════════════════════════════════════════════════════════════════
  // RELACIÓN CON LOTE
  // ═══════════════════════════════════════════════════════════════════
  lote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lote',
    required: true,
    index: true
  },

  // ═══════════════════════════════════════════════════════════════════
  // DATOS DE ALIMENTACIÓN
  // ═══════════════════════════════════════════════════════════════════
  fecha: {
    type: Date,
    default: Date.now,
    index: true
  },

  tipo_alimento: {
    type: String,
    enum: ['iniciador', 'levante', 'engorde', 'gestacion', 'lactancia', 'otro'],
    default: 'engorde'
  },

  cantidad_kg: {
    type: Number,
    required: true,
    min: 0
  },

  precio_kg: {
    type: Number,
    required: true,
    min: 0
  },

  total: {
    type: Number,
    default: 0
  },

  // ═══════════════════════════════════════════════════════════════════
  // REFERENCIA AL COSTO CREADO (para trazabilidad)
  // ═══════════════════════════════════════════════════════════════════
  costo_ref: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Costo'
  },

  // ═══════════════════════════════════════════════════════════════════
  // REFERENCIA AL INVENTARIO (para restaurar stock al eliminar)
  // ═══════════════════════════════════════════════════════════════════
  inventario_ref: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventarioAlimento'
  },

  // Bultos consumidos (decimal: 8 kg / 40 kg/bulto = 0.2 bultos)
  bultos_consumidos: {
    type: Number,
    default: 0
  },

  // ═══════════════════════════════════════════════════════════════════
  // SEMANA ISO (control de registro único por semana)
  // ═══════════════════════════════════════════════════════════════════
  semana_iso: {
    type: String,  // e.g. "2026-W08"
    default: ''
  },

  // Registro histórico: ingresado por superadmin para semanas pasadas
  // (no descuenta inventario)
  es_historico: {
    type: Boolean,
    default: false
  },

  // ═══════════════════════════════════════════════════════════════════
  // NOTAS
  // ═══════════════════════════════════════════════════════════════════
  notas: {
    type: String,
    default: ''
  },

  // ═══════════════════════════════════════════════════════════════════
  // REGISTRO
  // ═══════════════════════════════════════════════════════════════════
  registrado_por: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  collection: 'alimentacion_lotes'
});

// ═══════════════════════════════════════════════════════════════════════
// MIDDLEWARE PRE-SAVE: Calcular total y sincronizar con Costos
// CORRECCIONES:
//  1. Valida que el lote exista y esté activo antes de continuar
//  2. Lanza error explícito para que Mongoose cancele el save
//  3. Actualiza lote directamente (sin llamar a actualizarAlimentacion)
//     para evitar un segundo save que puede producir race conditions
// ═══════════════════════════════════════════════════════════════════════

alimentacionLoteSchema.pre('save', async function() {
  // 1. Calcular total
  this.total = (this.cantidad_kg || 0) * (this.precio_kg || 0);

  // 2. Si es documento nuevo, validar lote y actualizar sus totales.
  // NOTA: El Costo financiero se registra al COMPRAR el bulto (registrarEntrada),
  // no al consumir, para evitar doble conteo en el balance.
  if (this.isNew) {
    const Lote = mongoose.model('Lote');

    // ── VALIDAR LOTE ──────────────────────────────────────────────
    const lote = await Lote.findById(this.lote);

    if (!lote) {
      throw new Error('Lote no encontrado al registrar alimentación');
    }

    if (!lote.activo) {
      throw new Error('No se puede registrar alimentación en un lote finalizado');
    }

    // ── ACTUALIZAR TOTALES EN EL LOTE ────────────────────────────
    lote.alimento_total_kg    = (lote.alimento_total_kg   || 0) + this.cantidad_kg;
    lote.costo_alimento_total = (lote.costo_alimento_total || 0) + this.total;
    await lote.save();

    console.log(`[ALIMENTACIÓN] ✓ ${this.cantidad_kg} kg registrados para lote ${lote.nombre}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// MIDDLEWARE POST-REMOVE: Eliminar costo asociado si se borra la alimentación
// ═══════════════════════════════════════════════════════════════════════

alimentacionLoteSchema.post('findOneAndDelete', async function(doc) {
  if (!doc) return;
  try {
    // 1. Eliminar Costo asociado
    if (doc.costo_ref) {
      const Costo = mongoose.model('Costo');
      await Costo.findByIdAndDelete(doc.costo_ref);
      console.log('[ALIMENTACIÓN] Costo eliminado automáticamente');
    }

    // 2. Revertir totales en el Lote
    const Lote = mongoose.model('Lote');
    const lote = await Lote.findById(doc.lote);
    if (lote) {
      lote.alimento_total_kg    = Math.max(0, (lote.alimento_total_kg    || 0) - (doc.cantidad_kg || 0));
      lote.costo_alimento_total = Math.max(0, (lote.costo_alimento_total || 0) - (doc.total       || 0));
      await lote.save();
    }

    // 3. Restaurar stock en InventarioAlimento
    if (doc.inventario_ref && doc.bultos_consumidos > 0) {
      const InventarioAlimento = mongoose.model('InventarioAlimento');
      const inv = await InventarioAlimento.findById(doc.inventario_ref);
      if (inv) {
        const kg_devueltos = doc.bultos_consumidos * (inv.peso_por_bulto_kg || 40);
        inv.movimientos.push({
          tipo: 'entrada',
          cantidad_bultos: doc.bultos_consumidos,
          cantidad_kg: kg_devueltos,
          precio_unitario: inv.precio_bulto,
          total: doc.bultos_consumidos * inv.precio_bulto,
          descripcion: `Devolución por eliminación de registro de alimentación (${(doc.cantidad_kg || 0).toFixed(1)} kg)`
        });
        inv.cantidad_bultos = (inv.cantidad_bultos || 0) + doc.bultos_consumidos;
        await inv.save();
        console.log(`[ALIMENTACIÓN] Stock restaurado: +${doc.bultos_consumidos.toFixed(3)} bultos (${kg_devueltos.toFixed(1)} kg) en ${inv.nombre}`);
      }
    }
  } catch (error) {
    console.error('[ALIMENTACIÓN] Error en cleanup post-delete:', error.message);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// ÍNDICES
// ═══════════════════════════════════════════════════════════════════════
alimentacionLoteSchema.index({ lote: 1, fecha: -1 });
alimentacionLoteSchema.index({ fecha: -1 });

// ═══════════════════════════════════════════════════════════════════════
// MÉTODOS ESTÁTICOS
// ═══════════════════════════════════════════════════════════════════════

// Obtener historial de alimentación de un lote
alimentacionLoteSchema.statics.getHistorialPorLote = function(loteId, limite = 30) {
  return this.find({ lote: loteId })
    .sort({ fecha: -1 })
    .limit(limite)
    .lean();
};

// Obtener total de alimento de un lote
alimentacionLoteSchema.statics.getTotalPorLote = async function(loteId) {
  const result = await this.aggregate([
    { $match: { lote: new mongoose.Types.ObjectId(loteId) } },
    {
      $group: {
        _id: null,
        total_kg: { $sum: '$cantidad_kg' },
        total_costo: { $sum: '$total' }
      }
    }
  ]);

  return result[0] || { total_kg: 0, total_costo: 0 };
};

// Obtener alimentación por día para gráfica
alimentacionLoteSchema.statics.getAlimentacionDiaria = function(loteId, dias = 30) {
  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - dias);

  return this.aggregate([
    {
      $match: {
        lote: new mongoose.Types.ObjectId(loteId),
        fecha: { $gte: fechaLimite }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$fecha' } },
        kg: { $sum: '$cantidad_kg' },
        costo: { $sum: '$total' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

module.exports = mongoose.model('AlimentacionLote', alimentacionLoteSchema);