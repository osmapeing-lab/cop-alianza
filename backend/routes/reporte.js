const express = require('express');
const router  = express.Router();
const {
  generarReporteExcel,
  enviarReportePorEmail,
  testEmail,
  obtenerResumen
} = require('../controllers/reporteController');

router.get('/excel',      generarReporteExcel);
router.get('/resumen',    obtenerResumen);
router.post('/email',     enviarReportePorEmail);
router.get('/test-email', testEmail);

module.exports = router;
