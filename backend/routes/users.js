/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - RUTAS DE USUARIOS
 * ═══════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();

const {
  register,
  login,
  getMe,
  getAllUsers,
  toggleUser,
  deleteUser
} = require('../controllers/userController');

const { verificarToken } = require('../middleware/auth');

// ──────────────────────────────────────────────────────────────────────
// RUTAS PÚBLICAS
// ──────────────────────────────────────────────────────────────────────

// Registrar usuario
router.post('/register', register);

// Login
router.post('/login', login);

// ──────────────────────────────────────────────────────────────────────
// RUTAS PROTEGIDAS
// ──────────────────────────────────────────────────────────────────────

// Obtener usuario autenticado
router.get('/me', verificarToken, getMe);

// Obtener todos los usuarios
router.get('/', verificarToken, getAllUsers);

// Activar / desactivar usuario
router.put('/:id/toggle', verificarToken, toggleUser);

// Eliminar usuario
router.delete('/:id', verificarToken, deleteUser);

module.exports = router;
