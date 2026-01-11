const express = require('express');
const router = express.Router();
const { getHistorial, cerrarSesion } = require('../controllers/sessionController');

router.get('/', getHistorial);
router.put('/:id/logout', cerrarSesion);

module.exports = router;