/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - CONTROLADOR GESTIÓN DE LOTES (CORREGIDO)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * CORRECCIONES:
 * - registrarAlimentacion: delega la creación de Costo 100% al middleware
 *   pre('save') de AlimentacionLote. El controlador solo crea el registro
 *   y devuelve la respuesta.
 * - NUEVO: registrarGastoSemanal → registra un gasto manual en el lote
 *   y crea su Costo correspondiente para que aparezca en finanzas.
 * - NUEVO: getGastosSemanales → devuelve gastos del lote con total.
 * - NUEVO: eliminarGastoSemanal → elimina un gasto por su _id.
 * ═══════════════════════════════════════════════════════════════════════
 */

const Lote           = require('../models/lote');
const Weighing       = require('../models/pesaje');
const Contabilidad   = require('../models/contabilidad');
const AlimentacionLote = require('../models/AlimentacionLote');
const Costo          = require('../models/Costo');

// ═══════════════════════════════════════════════════════════════════════
// CRUD BÁSICO DE LOTES
// ═══════════════════════════════════════════════════════════════════════

exports.getLotes = async (req, res) => {
  try {
    const lotes = await Lote.find().sort({ createdAt: -1 });
    res.json(lotes);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

exports.getLotesActivos = async (req, res) => {
  try {
    const lotes = await Lote.find({ activo: true }).sort({ createdAt: -1 });
    res.json(lotes);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

exports.getLote = async (req, res) => {
  try {
    const lote = await Lote.findById(req.params.id);
    if (!lote) {
      return res.status(404).json({ mensaje: 'Lote no encontrado' });
    }
    res.json(lote.toObject({ virtuals: true }));
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

exports.createLote = async (req, res) => {
  try {
    const lote = new Lote(req.body);
    await lote.save();
    res.status(201).json(lote.toObject({ virtuals: true }));
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

exports.updateLote = async (req, res) => {
  try {
    const lote = await Lote.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!lote) {
      return res.status(404).json({ mensaje: 'Lote no encontrado' });
    }
    res.json(lote.toObject({ virtuals: true }));
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

exports.deleteLote = async (req, res) => {
  try {
    const lote = await Lote.findByIdAndDelete(req.params.id);
    if (!lote) {
      return res.status(404).json({ mensaje: 'Lote no encontrado' });
    }
    await AlimentacionLote.deleteMany({ lote: req.params.id });
    res.json({ mensaje: 'Lote eliminado' });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

exports.finalizarLote = async (req, res) => {
  try {
    const lote = await Lote.findById(req.params.id);
    if (!lote) {
      return res.status(404).json({ mensaje: 'Lote no encontrado' });
    }
    await lote.finalizar();
    res.json(lote.toObject({ virtuals: true }));
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ALIMENTACIÓN
// ═══════════════════════════════════════════════════════════════════════

/*
 * registrarAlimentacion — CORREGIDO
 *
 * El modelo AlimentacionLote.js tiene un middleware pre('save') que:
 *   1. Valida que el lote exista y esté activo (lanza error si no)
 *   2. Crea el Costo automáticamente
 *   3. Actualiza alimento_total_kg y costo_alimento_total en el Lote
 *
 * El controlador solo necesita construir y guardar el documento.
 * Si el middleware falla (lote inactivo, lote no encontrado, etc.),
 * el save lanzará una excepción que capturamos aquí.
 */
exports.registrarAlimentacion = async (req, res) => {
  try {
    const { lote, tipo_alimento, cantidad_kg, precio_kg, notas } = req.body;

    if (!lote || !cantidad_kg || !precio_kg) {
      return res.status(400).json({ mensaje: 'lote, cantidad_kg y precio_kg son requeridos' });
    }

    const alimentacion = new AlimentacionLote({
      lote,
      tipo_alimento: tipo_alimento || 'engorde',
      cantidad_kg,
      precio_kg,
      notas,
      registrado_por: req.user?._id
    });

    // El middleware pre('save') crea el Costo y actualiza el Lote.
    // Si hay un problema (lote inactivo, etc.) lanzará un error aquí.
    await alimentacion.save();

    await alimentacion.populate('lote', 'nombre');

    res.status(201).json({
      mensaje: 'Alimentación registrada y costo creado automáticamente',
      alimentacion,
      costo_ref: alimentacion.costo_ref,
      total: alimentacion.total
    });
  } catch (error) {
    console.error('[LOTES] Error registrando alimentación:', error);
    res.status(400).json({ mensaje: error.message });
  }
};

exports.getAlimentacionLote = async (req, res) => {
  try {
    const limite = parseInt(req.query.limite) || 30;
    const alimentacion = await AlimentacionLote.find({ lote: req.params.id })
      .sort({ fecha: -1 })
      .limit(limite)
      .lean();
    res.json(alimentacion);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

exports.eliminarAlimentacion = async (req, res) => {
  try {
    const alimentacion = await AlimentacionLote.findByIdAndDelete(req.params.alimentacionId);
    if (!alimentacion) {
      return res.status(404).json({ mensaje: 'Registro de alimentación no encontrado' });
    }
    res.json({ mensaje: 'Alimentación eliminada y costo asociado también' });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// GASTOS SEMANALES MANUALES — NUEVO
// ═══════════════════════════════════════════════════════════════════════

/*
 * registrarGastoSemanal
 * POST /api/lotes/:id/gasto-semanal
 *
 * Registra un gasto manual en el lote (campo gastos_semanales) y crea
 * su Costo correspondiente para que aparezca en el módulo de finanzas.
 */
exports.registrarGastoSemanal = async (req, res) => {
  try {
    const { descripcion, monto, categoria } = req.body;

    if (!monto || monto <= 0) {
      return res.status(400).json({ mensaje: 'monto es requerido y debe ser mayor a 0' });
    }

    const lote = await Lote.findById(req.params.id);
    if (!lote) {
      return res.status(404).json({ mensaje: 'Lote no encontrado' });
    }

    if (!lote.activo) {
      return res.status(400).json({ mensaje: 'No se pueden registrar gastos en un lote finalizado' });
    }

    // Calcular semana ISO del año
    const ahora = new Date();
    const inicioAno = new Date(ahora.getFullYear(), 0, 1);
    const dias = Math.floor((ahora - inicioAno) / (24 * 60 * 60 * 1000));
    const semana = Math.ceil((dias + 1) / 7);

    // Agregar gasto semanal al lote
    lote.gastos_semanales.push({
      semana,
      ano: ahora.getFullYear(),
      descripcion: descripcion || 'Gasto semanal',
      monto,
      categoria: categoria || 'otro',
      fecha: ahora,
      registrado_por: req.user?._id
    });

    // Recalcular total de gastos
    lote.total_gastos = lote.gastos_semanales.reduce((sum, g) => sum + (g.monto || 0), 0);

    await lote.save();

    // Crear Costo para que aparezca en el módulo de finanzas
    const categoriaCosto = categoria === 'alimento'    ? 'alimento_concentrado'
                         : categoria === 'medicamento' ? 'medicamentos'
                         : 'otro';

    const costo = new Costo({
      tipo_costo:      'directo',
      categoria:       categoriaCosto,
      descripcion:     descripcion || `Gasto semanal semana ${semana} - ${lote.nombre}`,
      cantidad:        1,
      unidad:          'unidad',
      precio_unitario: monto,
      total:           monto,
      lote:            req.params.id,
      fecha:           ahora,
      estado:          'registrado',
      metodo_pago:     'efectivo'
    });

    await costo.save();

    const gastoCreado = lote.gastos_semanales[lote.gastos_semanales.length - 1];

    res.status(201).json({
      mensaje: 'Gasto semanal registrado correctamente',
      gasto:        gastoCreado,
      total_gastos: lote.total_gastos,
      costo_ref:    costo._id
    });
  } catch (error) {
    console.error('[LOTES] Error registrando gasto semanal:', error);
    res.status(400).json({ mensaje: error.message });
  }
};

/*
 * getGastosSemanales
 * GET /api/lotes/:id/gastos-semanales
 */
exports.getGastosSemanales = async (req, res) => {
  try {
    const lote = await Lote.findById(req.params.id)
      .populate('gastos_semanales.registrado_por', 'usuario');

    if (!lote) {
      return res.status(404).json({ mensaje: 'Lote no encontrado' });
    }

    const gastos = [...lote.gastos_semanales].sort(
      (a, b) => new Date(b.fecha) - new Date(a.fecha)
    );

    res.json({
      total_gastos: lote.total_gastos || 0,
      gastos
    });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

/*
 * eliminarGastoSemanal
 * DELETE /api/lotes/:id/gasto-semanal/:gastoId
 */
exports.eliminarGastoSemanal = async (req, res) => {
  try {
    const lote = await Lote.findById(req.params.id);
    if (!lote) {
      return res.status(404).json({ mensaje: 'Lote no encontrado' });
    }

    const idx = lote.gastos_semanales.findIndex(
      g => g._id.toString() === req.params.gastoId
    );

    if (idx === -1) {
      return res.status(404).json({ mensaje: 'Gasto no encontrado' });
    }

    lote.gastos_semanales.splice(idx, 1);
    lote.total_gastos = lote.gastos_semanales.reduce((sum, g) => sum + (g.monto || 0), 0);

    await lote.save();

    res.json({ mensaje: 'Gasto eliminado', total_gastos: lote.total_gastos });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// RESUMEN Y ESTADÍSTICAS
// ═══════════════════════════════════════════════════════════════════════

exports.getResumenLote = async (req, res) => {
  try {
    const lote = await Lote.findById(req.params.id);
    if (!lote) {
      return res.status(404).json({ mensaje: 'Lote no encontrado' });
    }

    const pesajes      = await Weighing.find({ lote: req.params.id }).sort({ createdAt: -1 });
    const contabilidad = await Contabilidad.find({ lote: req.params.id }).sort({ fecha: -1 });
    const alimentacion = await AlimentacionLote.find({ lote: req.params.id })
      .sort({ fecha: -1 }).limit(10);

    const gastos   = contabilidad.filter(c => c.tipo === 'gasto');
    const ingresos = contabilidad.filter(c => c.tipo === 'ingreso');
    const totalGastos   = gastos.reduce((sum, g)   => sum + (g.total || 0), 0);
    const totalIngresos = ingresos.reduce((sum, i) => sum + (i.total || 0), 0);

    const ultimoPesaje = pesajes.length > 0 ? pesajes[0] : null;
    const loteObj = lote.toObject({ virtuals: true });

    res.json({
      lote: loteObj,
      pesajes,
      contabilidad,
      alimentacion,
      resumen: {
        total_pesajes:        pesajes.length,
        peso_promedio_actual: ultimoPesaje ? ultimoPesaje.peso_promedio : lote.peso_promedio_actual,
        total_gastos:         totalGastos,
        total_ingresos:       totalIngresos,
        ganancia:             totalIngresos - totalGastos,
        edad_dias:            loteObj.edad_dias,
        peso_total:           loteObj.peso_total,
        ganancia_peso:        loteObj.ganancia_peso,
        conversion_alimenticia: loteObj.conversion_alimenticia,
        costo_por_cerdo:      loteObj.costo_por_cerdo,
        costo_por_kg_ganancia: loteObj.costo_por_kg_ganancia,
        gastos_semanales_total: lote.total_gastos || 0
      }
    });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// GRÁFICAS
// ═══════════════════════════════════════════════════════════════════════

exports.getGraficaPeso = async (req, res) => {
  try {
    const dias = parseInt(req.query.dias) || 60;
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - dias);

    const pesajes = await Weighing.find({
      lote: req.params.id,
      createdAt: { $gte: fechaLimite }
    }).sort({ createdAt: 1 }).select('peso peso_promedio createdAt').lean();

    const datos = pesajes.map(p => ({
      fecha:         p.createdAt.toISOString().split('T')[0],
      peso_promedio: p.peso_promedio || p.peso,
      peso_total:    p.peso
    }));

    res.json(datos);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

exports.getGraficaAlimentacion = async (req, res) => {
  try {
    const dias  = parseInt(req.query.dias) || 30;
    const datos = await AlimentacionLote.getAlimentacionDiaria(req.params.id, dias);

    res.json(datos.map(d => ({ fecha: d._id, kg: d.kg, costo: d.costo })));
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

exports.getGraficaEvolucion = async (req, res) => {
  try {
    const dias = parseInt(req.query.dias) || 60;
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - dias);

    const pesajes = await Weighing.find({
      lote: req.params.id,
      createdAt: { $gte: fechaLimite }
    }).sort({ createdAt: 1 }).lean();

    const alimentacion = await AlimentacionLote.getAlimentacionDiaria(req.params.id, dias);

    const alimentacionMap = {};
    alimentacion.forEach(a => { alimentacionMap[a._id] = a; });

    const fechas = new Set();
    pesajes.forEach(p    => fechas.add(p.createdAt.toISOString().split('T')[0]));
    alimentacion.forEach(a => fechas.add(a._id));

    const datosOrdenados = Array.from(fechas).sort().map(fecha => {
      const pesaje  = pesajes.find(p => p.createdAt.toISOString().split('T')[0] === fecha);
      const alimento = alimentacionMap[fecha];
      return {
        fecha,
        peso_promedio:   pesaje?.peso_promedio || pesaje?.peso || null,
        alimento_kg:     alimento?.kg   || 0,
        alimento_costo:  alimento?.costo || 0
      };
    });

    res.json(datosOrdenados);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};