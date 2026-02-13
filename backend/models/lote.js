/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - MODELO LOTE (MEJORADO)
 * ═══════════════════════════════════════════════════════════════════════
 */

const mongoose = require('mongoose');

const loteSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  
  cantidad_cerdos: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // EDAD DEL LOTE
  // ═══════════════════════════════════════════════════════════════════
  fecha_nacimiento: {
    type: Date,
    default: null
  },
  
  edad_dias_manual: {
    type: Number,
    default: null,
    min: 0
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // FECHAS
  // ═══════════════════════════════════════════════════════════════════
  fecha_inicio: {
    type: Date,
    default: Date.now
  },
  
  fecha_finalizacion: {
    type: Date
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // ESTADO Y ETAPA
  // ═══════════════════════════════════════════════════════════════════
  estado: {
    type: String,
    enum: ['engorde', 'destete', 'gestacion', 'lactancia', 'levante', 'finalizado'],
    default: 'engorde',
    index: true
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // PESOS
  // ═══════════════════════════════════════════════════════════════════
  peso_promedio_actual: {
    type: Number,
    default: 0,
    min: 0
  },
  
  peso_inicial_promedio: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // UBICACIÓN
  // ═══════════════════════════════════════════════════════════════════
  corral: {
    type: String,
    default: '',
    trim: true
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // ALIMENTACIÓN ACUMULADA (se actualiza desde AlimentacionLote)
  // ═══════════════════════════════════════════════════════════════════
  alimento_total_kg: {
    type: Number,
    default: 0,
    min: 0
  },
  
  costo_alimento_total: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // RELACIONES
  // ═══════════════════════════════════════════════════════════════════
  granja: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm'
  },
  
  // ═══════════════════════════════════════════════════════════════════
  // ESTADO
  // ═══════════════════════════════════════════════════════════════════
  activo: {
    type: Boolean,
    default: true,
    index: true
  },
  
  notas: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  collection: 'lotes',
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ═══════════════════════════════════════════════════════════════════════
// VIRTUALS (campos calculados, no se guardan en BD)
// ═══════════════════════════════════════════════════════════════════════

// Edad en días
loteSchema.virtual('edad_dias').get(function() {
  // Si hay edad manual, usarla
  if (this.edad_dias_manual !== null && this.edad_dias_manual !== undefined) {
    // Sumar días desde que se ingresó el lote
    const diasDesdeInicio = Math.floor((Date.now() - this.fecha_inicio) / (1000 * 60 * 60 * 24));
    return this.edad_dias_manual + diasDesdeInicio;
  }
  
  // Si hay fecha de nacimiento, calcular
  if (this.fecha_nacimiento) {
    return Math.floor((Date.now() - this.fecha_nacimiento) / (1000 * 60 * 60 * 24));
  }
  
  // Si no hay ninguno, calcular desde fecha_inicio
  return Math.floor((Date.now() - this.fecha_inicio) / (1000 * 60 * 60 * 24));
});

// Peso total del lote
loteSchema.virtual('peso_total').get(function() {
  return (this.cantidad_cerdos || 0) * (this.peso_promedio_actual || 0);
});

// Ganancia de peso promedio
loteSchema.virtual('ganancia_peso').get(function() {
  return (this.peso_promedio_actual || 0) - (this.peso_inicial_promedio || 0);
});

// Ganancia de peso total del lote
loteSchema.virtual('ganancia_peso_total').get(function() {
  return this.ganancia_peso * (this.cantidad_cerdos || 0);
});

// Conversión alimenticia (kg alimento / kg ganancia)
loteSchema.virtual('conversion_alimenticia').get(function() {
  const gananciaTotal = this.ganancia_peso_total;
  if (gananciaTotal <= 0 || this.alimento_total_kg <= 0) return 0;
  return (this.alimento_total_kg / gananciaTotal).toFixed(2);
});

// Costo por cerdo
loteSchema.virtual('costo_por_cerdo').get(function() {
  if (this.cantidad_cerdos <= 0) return 0;
  return Math.round(this.costo_alimento_total / this.cantidad_cerdos);
});

// Costo por kg de ganancia
loteSchema.virtual('costo_por_kg_ganancia').get(function() {
  const gananciaTotal = this.ganancia_peso_total;
  if (gananciaTotal <= 0) return 0;
  return Math.round(this.costo_alimento_total / gananciaTotal);
});

// ═══════════════════════════════════════════════════════════════════════
// MÉTODOS DE INSTANCIA
// ═══════════════════════════════════════════════════════════════════════

// Calcular ganancia de peso
loteSchema.methods.getGanancia = function() {
  return (this.peso_promedio_actual || 0) - (this.peso_inicial_promedio || 0);
};

// Finalizar lote
loteSchema.methods.finalizar = async function() {
  this.activo = false;
  this.estado = 'finalizado';
  this.fecha_finalizacion = new Date();
  await this.save();
  return this;
};

// Actualizar alimentación acumulada
loteSchema.methods.actualizarAlimentacion = async function(kg, costo) {
  this.alimento_total_kg = (this.alimento_total_kg || 0) + kg;
  this.costo_alimento_total = (this.costo_alimento_total || 0) + costo;
  await this.save();
  return this;
};

// ═══════════════════════════════════════════════════════════════════════
// MÉTODOS ESTÁTICOS
// ═══════════════════════════════════════════════════════════════════════

// Obtener lotes activos
loteSchema.statics.getActivos = function() {
  return this.find({ activo: true }).sort({ createdAt: -1 });
};

// ═══════════════════════════════════════════════════════════════════════
// ÍNDICES
// ═══════════════════════════════════════════════════════════════════════
loteSchema.index({ activo: 1, estado: 1 });
loteSchema.index({ granja: 1, activo: 1 });
loteSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Lote', loteSchema);