const express = require('express');
const router = express.Router();
const {
  getAllMotorbombs,
  toggleMotorbomb,
  createMotorbomb,
  updateMotorbomb,
  deleteMotorbomb,
  getMotorbombStatus
} = require('../controllers/motorbombController');
const { verificarToken, requirePermiso, requireAccesoCompleto } = require('../middleware/auth');

router.use(verificarToken);

// Lectura y toggle: accesible a cuentas completas o con permiso 'bombas'
router.get('/', requirePermiso('bombas'), getAllMotorbombs);
router.get('/status', requirePermiso('bombas'), getMotorbombStatus);
router.put('/:id/toggle', requirePermiso('bombas'), toggleMotorbomb);

// Gestión del hardware (crear/editar/eliminar): solo cuentas sin restricción
// de permisos (el dueño real de la granja) — nunca una cuenta restringida
// como Carlos, aunque tenga permiso 'bombas' para operar.
router.post('/', requireAccesoCompleto, createMotorbomb);
router.put('/:id', requireAccesoCompleto, updateMotorbomb);
router.delete('/:id', requireAccesoCompleto, deleteMotorbomb);

module.exports = router;
