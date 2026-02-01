const Contabilidad = require('../models/contabilidad');
const Lote = require('../models/lote');

// Obtener todos los registros
exports.getContabilidad = async (req, res) => {
  try {
    const registros = await Contabilidad.find()
      .populate('lote', 'nombre')
      .sort({ fecha: -1 });
    res.json(registros);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// Obtener por lote
exports.getContabilidadPorLote = async (req, res) => {
  try {
    const registros = await Contabilidad.find({ lote: req.params.loteId })
      .sort({ fecha: -1 });
    res.json(registros);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// Crear registro
exports.createContabilidad = async (req, res) => {
  try {
    const registro = new Contabilidad(req.body);
    await registro.save();
    res.status(201).json(registro);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

// Actualizar registro
exports.updateContabilidad = async (req, res) => {
  try {
    const registro = await Contabilidad.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!registro) {
      return res.status(404).json({ mensaje: 'Registro no encontrado' });
    }
    res.json(registro);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

// Eliminar registro
exports.deleteContabilidad = async (req, res) => {
  try {
    const registro = await Contabilidad.findByIdAndDelete(req.params.id);
    if (!registro) {
      return res.status(404).json({ mensaje: 'Registro no encontrado' });
    }
    res.json({ mensaje: 'Registro eliminado' });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// Resumen general
exports.getResumenContable = async (req, res) => {
  try {
    const registros = await Contabilidad.find();

    const gastos = registros.filter(r => r.tipo === 'gasto');
    const ingresos = registros.filter(r => r.tipo === 'ingreso');

    const totalGastos = gastos.reduce((sum, g) => sum + g.total, 0);
    const totalIngresos = ingresos.reduce((sum, i) => sum + i.total, 0);

    const gastosPorCategoria = {};
    gastos.forEach(g => {
      if (!gastosPorCategoria[g.categoria]) {
        gastosPorCategoria[g.categoria] = 0;
      }
      gastosPorCategoria[g.categoria] += g.total;
    });

    res.json({
      total_gastos: totalGastos,
      total_ingresos: totalIngresos,
      ganancia: totalIngresos - totalGastos,
      gastos_por_categoria: gastosPorCategoria,
      total_registros: registros.length
    });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};