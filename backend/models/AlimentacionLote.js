/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - MODELO ALIMENTACIÓN POR LOTE
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Registra alimentación diaria y sincroniza con Costos automáticamente
 * 
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
// ═══════════════════════════════════════════════════════════════════════

alimentacionLoteSchema.pre('save', async function() {
  // Calcular total
  this.total = (this.cantidad_kg || 0) * (this.precio_kg || 0);
  
  // Solo crear costo si es documento nuevo y no tiene costo_ref
  if (this.isNew && !this.costo_ref) {
    try {
      const Costo = mongoose.model('Costo');
      const Lote = mongoose.model('Lote');
      
      // Obtener nombre del lote
      const lote = await Lote.findById(this.lote);
      const nombreLote = lote ? lote.nombre : 'Sin nombre';
      
      // Crear costo automáticamente
      const nuevoCosto = new Costo({
        tipo_costo: 'directo',
        categoria: 'alimento_concentrado',
        subcategoria: this.tipo_alimento,
        descripcion: `Alimento ${this.tipo_alimento} - Lote ${nombreLote}`,
        cantidad: this.cantidad_kg,
        unidad: 'kg',
        precio_unitario: this.precio_kg,
        total: this.total,
        lote: this.lote,
        fecha: this.fecha,
        estado: 'registrado',
        metodo_pago: 'efectivo'
      });
      
      await nuevoCosto.save();
      this.costo_ref = nuevoCosto._id;
      
      console.log(`[ALIMENTACIÓN] Costo creado automáticamente: $${this.total} para lote ${nombreLote}`);
      
      // Actualizar totales en el lote
      if (lote) {
        await lote.actualizarAlimentacion(this.cantidad_kg, this.total);
      }
      
    } catch (error) {
      console.error('[ALIMENTACIÓN] Error creando costo:', error.message);
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════
// MIDDLEWARE POST-REMOVE: Eliminar costo asociado si se borra alimentación
// ═══════════════════════════════════════════════════════════════════════

alimentacionLoteSchema.post('findOneAndDelete', async function(doc) {
  if (doc && doc.costo_ref) {
    try {
      const Costo = mongoose.model('Costo');
      await Costo.findByIdAndDelete(doc.costo_ref);
      console.log('[ALIMENTACIÓN] Costo eliminado automáticamente');
      
      // Restar del lote
      const Lote = mongoose.model('Lote');
      const lote = await Lote.findById(doc.lote);
      if (lote) {
        lote.alimento_total_kg = Math.max(0, (lote.alimento_total_kg || 0) - doc.cantidad_kg);
        lote.costo_alimento_total = Math.max(0, (lote.costo_alimento_total || 0) - doc.total);
        await lote.save();
      }
    } catch (error) {
      console.error('[ALIMENTACIÓN] Error eliminando costo:', error.message);
    }
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