const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  usuario: { type: String, required: true, unique: true },
  correo: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  rol: { type: String, default: 'cliente', enum: ['superadmin', 'jefa' , 'cliente'] },
  granja_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm' },
  activo: { type: Boolean, default: true },
  ultimo_acceso: Date
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);