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
  getResumenLote
} = require('../controllers/gestionLotesController');
router.get('/', getLotes);
router.get('/activos', getLotesActivos);
router.get('/:id', getLote);
router.get('/:id/resumen', getResumenLote);
router.post('/', createLote);
router.put('/:id', updateLote);
router.put('/:id/finalizar', finalizarLote);
router.delete('/:id', deleteLote);

module.exports = router;

        //espacio para comit 