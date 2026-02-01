const Weighing = require('../models/Weighing');
const Lote = require('../models/lote');

// Obtener todos los pesajes
exports.getPesajes = async (req, res) => {
  try {
    const pesajes = await Weighing.find()
      .populate('lote', 'nombre')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(pesajes);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// Obtener pesajes por lote
exports.getPesajesPorLote = async (req, res) => {
  try {
    const pesajes = await Weighing.find({ lote: req.params.loteId })
      .sort({ createdAt: -1 });
    res.json(pesajes);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// Crear pesaje y actualizar lote
exports.createPesaje = async (req, res) => {
  try {
    const pesaje = new Weighing(req.body);
    await pesaje.save();

    // Actualizar peso promedio del lote
    if (pesaje.lote) {
      const pesajesLote = await Weighing.find({ lote: pesaje.lote });
      const totalPeso = pesajesLote.reduce((sum, p) => sum + (p.peso_promedio || p.peso), 0);
      const pesoPromedio = totalPeso / pesajesLote.length;

      await Lote.findByIdAndUpdate(pesaje.lote, {
        peso_promedio_actual: Math.round(pesoPromedio * 100) / 100
      });
    }

    res.status(201).json(pesaje);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

// Eliminar pesaje
exports.deletePesaje = async (req, res) => {
  try {
    const pesaje = await Weighing.findByIdAndDelete(req.params.id);
    if (!pesaje) {
      return res.status(404).json({ mensaje: 'Pesaje no encontrado' });
    }
    res.json({ mensaje: 'Pesaje eliminado' });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// Estadísticas de pesajes
exports.getEstadisticasPesajes = async (req, res) => {
  try {
    const pesajes = await Weighing.find().sort({ createdAt: -1 });

    if (pesajes.length === 0) {
      return res.json({
        total_pesajes: 0,
        peso_promedio_general: 0,
        peso_maximo: 0,
        peso_minimo: 0
      });
    }

    const pesos = pesajes.map(p => p.peso_promedio || p.peso);
    const suma = pesos.reduce((a, b) => a + b, 0);

    res.json({
      total_pesajes: pesajes.length,
      peso_promedio_general: Math.round((suma / pesos.length) * 100) / 100,
      peso_maximo: Math.max(...pesos),
      peso_minimo: Math.min(...pesos),
      ultimo_pesaje: pesajes[0]
    });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};