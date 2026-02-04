/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - MODELO INVENTARIO DE CERDOS
 * ═══════════════════════════════════════════════════════════════════════
 */

const mongoose = require('mongoose');

const inventarioSchema = new mongoose.Schema({
  // Identificación
  codigo: {
    type: String,
    required: true,
    unique: true
  },
  
  // Clasificación
  tipo: {
    type: String,
    enum: ['lechon', 'levante', 'engorde', 'cerda_gestante', 'cerda_lactante', 'cerda_vacia', 'reproductor'],
    required: true
  },
  
  sexo: {
    type: String,
    enum: ['macho', 'hembra'],
    required: true
  },
  
  raza: {
    type: String,
    default: 'Criollo'
  },
  
  // Fechas
  fecha_nacimiento: {
    type: Date
  },
  
  fecha_ingreso: {
    type: Date,
    default: Date.now
  },
  
  edad_dias: {
    type: Number
  },
  
  // Peso
  peso_actual: {
    type: Number,
    default: 0
  },
  
  peso_ingreso: {
    type: Number
  },
  
  historial_peso: [{
    peso: Number,
    fecha: { type: Date, default: Date.now }
  }],
  
  // Ubicación
  lote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lote'
  },
  
  corral: {
    type: String
  },
  
  granja: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm'
  },
  
  // Salud
  estado_salud: {
    type: String,
    enum: ['sano', 'enfermo', 'tratamiento', 'cuarentena', 'recuperado'],
    default: 'sano'
  },
  
  vacunas: [{
    nombre: String,
    fecha: Date,
    proxima_dosis: Date,
    aplicado_por: String
  }],
  
  tratamientos: [{
    medicamento: String,
    dosis: String,
    fecha_inicio: Date,
    fecha_fin: Date,
    motivo: String
  }],
  
  // Reproducción (para cerdas)
  info_reproductiva: {
    numero_partos: { type: Number, default: 0 },
    ultimo_parto: Date,
    lechones_ultimo_parto: Number,
    fecha_servicio: Date,
    fecha_parto_estimada: Date,
    en_gestacion: { type: Boolean, default: false }
  },
  
  // Estado
  estado: {
    type: String,
    enum: ['activo', 'vendido', 'muerto', 'descartado'],
    default: 'activo'
  },
  
  // Si fue vendido
  venta: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Venta'
  },
  
  fecha_salida: {
    type: Date
  },
  
  motivo_salida: {
    type: String
  },
  
  // Costos acumulados
  costo_acumulado: {
    type: Number,
    default: 0
  },
  
  // Origen
  origen: {
    type: String,
    enum: ['nacido_granja', 'comprado', 'donado'],
    default: 'nacido_granja'
  },
  
  madre: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventario'
  },
  
  padre: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventario'
  },
  
  notas: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Calcular edad automáticamente
inventarioSchema.pre('save', function(next) {
  if (this.fecha_nacimiento) {
    const hoy = new Date();
    const diffTime = Math.abs(hoy - this.fecha_nacimiento);
    this.edad_dias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  next();
});

// Generar código automático
inventarioSchema.pre('save', async function(next) {
  if (!this.codigo) {
    const count = await mongoose.model('Inventario').countDocuments();
    const prefijo = this.sexo === 'macho' ? 'M' : 'H';
    this.codigo = `${prefijo}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Índices
inventarioSchema.index({ tipo: 1, estado: 1 });
inventarioSchema.index({ lote: 1 });
inventarioSchema.index({ codigo: 1 });

module.exports = mongoose.model('Inventario', inventarioSchema);