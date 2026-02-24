const express = require('express');
const router  = express.Router();
const {
  generarReporteExcel,
  enviarReportePorEmail,
  obtenerResumen
} = require('../controllers/reporteController');

router.get('/excel',    generarReporteExcel);
router.get('/resumen',  obtenerResumen);
router.post('/email',   enviarReportePorEmail);

module.exports = router;
