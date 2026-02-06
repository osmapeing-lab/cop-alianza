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
      'GET /api/esp/bombas',
      'POST /api/esp/heartbeat'
    ],
    timestamp: new Date()
  });
});
// ═══════════════════════════════════════════════════════════════════════════
// HEARTBEAT ESP8266/ESP32
// POST /api/esp/heartbeat
// ═══════════════════════════════════════════════════════════════════════════
router.post('/heartbeat', (req, res) => {
  const { deviceId, deviceType, status, rssi, ip, MB001, MB002 } = req.body;
  
  console.log('════════════════════════════════════════════');
  console.log('[ESP] Heartbeat recibido');
  console.log('  Device ID:', deviceId || 'No especificado');
  console.log('  Tipo:', deviceType || 'ESP');
  console.log('  Estado:', status || 'online');
  console.log('  RSSI:', rssi || 'N/A', 'dBm');
  console.log('  IP:', ip || 'N/A');
  console.log('  MB001:', MB001 !== undefined ? MB001 : 'N/A');
  console.log('  MB002:', MB002 !== undefined ? MB002 : 'N/A');
  console.log('  Hora:', new Date().toISOString());
  console.log('════════════════════════════════════════════');
  
  // Emitir al frontend por Socket.IO
  if (req.io) {
    req.io.emit('esp_status', {
      deviceId: deviceId || 'ESP-001',
      deviceType: deviceType || 'ESP8266',
      status: status || 'online',
      rssi: rssi,
      ip: ip,
      bombas: { MB001, MB002 },
      timestamp: Date.now()
    });
  }
  
  res.json({ 
    ok: true, 
    mensaje: 'Heartbeat recibido',
    timestamp: Date.now()
  });
});

module.exports = router;