const Farm = require('../models/Farm');

exports.getAllFarms = async (req, res) => {
  try {
    const farms = await Farm.find();
    res.json(farms);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

exports.createFarm = async (req, res) => {
  try {
    const farm = new Farm(req.body);
    await farm.save();
    res.status(201).json(farm);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

exports.updateFarm = async (req, res) => {
  try {
    const farm = await Farm.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(farm);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

exports.toggleFarm = async (req, res) => {
  try {
    const farm = await Farm.findById(req.params.id);
    farm.activo = !farm.activo;
    await farm.save();
    res.json(farm);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

exports.deleteFarm = async (req, res) => {
  try {
    await Farm.findByIdAndDelete(req.params.id);
    res.json({ mensaje: 'Granja eliminada' });
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};
