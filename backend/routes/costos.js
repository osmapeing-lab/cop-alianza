/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - RUTAS DE COSTOS (Contabilidad)
 * ═══════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();

const {
  obtenerCostos,
  registrarCosto,
  actualizarCosto,
  anularCosto,
  obtenerResumen,
  obtenerComparativo,
  obtenerCategorias
} = require('../controllers/costoController');

// CRUD Costos
router.get('/', obtenerCostos);
router.get('/resumen', obtenerResumen);
router.get('/comparativo', obtenerComparativo);
router.get('/categorias', obtenerCategorias);
router.post('/', registrarCosto);
router.put('/:id', actualizarCosto);
router.delete('/:id', anularCosto);

module.exports = router;