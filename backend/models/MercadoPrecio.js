const mongoose = require('mongoose');

// Precios reales de mercado (mayoristas) obtenidos del web service público
// del DANE (SIPSA — ver utils/sipsaService.js), ya promediados a nivel
// nacional por corte/semana (la respuesta cruda trae un registro por cada
// una de ~30 centrales de abasto, demasiado granular para esta app). El
// backend refresca esta colección cuando el caché se vence (ver
// mercadoController.obtenerHistorialPorcino).
// Exclusivo del plan 'corporativo' (informes de mercado porcícola).
const mercadoPrecioSchema = new mongoose.Schema({
  producto: { type: String, required: true }, // p.ej. "Carne de cerdo en canal"
  fuente: { type: String, required: true }, // descripción del promedio, p.ej. "Promedio nacional (28 centrales de abasto)"
  periodoTipo: { type: String, enum: ['semanal', 'mensual'], required: true },
  periodoInicio: { type: Date, required: true },
  promedioKg: { type: Number, required: true },
  minimoKg: Number,
  maximoKg: Number
}, { timestamps: true });

// Una sola fila por corte/semana (ya no por central de abasto).
mercadoPrecioSchema.index(
  { producto: 1, periodoTipo: 1, periodoInicio: 1 },
  { unique: true }
);

module.exports = mongoose.model('MercadoPrecio', mercadoPrecioSchema);
