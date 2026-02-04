/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - MODELO COSTO (Contabilidad Profesional)
 * ═══════════════════════════════════════════════════════════════════════
 */

const mongoose = require('mongoose');

const costoSchema = new mongoose.Schema({
  // Clasificación contable
  tipo_costo: {
    type: String,
    enum: ['directo', 'indirecto', 'fijo', 'variable'],
    required: true
  },
  
  categoria: {
    type: String,
    enum: [
      // Costos Directos
      'alimento_concentrado',
      'alimento_suplemento',
      'medicamentos',
      'vacunas',
      'vitaminas',
      'desparasitantes',
      'compra_lechones',
      'compra_cerdos',
      'inseminacion',
      'mano_obra_directa',
      
      // Costos Indirectos
      'agua',
      'electricidad',
      'gas',
      'transporte',
      'mantenimiento_equipos',
      'mantenimiento_instalaciones',
      'limpieza_desinfeccion',
      'mano_obra_indirecta',
      
      // Costos Fijos
      'arriendo',
      'seguros',
      'depreciacion',
      'administracion',
      'contabilidad',
      'impuestos',
      
      // Otros
      'otro'
    ],
    required: true
  },
  
  subcategoria: {
    type: String,
    default: ''
  },
  
  descripcion: {
    type: String,
    required: true
  },
  
  // Montos
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
  
  // Impuestos
  iva: {
    type: Number,
    default: 0
  },
  
  total_con_iva: {
    type: Number
  },
  
  // Fechas
  fecha: {
    type: Date,
    default: Date.now
  },
  
  periodo: {
    mes: { type: Number },
    año: { type: Number }
  },
  
  // Relaciones
  lote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lote'
  },
  
  granja: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm'
  },
  
  // Proveedor
  proveedor: {
    nombre: { type: String },
    nit: { type: String },
    telefono: { type: String }
  },
  
  // Factura/Soporte
  numero_factura: {
    type: String
  },
  
  soporte_url: {
    type: String
  },
  
  // Estado
  estado: {
    type: String,
    enum: ['registrado', 'pagado', 'anulado'],
    default: 'registrado'
  },
  
  metodo_pago: {
    type: String,
    enum: ['efectivo', 'transferencia', 'credito', 'nequi', 'daviplata', 'otro'],
    default: 'efectivo'
  },
  
  // Registro
  registrado_por: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  notas: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Calcular totales
costoSchema.pre('save', function(next) {
  this.total = this.cantidad * this.precio_unitario;
  this.total_con_iva = this.total + (this.total * (this.iva / 100));
  
  // Asignar periodo automáticamente
  const fecha = this.fecha || new Date();
  this.periodo = {
    mes: fecha.getMonth() + 1,
    año: fecha.getFullYear()
  };
  
  next();
});

// Índices
costoSchema.index({ fecha: -1 });
costoSchema.index({ tipo_costo: 1, categoria: 1 });
costoSchema.index({ 'periodo.mes': 1, 'periodo.año': 1 });
costoSchema.index({ lote: 1 });

module.exports = mongoose.model('Costo', costoSchema);