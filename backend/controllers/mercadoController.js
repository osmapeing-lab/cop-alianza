/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - INFORMES DE MERCADO PORCÍCOLA (plan Corporativo)
 * ═══════════════════════════════════════════════════════════════════════
 */

const ExcelJS = require('exceljs');
const User = require('../models/User');
const MercadoPrecio = require('../models/MercadoPrecio');
const { obtenerPreciosCerdoSemanal } = require('../utils/sipsaService');

const CACHE_HORAS = 24;

// Ambos endpoints de este controlador son exclusivos del plan
// 'corporativo' — devuelve el usuario si tiene acceso, o `null` tras
// responder el 403/404 correspondiente.
async function requerirPlanCorporativo(req, res) {
  const user = await User.findById(req.user.id).select('plan');
  if (!user) {
    res.status(404).json({ mensaje: 'Usuario no encontrado' });
    return null;
  }
  if (user.plan !== 'corporativo') {
    res.status(403).json({
      mensaje: 'Los informes de mercado porcícola son exclusivos del plan Corporativo/Institucional.',
      codigo: 'PLAN_INSUFICIENTE'
    });
    return null;
  }
  return user;
}

// El web service del DANE puede tardar varios minutos (y a veces cortarse a
// medias) en responder ~20 MB de XML. Bloquear la respuesta HTTP hasta que
// termine sería una pésima experiencia, así que el refresco corre en
// segundo plano (fire-and-forget) — el usuario ve el caché actual de
// inmediato (vacío la primera vez) y la próxima consulta ya trae lo nuevo.
// `refrescando` evita lanzar el refresco dos veces en paralelo si llegan
// varias solicitudes mientras el anterior sigue en curso.
let refrescando = false;

async function refrescarEnSegundoPlano() {
  if (refrescando) return;
  const masReciente = await MercadoPrecio.findOne().sort({ createdAt: -1 });
  const vencido = !masReciente || (Date.now() - masReciente.createdAt.getTime()) > CACHE_HORAS * 60 * 60 * 1000;
  if (!vencido) return;

  refrescando = true;
  obtenerPreciosCerdoSemanal()
    .then(async (precios) => {
      if (precios.length === 0) return;
      // bulkWrite en una sola ida y vuelta a Mongo — con updateOne uno por
      // uno (cientos de filas por central de abasto antes de promediar) la
      // primera carga tardaba ~28 minutos.
      const operaciones = precios.map((p) => ({
        updateOne: {
          filter: { producto: p.producto, periodoTipo: 'semanal', periodoInicio: p.periodoInicio },
          update: { $set: p, $setOnInsert: { periodoTipo: 'semanal' } },
          upsert: true
        }
      }));
      await MercadoPrecio.bulkWrite(operaciones, { ordered: false });
    })
    .catch((e) => console.error('[MERCADO] Error refrescando SIPSA en segundo plano:', e.message))
    .finally(() => {
      refrescando = false;
    });
}

// GET /api/mercado/porcino — exclusivo del plan 'corporativo'.
exports.obtenerHistorialPorcino = async (req, res) => {
  try {
    if (!(await requerirPlanCorporativo(req, res))) return;

    refrescarEnSegundoPlano().catch(() => {});

    const historial = await MercadoPrecio.find({ periodoTipo: 'semanal' }).sort({ periodoInicio: 1 });
    res.json(historial);
  } catch (error) {
    console.error('Error en obtenerHistorialPorcino:', error);
    res.status(500).json({ mensaje: error.message });
  }
};

// GET /api/mercado/porcino/excel — informe descargable del histórico ya
// cacheado (no dispara un refresco a SIPSA, solo exporta lo que haya).
exports.descargarExcelPorcino = async (req, res) => {
  try {
    if (!(await requerirPlanCorporativo(req, res))) return;

    const historial = await MercadoPrecio.find({ periodoTipo: 'semanal' }).sort([
      ['producto', 1],
      ['periodoInicio', 1]
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'COO Alianzas - Mercado Porcícola (DANE/SIPSA)';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Precios Cerdo SIPSA');
    sheet.columns = [
      { header: 'Producto', key: 'producto', width: 34 },
      { header: 'Semana', key: 'semana', width: 14 },
      { header: 'Promedio/kg', key: 'promedio', width: 14 },
      { header: 'Mínimo/kg', key: 'minimo', width: 12 },
      { header: 'Máximo/kg', key: 'maximo', width: 12 },
      { header: 'Fuente', key: 'fuente', width: 40 }
    ];
    sheet.getRow(1).font = { bold: true };

    for (const p of historial) {
      sheet.addRow({
        producto: p.producto,
        semana: p.periodoInicio.toISOString().split('T')[0],
        promedio: p.promedioKg,
        minimo: p.minimoKg ?? '',
        maximo: p.maximoKg ?? '',
        fuente: p.fuente
      });
    }

    const fecha = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Mercado_Porcino_${fecha}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error en descargarExcelPorcino:', error);
    res.status(500).json({ mensaje: error.message });
  }
};
