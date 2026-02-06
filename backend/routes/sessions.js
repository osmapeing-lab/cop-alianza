const express = require('express');
const router = express.Router();
const { getHistorial, cerrarSesion } = require('../controllers/sessionController');
const { verificarToken } = require('../middleware/auth'); // Importante para saber qué sesión cerrar

// Obtener historial (puedes dejarlo así)
router.get('/', verificarToken, getHistorial);

// CAMBIO AQUÍ: Ruta genérica de logout que no pide ID en la URL
// El ID se saca del token del usuario logueado
router.post('/logout', verificarToken, cerrarSesion);

module.exports = router;