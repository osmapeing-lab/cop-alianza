const mongoose = require('mongoose');

const waterConsumptionSchema = new mongoose.Schema({
  granja_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm' },
  fecha: { type: Date, default: Date.now },
  litros: { type: Number, default: 0 },
  tipo: { type: String, enum: ['lectura', 'diario', 'mensual'], default: 'lectura' }
}, { timestamps: true });

module.exports = mongoose.model('WaterConsumption', waterConsumptionSchema);