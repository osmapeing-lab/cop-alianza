const Lote = require('../models/lote');
const Weighing = require('../models/Weighing');
const Contabilidad = require('../models/contabilidad');

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

// Obtener un lote por ID
exports.getLote = async (req, res) => {
  try {
    const lote = await Lote.findById(req.params.id);
    if (!lote) {
      return res.status(404).json({ mensaje: 'Lote no encontrado' });
    }
    res.json(lote);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// Crear lote
exports.createLote = async (req, res) => {
  try {
    const lote = new Lote(req.body);
    await lote.save();
    res.status(201).json(lote);
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
    res.json(lote);
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
    res.json({ mensaje: 'Lote eliminado' });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// Finalizar lote
exports.finalizarLote = async (req, res) => {
  try {
    const lote = await Lote.findByIdAndUpdate(
      req.params.id,
      { estado: 'finalizado', activo: false },
      { new: true }
    );
    res.json(lote);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

// Obtener resumen del lote (pesajes, contabilidad)
exports.getResumenLote = async (req, res) => {
  try {
    const lote = await Lote.findById(req.params.id);
    if (!lote) {
      return res.status(404).json({ mensaje: 'Lote no encontrado' });
    }

    const pesajes = await Weighing.find({ lote: req.params.id }).sort({ createdAt: -1 });
    const contabilidad = await Contabilidad.find({ lote: req.params.id }).sort({ fecha: -1 });

    const gastos = contabilidad.filter(c => c.tipo === 'gasto');
    const ingresos = contabilidad.filter(c => c.tipo === 'ingreso');

    const totalGastos = gastos.reduce((sum, g) => sum + g.total, 0);
    const totalIngresos = ingresos.reduce((sum, i) => sum + i.total, 0);
    const ganancia = totalIngresos - totalGastos;

    const ultimoPesaje = pesajes.length > 0 ? pesajes[0] : null;

    res.json({
      lote,
      pesajes,
      contabilidad,
      resumen: {
        total_pesajes: pesajes.length,
        peso_promedio_actual: ultimoPesaje ? ultimoPesaje.peso_promedio : 0,
        total_gastos: totalGastos,
        total_ingresos: totalIngresos,
        ganancia
      }
    });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};