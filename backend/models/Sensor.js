const mongoose = require('mongoose');

const sensorSchema = new mongoose.Schema({
  codigo_sensor: {
    type: String,
    required: true,
    unique: true
  },
  tipo: {
    type: String,
    required: true,
    enum: ['temperatura', 'humedad', 'nivel', 'flujo', 'peso']
  },
  ubicacion: {
    type: String,
    required: true
  },
  estado: {
    type: String,
    default: 'activo',
    enum: ['activo', 'inactivo', 'mantenimiento']
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Sensor', sensorSchema);