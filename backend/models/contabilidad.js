const mongoose = require('mongoose');

const contabilidadSchema = new mongoose.Schema({
  lote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lote'
  },
  tipo: {
    type: String,
    enum: ['ingreso', 'gasto'],
    required: true
  },
  categoria: {
    type: String,
    enum: ['alimento', 'agua', 'medicamento', 'vacuna', 'compra_cerdos', 'venta_cerdos', 'mano_obra', 'transporte', 'otro'],
    required: true
  },
  descripcion: {
    type: String,
    default: ''
  },
  cantidad: {
    type: Number,
    default: 1
  },
  unidad: {
    type: String,
    default: 'unidad'
  },
  precio_unitario: {
    type: Number,
    required: true
  },
  total: {
    type: Number
  },
  fecha: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// ═══════════════════════════════════════════════════════════════════════
// MIDDLEWARE: Calcular total antes de guardar
// ═══════════════════════════════════════════════════════════════════════
contabilidadSchema.pre('save', async function() {
  // Aseguramos que cantidad tenga un valor para evitar NaN (Not a Number)
  const cant = this.cantidad || 1;
  const precio = this.precio_unitario || 0;
  
  this.total = cant * precio;
  
  // Eliminamos next() y usamos async
});

module.exports = mongoose.model('Contabilidad', contabilidadSchema);