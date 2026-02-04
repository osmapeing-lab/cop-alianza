/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - RUTAS DE GRABACIONES
 * ═══════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();

const {
  obtenerGrabaciones,
  obtenerGrabacionesPorCamara,
  registrarGrabacion,
  capturarFoto,
  eliminarGrabacion,
  obtenerEstadisticas
} = require('../controllers/grabacionController');

// Grabaciones
router.get('/', obtenerGrabaciones);
router.get('/estadisticas', obtenerEstadisticas);
router.get('/camara/:camaraId', obtenerGrabacionesPorCamara);
router.post('/', registrarGrabacion);
router.post('/foto', capturarFoto);
router.delete('/:id', eliminarGrabacion);

module.exports = router;