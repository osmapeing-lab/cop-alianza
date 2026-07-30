/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - RUTAS DE DATOS CROSS-GRANJA (plan Corporativo)
 * Solo lectura, para cuentas "comprador de datos" sin granja propia — ver
 * userController.crearCuentaCorporativa. Reutiliza directamente las mismas
 * consultas que ya usa el panel de administración de superadmin
 * (farmController.getAllFarms / getFarmDetail), sin duplicar lógica.
 * ═══════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();

const { getAllFarms, getFarmDetail } = require('../controllers/farmController');
const { verificarToken } = require('../middleware/auth');

function requireCorporativo(req, res, next) {
  if (req.user.plan !== 'corporativo' && req.user.rol !== 'superadmin') {
    return res.status(403).json({
      mensaje: 'Acceso exclusivo de cuentas de datos (plan Corporativo).',
      codigo: 'PLAN_INSUFICIENTE'
    });
  }
  next();
}

router.use(verificarToken, requireCorporativo);

router.get('/granjas', getAllFarms);
router.get('/granjas/:id', getFarmDetail);

module.exports = router;
