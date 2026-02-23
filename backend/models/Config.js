const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
  granja_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm'
  },
  umbral_temp_max: {
    type: Number,
    default: 37
  },
  umbral_temp_critico: {
    type: Number,
    default: 40
  },
  umbral_temp_min: {
    type: Number,
    default: 18
  },
  umbral_humedad_max: {
    type: Number,
    default: 85
  },
  alerta_activa: {
    type: Boolean,
    default: true
  },
  bomba_automatica: {
    type: Boolean,
    default: true
  },
  telefono_alerta: String,
  email_alerta: String,
  precio_agua_litro: {
    type: Number,
    default: 5
  },
  precio_alimento_kg: {
    type: Number,
    default: 2500
  },
  precio_venta_kg: {
    type: Number,
    default: 8000
  },
  reporte_automatico: {
    type: String,
    enum: ['diario', 'semanal', 'quincenal', 'mensual', 'desactivado'],
    default: 'quincenal'
  },
  // Configuración de bombas
  limite_consumo_bomba_1: {
    type: Number,
    default: 600,
    description: 'Límite de consumo diario en litros para bomba 1'
  },
  hora_inicio_bombas: {
    type: Number,
    default: 6,
    description: 'Hora de inicio permitido para bombas (0-23)'
  },
  hora_fin_bombas: {
    type: Number,
    default: 12,
    description: 'Hora de fin permitido para bombas (0-23)'
  },
  // Configuración de inventario de alimento
  alerta_stock_alimento: {
    type: Boolean,
    default: true,
    description: 'Activar alertas cuando el inventario de alimento esté bajo'
  },
  stock_minimo_alimento_bultos: {
    type: Number,
    default: 5,
    description: 'Cantidad mínima de bultos para alertar'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Config', configSchema);