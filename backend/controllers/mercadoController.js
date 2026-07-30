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

// Nivel de acceso al mercado según el plan de la cuenta:
//  - 'completo': ve el histórico real. Hoy exclusivo de las cuentas
//    'corporativo' (comprador de datos, sin granja propia — ver
//    userController.crearCuentaCorporativa), para quienes el mercado
//    completo es parte del mismo servicio de datos.
//  - 'preview': ve solo la tendencia (subiendo/bajando/estable), sin cifras
//    exactas — gancho de retención para el plan más básico de granja
//    (corral).
//  - 'bloqueado': sin acceso en absoluto (granja/alianza/empresas).
function resolverNivelMercado(plan) {
  if (plan === 'corporativo') return 'completo';
  if (plan === 'corral') return 'preview';
  return 'bloqueado';
}

// Devuelve el usuario y su nivel de acceso, o `null` tras responder el
// 403/404 correspondiente si el usuario no existe o está bloqueado.
async function resolverAccesoMercado(req, res) {
  const user = await User.findById(req.user.id).select('plan');
  if (!user) {
    res.status(404).json({ mensaje: 'Usuario no encontrado' });
    return null;
  }
  const nivel = resolverNivelMercado(user.plan);
  if (nivel === 'bloqueado') {
    res.status(403).json({
      mensaje: 'Los informes de mercado porcícola son exclusivos de los planes Corral y Corporativo/Institucional.',
      codigo: 'PLAN_INSUFICIENTE'
    });
    return null;
  }
  return { user, nivel };
}

// A partir del histórico completo (ordenado por periodoInicio ascendente),
// calcula la tendencia reciente por producto comparando las dos últimas
// lecturas — sin exponer las cifras exactas (eso es lo que se reserva
// para el nivel 'completo').
function calcularTendencias(historial) {
  const porProducto = new Map();
  for (const p of historial) {
    const lista = porProducto.get(p.producto) || [];
    lista.push(p);
    porProducto.set(p.producto, lista);
  }
  const tendencias = [];
  for (const [producto, lista] of porProducto) {
    const ultima = lista[lista.length - 1];
    const anterior = lista.length >= 2 ? lista[lista.length - 2] : null;
    let tendencia = 'estable';
    if (anterior) {
      if (ultima.promedioKg > anterior.promedioKg) tendencia = 'subiendo';
      else if (ultima.promedioKg < anterior.promedioKg) tendencia = 'bajando';
    }
    tendencias.push({ producto, periodoInicio: ultima.periodoInicio, tendencia });
  }
  return tendencias;
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

// GET /api/mercado/porcino — 'completo' (corporativo) ve el histórico
// real; 'preview' (corral) ve solo la tendencia, sin cifras exactas.
exports.obtenerHistorialPorcino = async (req, res) => {
  try {
    const acceso = await resolverAccesoMercado(req, res);
    if (!acceso) return;

    refrescarEnSegundoPlano().catch(() => {});

    const historial = await MercadoPrecio.find({ periodoTipo: 'semanal' }).sort({ periodoInicio: 1 });

    if (acceso.nivel === 'preview') {
      return res.json({
        nivel: 'preview',
        codigo: 'UPGRADE_DISPONIBLE',
        mensaje: 'Los precios exactos del mercado porcícola son parte de nuestro servicio de datos comerciales — contáctanos si te interesa.',
        tendencias: calcularTendencias(historial)
      });
    }

    res.json({ nivel: 'completo', historial });
  } catch (error) {
    console.error('Error en obtenerHistorialPorcino:', error);
    res.status(500).json({ mensaje: error.message });
  }
};

// GET /api/mercado/porcino/excel — informe descargable del histórico ya
// cacheado (no dispara un refresco a SIPSA, solo exporta lo que haya).
// Se mantiene exclusivo del nivel 'completo' — no tiene sentido exportar
// cifras exactas en una vista previa.
exports.descargarExcelPorcino = async (req, res) => {
  try {
    const acceso = await resolverAccesoMercado(req, res);
    if (!acceso) return;
    if (acceso.nivel !== 'completo') {
      return res.status(403).json({
        mensaje: 'La descarga del informe es exclusiva del plan Corporativo/Institucional.',
        codigo: 'PLAN_INSUFICIENTE'
      });
    }

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
