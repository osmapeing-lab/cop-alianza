const express = require('express');
const router = express.Router();
const { recibirPeso, recibirRiego, obtenerEstadoBombas } = require('../controllers/espController');

// Endpoints para ESP32
router.post('/peso', recibirPeso);
router.post('/riego', recibirRiego);
router.get('/bombas', obtenerEstadoBombas);

module.exports = router;