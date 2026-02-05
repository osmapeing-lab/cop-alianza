const Pesaje = require('../models/pesaje');
const Lote = require('../models/lote');

// Obtener todos los pesajes
exports.getPesajes = async (req, res) => {
  try {
    const pesajes = await Pesaje.find()
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
    const pesajes = await Pesaje.find({ lote: req.params.loteId })
      .sort({ createdAt: -1 });
    res.json(pesajes);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// Crear pesaje (la actualización del lote ahora es AUTOMÁTICA en el modelo)
exports.createPesaje = async (req, res) => {
  try {
    const pesaje = new Pesaje(req.body);
    await pesaje.save();
    // ✅ El middleware del modelo ya actualiza el lote automáticamente
    
    res.status(201).json(pesaje);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

// Eliminar pesaje
exports.deletePesaje = async (req, res) => {
  try {
    const pesaje = await Pesaje.findById(req.params.id);
    if (!pesaje) {
      return res.status(404).json({ mensaje: 'Pesaje no encontrado' });
    }
    
    // ✅ Usar deleteOne() para que se ejecute el middleware post('deleteOne')
    await pesaje.deleteOne();
    
    res.json({ mensaje: 'Pesaje eliminado' });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// Estadísticas de pesajes
exports.getEstadisticasPesajes = async (req, res) => {
  try {
    const pesajes = await Pesaje.find().sort({ createdAt: -1 });

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