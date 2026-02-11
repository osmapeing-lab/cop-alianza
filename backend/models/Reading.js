const mongoose = require('mongoose');

const readingSchema = new mongoose.Schema({
  sensor: {
    type: String,
    required: true
  },
  tipo: {
    type: String,
    required: true,
    enum: ['temp_porqueriza', 'humedad_porqueriza', 'flujo_agua', 'peso', 'volumen_diario', 'caudal_agua']
  },
  valor: {
    type: Number,
    required: true
  },
  unidad: {
    type: String,
    required: true
  },
  metadata: {
    type: Object,
    default: {}
  },
  fecha: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

readingSchema.index({ tipo: 1, createdAt: -1 });

module.exports = mongoose.model('Reading', readingSchema);