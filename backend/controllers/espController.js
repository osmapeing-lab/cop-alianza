/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - ESP CONTROLLER (REFACTORIZADO - VERSIÓN BLINDADA)
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * CAMBIOS CRÍTICOS EN ESTA VERSIÓN:
 * 
 * 1. ✅ ATOMICIDAD GARANTIZADA:
 *    - recibirFlujo() usa {new: true} en findOneAndUpdate
 *    - Espera confirmación de MongoDB antes de emitir socket
 *    - Actualiza memoria solo con valores verificados
 * 
 * 2. ✅ ELIMINACIÓN DE RACE CONDITION:
 *    - Respaldo periódico (setInterval) ELIMINADO
 *    - Cada lectura se guarda inmediatamente en BD
 *    - No hay competencia entre escrituras
 * 
 * 3. ✅ FUENTE ÚNICA DE VERDAD:
 *    - MongoDB es la autoridad, memoria es caché
 *    - obtenerDatosFlujo() prioriza BD sobre memoria
 *    - Frontend siempre recibe datos verificados
 * 
 * 4. ✅ PROTECCIÓN CONTRA REINICIOS:
 *    - ESP32 reinicia → $max protege en BD
 *    - Servidor reinicia → recupera de BD
 *    - Frontend nunca ve valores "0" incorrectos
 * 
 * Endpoints:
 *   POST /api/esp/riego                      -> Temperatura/humedad porqueriza
 *   GET  /api/esp/porqueriza                 -> Obtener ultimos datos temp
 *   GET  /api/esp/porqueriza/historico       -> Historial 24 horas temperatura
 *   POST /api/esp/flujo                      -> Datos de flujo de agua
 *   GET  /api/esp/flujo                      -> Obtener ultimos datos flujo
 *   GET  /api/esp/flujo/historico            -> Historial 7 días agua
 *   PUT  /api/esp/flujo/corregir             -> Corrección manual consumo
 *   POST /api/esp/peso                       -> Guardar peso en BD
 *   POST /api/esp/peso/live                  -> Peso en tiempo real (NO guarda)
 *   GET  /api/esp/peso/actual                -> Obtener peso actual en memoria
 *   GET  /api/esp/pesos                      -> Historial de pesos
 *   GET  /api/esp/bombas                     -> Estado de bombas
 *   POST /api/esp/heartbeat                  -> Heartbeat dispositivos
 * 
 * ═══════════════════════════════════════════════════════════════════════
 */

const mongoose = require('mongoose');
const Reading = require('../models/Reading');
const Alert = require('../models/Alert');
const Motorbomb = require('../models/Motorbomb');
const Pesaje = require('../models/pesaje');
const Lote = require('../models/lote');
const WaterConsumption = require('../models/WaterConsumption');
const Config = require('../models/Config');
const Dispositivo = require('../models/Dispositivo');
const { evaluarTemperatura, notificarBomba } = require('../utils/notificationManager');
const { enviarWhatsApp } = require('../utils/whatsappService');
const { enviarPushAGranja } = require('../utils/pushService');

// ═══════════════════════════════════════════════════════════════════════
// A QUÉ GRANJA PERTENECE CADA ESP32
// ═══════════════════════════════════════════════════════════════════════
// El hardware no manda un token (no hay sesión de usuario en un sensor),
// así que en vez de eso identifica la granja por su `sensor_id` contra el
// registro `Dispositivo`. Todo el hardware físico instalado hasta ahora es
// de Granja Porcina COO-Alianzas y nunca mandó un `sensor_id` propio (usa
// los defaults fijos del firmware) — por eso esos defaults quedan como
// respaldo aquí para no perder datos de un sensor que aún no se registró
// explícitamente. Un ESP32 nuevo en otra granja (Alianza/Empresas con
// sensores cotizados) debe registrarse en `Dispositivo` con un `sensor_id`
// propio para esa granja.
const GRANJA_PRINCIPAL_ID = '696413ec1dff9fe7d6baea75'; // Granja Porcina COO-Alianzas
const GRANJA_LEGACY_POR_SENSOR = {
  esp_porqueriza: GRANJA_PRINCIPAL_ID,
  esp_flujo: GRANJA_PRINCIPAL_ID,
  bascula: GRANJA_PRINCIPAL_ID
};

const _dispositivoCache = new Map(); // sensor_id -> { granja, expira }
const DISPOSITIVO_CACHE_MS = 5 * 60 * 1000;

async function resolverGranjaDispositivo(sensorId) {
  if (!sensorId) return GRANJA_PRINCIPAL_ID;
  const cacheado = _dispositivoCache.get(sensorId);
  if (cacheado && cacheado.expira > Date.now()) return cacheado.granja;

  const dispositivo = await Dispositivo.findOne({ sensor_id: sensorId, activo: true }).select('granja');
  const granja = dispositivo ? dispositivo.granja.toString() : (GRANJA_LEGACY_POR_SENSOR[sensorId] || GRANJA_PRINCIPAL_ID);
  _dispositivoCache.set(sensorId, { granja, expira: Date.now() + DISPOSITIVO_CACHE_MS });
  return granja;
}

function emitirAGranja(req, granjaId, evento, payload) {
  if (!req.io) return;
  if (granjaId) {
    req.io.to(`granja_${granjaId}`).emit(evento, payload);
  } else {
    req.io.emit(evento, payload);
  }
}

// Cooldown en memoria para evitar spam de Alert records en BD por temperatura
// El ESP puede enviar datos cada 30s; sin throttle genera cientos de registros/hora
const _alertCooldown = { critico: 0, alerta: 0 };
const ALERT_CD_CRITICO = 15 * 60 * 1000; // 15 min entre alertas críticas en BD
const ALERT_CD_NORMAL  = 30 * 60 * 1000; // 30 min entre alertas normales en BD

