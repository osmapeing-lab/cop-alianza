const mongoose = require('mongoose');

const weighingSchema = new mongoose.Schema({
  lote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lote'
  },
  peso: {
    type: Number,
    required: true
  },
  cantidad_cerdos_pesados: {
    type: Number,
    default: 1
  },
  peso_promedio: {
    type: Number
  },
  unidad: {
    type: String,
    default: 'kg'
  },
  sensor_id: {
    type: String
  },
  notas: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

weighingSchema.pre('save', function(next) {
  if (this.cantidad_cerdos_pesados > 0) {
    this.peso_promedio = this.peso / this.cantidad_cerdos_pesados;
  }
  next();
});

module.exports = mongoose.model('Weighing', weighingSchema);