const WaterConsumption = require('../models/WaterConsumption');

exports.registrarConsumo = async (req, res) => {
  try {
    const consumo = new WaterConsumption(req.body);
    await consumo.save();
    res.status(201).json(consumo);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

exports.getConsumoDiario = async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const consumos = await WaterConsumption.find({
      fecha: { $gte: hoy },
      tipo: 'lectura'
    });
    
    const totalLitros = consumos.reduce((sum, c) => sum + c.litros, 0);
    res.json({ fecha: hoy, litros_total: totalLitros, lecturas: consumos.length });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

exports.getConsumoMensual = async (req, res) => {
  try {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    
    const consumos = await WaterConsumption.find({
      fecha: { $gte: inicioMes },
      tipo: 'lectura'
    });
    
    const totalLitros = consumos.reduce((sum, c) => sum + c.litros, 0);
    res.json({ mes: inicioMes.getMonth() + 1, litros_total: totalLitros, lecturas: consumos.length });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

exports.getHistorial = async (req, res) => {
  try {
    const consumos = await WaterConsumption.find().sort({ fecha: -1 }).limit(100);
    res.json(consumos);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};