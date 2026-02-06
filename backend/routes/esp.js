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
  obtenerHistoricoTemperatura,
  recibirFlujo,
  obtenerDatosFlujo,
  obtenerHistoricoAgua,
  recibirPeso,
  recibirPesoLive,        // ✅ NUEVO: Peso en tiempo real
  obtenerPesoActual,      // ✅ NUEVO: Consultar peso actual
  tararBascula,           // ✅ NUEVO: Tarar báscula
  obtenerHistorialPeso,
  obtenerEstadoBombas,
  heartbeat
} = require('../controllers/espController');

// ═══════════════════════════════════════════════════════════════════════
// TEMPERATURA Y HUMEDAD
// ═══════════════════════════════════════════════════════════════════════
router.post('/riego', recibirRiego);
router.get('/porqueriza', obtenerDatosPorqueriza);
router.get('/porqueriza/historico', obtenerHistoricoTemperatura);

// ═══════════════════════════════════════════════════════════════════════
// FLUJO DE AGUA
// ═══════════════════════════════════════════════════════════════════════
router.post('/flujo', recibirFlujo);
router.get('/flujo', obtenerDatosFlujo);
router.get('/flujo/historico', obtenerHistoricoAgua);

// ═══════════════════════════════════════════════════════════════════════
// BÁSCULA - PESO EN TIEMPO REAL
// ═══════════════════════════════════════════════════════════════════════
router.post('/peso/live', recibirPesoLive);   // ✅ ESP envía cada 500ms (NO guarda)
router.get('/peso/actual', obtenerPesoActual); // ✅ Frontend consulta peso actual
router.post('/peso/tarar', tararBascula);      // ✅ Tarar/resetear báscula
router.post('/peso', recibirPeso);             // Guardar pesaje en BD
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
    version: '3.0.0',
    endpoints: [
      'POST /api/esp/riego                    -> Temp/Humedad DHT22',
      'GET  /api/esp/porqueriza               -> Datos actuales porqueriza',
      'GET  /api/esp/porqueriza/historico     -> Histórico 24h temperatura',
      'POST /api/esp/flujo                    -> Datos flujo YF-S201',
      'GET  /api/esp/flujo                    -> Datos actuales flujo',
      'GET  /api/esp/flujo/historico          -> Histórico 7 días agua',
      'POST /api/esp/peso/live                -> ✅ Peso tiempo real (NO guarda)',
      'GET  /api/esp/peso/actual              -> ✅ Consultar peso actual',
      'POST /api/esp/peso/tarar               -> ✅ Tarar báscula',
      'POST /api/esp/peso                     -> Guardar pesaje en BD',
      'GET  /api/esp/pesos                    -> Historial pesajes',
      'GET  /api/esp/bombas                   -> Estado bombas',
      'POST /api/esp/heartbeat                -> Heartbeat dispositivos'
    ],
    timestamp: new Date()
  });
});

module.exports = router;