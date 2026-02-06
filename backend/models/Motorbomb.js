const mongoose = require('mongoose');

const motorbombSchema = new mongoose.Schema({
  codigo_bomba: {
    type: String,
    required: true,
    unique: true
  },
  nombre: {
    type: String,
    required: true
  },
  estado: {
    type: Boolean,
    default: false
  },
  conectado: {
    type: Boolean,
    default: true
  },
  ubicacion: {
    type: String,
    default: ''
  },
  descripcion: {
    type: String,
    default: ''
  },
  fecha_cambio: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Motorbomb', motorbombSchema);