// ═══════════════════════════════════════════════════════════════════════
// CACHE EN MEMORIA PARA DATOS EN TIEMPO REAL
// ═══════════════════════════════════════════════════════════════════════

let ultimosDatosPorqueriza = {
  granja: null,
  temperatura: null,
  humedad: null,
  sensor_id: null,
  fecha: null,
  conectado: false
};

let ultimosDatosFlujo = {
  granja: null,
  caudal: 0,
  volumen_total: 0,
  volumen_diario: 0,
  volumen_offset: 0,
  volumen_inicio_sesion: null,
  fecha_inicio_dia: null,
  ultima_lectura_guardada: null,
  sensor_id: null,
  fecha: null,
  conectado: false
};

// ═══════════════════════════════════════════════════════════════════════
// INICIALIZAR DATOS DE FLUJO DESDE BD (PERSISTENCIA)
// ═══════════════════════════════════════════════════════════════════════

let flujoInicializado = false;

async function inicializarDatosFlujo(intento = 1) {
  const MAX_INTENTOS = 5;
  try {
    const ahoraColombia = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    const hoy = new Date(Date.UTC(ahoraColombia.getFullYear(), ahoraColombia.getMonth(), ahoraColombia.getDate()));
    const mananaInit = new Date(hoy.getTime() + 86400000);

    const consumoHoy = await WaterConsumption.findOne({
      fecha: { $gte: hoy, $lt: mananaInit },
      tipo: 'diario',
      granja_id: GRANJA_PRINCIPAL_ID
    });

    ultimosDatosFlujo.granja = GRANJA_PRINCIPAL_ID;
    ultimosDatosFlujo.fecha_inicio_dia = new Date(); // UTC real — esNuevoDia usa toLocaleDateString para comparar

    if (consumoHoy) {
      ultimosDatosFlujo.volumen_diario = consumoHoy.litros;
      ultimosDatosFlujo.volumen_offset = consumoHoy.litros;
      console.log(`[FLUJO] ✓ Datos recuperados del día: ${consumoHoy.litros}L (intento ${intento})`);
    } else {
      ultimosDatosFlujo.volumen_diario = 0;
      ultimosDatosFlujo.volumen_offset = 0;
      console.log('[FLUJO] Nuevo día sin registros previos');
    }
    flujoInicializado = true;
  } catch (error) {
    console.error(`[FLUJO] Error inicializando (intento ${intento}/${MAX_INTENTOS}):`, error.message);
    if (intento < MAX_INTENTOS) {
      const espera = intento * 3000;
      console.log(`[FLUJO] Reintentando en ${espera / 1000}s...`);
      await new Promise(r => setTimeout(r, espera));
      return inicializarDatosFlujo(intento + 1);
    }
    console.error('[FLUJO] ⚠️ No se pudo inicializar tras', MAX_INTENTOS, 'intentos.');
  }
}

let flujoInitPromise = inicializarDatosFlujo();

// ═══════════════════════════════════════════════════════════════════════
// ⚡ RESPALDO PERIÓDICO ELIMINADO
// ═══════════════════════════════════════════════════════════════════════
// 
// ANTES: setInterval cada 2 minutos guardaba en BD
// AHORA: Cada lectura se guarda inmediatamente con confirmación atómica
// 
// JUSTIFICACIÓN:
// - Elimina race condition entre setInterval y recibirFlujo()
// - No hay riesgo de pérdida de datos (se guarda en cada lectura)
// - Mejora consistencia entre memoria y BD
// 
// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
// RESET AUTOMÁTICO A MEDIANOCHE COLOMBIA
// ═══════════════════════════════════════════════════════════════════════

setInterval(() => {
  const ahoraColombia = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  const horas = ahoraColombia.getHours();
  const minutos = ahoraColombia.getMinutes();

  if (horas === 0 && minutos <= 2) {
    if (ultimosDatosFlujo.volumen_diario > 0 || ultimosDatosFlujo.volumen_offset > 0) {
      ultimosDatosFlujo.volumen_offset = 0;
      ultimosDatosFlujo.volumen_inicio_sesion = null;
      ultimosDatosFlujo.volumen_diario = 0;
      ultimosDatosFlujo.fecha_inicio_dia = new Date(); // UTC real
      console.log('[FLUJO] ✓ Reset diario ejecutado a medianoche Colombia');
    }
  }
}, 60 * 1000);

// ═══════════════════════════════════════════════════════════════════════
// CICLO AUTOMÁTICO DE BOMBAS (45s ON → OFF → 30min cooldown)
// ═══════════════════════════════════════════════════════════════════════

let cicloBomba = {
  enCiclo: false,
  ultimaActivacion: null,
  timeoutApagado: null
};

const BOMBA_DURACION_MS = 45 * 1000;      // 45 segundos encendida
const BOMBA_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutos entre activaciones

