/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - MODELO INVENTARIO DE ALIMENTO
 * ═══════════════════════════════════════════════════════════════════════
 */

const mongoose = require('mongoose');

const inventarioAlimentoSchema = new mongoose.Schema({
  // Tipo de alimento
  nombre: {
    type: String,
    required: true,
    default: 'Concentrado'
  },
  
  tipo: {
    type: String,
    enum: ['inicio', 'crecimiento', 'engorde', 'gestacion', 'lactancia', 'universa'],
    default: 'universa'
  },
  
  // Inventario actual
  cantidad_bultos: {
    type: Number,
    default: 0,
    min: 0
  },
  
  peso_por_bulto_kg: {
    type: Number,
    default: 40,
    min: 0
  },
  
  // Stock mínimo para alerta
  stock_minimo_bultos: {
    type: Number,
    default: 5
  },
  
  // Precio por bulto
  precio_bulto: {
    type: Number,
    default: 0
  },
  
  // Movimientos
  movimientos: [{
    tipo: {
      type: String,
      enum: ['entrada', 'salida'],
      required: true
    },
    cantidad_bultos: {
      type: Number,
      required: true,
      min: 0
    },
    cantidad_kg: {
      type: Number,
      default: 0
    },
    precio_unitario: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 0
    },
    lote: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lote'
    },
    descripcion: {
      type: String,
      default: ''
    },
    fecha: {
      type: Date,
      default: Date.now
    },
    registrado_por: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  
  // Estado
  activo: {
    type: Boolean,
    default: true
  },
  
  observaciones: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Virtual para calcular total kg en inventario
inventarioAlimentoSchema.virtual('total_kg').get(function() {
  return (this.cantidad_bultos || 0) * (this.peso_por_bulto_kg || 40);
});

// Virtual para verificar si está bajo stock
inventarioAlimentoSchema.virtual('bajo_stock').get(function() {
  return (this.cantidad_bultos || 0) <= (this.stock_minimo_bultos || 5);
});

// Virtual para valor total del inventario
inventarioAlimentoSchema.virtual('valor_total').get(function() {
  return (this.cantidad_bultos || 0) * (this.precio_bulto || 0);
});

// Método para registrar entrada (compra)
inventarioAlimentoSchema.methods.registrarEntrada = async function(bultos, precioPorBulto, descripcion, userId) {
  const kg = bultos * this.peso_por_bulto_kg;
  const total = bultos * precioPorBulto;
  
  this.movimientos.push({
    tipo: 'entrada',
    cantidad_bultos: bultos,
    cantidad_kg: kg,
    precio_unitario: precioPorBulto,
    total: total,
    descripcion: descripcion || 'Compra de alimento',
    registrado_por: userId
  });
  
  this.cantidad_bultos += bultos;
  this.precio_bulto = precioPorBulto;
  
  await this.save();
  return this;
};

// Método para registrar salida (consumo por lote)
inventarioAlimentoSchema.methods.registrarSalida = async function(bultos, loteId, descripcion, userId) {
  if (bultos > this.cantidad_bultos) {
    throw new Error('Stock insuficiente');
  }
  
  const kg = bultos * this.peso_por_bulto_kg;
  const total = bultos * this.precio_bulto;
  
  this.movimientos.push({
    tipo: 'salida',
    cantidad_bultos: bultos,
    cantidad_kg: kg,
    precio_unitario: this.precio_bulto,
    total: total,
    lote: loteId,
    descripcion: descripcion || 'Consumo lote',
    registrado_por: userId
  });
  
  this.cantidad_bultos -= bultos;
  
  await this.save();
  return this;
};

// Método estático para obtener resumen
inventarioAlimentoSchema.statics.getResumen = async function() {
  const inventarios = await this.find({ activo: true });
  
  let totalBultos = 0;
  let totalKg = 0;
  let valorTotal = 0;
  let bajoStock = [];
  
  inventarios.forEach(inv => {
    totalBultos += inv.cantidad_bultos || 0;
    totalKg += (inv.cantidad_bultos || 0) * (inv.peso_por_bulto_kg || 40);
    valorTotal += (inv.cantidad_bultos || 0) * (inv.precio_bulto || 0);
    
    if (inv.bajo_stock) {
      bajoStock.push({
        nombre: inv.nombre,
        tipo: inv.tipo,
        cantidad: inv.cantidad_bultos,
        minimo: inv.stock_minimo_bultos
      });
    }
  });
  
  return {
    total_bultos: totalBultos,
    total_kg: totalKg,
    valor_total: valorTotal,
    cantidad_items: inventarios.length,
    bajo_stock: bajoStock
  };
};

module.exports = mongoose.model('InventarioAlimento', inventarioAlimentoSchema);
