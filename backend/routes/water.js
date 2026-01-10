const express = require('express');
const router = express.Router();
const { registrarConsumo, getConsumoDiario, getConsumoMensual, getHistorial } = require('../controllers/waterController');

router.post('/', registrarConsumo);
router.get('/diario', getConsumoDiario);
router.get('/mensual', getConsumoMensual);
router.get('/historial', getHistorial);

module.exports = router;