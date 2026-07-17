const mongoose = require('mongoose');

const fcmTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true
  },
  dispositivo: {
    type: String,
    default: 'android'
  },
  // Identidad confiable para dirigir notificaciones a un usuario específico
  // (ver utils/fcmService.js enviarNotificacionAUsuarios) — se toma de
  // req.user.id en el registro autenticado, nunca del body.
  usuario_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  // Texto libre heredado, ya no se usa para dirigir notificaciones.
  usuario: {
    type: String,
    default: ''
  },
  activo: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('FCMToken', fcmTokenSchema);
