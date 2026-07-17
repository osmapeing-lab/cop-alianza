const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  // Granja dueña de esta alerta — aísla los datos entre distintos
  // clientes de la app (ver middleware/auth.js).
  granja: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm'
  },
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