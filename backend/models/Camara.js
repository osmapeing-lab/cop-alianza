/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - MODELO CAMARA
 * ═══════════════════════════════════════════════════════════════════════
 */

const mongoose = require('mongoose');

const camaraSchema = new mongoose.Schema({
  codigo: {
    type: String,
    required: true,
    unique: true
  },
  nombre: {
    type: String,
    required: true
  },
  ubicacion: {
    type: String,
    required: true
  },
  tipo: {
    type: String,
    enum: ['sensor_temp', 'sensor_flujo', 'vigilancia', 'otro'],
    default: 'vigilancia'
  },
  ip_local: {
    type: String,
    default: ''
  },
  url_stream: {
    type: String,
    default: ''
  },
  resolucion: {
    type: String,
    enum: ['QQVGA', 'QVGA', 'CIF', 'VGA', 'SVGA', 'XGA', 'SXGA', 'UXGA'],
    default: 'VGA'
  },
  estado: {
    type: String,
    enum: ['activa', 'inactiva', 'mantenimiento', 'sin_conexion'],
    default: 'activa'
  },
  granja: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm'
  },
  grabacion_activa: {
    type: Boolean,
    default: false
  },
  deteccion_movimiento: {
    type: Boolean,
    default: false
  },
  ultima_conexion: {
    type: Date,
    default: Date.now
  },
  configuracion: {
    brillo: { type: Number, default: 0, min: -2, max: 2 },
    contraste: { type: Number, default: 0, min: -2, max: 2 },
    saturacion: { type: Number, default: 0, min: -2, max: 2 },
    flash: { type: Boolean, default: false },
    espejo_horizontal: { type: Boolean, default: false },
    espejo_vertical: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Camara', camaraSchema);