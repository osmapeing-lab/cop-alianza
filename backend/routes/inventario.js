/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - RUTAS DE INVENTARIO
 * ═══════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();

const {
  obtenerInventario,
  obtenerPorId,
  registrarCerdo,
  actualizarCerdo,
  registrarPeso,
  registrarSalida,
  obtenerEstadisticas
} = require('../controllers/inventarioController');

// CRUD Inventario
router.get('/', obtenerInventario);
router.get('/estadisticas', obtenerEstadisticas);
router.get('/:id', obtenerPorId);
router.post('/', registrarCerdo);
router.put('/:id', actualizarCerdo);

// Acciones específicas
router.post('/:id/peso', registrarPeso);
router.put('/:id/salida', registrarSalida);

module.exports = router;