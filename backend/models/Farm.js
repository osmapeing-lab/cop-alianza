const mongoose = require('mongoose');

const farmSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  ubicacion: String,
  propietario: String,
  telefono: String,
  email: String,
  activo: { type: Boolean, default: true },
  fecha_registro: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Farm', farmSchema);