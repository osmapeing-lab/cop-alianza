/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - RUTAS ESP32
 * ═══════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();

const { 
  recibirRiego,
  obtenerDatosPorqueriza,
  obtenerHistoricoTemperatura,  // ✅ NUEVO
  recibirFlujo,
  obtenerDatosFlujo,
  obtenerHistoricoAgua,          // ✅ NUEVO
  recibirPeso, 
  obtenerHistorialPeso,
  obtenerEstadoBombas,
  heartbeat
} = require('../controllers/espController');

// ═══════════════════════════════════════════════════════════════════════
// TEMPERATURA Y HUMEDAD
// ═══════════════════════════════════════════════════════════════════════
router.post('/riego', recibirRiego);
router.get('/porqueriza', obtenerDatosPorqueriza);
router.get('/porqueriza/historico', obtenerHistoricoTemperatura);  // ✅ NUEVO

// ═══════════════════════════════════════════════════════════════════════
// FLUJO DE AGUA
// ═══════════════════════════════════════════════════════════════════════
router.post('/flujo', recibirFlujo);
router.get('/flujo', obtenerDatosFlujo);
router.get('/flujo/historico', obtenerHistoricoAgua);  // ✅ NUEVO

// ═══════════════════════════════════════════════════════════════════════
// BÁSCULA
// ═══════════════════════════════════════════════════════════════════════
router.post('/peso', recibirPeso);
router.get('/pesos', obtenerHistorialPeso);

// ═══════════════════════════════════════════════════════════════════════
// BOMBAS
// ═══════════════════════════════════════════════════════════════════════
router.get('/bombas', obtenerEstadoBombas);

// ═══════════════════════════════════════════════════════════════════════
// HEARTBEAT
// ═══════════════════════════════════════════════════════════════════════
router.post('/heartbeat', heartbeat);

// ═══════════════════════════════════════════════════════════════════════
// TEST
// ═══════════════════════════════════════════════════════════════════════
router.get('/test', (req, res) => {
  res.json({ 
    mensaje: 'API ESP funcionando',
    version: '2.5.0',
    endpoints: [
      'POST /api/esp/riego',
      'GET  /api/esp/porqueriza',
      'GET  /api/esp/porqueriza/historico?horas=24  ← NUEVO',
      'POST /api/esp/flujo',
      'GET  /api/esp/flujo',
      'GET  /api/esp/flujo/historico?dias=7  ← NUEVO',
      'POST /api/esp/peso',
      'GET  /api/esp/pesos',
      'GET  /api/esp/bombas',
      'POST /api/esp/heartbeat'
    ],
    timestamp: new Date()
  });
});

module.exports = router;