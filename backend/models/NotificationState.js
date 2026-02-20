const mongoose = require('mongoose');

/**
 * Key-value store para persistir estado de notificaciones.
 * Sobrevive reinicios de Render (a diferencia de variables en memoria).
 *
 * Claves usadas:
 *   ultima_alerta_calor      → Date (última notificación de calor)
 *   alerta_nivel_100         → Date (última notificación tanque lleno)
 *   alerta_nivel_20          → Date (última notificación nivel bajo)
 *   alerta_nivel_10          → Date (última notificación nivel crítico)
 *   bomba_encendida_MB001    → Date (timestamp de encendido)
 *   bomba_encendida_MB002    → Date (timestamp de encendido)
 *   tarea_diaria_ejecutada   → String (fecha en formato dateString)
 *   resumen_agua_enviado     → String (fecha en formato dateString)
 */
const notificationStateSchema = new mongoose.Schema({
  clave: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  valor: {
    type: mongoose.Schema.Types.Mixed
  },
  actualizado: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('NotificationState', notificationStateSchema);
