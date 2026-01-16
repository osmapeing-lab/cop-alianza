const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  usuario: String,
  ip: String,
  token: String,
  fecha_entrada: { type: Date, default: Date.now },
  fecha_salida: Date,
  ultima_actividad: { type: Date, default: Date.now },
  expira_en: { type: Date, default: () => new Date(Date.now() + 30*60*1000) }, // 30 min
  activa: { type: Boolean, default: true }
});

// Auto-expirar sesiones inactivas
sessionSchema.methods.verificarExpiracion = function() {
  if (new Date() > this.expira_en) {
    this.activa = false;
    this.fecha_salida = new Date();
    return true;
  }
  return false;
};

module.exports = mongoose.model('Session', sessionSchema);