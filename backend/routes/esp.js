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
  recibirFlujo,
  obtenerDatosFlujo,
  recibirPeso, 
  obtenerHistorialPeso,
  obtenerEstadoBombas,
  heartbeat
} = require('../controllers/espController');

// Temperatura y humedad
router.post('/riego', recibirRiego);
router.get('/porqueriza', obtenerDatosPorqueriza);

// Flujo de agua
router.post('/flujo', recibirFlujo);
router.get('/flujo', obtenerDatosFlujo);

// Bascula
router.post('/peso', recibirPeso);
router.get('/pesos', obtenerHistorialPeso);

// Bombas
router.get('/bombas', obtenerEstadoBombas);

// Heartbeat
router.post('/heartbeat', heartbeat);

// Test
router.get('/test', (req, res) => {
  res.json({ 
    mensaje: 'API ESP funcionando',
    endpoints: [
      'POST /api/esp/riego',
      'GET /api/esp/porqueriza',
      'POST /api/esp/flujo',
      'GET /api/esp/flujo',
      'POST /api/esp/peso',
      'GET /api/esp/pesos',
      'GET /api/esp/bombas'
    ]
  });
});

module.exports = router;