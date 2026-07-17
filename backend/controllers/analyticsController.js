/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - CONTROLADOR DE ANALÍTICA DE USO
 * ═══════════════════════════════════════════════════════════════════════
 */

const AnalyticsEvent = require('../models/AnalyticsEvent');
const Farm = require('../models/Farm');
const User = require('../models/User');

const TIPOS_VALIDOS = ['screen_view', 'feature_used', 'plan_limit_hit'];

// ═══════════════════════════════════════════════════════════════════════
// REGISTRAR EVENTOS (batch)
// POST /api/analytics/events
// ═══════════════════════════════════════════════════════════════════════
exports.registrarEventos = async (req, res) => {
  try {
    const { eventos } = req.body;
    if (!Array.isArray(eventos) || eventos.length === 0) {
      return res.status(400).json({ mensaje: 'Se requiere un arreglo "eventos" no vacío' });
    }

    // granja/usuario siempre se toman del token, nunca del body — evita que
    // un cliente inserte eventos a nombre de otra granja.
    const documentos = eventos
      .filter(e => e && TIPOS_VALIDOS.includes(e.tipo) && typeof e.nombre === 'string' && e.nombre.length > 0)
      .map(e => ({
        granja: req.user.granja_id,
        usuario: req.user.id,
        tipo: e.tipo,
        nombre: e.nombre,
        metadata: e.metadata || {},
        plataforma: 'mobile'
      }));

    if (documentos.length === 0) {
      return res.status(400).json({ mensaje: 'Ningún evento válido en el arreglo' });
    }

    await AnalyticsEvent.insertMany(documentos);
    res.status(201).json({ ok: true, insertados: documentos.length });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// RESUMEN GLOBAL (solo superadmin)
// GET /api/admin/analytics/resumen?dias=30
// ═══════════════════════════════════════════════════════════════════════
exports.obtenerResumen = async (req, res) => {
  try {
    const dias = parseInt(req.query.dias) || 30;
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

    const [topPantallas, topFunciones, rankingLimites] = await Promise.all([
      AnalyticsEvent.aggregate([
        { $match: { tipo: 'screen_view', fecha: { $gte: desde } } },
        { $group: { _id: '$nombre', total: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $limit: 15 }
      ]),
      AnalyticsEvent.aggregate([
        { $match: { tipo: 'feature_used', fecha: { $gte: desde } } },
        { $group: { _id: '$nombre', total: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $limit: 15 }
      ]),
      AnalyticsEvent.aggregate([
        { $match: { tipo: 'plan_limit_hit', fecha: { $gte: desde } } },
        { $group: { _id: '$granja', total: { $sum: 1 }, nombres: { $addToSet: '$nombre' } } },
        { $sort: { total: -1 } },
        { $limit: 20 }
      ])
    ]);

    // Enriquecer el ranking de límites con el nombre de la granja
    const granjaIds = rankingLimites.map(r => r._id).filter(Boolean);
    const granjas = await Farm.find({ _id: { $in: granjaIds } }).select('nombre');
    const nombreGranja = Object.fromEntries(granjas.map(g => [g._id.toString(), g.nombre]));
    const rankingConNombre = rankingLimites.map(r => ({
      granja: r._id,
      nombreGranja: r._id ? (nombreGranja[r._id.toString()] || 'Desconocida') : 'Sin granja',
      total: r.total,
      limites: r.nombres
    }));

    // Granjas activas vs inactivas según el último acceso de su(s) usuario(s)
    const [totalGranjas, activasRecientes] = await Promise.all([
      Farm.countDocuments(),
      User.distinct('granja_id', { ultimo_acceso: { $gte: desde } })
    ]);
    const granjasActivas = activasRecientes.filter(Boolean).length;

    res.json({
      periodo_dias: dias,
      pantallas_mas_usadas: topPantallas,
      funciones_mas_usadas: topFunciones,
      ranking_limites_plan: rankingConNombre,
      actividad: {
        total_granjas: totalGranjas,
        granjas_activas: granjasActivas,
        granjas_inactivas: totalGranjas - granjasActivas
      }
    });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};
