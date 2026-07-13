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
  deleteUser,
  cambiarPassword,
  actualizarPerfil,
  forgotPassword,
  resetPassword,
  actualizarPlan,
  actualizarLimiteDispositivos
} = require('../controllers/userController');

const { verificarToken } = require('../middleware/auth');

// ──────────────────────────────────────────────────────────────────────
// RUTAS PÚBLICAS
// ──────────────────────────────────────────────────────────────────────

// Registrar usuario
router.post('/register', register);

// Login
router.post('/login', login);

// Recuperar contraseña (nuevo, requerido por la app móvil)
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// ──────────────────────────────────────────────────────────────────────
// RUTAS PROTEGIDAS
// ──────────────────────────────────────────────────────────────────────

// Obtener usuario autenticado
router.get('/me', verificarToken, getMe);

// Obtener todos los usuarios
router.get('/', verificarToken, getAllUsers);

// Cambiar contraseña (antes de /:id para evitar conflicto)
router.put('/me/password', verificarToken, cambiarPassword);

// Actualizar perfil (antes de /:id para evitar conflicto)
router.put('/me/perfil', verificarToken, actualizarPerfil);

// Actualizar plan de suscripción (tras compra en Google Play Billing)
router.put('/me/plan', verificarToken, actualizarPlan);

// Configurar límite de dispositivos de cualquier cuenta (solo superadmin)
router.put('/:id/limite-dispositivos', verificarToken, actualizarLimiteDispositivos);

// Activar / desactivar usuario
router.put('/:id/toggle', verificarToken, toggleUser);

// Eliminar usuario
router.delete('/:id', verificarToken, deleteUser);

module.exports = router;
