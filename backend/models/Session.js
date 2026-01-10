const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  usuario: String,
  fecha_entrada: { type: Date, default: Date.now },
  fecha_salida: Date,
  ip: String
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);