const express = require('express');
const router = express.Router();
const {
  getPesajes,
  getPesajesPorLote,
  createPesaje,
  deletePesaje,
  getEstadisticasPesajes,
  insertarPesajesHistoricos
} = require('../controllers/pesajeController');

router.get('/', getPesajes);
router.get('/estadisticas', getEstadisticasPesajes);
router.get('/lote/:loteId', getPesajesPorLote);
router.post('/', createPesaje);
router.post('/historicos', insertarPesajesHistoricos);
router.delete('/:id', deletePesaje);

module.exports = router;