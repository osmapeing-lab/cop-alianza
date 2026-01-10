const Alert = require('../models/Alert');

exports.getAllAlerts = async (req, res) => {
  try {
    const alerts = await Alert.find().sort({ fecha: -1 }).limit(50);
    res.json(alerts);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

exports.createAlert = async (req, res) => {
  try {
    const alert = new Alert(req.body);
    await alert.save();
    res.status(201).json(alert);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};