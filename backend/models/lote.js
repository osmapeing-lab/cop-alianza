const mongoose = require('mongoose');

const loteSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true
  },
  cantidad_cerdos: {
    type: Number,
    required: true,
    default: 0
  },
  fecha_inicio: {
    type: Date,
    default: Date.now
  },
  estado: {
    type: String,
    enum: ['engorde', 'destete', 'gestacion', 'lactancia', 'finalizado'],
    default: 'engorde'
  },
  peso_promedio_actual: {
    type: Number,
    default: 0
  },
  peso_inicial_promedio: {
    type: Number,
    default: 0
  },
  granja: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm'
  },
  activo: {
    type: Boolean,
    default: true
  },
  notas: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Lote', loteSchema);