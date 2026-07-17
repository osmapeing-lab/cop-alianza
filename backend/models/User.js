const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  usuario: { type: String, required: true, unique: true },
  correo: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  rol: { type: String, default: 'cliente', enum: ['superadmin', 'jefa' , 'cliente'] },
  // Plan de suscripción de la app móvil: 'corral' (básico: temperatura +
  // alertas básicas + ración diaria, con anuncios, 1 dispositivo), 'granja'
  // (+ inventario, gráficas, alertas personalizadas, reportes, 3
  // dispositivos), 'alianza' (todo + BI + usuarios secundarios, 5
  // dispositivos), 'empresas' (multi-granja, 10 dispositivos), 'corporativo'
  // (institucional: informes de mercado porcícola reales vía DANE SIPSA +
  // cantidad de dispositivos a la medida, ver `limite_dispositivos_custom`
  // abajo). No reemplaza a `rol` (que sigue rigiendo permisos en la web) —
  // son dimensiones independientes. Default 'corral' para cuentas nuevas
  // (el registro público también lo fuerza en `register`); los usuarios
  // previos a este campo quedaron en 'corral' por el mismo default.
  plan: { type: String, enum: ['corral', 'granja', 'alianza', 'empresas', 'corporativo'], default: 'corral' },
  // Límite de dispositivos simultáneos fijado a mano por un superadmin,
  // para cualquier plan (pensado sobre todo para 'corporativo', que se
  // vende por contrato y no tiene un número fijo propio) — ver
  // userController.actualizarLimiteDispositivos. `null` hasta que un
  // administrador lo configure; mientras tanto se usa el valor fijo del
  // plan (o el default de 'corporativo' si aplica).
  limite_dispositivos_custom: { type: Number, min: 1, default: null },
  granja_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm' },
  // Permisos de una cuenta restringida "extensión" de la granja (ej. un
  // empleado que solo debe poder operar bombas o registrar pesajes) — sin
  // setear (undefined/[]) significa acceso completo según su `rol`. Ver
  // middleware/auth.js `requirePermiso`. Genérico y reutilizable por
  // cualquier granja, no atado a personas específicas.
  permisos: { type: [String], enum: ['bombas', 'alertas', 'pesajes'], default: undefined },
  activo: { type: Boolean, default: true },
  ultimo_acceso: Date,
  reset_token_hash: { type: String, select: false },
  reset_token_expira: { type: Date, select: false }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);