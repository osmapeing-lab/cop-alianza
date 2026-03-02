/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - RUTAS DE CAMARAS
 * ═══════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();

const {
  obtenerCamaras,
  obtenerCamaraPorId,
  crearCamara,
  actualizarCamara,
  eliminarCamara,
  heartbeat,
  cambiarEstado,
  obtenerConfiguracion,
  actualizarConfiguracion
} = require('../controllers/camaraController');

const { getSnapshot, getStatus } = require('../controllers/tplinkController');

// CRUD Cámaras
router.get('/', obtenerCamaras);
router.get('/:id', obtenerCamaraPorId);
router.post('/', crearCamara);
router.put('/:id', actualizarCamara);
router.delete('/:id', eliminarCamara);

// ESP32-CAM
router.post('/heartbeat', heartbeat);

// Estado y configuración
router.put('/:id/estado', cambiarEstado);
router.get('/:id/config', obtenerConfiguracion);
router.put('/:id/config', actualizarConfiguracion);

// TP-Link VIGI Cloud
router.get('/tplink/snapshot', getSnapshot);
router.get('/tplink/status',   getStatus);

module.exports = router;