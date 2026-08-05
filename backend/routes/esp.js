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
  corregirConsumo,
  obtenerHistoricoAgua,
  recibirPeso,
  recibirPesoLive,        // ✅ NUEVO: Peso en tiempo real
  obtenerPesoActual,      // ✅ NUEVO: Consultar peso actual
  tararBascula,           // ✅ NUEVO: Tarar báscula
  obtenerHistorialPeso,
  obtenerEstadoBombas,
  heartbeat
} = require('../controllers/espController');
const { verificarToken, verificarTokenOpcional } = require('../middleware/auth');

// ═══════════════════════════════════════════════════════════════════════
// TEMPERATURA Y HUMEDAD
// ═══════════════════════════════════════════════════════════════════════
// POST /riego lo manda el ESP32 directo (sin sesión de usuario) — la
// granja se resuelve por sensor_id dentro del controlador. Los GET los
// consume la web/app autenticada y se filtran por su granja.
router.post('/riego', recibirRiego);
router.get('/porqueriza', verificarToken, obtenerDatosPorqueriza);
router.get('/porqueriza/historico', verificarToken, obtenerHistoricoTemperatura);

// ═══════════════════════════════════════════════════════════════════════
// FLUJO DE AGUA
// ═══════════════════════════════════════════════════════════════════════
router.post('/flujo', recibirFlujo);
router.get('/flujo', verificarToken, obtenerDatosFlujo);
router.put('/flujo/corregir', verificarToken, corregirConsumo);
router.get('/flujo/historico', verificarToken, obtenerHistoricoAgua);

// ═══════════════════════════════════════════════════════════════════════
// BÁSCULA - PESO EN TIEMPO REAL
// ═══════════════════════════════════════════════════════════════════════
router.post('/peso/live', recibirPesoLive);   // ✅ ESP envía cada 500ms (NO guarda)
router.get('/peso/actual', verificarToken, obtenerPesoActual); // ✅ Frontend consulta peso actual
router.post('/peso/tarar', tararBascula);      // ✅ Tarar/resetear báscula
router.post('/peso', verificarTokenOpcional, recibirPeso); // ESP32 (sin token) o guardado manual autenticado
router.get('/pesos', verificarToken, obtenerHistorialPeso);

// ═══════════════════════════════════════════════════════════════════════
// BOMBAS
// ═══════════════════════════════════════════════════════════════════════
router.get('/bombas', verificarToken, obtenerEstadoBombas);

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