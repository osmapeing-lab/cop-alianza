/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - MODELO VENTA
 * ═══════════════════════════════════════════════════════════════════════
 */

const mongoose = require('mongoose');

const ventaSchema = new mongoose.Schema({
  // Información del comprador
  comprador: {
    nombre: { type: String, required: true },
    documento: { type: String },
    telefono: { type: String },
    direccion: { type: String }
  },
  
  // Tipo de venta
  tipo_venta: {
    type: String,
    enum: ['en_pie', 'carne', 'lechon'],
    required: true
  },
  
  // Detalles de la venta
  cantidad: {
    type: Number,
    required: true,
    min: 1
  },
  
  peso_total_kg: {
    type: Number,
    required: true
  },
  
  precio_kg: {
    type: Number,
    required: true
  },
  
  subtotal: {
    type: Number
  },
  
  descuento: {
    type: Number,
    default: 0
  },
  
  total: {
    type: Number
  },
  
  // Estado del pago
  estado_pago: {
    type: String,
    enum: ['pendiente', 'parcial', 'pagado', 'cancelado'],
    default: 'pendiente'
  },
  
  monto_pagado: {
    type: Number,
    default: 0
  },
  
  saldo_pendiente: {
    type: Number
  },
  
  // Pagos parciales
  pagos: [{
    monto: Number,
    fecha: { type: Date, default: Date.now },
    metodo: { 
      type: String, 
      enum: ['efectivo', 'transferencia', 'nequi', 'daviplata', 'otro'],
      default: 'efectivo'
    },
    referencia: String,
    notas: String
  }],
  
  // Relaciones
  lote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lote'
  },
  
  granja: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm'
  },
  
  // Facturación
  numero_factura: {
    type: String,
    unique: true,
    sparse: true  // ← AGREGADO: Permite múltiples null sin conflicto
  },
  
  fecha_venta: {
    type: Date,
    default: Date.now
  },
  
  fecha_entrega: {
    type: Date
  },
  
  // Información adicional
  notas: {
    type: String,
    default: ''
  },
  
  // Para carne procesada
  detalles_carne: {
    tipo_corte: [String],
    incluye_visceras: { type: Boolean, default: false },
    empacado: { type: Boolean, default: false }
  },
  
  // Registro
  registrado_por: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  activa: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});
// ═══════════════════════════════════════════════════════════════════════
// MIDDLEWARE 1: Calcular totales antes de guardar
// ═══════════════════════════════════════════════════════════════════════
ventaSchema.pre('save', async function() {
  // Calcular subtotal
  this.subtotal = this.peso_total_kg * this.precio_kg;
  
  // Calcular total con descuento
  this.total = this.subtotal - (this.descuento || 0);
  
  // Calcular saldo pendiente
  this.saldo_pendiente = this.total - (this.monto_pagado || 0);
  
  // Actualizar estado de pago automáticamente
  if (this.monto_pagado >= this.total) {
    this.estado_pago = 'pagado';
    this.saldo_pendiente = 0;
  } else if (this.monto_pagado > 0) {
    this.estado_pago = 'parcial';
  } else {
    this.estado_pago = 'pendiente';
  }
  
  // Aquí ya NO va next()
});

// ═══════════════════════════════════════════════════════════════════════
// MIDDLEWARE 2: Generar número de factura automático
// ═══════════════════════════════════════════════════════════════════════
ventaSchema.pre('save', async function() {
  if (!this.numero_factura) {
    const count = await mongoose.model('Venta').countDocuments();
    const year = new Date().getFullYear();
    this.numero_factura = `COO-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  // Aquí tampoco va next()
});
// ═══════════════════════════════════════════════════════════════════════
// MÉTODO: Registrar pago parcial
// ═══════════════════════════════════════════════════════════════════════
ventaSchema.methods.registrarPago = async function(monto, metodo = 'efectivo', referencia = '', notas = '') {
  // Agregar pago al array
  this.pagos.push({
    monto,
    metodo,
    referencia,
    notas,
    fecha: new Date()
  });
  
  // Actualizar monto pagado
  this.monto_pagado += monto;
  
  // Guardar (los middlewares calcularán el resto automáticamente)
  await this.save();
  
  return this;
};

// ═══════════════════════════════════════════════════════════════════════
// ÍNDICES para optimizar consultas
// ═══════════════════════════════════════════════════════════════════════
ventaSchema.index({ fecha_venta: -1 });
ventaSchema.index({ tipo_venta: 1 });
ventaSchema.index({ estado_pago: 1 });
ventaSchema.index({ 'comprador.nombre': 'text' });
ventaSchema.index({ numero_factura: 1 });
ventaSchema.index({ activa: 1, fecha_venta: -1 });

module.exports = mongoose.model('Venta', ventaSchema);