const express = require('express');
const router = express.Router();
const { enviarReporteEmail, descargarReporte } = require('../controllers/reporteController');

router.post('/enviar', enviarReporteEmail);
router.post('/descargar', descargarReporte);

module.exports = router;