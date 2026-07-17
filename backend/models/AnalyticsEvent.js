/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - EVENTOS DE ANALÍTICA DE USO (app móvil)
 * ═══════════════════════════════════════════════════════════════════════
 */

const mongoose = require('mongoose');

const analyticsEventSchema = new mongoose.Schema({
  granja: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm',
    index: true
  },
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  tipo: {
    type: String,
    enum: ['screen_view', 'feature_used', 'plan_limit_hit'],
    required: true
  },
  nombre: {
    type: String,
    required: true
  },
  metadata: {
    type: Object,
    default: {}
  },
  plataforma: {
    type: String,
    default: 'mobile'
  },
  fecha: {
    type: Date,
    default: Date.now,
    index: true
  }
});

analyticsEventSchema.index({ tipo: 1, nombre: 1, fecha: -1 });

module.exports = mongoose.model('AnalyticsEvent', analyticsEventSchema);
