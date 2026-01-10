const express = require('express');
const router = express.Router();
const { getAllSensors, createSensor, getReadings, createReading } = require('../controllers/sensorController');

router.get('/', getAllSensors);
router.post('/', createSensor);
router.get('/readings', getReadings);
router.post('/readings', createReading);

module.exports = router;