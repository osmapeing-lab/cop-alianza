const Sensor = require('../models/Sensor');
const Reading = require('../models/Reading');

exports.getAllSensors = async (req, res) => {
  try {
    const sensors = await Sensor.find();
    res.json(sensors);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

exports.createSensor = async (req, res) => {
  try {
    const sensor = new Sensor(req.body);
    await sensor.save();
    res.status(201).json(sensor);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

exports.getReadings = async (req, res) => {
  try {
    const readings = await Reading.find().sort({ fecha: -1 }).limit(100);
    res.json(readings);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

exports.createReading = async (req, res) => {
  try {
    const reading = new Reading(req.body);
    await reading.save();
    res.status(201).json(reading);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};