/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - MODELO PESAJE
 * ═══════════════════════════════════════════════════════════════════════
 */

const mongoose = require('mongoose');

const pesajeSchema = new mongoose.Schema({
  lote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lote',
    index: true  // ← Optimiza búsquedas por lote
  },
  peso: {
    type: Number,
    required: true,
    min: 0
  },
  cantidad_cerdos_pesados: {
    type: Number,
    default: 1,
    min: 1
  },
  peso_promedio: {
    type: Number
  },
  unidad: {
    type: String,
    default: 'kg',
    enum: ['kg', 'lb']
  },
  sensor_id: {
    type: String,
    default: 'manual'
  },
  validado: {
    type: Boolean,
    default: true
  },
  notas: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  collection: 'weighings'  // ← Mantiene el nombre original en BD
});

// ═══════════════════════════════════════════════════════════════════════
// MIDDLEWARE 1: Calcular peso promedio ANTES de guardar
// ═══════════════════════════════════════════════════════════════════════
pesajeSchema.pre('save', function(next) {
  if (this.cantidad_cerdos_pesados > 0) {
    this.peso_promedio = this.peso / this.cantidad_cerdos_pesados;
  }
  next();
});

// ═══════════════════════════════════════════════════════════════════════
// MIDDLEWARE 2: Actualizar lote DESPUÉS de guardar
// ═══════════════════════════════════════════════════════════════════════
pesajeSchema.post('save', async function(doc) {
  try {
    if (!doc.lote) return; // Si no tiene lote, no hacer nada
    
    const Lote = mongoose.model('Lote');
    const Pesaje = mongoose.model('Pesaje');
    
    // Obtener TODOS los pesajes del lote
    const pesajes = await Pesaje.find({ lote: doc.lote }).sort({ createdAt: -1 });
    
    if (pesajes.length > 0) {
      // Calcular nuevo peso promedio
      const sumaPesos = pesajes.reduce((total, p) => total + (p.peso_promedio || 0), 0);
      const nuevoPesoPromedio = sumaPesos / pesajes.length;
      
      // Actualizar el lote
      await Lote.findByIdAndUpdate(doc.lote, {
        peso_promedio_actual: nuevoPesoPromedio,
        updatedAt: new Date()
      });
      
      console.log(`✅ Lote actualizado: ${nuevoPesoPromedio.toFixed(2)} kg`);
    }
  } catch (error) {
    console.error('❌ Error actualizando lote después de pesaje:', error);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// MIDDLEWARE 3: Recalcular lote DESPUÉS de eliminar pesaje
// ═══════════════════════════════════════════════════════════════════════
pesajeSchema.post('deleteOne', { document: true, query: false }, async function(doc) {
  try {
    if (!doc.lote) return;
    
    const Lote = mongoose.model('Lote');
    const Pesaje = mongoose.model('Pesaje');
    
    // Obtener pesajes restantes
    const pesajes = await Pesaje.find({ lote: doc.lote });
    
    if (pesajes.length > 0) {
      const sumaPesos = pesajes.reduce((total, p) => total + (p.peso_promedio || 0), 0);
      const nuevoPesoPromedio = sumaPesos / pesajes.length;
      
      await Lote.findByIdAndUpdate(doc.lote, {
        peso_promedio_actual: nuevoPesoPromedio
      });
    } else {
      // Si no quedan pesajes, resetear a peso inicial
      await Lote.findByIdAndUpdate(doc.lote, {
        peso_promedio_actual: 0
      });
    }
    
    console.log(`✅ Lote recalculado después de eliminar pesaje`);
  } catch (error) {
    console.error('❌ Error recalculando lote:', error);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// ÍNDICES para optimizar consultas
// ═══════════════════════════════════════════════════════════════════════
pesajeSchema.index({ lote: 1, createdAt: -1 });
pesajeSchema.index({ createdAt: -1 });
pesajeSchema.index({ sensor_id: 1 });

module.exports = mongoose.model('Pesaje', pesajeSchema);