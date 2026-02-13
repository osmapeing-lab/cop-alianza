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
  getAlimentacionLote,
  eliminarAlimentacion,
  getGraficaPeso,
  getGraficaAlimentacion,
  getGraficaEvolucion
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
router.get('/:id/alimentacion', getAlimentacionLote);
router.delete('/alimentacion/:alimentacionId', eliminarAlimentacion);

// ═══════════════════════════════════════════════════════════════════════
// RUTAS GRÁFICAS
// ═══════════════════════════════════════════════════════════════════════
router.get('/:id/grafica/peso', getGraficaPeso);
router.get('/:id/grafica/alimentacion', getGraficaAlimentacion);
router.get('/:id/grafica/evolucion', getGraficaEvolucion);

module.exports = router;