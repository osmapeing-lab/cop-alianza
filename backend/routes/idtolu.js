const express = require('express');
const router = express.Router();
const { 
  getUltimaLectura, 
  forzarActualizacion, 
  recibirDatos,
  verificarConexion 
} = require('../controllers/idtoluController');

router.get('/lectura', getUltimaLectura);
router.get('/conexion', verificarConexion);
router.post('/actualizar', forzarActualizacion);
router.post('/datos', recibirDatos);

module.exports = router;