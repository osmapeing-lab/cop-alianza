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
