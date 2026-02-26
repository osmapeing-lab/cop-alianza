/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - RUTAS DE LOTES (MEJORADO)
 * ═══════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();
const {
  getLotes,
  getLotesActivos,
  getLote,
  createLote,
  updateLote,
  deleteLote,
  finalizarLote,
  getResumenLote,
  registrarAlimentacion,
  registrarAlimentacionConInventario,
  registrarConsumoHistorico,
  getAlimentacionLote,
  eliminarAlimentacion,
  getGraficaPeso,
  getGraficaAlimentacion,
  getGraficaEvolucion,
  registrarGastoSemanal,
  getGastosSemanales,
  eliminarGastoSemanal
} = require('../controllers/gestionLotesController');

// ═══════════════════════════════════════════════════════════════════════
// RUTAS CRUD LOTES
// ═══════════════════════════════════════════════════════════════════════
router.get('/', getLotes);
router.get('/activos', getLotesActivos);
router.get('/:id', getLote);
router.get('/:id/resumen', getResumenLote);
router.post('/', createLote);
router.put('/:id', updateLote);
router.put('/:id/finalizar', finalizarLote);
router.delete('/:id', deleteLote);

// ═══════════════════════════════════════════════════════════════════════
// RUTAS ALIMENTACIÓN
// ═══════════════════════════════════════════════════════════════════════
router.post('/alimentacion', registrarAlimentacion);
router.post('/alimentacion-inventario', registrarAlimentacionConInventario);
router.post('/consumo-historico', registrarConsumoHistorico);   // superadmin: semanas pasadas sin inventario
router.get('/:id/alimentacion', getAlimentacionLote);
router.delete('/alimentacion/:alimentacionId', eliminarAlimentacion);

// ═══════════════════════════════════════════════════════════════════════
// RUTAS GRÁFICAS
// ═══════════════════════════════════════════════════════════════════════
router.get('/:id/grafica/peso', getGraficaPeso);
router.get('/:id/grafica/alimentacion', getGraficaAlimentacion);
router.get('/:id/grafica/evolucion', getGraficaEvolucion);

// ═══════════════════════════════════════════════════════════════════════
// RUTAS GASTOS SEMANALES
// ═══════════════════════════════════════════════════════════════════════
router.post('/:id/gasto-semanal', registrarGastoSemanal);
router.get('/:id/gastos-semanales', getGastosSemanales);
router.delete('/:id/gasto-semanal/:gastoId', eliminarGastoSemanal);

module.exports = router;