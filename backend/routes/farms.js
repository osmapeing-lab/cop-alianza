/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - RUTAS DE ADMINISTRACIÓN DE GRANJAS (superadmin)
 * ═══════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();
const {
  getAllFarms,
  getFarmDetail,
  createFarm,
  updateFarm,
  updateFarmPlan,
  toggleFarm,
  deleteFarm,
  crearUsuarioGranja
} = require('../controllers/farmController');
const { verificarToken, requireRole } = require('../middleware/auth');
const { registrarConsumoDiarioAutomatico } = require('../utils/alimentacionAutomatica');

router.use(verificarToken, requireRole('superadmin'));

router.get('/', getAllFarms);
router.get('/:id', getFarmDetail);
router.post('/', createFarm);
router.post('/:id/usuarios', crearUsuarioGranja);
router.put('/:id', updateFarm);
router.put('/:id/plan', updateFarmPlan);
router.put('/:id/toggle', toggleFarm);
router.delete('/:id', deleteFarm);

// Dispara a mano la tarea diaria de consumo automático de alimento (que
// normalmente corre sola a las 6 AM) — para probar sin esperar al cron.
router.post('/ejecutar-consumo-alimento', async (req, res) => {
  try {
    const registrados = await registrarConsumoDiarioAutomatico();
    res.json({ ok: true, mensaje: `Consumo registrado en ${registrados} lote(s).` });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
});

module.exports = router;