async function activarCicloBomba(granja) {
  if (cicloBomba.enCiclo) {
    console.log('[BOMBA] Ciclo ya activo, ignorando');
    return;
  }

  const ahora = Date.now();
  if (cicloBomba.ultimaActivacion && (ahora - cicloBomba.ultimaActivacion) < BOMBA_COOLDOWN_MS) {
    const restanteMin = Math.round((BOMBA_COOLDOWN_MS - (ahora - cicloBomba.ultimaActivacion)) / 60000);
    console.log(`[BOMBA] En cooldown, faltan ${restanteMin} min para siguiente ciclo`);
    return;
  }

  cicloBomba.enCiclo = true;
  cicloBomba.ultimaActivacion = ahora;

  await Motorbomb.updateOne({ codigo_bomba: 'MB002', granja }, { estado: false, fecha_cambio: Date.now() });
  console.log('[BOMBA] Ciclo iniciado - Bomba Riego (MB002) ON por 45 segundos');

  const hora = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: true });
  const alerta = new Alert({
    granja,
    tipo: 'info',
    mensaje: `Bomba de riego activada automáticamente por temperatura crítica (45s) a las ${hora}`
  });
  await alerta.save();
  enviarPushAGranja(granja, { title: '🚿 Bomba de riego activada', body: `Temperatura crítica — riego automático a las ${hora}`, tag: 'bomba_auto' }).catch(() => {});

  enviarWhatsApp(
    `🚿 *BOMBA RIEGO AUTOMÁTICA*\nActivada por temperatura crítica en chiquero (45s)\nHora: ${hora}`
  ).catch(() => {});

  cicloBomba.timeoutApagado = setTimeout(async () => {
    try {
      await Motorbomb.updateOne({ codigo_bomba: 'MB002', granja }, { estado: true, fecha_cambio: Date.now() });
      cicloBomba.enCiclo = false;
      console.log('[BOMBA] Ciclo completado - Bomba Riego (MB002) OFF. Cooldown 30 min');
    } catch (err) {
      console.error('[BOMBA] Error apagando bomba:', err);
      cicloBomba.enCiclo = false;
    }
  }, BOMBA_DURACION_MS);
}

let pesoEnTiempoReal = {
  granja: null,
  peso: 0,
  unidad: 'kg',
  estable: false,
  sensor_id: null,
  fecha: null,
  conectado: false,
  historial: []
};

// ═══════════════════════════════════════════════════════════════════════
// FUNCIÓN AUXILIAR: Verificar si es un nuevo día
// ═══════════════════════════════════════════════════════════════════════

function esNuevoDia(fechaAnterior) {
  if (!fechaAnterior) return true;
  // Comparar fechas directamente en zona Colombia (formato "YYYY-MM-DD")
  const hoyStr     = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  const anteriorStr = new Date(fechaAnterior).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  return hoyStr !== anteriorStr;
}

// ═══════════════════════════════════════════════════════════════════════
// RECIBIR DATOS DE TEMPERATURA Y HUMEDAD (DHT22)
// POST /api/esp/riego
// ═══════════════════════════════════════════════════════════════════════

