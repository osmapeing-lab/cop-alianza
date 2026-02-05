/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - MODELO LOTE
 * ═══════════════════════════════════════════════════════════════════════
 */

const mongoose = require('mongoose');

const loteSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true,
    index: true  // ← Índice simple para búsquedas
  },
  cantidad_cerdos: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  fecha_inicio: {
    type: Date,
    default: Date.now
  },
  fecha_finalizacion: {
    type: Date
  },
  estado: {
    type: String,
    enum: ['engorde', 'destete', 'gestacion', 'lactancia', 'finalizado'],
    default: 'engorde',
    index: true  // ← Para filtrar por estado rápidamente
  },
  peso_promedio_actual: {
    type: Number,
    default: 0,
    min: 0
  },
  peso_inicial_promedio: {
    type: Number,
    default: 0,
    min: 0
  },
  granja: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm'
  },
  activo: {
    type: Boolean,
    default: true,
    index: true  // ← Para filtrar lotes activos
  },
  notas: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  collection: 'lotes'  // ← Nombre explícito de la colección
});

// ═══════════════════════════════════════════════════════════════════════
// MÉTODO: Calcular ganancia de peso
// ═══════════════════════════════════════════════════════════════════════
loteSchema.methods.getGanancia = function() {
  return (this.peso_promedio_actual || 0) - (this.peso_inicial_promedio || 0);
};

// ═══════════════════════════════════════════════════════════════════════
// MÉTODO: Finalizar lote
// ═══════════════════════════════════════════════════════════════════════
loteSchema.methods.finalizar = async function() {
  this.activo = false;
  this.estado = 'finalizado';
  this.fecha_finalizacion = new Date();
  await this.save();
  return this;
};

// ═══════════════════════════════════════════════════════════════════════
// MÉTODO ESTÁTICO: Obtener lotes activos
// ═══════════════════════════════════════════════════════════════════════
loteSchema.statics.getActivos = function() {
  return this.find({ activo: true }).sort({ createdAt: -1 });
};

// ═══════════════════════════════════════════════════════════════════════
// ÍNDICES COMPUESTOS (optimización)
// ═══════════════════════════════════════════════════════════════════════
loteSchema.index({ activo: 1, estado: 1 });
loteSchema.index({ granja: 1, activo: 1 });
loteSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Lote', loteSchema);