/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - RUTAS DE MERCADO (informes de mercado porcícola, plan Corporativo)
 * ═══════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();

const { obtenerHistorialPorcino, descargarExcelPorcino } = require('../controllers/mercadoController');
const { verificarToken } = require('../middleware/auth');

router.get('/porcino', verificarToken, obtenerHistorialPorcino);
router.get('/porcino/excel', verificarToken, descargarExcelPorcino);

module.exports = router;
