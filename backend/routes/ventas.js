/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - RUTAS DE VENTAS
 * ═══════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();

const {
  obtenerVentas,
  obtenerVentaPorId,
  registrarVenta,
  actualizarVenta,
  registrarPago,
  anularVenta,
  obtenerEstadisticas,
  obtenerPrecios
} = require('../controllers/ventaController');

// CRUD Ventas
router.get('/', obtenerVentas);
router.get('/estadisticas', obtenerEstadisticas);
router.get('/precios', obtenerPrecios);
router.get('/:id', obtenerVentaPorId);
router.post('/', registrarVenta);
router.put('/:id', actualizarVenta);

// Pagos
router.post('/:id/pago', registrarPago);

// Anular
router.put('/:id/anular', anularVenta);

module.exports = router;