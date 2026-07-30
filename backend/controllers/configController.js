const Config = require('../models/Config');
const Motorbomb = require('../models/Motorbomb');

const ETAPAS_ALIMENTACION_VALIDAS = [
  'Calostro y leche materna', 'Leche materna', 'Preiniciador + leche', 'Preiniciador',
  'Iniciador', 'Levante', 'Engorde', 'Finalización'
];

exports.getConfig = async (req, res) => {
  try {
    let config = await Config.findOne();
    if (!config) {
      config = await Config.create({});
    }
    res.json(config);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

exports.updateConfig = async (req, res) => {
  try {
    if (req.body.precios_alimento_por_etapa !== undefined) {
      const lista = req.body.precios_alimento_por_etapa;
      if (!Array.isArray(lista)) {
        return res.status(400).json({ mensaje: 'precios_alimento_por_etapa debe ser una lista de {etapa, precio_por_kg}.' });
      }
      for (const fila of lista) {
        if (!ETAPAS_ALIMENTACION_VALIDAS.includes(fila.etapa)) {
          return res.status(400).json({
            mensaje: `Etapa inválida: "${fila.etapa}". Debe ser una de: ${ETAPAS_ALIMENTACION_VALIDAS.join(', ')}`
          });
        }
        if (typeof fila.precio_por_kg !== 'number' || fila.precio_por_kg < 0) {
          return res.status(400).json({ mensaje: `Precio inválido para la etapa "${fila.etapa}".` });
        }
      }
    }

    const config = await Config.findOneAndUpdate({}, req.body, { new: true, upsert: true, runValidators: true });
    res.json(config);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

exports.verificarUmbrales = async (temperatura, humedad) => {
  const config = await Config.findOne();
  if (!config || !config.alerta_activa) return null;

  const sensacionTermica = calcularSensacionTermica(temperatura, humedad);
  let alerta = null;

  if (temperatura > config.umbral_temp_max) {
    alerta = { tipo: 'temperatura_alta', mensaje: `Temperatura ${temperatura}°C supera umbral ${config.umbral_temp_max}°C` };
    // Activación de bombas se maneja con ciclo automático en espController
  }

  if (temperatura < config.umbral_temp_min) {
    alerta = { tipo: 'temperatura_baja', mensaje: `Temperatura ${temperatura}°C bajo umbral ${config.umbral_temp_min}°C` };
  }

  return { alerta, sensacionTermica, config };
};

function calcularSensacionTermica(temp, humedad) {
  if (temp >= 27) {
    const st = -8.784 + 1.611 * temp + 2.338 * humedad - 0.146 * temp * humedad;
    return Math.round(st * 10) / 10;
  }
  return temp;
}

exports.calcularSensacionTermica = calcularSensacionTermica;