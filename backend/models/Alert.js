const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  tipo: {
    type: String,
    required: true
  },
  mensaje: {
    type: String,
    required: true
  },
  enviado_whatsapp: {
    type: Boolean,
    default: false
  },
  enviado_email: {
    type: Boolean,
    default: false
  },
  fecha: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Alert', alertSchema);