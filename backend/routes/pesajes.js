const express = require('express');
const router = express.Router();
const {
  getPesajes,
  getPesajesPorLote,
  createPesaje,
  deletePesaje,
  getEstadisticasPesajes
} = require('../controllers/pesajeController');

router.get('/', getPesajes);
router.get('/estadisticas', getEstadisticasPesajes);
router.get('/lote/:loteId', getPesajesPorLote);
router.post('/', createPesaje);
router.delete('/:id', deletePesaje);

module.exports = router;