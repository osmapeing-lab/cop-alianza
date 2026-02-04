/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - MODELO GRABACION
 * ═══════════════════════════════════════════════════════════════════════
 */

const mongoose = require('mongoose');

const grabacionSchema = new mongoose.Schema({
  camara: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Camara',
    required: true
  },
  tipo: {
    type: String,
    enum: ['foto', 'video', 'timelapse'],
    required: true
  },
  motivo: {
    type: String,
    enum: ['programada', 'movimiento', 'alerta', 'manual', 'evento'],
    default: 'programada'
  },
  archivo_nombre: {
    type: String,
    required: true
  },
  archivo_url: {
    type: String,
    default: ''
  },
  archivo_size: {
    type: Number,
    default: 0
  },
  duracion_segundos: {
    type: Number,
    default: 0
  },
  fecha_inicio: {
    type: Date,
    default: Date.now
  },
  fecha_fin: {
    type: Date
  },
  evento_asociado: {
    tipo: { type: String },
    descripcion: { type: String },
    valor: { type: Number }
  },
  procesada: {
    type: Boolean,
    default: false
  },
  eliminada: {
    type: Boolean,
    default: false
  },
  notas: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Índices para búsquedas rápidas
grabacionSchema.index({ camara: 1, fecha_inicio: -1 });
grabacionSchema.index({ tipo: 1, motivo: 1 });
grabacionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Grabacion', grabacionSchema);