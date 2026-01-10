const mongoose = require('mongoose');

const readingSchema = new mongoose.Schema({
  sensor: {
    type: String,
    required: true
  },
  valor: {
    type: Number,
    required: true
  },
  unidad: {
    type: String,
    required: true
  },
  fecha: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Reading', readingSchema);