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

contabilidadSchema.pre('save', function(next) {
  this.total = this.cantidad * this.precio_unitario;
  next();
});

module.exports = mongoose.model('Contabilidad', contabilidadSchema);