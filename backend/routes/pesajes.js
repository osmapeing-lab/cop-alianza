const express = require('express');
const router = express.Router();
const {
  getPesajes,
  getPesajesPorLote,
  createPesaje,
  deletePesaje,
  getEstadisticasPesajes,
  insertarPesajesHistoricos,
  actualizarFechaPesaje
} = require('../controllers/pesajeController');
const { verificarToken, requirePermiso } = require('../middleware/auth');

router.use(verificarToken);
router.use(requirePermiso('pesajes'));

router.get('/', getPesajes);
router.get('/estadisticas', getEstadisticasPesajes);
router.get('/lote/:loteId', getPesajesPorLote);
router.post('/', createPesaje);
router.post('/historicos', insertarPesajesHistoricos);
router.put('/:id/fecha', actualizarFechaPesaje);
router.delete('/:id', deletePesaje);

module.exports = router;
