const mongoose = require('mongoose');

const weighingSchema = new mongoose.Schema({
  cerdo: {
    type: String,
    required: true
  },
  peso: {
    type: Number,
    required: true
  },
  unidad: {
    type: String,
    default: 'kg'
  },
  validado: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Weighing', weighingSchema);