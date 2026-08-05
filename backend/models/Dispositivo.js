const mongoose = require('mongoose');

/*
 * Registro de qué granja es dueña de cada ESP32 físico. El hardware no
 * manda un token (no hay sesión de usuario en un sensor), así que en vez
 * de eso manda un `sensor_id` propio en cada request — este modelo liga
 * ese `sensor_id` a una granja para que espController pueda decidir dónde
 * guardar cada lectura y a quién mostrársela (ver
 * espController.resolverGranjaDispositivo). Al instalar un ESP32 nuevo en
 * una granja (Alianza/Empresas con sensores cotizados), se registra aquí
 * con un `sensor_id` único para esa granja.
 */
const dispositivoSchema = new mongoose.Schema({
  sensor_id: { type: String, required: true, unique: true, trim: true },
  tipo: {
    type: String,
    required: true,
    enum: ['temperatura', 'flujo_agua', 'bascula', 'bomba']
  },
  granja: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true, index: true },
  descripcion: { type: String, default: '' },
  activo: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Dispositivo', dispositivoSchema);
