/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - RUTAS DE ANALÍTICA GLOBAL (panel de administración)
 * ═══════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();
const { obtenerResumen } = require('../controllers/analyticsController');
const { verificarToken, requireRole } = require('../middleware/auth');

router.use(verificarToken, requireRole('superadmin'));

router.get('/resumen', obtenerResumen);

module.exports = router;
