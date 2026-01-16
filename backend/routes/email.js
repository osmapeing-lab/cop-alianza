const express = require('express');
const router = express.Router();
const { enviarReporte } = require('../controllers/emailController');

router.post('/reporte', enviarReporte);

module.exports = router;