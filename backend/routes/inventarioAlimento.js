/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - RUTAS INVENTARIO ALIMENTO
 * ═══════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();
const {
  getAll,
  getById,
  getResumen,
  create,
  update,
  delete: deleteInventario,
  registrarEntrada,
  registrarSalida,
  getMovimientos,
  getConsumoPorLote,
  verificarStock
} = require('../controllers/inventarioAlimentoController');

// Rutas públicas (para el sistema)
// Obtener todos los inventarios
router.get('/', getAll);

// Obtener resumen general
router.get('/resumen', getResumen);

// Obtener consumo por lote
router.get('/consumo-lote', getConsumoPorLote);

// Verificar stock bajo
router.get('/verificar-stock', verificarStock);

// Obtener un inventario por ID
router.get('/:id', getById);

// Obtener movimientos de un inventario
router.get('/:id/movimientos', getMovimientos);

// Crear inventario
router.post('/', create);

// Actualizar inventario
router.put('/:id', update);

// Eliminar inventario (soft delete)
router.delete('/:id', deleteInventario);

// Registrar entrada (compra)
router.post('/:id/entrada', registrarEntrada);

// Registrar salida (consumo)
router.post('/:id/salida', registrarSalida);

module.exports = router;
