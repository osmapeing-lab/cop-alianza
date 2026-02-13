/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - CONTROLADOR GESTIÓN DE LOTES (MEJORADO)
 * ═══════════════════════════════════════════════════════════════════════
 */

const Lote = require('../models/lote');
const Weighing = require('../models/pesaje');
const Contabilidad = require('../models/contabilidad');
const AlimentacionLote = require('../models/AlimentacionLote');

// ═══════════════════════════════════════════════════════════════════════
// CRUD BÁSICO DE LOTES
// ═══════════════════════════════════════════════════════════════════════

// Obtener todos los lotes
exports.getLotes = async (req, res) => {
  try {
    const lotes = await Lote.find().sort({ createdAt: -1 });
    res.json(lotes);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// Obtener lotes activos
exports.getLotesActivos = async (req, res) => {
  try {
    const lotes = await Lote.find({ activo: true }).sort({ createdAt: -1 });
    res.json(lotes);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// Obtener un lote por ID (con datos calculados)
exports.getLote = async (req, res) => {
  try {
    const lote = await Lote.findById(req.params.id);
    if (!lote) {
      return res.status(404).json({ mensaje: 'Lote no encontrado' });
    }
    
    // Convertir a objeto para incluir virtuals
    const loteObj = lote.toObject({ virtuals: true });
    
    res.json(loteObj);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// Crear lote
exports.createLote = async (req, res) => {
  try {
    const lote = new Lote(req.body);
    await lote.save();
    
    // Devolver con virtuals
    const loteObj = lote.toObject({ virtuals: true });
    res.status(201).json(loteObj);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

// Actualizar lote
exports.updateLote = async (req, res) => {
  try {
    const lote = await Lote.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!lote) {
      return res.status(404).json({ mensaje: 'Lote no encontrado' });
    }
    
    const loteObj = lote.toObject({ virtuals: true });
    res.json(loteObj);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

// Eliminar lote
exports.deleteLote = async (req, res) => {
  try {
    const lote = await Lote.findByIdAndDelete(req.params.id);
    if (!lote) {
      return res.status(404).json({ mensaje: 'Lote no encontrado' });
    }
    
    // Eliminar alimentación asociada
    await AlimentacionLote.deleteMany({ lote: req.params.id });
    
    res.json({ mensaje: 'Lote eliminado' });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// Finalizar lote
exports.finalizarLote = async (req, res) => {
  try {
    const lote = await Lote.findById(req.params.id);
    if (!lote) {
      return res.status(404).json({ mensaje: 'Lote no encontrado' });
    }
    
    await lote.finalizar();
    
    const loteObj = lote.toObject({ virtuals: true });
    res.json(loteObj);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ALIMENTACIÓN
// ═══════════════════════════════════════════════════════════════════════

// Registrar alimentación (sincroniza con Costos automáticamente)
exports.registrarAlimentacion = async (req, res) => {
  try {
    const { lote, tipo_alimento, cantidad_kg, precio_kg, notas } = req.body;
    
    // Verificar que el lote existe
    const loteExiste = await Lote.findById(lote);
    if (!loteExiste) {
      return res.status(404).json({ mensaje: 'Lote no encontrado' });
    }
    
    if (!loteExiste.activo) {
      return res.status(400).json({ mensaje: 'No se puede alimentar un lote finalizado' });
    }
    
    const alimentacion = new AlimentacionLote({
      lote,
      tipo_alimento: tipo_alimento || 'engorde',
      cantidad_kg,
      precio_kg,
      notas,
      registrado_por: req.user?._id
    });
    
    await alimentacion.save();
    
    // Poblar lote para respuesta
    await alimentacion.populate('lote', 'nombre');
    
    res.status(201).json({
      mensaje: 'Alimentación registrada y costo creado automáticamente',
      alimentacion,
      total: alimentacion.total
    });
  } catch (error) {
    console.error('[LOTES] Error registrando alimentación:', error);
    res.status(400).json({ mensaje: error.message });
  }
};

// Obtener historial de alimentación de un lote
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

// Eliminar registro de alimentación
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
// RESUMEN Y ESTADÍSTICAS
// ═══════════════════════════════════════════════════════════════════════

// Obtener resumen completo del lote
exports.getResumenLote = async (req, res) => {
  try {
    const lote = await Lote.findById(req.params.id);
    if (!lote) {
      return res.status(404).json({ mensaje: 'Lote no encontrado' });
    }
    
    // Obtener datos relacionados
    const pesajes = await Weighing.find({ lote: req.params.id }).sort({ createdAt: -1 });
    const contabilidad = await Contabilidad.find({ lote: req.params.id }).sort({ fecha: -1 });
    const alimentacion = await AlimentacionLote.find({ lote: req.params.id }).sort({ fecha: -1 }).limit(10);
    
    // Calcular totales contables
    const gastos = contabilidad.filter(c => c.tipo === 'gasto');
    const ingresos = contabilidad.filter(c => c.tipo === 'ingreso');
    const totalGastos = gastos.reduce((sum, g) => sum + (g.total || 0), 0);
    const totalIngresos = ingresos.reduce((sum, i) => sum + (i.total || 0), 0);
    const ganancia = totalIngresos - totalGastos;
    
    // Último pesaje
    const ultimoPesaje = pesajes.length > 0 ? pesajes[0] : null;
    
    // Convertir lote con virtuals
    const loteObj = lote.toObject({ virtuals: true });
    
    res.json({
      lote: loteObj,
      pesajes,
      contabilidad,
      alimentacion,
      resumen: {
        total_pesajes: pesajes.length,
        peso_promedio_actual: ultimoPesaje ? ultimoPesaje.peso_promedio : lote.peso_promedio_actual,
        total_gastos: totalGastos,
        total_ingresos: totalIngresos,
        ganancia,
        // Datos calculados del lote
        edad_dias: loteObj.edad_dias,
        peso_total: loteObj.peso_total,
        ganancia_peso: loteObj.ganancia_peso,
        conversion_alimenticia: loteObj.conversion_alimenticia,
        costo_por_cerdo: loteObj.costo_por_cerdo,
        costo_por_kg_ganancia: loteObj.costo_por_kg_ganancia
      }
    });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// GRÁFICAS
// ═══════════════════════════════════════════════════════════════════════

// Obtener datos para gráfica de evolución de peso
exports.getGraficaPeso = async (req, res) => {
  try {
    const dias = parseInt(req.query.dias) || 60;
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - dias);
    
    const pesajes = await Weighing.find({
      lote: req.params.id,
      createdAt: { $gte: fechaLimite }
    })
    .sort({ createdAt: 1 })
    .select('peso peso_promedio createdAt')
    .lean();
    
    const datos = pesajes.map(p => ({
      fecha: p.createdAt.toISOString().split('T')[0],
      peso_promedio: p.peso_promedio || p.peso,
      peso_total: p.peso
    }));
    
    res.json(datos);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// Obtener datos para gráfica de alimentación
exports.getGraficaAlimentacion = async (req, res) => {
  try {
    const dias = parseInt(req.query.dias) || 30;
    
    const datos = await AlimentacionLote.getAlimentacionDiaria(req.params.id, dias);
    
    // Formatear para gráfica
    const graficaData = datos.map(d => ({
      fecha: d._id,
      kg: d.kg,
      costo: d.costo
    }));
    
    res.json(graficaData);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// Obtener datos combinados para gráfica de evolución completa
exports.getGraficaEvolucion = async (req, res) => {
  try {
    const dias = parseInt(req.query.dias) || 60;
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - dias);
    
    // Obtener pesajes
    const pesajes = await Weighing.find({
      lote: req.params.id,
      createdAt: { $gte: fechaLimite }
    })
    .sort({ createdAt: 1 })
    .lean();
    
    // Obtener alimentación diaria
    const alimentacion = await AlimentacionLote.getAlimentacionDiaria(req.params.id, dias);
    
    // Crear mapa de alimentación por fecha
    const alimentacionMap = {};
    alimentacion.forEach(a => {
      alimentacionMap[a._id] = a;
    });
    
    // Combinar datos
    const fechas = new Set();
    pesajes.forEach(p => fechas.add(p.createdAt.toISOString().split('T')[0]));
    alimentacion.forEach(a => fechas.add(a._id));
    
    const datosOrdenados = Array.from(fechas).sort().map(fecha => {
      const pesaje = pesajes.find(p => p.createdAt.toISOString().split('T')[0] === fecha);
      const alimento = alimentacionMap[fecha];
      
      return {
        fecha,
        peso_promedio: pesaje?.peso_promedio || pesaje?.peso || null,
        alimento_kg: alimento?.kg || 0,
        alimento_costo: alimento?.costo || 0
      };
    });
    
    res.json(datosOrdenados);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};