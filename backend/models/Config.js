const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
  granja_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm' },
  umbral_temp_max: { type: Number, default: 32 },
  umbral_temp_min: { type: Number, default: 18 },
  umbral_humedad_max: { type: Number, default: 85 },
  alerta_activa: { type: Boolean, default: true },
  bomba_automatica: { type: Boolean, default: true },
  telefono_alerta: String,
  email_alerta: String
}, { timestamps: true });

module.exports = mongoose.model('Config', configSchema);