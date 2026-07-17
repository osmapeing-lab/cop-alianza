/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - RUTAS DE ANALÍTICA (ingesta desde la app móvil)
 * ═══════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();
const { registrarEventos } = require('../controllers/analyticsController');
const { verificarToken } = require('../middleware/auth');

router.use(verificarToken);

router.post('/events', registrarEventos);

module.exports = router;