exports.recibirRiego = async (req, res) => {
  try {
    const { sensor_id, temperatura, humedad, rssi } = req.body;
    const sensorIdEfectivo = sensor_id || 'esp_porqueriza';
    const granja = await resolverGranjaDispositivo(sensorIdEfectivo);

    console.log('========================================');
    console.log('[ESP32] Datos temperatura recibidos');
    console.log('  Sensor:', sensor_id, '→ granja:', granja);
    console.log('  Temp:', temperatura, 'C');
    console.log('  Hum:', humedad, '%');
    console.log('  RSSI:', rssi, 'dBm');
    console.log('========================================');

    const config = await Config.findOne({ granja_id: granja }) || { umbral_temp_max: 37, umbral_temp_critico: 40 };

    const lecturas = [];

    if (temperatura !== undefined) {
      lecturas.push({
        granja,
        sensor: sensorIdEfectivo,
        tipo: 'temp_porqueriza',
        valor: temperatura,
        unidad: 'C'
      });

      if (temperatura >= config.umbral_temp_critico) {
        const now = Date.now();
        if (now - _alertCooldown.critico > ALERT_CD_CRITICO) {
          _alertCooldown.critico = now;
          const alerta = new Alert({
            granja,
            tipo: 'critico',
            mensaje: `CRITICO: Temperatura ${temperatura}°C - Riesgo de estrés térmico`,
            valor: temperatura
          });
          await alerta.save();
          enviarPushAGranja(granja, { title: '🔴 CRÍTICO — Temperatura', body: `${temperatura}°C - Riesgo de estrés térmico`, tag: 'temp_critico' }).catch(() => {});
        }
        if (config.bomba_automatica) {
          await activarCicloBomba(granja);
        }
      } else if (temperatura >= config.umbral_temp_max) {
        const now = Date.now();
        if (now - _alertCooldown.alerta > ALERT_CD_NORMAL) {
          _alertCooldown.alerta = now;
          const alerta = new Alert({
            granja,
            tipo: 'alerta',
            mensaje: `ALERTA: Temperatura ${temperatura}°C - Por encima del umbral`,
            valor: temperatura
          });
          await alerta.save();
          enviarPushAGranja(granja, { title: '🌡️ Temperatura Alta — SAMTR', body: `${temperatura}°C supera el umbral permitido`, tag: 'temp_alta' }).catch(() => {});
        }
      }

      evaluarTemperatura(temperatura, humedad, granja).catch(e =>
        console.error('[NOTIF] Error WhatsApp temp:', e.message)
      );
    }

    if (humedad !== undefined) {
      lecturas.push({
        granja,
        sensor: sensorIdEfectivo,
        tipo: 'humedad_porqueriza',
        valor: humedad,
        unidad: '%'
      });
    }

    if (lecturas.length > 0) {
      await Reading.insertMany(lecturas);
    }

    ultimosDatosPorqueriza = {
      granja,
      temperatura,
      humedad,
      sensor_id: sensorIdEfectivo,
      fecha: new Date(),
      conectado: true
    };

    emitirAGranja(req, granja, 'lectura_actualizada', {
      temperatura,
      humedad,
      sensor_id: sensorIdEfectivo,
      timestamp: new Date()
    });

    res.status(201).json({
      mensaje: 'Datos registrados',
      temperatura,
      humedad
    });

  } catch (error) {
    console.error('[ESP32] Error:', error);
    res.status(400).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// OBTENER DATOS DE PORQUERIZA
// GET /api/esp/porqueriza
// ═══════════════════════════════════════════════════════════════════════

exports.obtenerDatosPorqueriza = async (req, res) => {
  try {
    const granjaId = req.user?.granja_id ? String(req.user.granja_id) : null;
    if (!granjaId) {
      return res.json({ temperatura: null, humedad: null, fecha: null, conectado: false });
    }

    const ultimaTemp = await Reading.findOne({ tipo: 'temp_porqueriza', granja: granjaId })
      .sort({ createdAt: -1 });

    const ultimaHum = await Reading.findOne({ tipo: 'humedad_porqueriza', granja: granjaId })
      .sort({ createdAt: -1 });

    // El caché en memoria solo aplica si es la misma granja del hardware
    // que lo llenó — si no, el respaldo son los últimos valores en BD.
    const cacheEsDeEstaGranja = ultimosDatosPorqueriza.granja === granjaId;
    const conectado = cacheEsDeEstaGranja && ultimosDatosPorqueriza.fecha &&
      (new Date() - ultimosDatosPorqueriza.fecha) < 120000;

    res.json({
      temperatura: ultimaTemp?.valor ?? (cacheEsDeEstaGranja ? ultimosDatosPorqueriza.temperatura : null),
      humedad: ultimaHum?.valor ?? (cacheEsDeEstaGranja ? ultimosDatosPorqueriza.humedad : null),
      fecha: ultimaTemp?.createdAt ?? (cacheEsDeEstaGranja ? ultimosDatosPorqueriza.fecha : null),
      conectado
    });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// OBTENER HISTÓRICO DE TEMPERATURA (24 HORAS)
// GET /api/esp/porqueriza/historico?horas=24
// ═══════════════════════════════════════════════════════════════════════

exports.obtenerHistoricoTemperatura = async (req, res) => {
  try {
    if (!req.user?.granja_id) return res.json([]);
    const granjaId = String(req.user.granja_id);

    const horas = parseInt(req.query.horas) || 24;
    const fechaLimite = new Date();
    fechaLimite.setHours(fechaLimite.getHours() - horas);

    const temperaturas = await Reading.find({
      tipo: 'temp_porqueriza',
      granja: granjaId,
      createdAt: { $gte: fechaLimite }
    })
    .sort({ createdAt: 1 })
    .select('valor createdAt')
    .lean();

    const humedades = await Reading.find({
      tipo: 'humedad_porqueriza',
      granja: granjaId,
      createdAt: { $gte: fechaLimite }
    })
    .sort({ createdAt: 1 })
    .select('valor createdAt')
    .lean();
    
    const historico = temperaturas.map((temp, index) => ({
      fecha: temp.createdAt,
      temperatura: temp.valor,
      humedad: humedades[index]?.valor || null
    }));
    
    res.json(historico);
  } catch (error) {
    console.error('Error obteniendo histórico temperatura:', error);
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ⚡ RECIBIR DATOS DE FLUJO DE AGUA (VERSIÓN REFACTORIZADA)
// POST /api/esp/flujo
// ═══════════════════════════════════════════════════════════════════════

exports.recibirFlujo = async (req, res) => {
  try {
    // 1. Esperar inicialización
    if (flujoInitPromise) {
      await flujoInitPromise;
      flujoInitPromise = null;
    }

    const { sensor_id, caudal_l_min, volumen_l, rssi } = req.body;
    const sensorIdEfectivo = sensor_id || 'esp_flujo';
    const granja = await resolverGranjaDispositivo(sensorIdEfectivo);
    const caudal = parseFloat(caudal_l_min) || 0;
    const volumen = parseFloat(volumen_l) || 0;

    console.log('========================================');
    console.log('[ESP32] Datos flujo de agua recibidos');
    console.log('  Sensor:', sensor_id, '→ granja:', granja);
    console.log('  Caudal:', caudal, 'L/min');
    console.log('  Volumen ESP:', volumen, 'L');
    console.log('========================================');

    // El caché en memoria (offset/sesión) solo modela UNA granja a la vez —
    // si empieza a llegar flujo de una granja distinta a la que ya estaba
    // en memoria, se trata como un reinicio de sesión para no mezclar
    // volúmenes de dos granjas distintas en el mismo acumulado.
    const esGranjaDistinta = ultimosDatosFlujo.granja !== null && ultimosDatosFlujo.granja !== granja;
    if (esGranjaDistinta) {
      ultimosDatosFlujo.volumen_inicio_sesion = null;
      ultimosDatosFlujo.volumen_offset = 0;
      ultimosDatosFlujo.volumen_diario = 0;
      console.log('[FLUJO] Cambio de granja detectado en memoria — reiniciando sesión de caché');
    }

    // 2. Calcular volumen diario usando modelo offset + sesión
    let volumenDiarioCalculado = 0;
    const prevVolumenTotal = esGranjaDistinta ? 0 : (ultimosDatosFlujo.volumen_total || 0);

    // ⚠️ CRÍTICO: evaluar esNuevoDia ANTES de modificar fecha_inicio_dia
    // Si se evalúa después, la protección anti-caída (paso 3) dispara incorrectamente
    // y preserva el volumen de ayer como si fuera de hoy.
    const esDiaNuevo = esGranjaDistinta || esNuevoDia(ultimosDatosFlujo.fecha_inicio_dia);

    if (esDiaNuevo) {
      // Nuevo día: reset completo
      ultimosDatosFlujo.volumen_offset = 0;
      ultimosDatosFlujo.volumen_inicio_sesion = volumen;
      ultimosDatosFlujo.fecha_inicio_dia = new Date(); // UTC real
      volumenDiarioCalculado = 0;
      console.log('[FLUJO] Nuevo día. Sesión inicia en:', volumen, 'L');

    } else if (ultimosDatosFlujo.volumen_inicio_sesion === null) {
      // Servidor reinició: calibrar con valor de BD
      ultimosDatosFlujo.volumen_inicio_sesion = volumen;
      volumenDiarioCalculado = ultimosDatosFlujo.volumen_offset;
      console.log('[FLUJO] Servidor reiniciado. Offset:', ultimosDatosFlujo.volumen_offset, 'L');

    } else if (volumen < prevVolumenTotal - 0.5) {
      // ESP32 reinició: guardar acumulado y nueva sesión
      ultimosDatosFlujo.volumen_offset = ultimosDatosFlujo.volumen_diario;
      ultimosDatosFlujo.volumen_inicio_sesion = volumen;
      volumenDiarioCalculado = ultimosDatosFlujo.volumen_offset;
      console.log('[FLUJO] ESP reiniciado. Offset:', ultimosDatosFlujo.volumen_offset, 'L');

    } else {
      // Operación normal
      volumenDiarioCalculado = ultimosDatosFlujo.volumen_offset + (volumen - ultimosDatosFlujo.volumen_inicio_sesion);
    }

    volumenDiarioCalculado = Math.round(volumenDiarioCalculado * 100) / 100;

    // 3. Protección en memoria (primera capa) — solo aplica si es el MISMO día
    const volumenPrevioEnMemoria = ultimosDatosFlujo.volumen_diario || 0;

    if (volumenDiarioCalculado < volumenPrevioEnMemoria && !esDiaNuevo) {
      console.log(`[FLUJO] PROTECCIÓN MEMORIA: ${volumenDiarioCalculado}L < ${volumenPrevioEnMemoria}L → manteniendo`);
      volumenDiarioCalculado = volumenPrevioEnMemoria;
    }

    // ════════════════════════════════════════════════════════════════════
    // ⚡ GUARDAR EN BD Y ESPERAR CONFIRMACIÓN (ATÓMICO)
    // ════════════════════════════════════════════════════════════════════
    
    const ahoraColombia = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    const hoy = new Date(Date.UTC(ahoraColombia.getFullYear(), ahoraColombia.getMonth(), ahoraColombia.getDate()));
    
    // 4. GUARDAR EN BD Y OBTENER DOCUMENTO ACTUALIZADO
    const manana = new Date(hoy.getTime() + 86400000);
    const resultadoBD = await WaterConsumption.findOneAndUpdate(
      { fecha: { $gte: hoy, $lt: manana }, tipo: 'diario', granja_id: granja },
      {
        $max: { litros: volumenDiarioCalculado },
        $setOnInsert: { fecha: hoy, tipo: 'diario', granja_id: granja }
      },
      {
        upsert: true,
        new: true  // ⚡ CRÍTICO: Devuelve el documento DESPUÉS del update
      }
    );
    
    // 5. OBTENER EL VALOR REAL QUE ESTÁ EN LA BASE DE DATOS
    const volumenRealEnBD = resultadoBD.litros;
    
    if (volumenDiarioCalculado !== volumenRealEnBD) {
      console.log(`[FLUJO] ⚠️ MongoDB protegió: BD=${volumenRealEnBD}L > Calculado=${volumenDiarioCalculado}L`);
    } else {
      console.log(`[FLUJO] ✓ BD confirmó: ${volumenRealEnBD}L`);
    }
    
    // 6. Guardar en Reading (opcional, cada 5 min o si hay flujo)
    const ahora = new Date();
    const ultimaLectura = ultimosDatosFlujo.ultima_lectura_guardada;
    const minutosPasados = ultimaLectura ? (ahora - ultimaLectura) / 60000 : 999;
    
    if (minutosPasados >= 5 || caudal > 0) {
      const lectura = new Reading({
        granja,
        sensor: sensorIdEfectivo,
        tipo: 'flujo_agua',
        valor: volumenRealEnBD,  // ⚡ Usar valor confirmado por BD
        unidad: 'L',
        metadata: {
          caudal: caudal,
          volumen_total: volumen
        }
      });
      await lectura.save();
      ultimosDatosFlujo.ultima_lectura_guardada = ahora;
    }

    // ════════════════════════════════════════════════════════════════════
    // ⚡ ACTUALIZAR MEMORIA CON VALOR VERIFICADO POR MONGODB
    // ════════════════════════════════════════════════════════════════════

    ultimosDatosFlujo = {
      ...ultimosDatosFlujo,
      granja,
      caudal: caudal,
      volumen_total: volumen,
      volumen_diario: volumenRealEnBD,  // ⚡ Valor confirmado por MongoDB
      sensor_id: sensorIdEfectivo,
      fecha: ahora,
      conectado: true
    };

    // ════════════════════════════════════════════════════════════════════
    // ⚡ EMITIR SOCKET SOLO CON VALOR VERIFICADO
    // ════════════════════════════════════════════════════════════════════

    emitirAGranja(req, granja, 'lectura_actualizada', {
      caudal_l_min: caudal,
      volumen_diario: volumenRealEnBD,
      timestamp: ahora
    });

    emitirAGranja(req, granja, 'flujo_actualizado', {
      caudal: caudal,
      volumen_total: volumen,
      volumen_diario: volumenRealEnBD,
      timestamp: ahora
    });

    // ════════════════════════════════════════════════════════════════════
    // AUTO-APAGADO MB001 AL ALCANZAR EL LÍMITE DIARIO DE AGUA
    // ════════════════════════════════════════════════════════════════════
    try {
      const configActual = await Config.findOne({ granja_id: granja });
      const limiteAgua = configActual?.limite_consumo_bomba_1 ?? 600;

      if (volumenRealEnBD >= limiteAgua) {
        // 1. Auto-apagar MB001 si está encendida
        const mb001 = await Motorbomb.findOne({
          granja,
          $or: [{ codigo_bomba: 'MB001' }, { nombre: /bomba 1/i }]
        });

        if (mb001 && mb001.estado === false) { // false = encendida (lógica invertida)
          mb001.estado       = true; // apagar
          mb001.fecha_cambio = Date.now();
          await mb001.save();

          const alertaBomba = new Alert({
            granja,
            tipo: 'alerta',
            mensaje: `Bomba 1 apagada automáticamente: límite diario de ${limiteAgua}L alcanzado (${volumenRealEnBD.toFixed(1)}L)`
          });
          await alertaBomba.save();
          enviarPushAGranja(granja, { title: '💧 Límite de agua alcanzado', body: `Bomba 1 apagada — ${volumenRealEnBD.toFixed(1)}L / ${limiteAgua}L`, tag: 'agua_limite' }).catch(() => {});

          emitirAGranja(req, granja, 'bomba_actualizada', {
            bomba_id:  mb001._id,
            codigo:    mb001.codigo_bomba,
            estado:    mb001.estado,
            nombre:    mb001.nombre,
            timestamp: Date.now()
          });
          emitirAGranja(req, granja, 'nueva_alerta', alertaBomba);

          notificarBomba(mb001).catch(e => console.error('[AUTO-OFF] Notif bomba:', e.message));
          console.log(`[AUTO-OFF] MB001 apagada por límite de ${limiteAgua}L (${volumenRealEnBD.toFixed(1)}L)`);
        }

        // 2. Alerta de consumo alto — independiente del estado de la bomba
        //    Solo una vez por día (evitar spam en cada lectura)
        const ahoraCol2 = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
        const inicioDia = new Date(Date.UTC(ahoraCol2.getFullYear(), ahoraCol2.getMonth(), ahoraCol2.getDate()));
        const yaAlertado = await Alert.findOne({
          granja,
          mensaje: { $regex: /consumo.*agua.*alto|agua.*alto/i },
          createdAt: { $gte: inicioDia }
        });

        if (!yaAlertado) {
          const alertaAlta = new Alert({
            granja,
            tipo: 'advertencia',
            mensaje: `⚠️ Consumo de agua alto: ${volumenRealEnBD.toFixed(1)}L hoy (límite configurado: ${limiteAgua}L)`
          });
          await alertaAlta.save();
          enviarPushAGranja(granja, { title: '⚠️ Consumo de agua alto', body: `${volumenRealEnBD.toFixed(1)}L hoy (límite: ${limiteAgua}L)`, tag: 'agua_alto' }).catch(() => {});
          emitirAGranja(req, granja, 'nueva_alerta', alertaAlta);
          console.log(`[AGUA] Alerta consumo alto: ${volumenRealEnBD.toFixed(1)}L`);
        }
      }
    } catch (errAutoOff) {
      console.error('[AUTO-OFF] Error auto-apagado MB001:', errAutoOff.message);
    }

    res.status(200).json({
      ok: true,
      volumen_diario: volumenRealEnBD
    });
    
  } catch (error) {
    console.error('[ESP32] Error flujo:', error);
    res.status(400).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ⚡ OBTENER DATOS DE FLUJO (VERSIÓN CORREGIDA)
// GET /api/esp/flujo
// ═══════════════════════════════════════════════════════════════════════

exports.obtenerDatosFlujo = async (req, res) => {
  try {
    const granjaId = req.user?.granja_id ? String(req.user.granja_id) : null;
    if (!granjaId) {
      return res.json({ caudal: 0, volumen_total: 0, volumen_diario: 0, fecha: null, conectado: false });
    }

    // Esperar inicialización
    if (flujoInitPromise) {
      await flujoInitPromise;
      flujoInitPromise = null;
    }

    const ultimaLectura = await Reading.findOne({ tipo: 'flujo_agua', granja: granjaId })
      .sort({ createdAt: -1 });

    const ahoraCol = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    const hoy = new Date(Date.UTC(ahoraCol.getFullYear(), ahoraCol.getMonth(), ahoraCol.getDate()));
    const mananaGet = new Date(hoy.getTime() + 86400000);

    const consumoHoy = await WaterConsumption.findOne({
      fecha: { $gte: hoy, $lt: mananaGet },
      tipo: 'diario',
      granja_id: granjaId
    });

    // El caché en memoria solo aplica si es la misma granja del hardware
    // que lo llenó.
    const cacheEsDeEstaGranja = ultimosDatosFlujo.granja === granjaId;
    const conectado = cacheEsDeEstaGranja && ultimosDatosFlujo.fecha &&
      (new Date() - ultimosDatosFlujo.fecha) < 120000;

    // ⚡ PRIORIZAR BD SOBRE MEMORIA
    res.json({
      caudal: cacheEsDeEstaGranja ? (ultimosDatosFlujo.caudal || 0) : 0,
      volumen_total: cacheEsDeEstaGranja ? (ultimosDatosFlujo.volumen_total || 0) : 0,
      volumen_diario: consumoHoy !== null && consumoHoy !== undefined
        ? consumoHoy.litros
        : (cacheEsDeEstaGranja ? (ultimosDatosFlujo.volumen_diario || 0) : 0),
      fecha: ultimaLectura?.createdAt ?? (cacheEsDeEstaGranja ? ultimosDatosFlujo.fecha : null),
      conectado
    });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// CORREGIR CONSUMO DIARIO MANUALMENTE
// PUT /api/esp/flujo/corregir
// ═══════════════════════════════════════════════════════════════════════

exports.corregirConsumo = async (req, res) => {
  try {
    if (!req.user?.granja_id) return res.status(403).json({ mensaje: 'Sin granja asociada' });
    const granjaId = String(req.user.granja_id);

    const { litros, fecha } = req.body;
    if (litros === undefined || litros < 0) {
      return res.status(400).json({ mensaje: 'Litros requerido y >= 0' });
    }

    let targetDate;
    if (fecha) {
      const parts = fecha.split('-');
      targetDate = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
    } else {
      const ahoraCol = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
      targetDate = new Date(Date.UTC(ahoraCol.getFullYear(), ahoraCol.getMonth(), ahoraCol.getDate()));
    }

    const nextDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);

    const result = await WaterConsumption.findOneAndUpdate(
      { fecha: { $gte: targetDate, $lt: nextDay }, tipo: 'diario', granja_id: granjaId },
      { $set: { litros, fecha: targetDate, granja_id: granjaId } },
      { upsert: true, new: true }
    );

    // Si es corrección de hoy Y de la granja que ya está en memoria, actualizar cache
    const ahoraCol = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    const hoy = new Date(Date.UTC(ahoraCol.getFullYear(), ahoraCol.getMonth(), ahoraCol.getDate()));

    if (targetDate.getTime() === hoy.getTime() && ultimosDatosFlujo.granja === granjaId) {
      ultimosDatosFlujo.volumen_diario = litros;
      ultimosDatosFlujo.volumen_offset = litros;
      ultimosDatosFlujo.fecha_inicio_dia = new Date(); // UTC real
      ultimosDatosFlujo.volumen_inicio_sesion = null;
    }

    console.log('[FLUJO] Consumo corregido manualmente a', litros, 'L');

    res.json({ ok: true, litros: result.litros, fecha: result.fecha });
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// OBTENER HISTÓRICO DE AGUA (7 DÍAS)
// GET /api/esp/flujo/historico?dias=7
// ═══════════════════════════════════════════════════════════════════════

exports.obtenerHistoricoAgua = async (req, res) => {
  try {
    if (!req.user?.granja_id) return res.json([]);
    const granjaId = String(req.user.granja_id);

    const dias = parseInt(req.query.dias) || 7;
    const ahoraColombia = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    const fechaLimite = new Date(Date.UTC(ahoraColombia.getFullYear(), ahoraColombia.getMonth(), ahoraColombia.getDate() - dias));

    const consumos = await WaterConsumption.find({
      fecha: { $gte: fechaLimite },
      tipo: 'diario',
      granja_id: granjaId
    })
    .sort({ fecha: 1 })
    .select('fecha litros')
    .lean();

    if (consumos.length === 0) {
      const lecturas = await Reading.aggregate([
        {
          $match: {
            tipo: 'volumen_diario',
            granja: new mongoose.Types.ObjectId(granjaId),
            createdAt: { $gte: fechaLimite }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            volumen_total: { $max: '$valor' }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);
      
      const historico = lecturas.map(item => ({
        fecha: item._id,
        volumen_total: item.volumen_total
      }));
      
      return res.json(historico);
    }
    
    const historico = consumos.map(c => ({
      fecha: c.fecha.toISOString().split('T')[0],
      litros: c.litros
    }));
    
    res.json(historico);
  } catch (error) {
    console.error('Error obteniendo histórico agua:', error);
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// RECIBIR PESO EN TIEMPO REAL (NO GUARDA EN BD)
// POST /api/esp/peso/live
// ═══════════════════════════════════════════════════════════════════════

exports.recibirPesoLive = async (req, res) => {
  try {
    const { sensor_id, peso, unidad } = req.body;
    const sensorIdEfectivo = sensor_id || 'bascula';
    const granja = await resolverGranjaDispositivo(sensorIdEfectivo);

    const pesoNumerico = parseFloat(peso) || 0;

    pesoEnTiempoReal.historial.push(pesoNumerico);
    if (pesoEnTiempoReal.historial.length > 10) {
      pesoEnTiempoReal.historial.shift();
    }

    let estable = false;
    if (pesoEnTiempoReal.historial.length >= 5) {
      const min = Math.min(...pesoEnTiempoReal.historial);
      const max = Math.max(...pesoEnTiempoReal.historial);
      estable = (max - min) < 1.0;
    }

    pesoEnTiempoReal = {
      granja,
      peso: pesoNumerico,
      unidad: unidad || 'kg',
      estable,
      sensor_id: sensorIdEfectivo,
      fecha: new Date(),
      conectado: true,
      historial: pesoEnTiempoReal.historial
    };

    emitirAGranja(req, granja, 'peso_live', {
      peso: pesoNumerico,
      unidad: unidad || 'kg',
      estable,
      timestamp: Date.now()
    });

    res.status(200).json({ ok: true });

  } catch (error) {
    console.error('[ESP32] Error peso live:', error);
    res.status(400).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// OBTENER PESO ACTUAL EN MEMORIA
// GET /api/esp/peso/actual
// ═══════════════════════════════════════════════════════════════════════

exports.obtenerPesoActual = (req, res) => {
  const granjaId = req.user?.granja_id ? String(req.user.granja_id) : null;
  const cacheEsDeEstaGranja = granjaId && pesoEnTiempoReal.granja === granjaId;
  const conectado = cacheEsDeEstaGranja && pesoEnTiempoReal.fecha &&
    (new Date() - pesoEnTiempoReal.fecha) < 5000;

  res.json({
    peso: cacheEsDeEstaGranja ? pesoEnTiempoReal.peso : 0,
    unidad: cacheEsDeEstaGranja ? pesoEnTiempoReal.unidad : 'kg',
    estable: cacheEsDeEstaGranja ? pesoEnTiempoReal.estable : false,
    conectado,
    fecha: cacheEsDeEstaGranja ? pesoEnTiempoReal.fecha : null
  });
};

// ═══════════════════════════════════════════════════════════════════════
// TARAR BÁSCULA (Reset a cero)
// POST /api/esp/peso/tarar
// ═══════════════════════════════════════════════════════════════════════

exports.tararBascula = (req, res) => {
  pesoEnTiempoReal.historial = [];
  pesoEnTiempoReal.peso = 0;
  pesoEnTiempoReal.estable = false;
  
  if (req.io) {
    req.io.emit('comando_bascula', { accion: 'tarar' });
  }
  
  console.log('[BASCULA] Tara solicitada');
  
  res.json({ 
    ok: true, 
    mensaje: 'Comando de tara enviado' 
  });
};

// ═══════════════════════════════════════════════════════════════════════
// RECIBIR DATOS DE PESO Y GUARDAR EN BD (HX711)
// POST /api/esp/peso
// ═══════════════════════════════════════════════════════════════════════

exports.recibirPeso = async (req, res) => {
  try {
    const { sensor_id, peso, unidad, lote_id, cantidad_cerdos, notas } = req.body;

    // Si no hay token JWT, viene del ESP32 (auto-estable) → solo actualizar live, NO guardar
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return exports.recibirPesoLive(req, res);
    }

    // Con token: acción autenticada desde la web/app (ver verificarTokenOpcional
    // en routes/esp.js) — la granja es la del usuario, no la del sensor.
    if (!req.user?.granja_id) return res.status(403).json({ mensaje: 'Sin granja asociada' });
    const granja = String(req.user.granja_id);
    const sensorIdEfectivo = sensor_id || 'bascula';

    console.log('[ESP32] Peso para GUARDAR:', peso, unidad || 'kg');

    let loteAsociado = null;
    if (lote_id) {
      loteAsociado = await Lote.findOne({ _id: lote_id, granja });
    } else {
      loteAsociado = await Lote.findOne({ activo: true, granja }).sort({ createdAt: -1 });
    }

    const pesaje = new Pesaje({
      granja,
      lote: loteAsociado ? loteAsociado._id : null,
      peso: parseFloat(peso),
      unidad: unidad || 'kg',
      sensor_id: sensorIdEfectivo,
      cantidad_cerdos_pesados: cantidad_cerdos || 1,
      notas: notas || ''
    });
    await pesaje.save();

    if (loteAsociado) {
      console.log('[ESP32] Peso guardado y asociado a lote:', loteAsociado.nombre);
    }

    const lectura = new Reading({
      granja,
      sensor: sensorIdEfectivo,
      tipo: 'peso',
      valor: peso,
      unidad: unidad || 'kg'
    });
    await lectura.save();

    emitirAGranja(req, granja, 'nuevo_peso', {
      peso,
      unidad: unidad || 'kg',
      lote: loteAsociado ? loteAsociado.nombre : null,
      pesaje_id: pesaje._id
    });

    res.status(201).json({
      mensaje: 'Peso guardado correctamente',
      peso,
      pesaje_id: pesaje._id,
      lote: loteAsociado ? loteAsociado.nombre : 'Sin lote activo'
    });

  } catch (error) {
    console.error('[ESP32] Error guardando peso:', error);
    res.status(400).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// OBTENER HISTORIAL DE PESOS
// GET /api/esp/pesos
// ═══════════════════════════════════════════════════════════════════════

exports.obtenerHistorialPeso = async (req, res) => {
  try {
    if (!req.user?.granja_id) return res.json([]);
    const limite = parseInt(req.query.limite) || 20;
    const pesajes = await Pesaje.find({ granja: req.user.granja_id })
      .populate('lote', 'nombre')
      .sort({ createdAt: -1 })
      .limit(limite);
    res.json(pesajes);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// OBTENER ESTADO DE BOMBAS
// GET /api/esp/bombas
// ═══════════════════════════════════════════════════════════════════════

exports.obtenerEstadoBombas = async (req, res) => {
  try {
    if (!req.user?.granja_id) return res.json([]);
    const bombas = await Motorbomb.find({ granja: req.user.granja_id });
    res.json(bombas);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// HEARTBEAT
// POST /api/esp/heartbeat
// ═══════════════════════════════════════════════════════════════════════

exports.heartbeat = async (req, res) => {
  try {
    const { dispositivo_id, deviceId, tipo, deviceType, status, rssi, ip, MB001, MB002 } = req.body;
    
    console.log('════════════════════════════════════════════');
    console.log('[HEARTBEAT]', tipo || deviceType, '-', dispositivo_id || deviceId);
    console.log('  Estado:', status || 'online');
    console.log('  RSSI:', rssi, 'dBm');
    console.log('  IP:', ip || 'N/A');
    if (MB001 !== undefined) console.log('  MB001:', MB001);
    if (MB002 !== undefined) console.log('  MB002:', MB002);
    console.log('════════════════════════════════════════════');
    
    if (req.io) {
      req.io.emit('esp_status', {
        deviceId: dispositivo_id || deviceId || 'ESP-001',
        deviceType: tipo || deviceType || 'ESP32',
        status: status || 'online',
        rssi,
        ip,
        bombas: { MB001, MB002 },
        timestamp: Date.now()
      });
    }
    
    res.json({ 
      ok: true,
      mensaje: 'Heartbeat recibido',
      timestamp: new Date()
    });
  } catch (error) {
    console.error('[HEARTBEAT] Error:', error);
    res.status(400).json({ mensaje: error.message });
  }
};