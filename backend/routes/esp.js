/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - RUTAS ESP32
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Archivo: routes/esp.js
 * 
 * Endpoints disponibles:
 *   POST /api/esp/riego      → Recibir datos DHT22 (temp/humedad)
 *   GET  /api/esp/porqueriza → Obtener últimos datos porqueriza
 *   POST /api/esp/peso       → Recibir datos de báscula
 *   GET  /api/esp/pesos      → Historial de pesajes
 *   GET  /api/esp/bombas     → Estado de bombas para ESP-01
 *   POST /api/esp/heartbeat  → Heartbeat de dispositivos
 *   POST /api/esp/confirmar  → Confirmar cambio de bomba
 * 
 * ═══════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();

const { 
  recibirRiego,
  obtenerDatosPorqueriza,
  recibirPeso, 
  obtenerHistorialPeso,
  obtenerEstadoBombas,
  heartbeat,
  confirmarCambio
} = require('../controllers/espController');

// ═══════════════════════════════════════════════════════════════════════
// RUTAS PARA SENSOR DHT22 (TEMPERATURA/HUMEDAD)
// ═══════════════════════════════════════════════════════════════════════

// Recibir datos de temperatura y humedad
router.post('/riego', recibirRiego);

// Obtener últimos datos de porqueriza
router.get('/porqueriza', obtenerDatosPorqueriza);

// ═══════════════════════════════════════════════════════════════════════
// RUTAS PARA BÁSCULA (HX711)
// ═══════════════════════════════════════════════════════════════════════

// Recibir nuevo peso
router.post('/peso', recibirPeso);

// Obtener historial de pesos
router.get('/pesos', obtenerHistorialPeso);
router.get('/peso/historial', obtenerHistorialPeso);  // Alias

// ═══════════════════════════════════════════════════════════════════════
// RUTAS PARA CONTROL DE BOMBAS (ESP-01)
// ═══════════════════════════════════════════════════════════════════════

// Obtener estado de bombas
router.get('/bombas', obtenerEstadoBombas);

// Confirmar cambio de bomba
router.post('/confirmar', confirmarCambio);

// ═══════════════════════════════════════════════════════════════════════
// RUTAS GENERALES
// ═══════════════════════════════════════════════════════════════════════

// Heartbeat de dispositivos
router.post('/heartbeat', heartbeat);

// Ruta de prueba
router.get('/test', (req, res) => {
  res.json({ 
    mensaje: 'API ESP funcionando correctamente',
    endpoints: [
      'POST /api/esp/riego - Enviar temp/humedad',
      'GET /api/esp/porqueriza - Obtener últimos datos',
      'POST /api/esp/peso - Enviar peso',
      'GET /api/esp/pesos - Historial pesos',
      'GET /api/esp/bombas - Estado bombas'
    ],
    timestamp: new Date()
  });
});

module.exports = router;