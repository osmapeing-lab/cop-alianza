const express = require('express');
const router = express.Router();
const { 
  recibirPeso, 
  obtenerUltimoPeso,
  obtenerHistorialPeso,
  recibirRiego, 
  obtenerEstadoBombas 
} = require('../controllers/espController');

// Peso
router.post('/peso', recibirPeso);
router.get('/peso', obtenerUltimoPeso);
router.get('/peso/historial', obtenerHistorialPeso);

// Riego
router.post('/riego', recibirRiego);

// Bombas
router.get('/bombas', obtenerEstadoBombas);

module.exports = router;