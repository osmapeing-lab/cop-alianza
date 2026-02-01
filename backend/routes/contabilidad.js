const express = require('express');
const router = express.Router();
const {
  getContabilidad,
  getContabilidadPorLote,
  createContabilidad,
  updateContabilidad,
  deleteContabilidad,
  getResumenContable
} = require('../controllers/LaContabilidadController');

router.get('/', getContabilidad);
router.get('/resumen', getResumenContable);
router.get('/lote/:loteId', getContabilidadPorLote);
router.post('/', createContabilidad);
router.put('/:id', updateContabilidad);
router.delete('/:id', deleteContabilidad);

module.exports = router;