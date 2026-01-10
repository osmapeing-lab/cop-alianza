const Motorbomb = require('../models/Motorbomb');

exports.getAllMotorbombs = async (req, res) => {
  try {
    const motorbombs = await Motorbomb.find();
    res.json(motorbombs);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

exports.toggleMotorbomb = async (req, res) => {
  try {
    const { id } = req.params;
    const motorbomb = await Motorbomb.findById(id);
    motorbomb.estado = !motorbomb.estado;
    motorbomb.fecha_cambio = Date.now();
    await motorbomb.save();
    res.json(motorbomb);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

exports.createMotorbomb = async (req, res) => {
  try {
    const motorbomb = new Motorbomb(req.body);
    await motorbomb.save();
    res.status(201).json(motorbomb);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};