const express = require('express');
const router = express.Router();
const { getAlertas, crearAlerta } = require('../controllers/alertController');
const { verificarToken, requirePermiso } = require('../middleware/auth');

router.get('/', verificarToken, requirePermiso('alertas'), getAlertas);
router.post('/', verificarToken, crearAlerta);

module.exports = router;
