const express = require('express');
const router = express.Router();
const { generarReporteExcel, obtenerResumen } = require('../controllers/reporteController');

router.get('/excel', generarReporteExcel);
router.get('/resumen', obtenerResumen);

module.exports = router;