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

const Reading = require('../models/Reading');
const Alert = require('../models/Alert');
const Motorbomb = require('../models/Motorbomb');
const Pesaje = require('../models/pesaje');
const Lote = require('../models/lote');
const WaterConsumption = require('../models/WaterConsumption');
const Config = require('../models/Config');
const { evaluarTemperatura, notificarBomba } = require('../utils/notificationManager');
const { enviarWhatsApp } = require('../utils/whatsappService');
const { enviarPushATodos } = require('../utils/pushService');

// Cooldown en memoria para evitar spam de Alert records en BD por temperatura
// El ESP puede enviar datos cada 30s; sin throttle genera cientos de registros/hora
const _alertCooldown = { critico: 0, alerta: 0 };
const ALERT_CD_CRITICO = 15 * 60 * 1000; // 15 min entre alertas críticas en BD
const ALERT_CD_NORMAL  = 30 * 60 * 1000; // 30 min entre alertas normales en BD

// ═══════════════════════════════════════════════════════════════════════
// CACHE EN MEMORIA PARA DATOS EN TIEMPO REAL
// ═══════════════════════════════════════════════════════════════════════

let ultimosDatosPorqueriza = {
  temperatura: null,
  humedad: null,
  sensor_id: null,
  fecha: null,
  conectado: false
};

let ultimosDatosFlujo = {
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
      tipo: 'diario'
    });

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

async function activarCicloBomba() {
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

  await Motorbomb.updateOne({ codigo_bomba: 'MB002' }, { estado: false, fecha_cambio: Date.now() });
  console.log('[BOMBA] Ciclo iniciado - Bomba Riego (MB002) ON por 45 segundos');

  const hora = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: true });
  const alerta = new Alert({
    tipo: 'info',
    mensaje: `Bomba de riego activada automáticamente por temperatura crítica (45s) a las ${hora}`
  });
  await alerta.save();
  enviarPushATodos({ title: '🚿 Bomba de riego activada', body: `Temperatura crítica — riego automático a las ${hora}`, tag: 'bomba_auto' }).catch(() => {});

  enviarWhatsApp(
    `🚿 *BOMBA RIEGO AUTOMÁTICA*\nActivada por temperatura crítica en chiquero (45s)\nHora: ${hora}`
  ).catch(() => {});

  cicloBomba.timeoutApagado = setTimeout(async () => {
    try {
      await Motorbomb.updateOne({ codigo_bomba: 'MB002' }, { estado: true, fecha_cambio: Date.now() });
      cicloBomba.enCiclo = false;
      console.log('[BOMBA] Ciclo completado - Bomba Riego (MB002) OFF. Cooldown 30 min');
    } catch (err) {
      console.error('[BOMBA] Error apagando bomba:', err);
      cicloBomba.enCiclo = false;
    }
  }, BOMBA_DURACION_MS);
}

let pesoEnTiempoReal = {
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
    
    console.log('========================================');
    console.log('[ESP32] Datos temperatura recibidos');
    console.log('  Sensor:', sensor_id);
    console.log('  Temp:', temperatura, 'C');
    console.log('  Hum:', humedad, '%');
    console.log('  RSSI:', rssi, 'dBm');
    console.log('========================================');
    
    const config = await Config.findOne() || { umbral_temp_max: 37, umbral_temp_critico: 40 };
    
    const lecturas = [];
    
    if (temperatura !== undefined) {
      lecturas.push({
        sensor: sensor_id || 'esp_porqueriza',
        tipo: 'temp_porqueriza',
        valor: temperatura,
        unidad: 'C'
      });
      
      if (temperatura >= config.umbral_temp_critico) {
        const now = Date.now();
        if (now - _alertCooldown.critico > ALERT_CD_CRITICO) {
          _alertCooldown.critico = now;
          const alerta = new Alert({
            tipo: 'critico',
            mensaje: `CRITICO: Temperatura ${temperatura}°C - Riesgo de estrés térmico`,
            valor: temperatura
          });
          await alerta.save();
          enviarPushATodos({ title: '🔴 CRÍTICO — Temperatura', body: `${temperatura}°C - Riesgo de estrés térmico`, tag: 'temp_critico' }).catch(() => {});
        }
        if (config.bomba_automatica) {
          await activarCicloBomba();
        }
      } else if (temperatura >= config.umbral_temp_max) {
        const now = Date.now();
        if (now - _alertCooldown.alerta > ALERT_CD_NORMAL) {
          _alertCooldown.alerta = now;
          const alerta = new Alert({
            tipo: 'alerta',
            mensaje: `ALERTA: Temperatura ${temperatura}°C - Por encima del umbral`,
            valor: temperatura
          });
          await alerta.save();
          enviarPushATodos({ title: '🌡️ Temperatura Alta — SAMTR', body: `${temperatura}°C supera el umbral permitido`, tag: 'temp_alta' }).catch(() => {});
        }
      }

      evaluarTemperatura(temperatura, humedad).catch(e =>
        console.error('[NOTIF] Error WhatsApp temp:', e.message)
      );
    }
    
    if (humedad !== undefined) {
      lecturas.push({
        sensor: sensor_id || 'esp_porqueriza',
        tipo: 'humedad_porqueriza',
        valor: humedad,
        unidad: '%'
      });
    }
    
    if (lecturas.length > 0) {
      await Reading.insertMany(lecturas);
    }
    
    ultimosDatosPorqueriza = {
      temperatura,
      humedad,
      sensor_id,
      fecha: new Date(),
      conectado: true
    };
    
    if (req.io) {
      req.io.emit('lectura_actualizada', {
        temperatura,
        humedad,
        sensor_id,
        timestamp: new Date()
      });
    }
    
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
    const ultimaTemp = await Reading.findOne({ tipo: 'temp_porqueriza' })
      .sort({ createdAt: -1 });
    
    const ultimaHum = await Reading.findOne({ tipo: 'humedad_porqueriza' })
      .sort({ createdAt: -1 });
    
    const conectado = ultimosDatosPorqueriza.fecha && 
      (new Date() - ultimosDatosPorqueriza.fecha) < 120000;
    
    res.json({
      temperatura: ultimaTemp?.valor || ultimosDatosPorqueriza.temperatura,
      humedad: ultimaHum?.valor || ultimosDatosPorqueriza.humedad,
      fecha: ultimaTemp?.createdAt || ultimosDatosPorqueriza.fecha,
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
    const horas = parseInt(req.query.horas) || 24;
    const fechaLimite = new Date();
    fechaLimite.setHours(fechaLimite.getHours() - horas);
    
    const temperaturas = await Reading.find({
      tipo: 'temp_porqueriza',
      createdAt: { $gte: fechaLimite }
    })
    .sort({ createdAt: 1 })
    .select('valor createdAt')
    .lean();
    
    const humedades = await Reading.find({
      tipo: 'humedad_porqueriza',
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
    const caudal = parseFloat(caudal_l_min) || 0;
    const volumen = parseFloat(volumen_l) || 0;
    
    console.log('========================================');
    console.log('[ESP32] Datos flujo de agua recibidos');
    console.log('  Sensor:', sensor_id);
    console.log('  Caudal:', caudal, 'L/min');
    console.log('  Volumen ESP:', volumen, 'L');
    console.log('========================================');
    
    // 2. Calcular volumen diario usando modelo offset + sesión
    let volumenDiarioCalculado = 0;
    const prevVolumenTotal = ultimosDatosFlujo.volumen_total || 0;

    // ⚠️ CRÍTICO: evaluar esNuevoDia ANTES de modificar fecha_inicio_dia
    // Si se evalúa después, la protección anti-caída (paso 3) dispara incorrectamente
    // y preserva el volumen de ayer como si fuera de hoy.
    const esDiaNuevo = esNuevoDia(ultimosDatosFlujo.fecha_inicio_dia);

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
      { fecha: { $gte: hoy, $lt: manana }, tipo: 'diario' },
      {
        $max: { litros: volumenDiarioCalculado },
        $setOnInsert: { fecha: hoy, tipo: 'diario' }
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
        sensor: sensor_id || 'esp_flujo',
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
      caudal: caudal,
      volumen_total: volumen,
      volumen_diario: volumenRealEnBD,  // ⚡ Valor confirmado por MongoDB
      sensor_id,
      fecha: ahora,
      conectado: true
    };
    
    // ════════════════════════════════════════════════════════════════════
    // ⚡ EMITIR SOCKET SOLO CON VALOR VERIFICADO
    // ════════════════════════════════════════════════════════════════════
    
    if (req.io) {
      req.io.emit('lectura_actualizada', {
        caudal_l_min: caudal,
        volumen_diario: volumenRealEnBD,
        timestamp: ahora
      });

      req.io.emit('flujo_actualizado', {
        caudal: caudal,
        volumen_total: volumen,
        volumen_diario: volumenRealEnBD,
        timestamp: ahora
      });
    }

    // ════════════════════════════════════════════════════════════════════
    // AUTO-APAGADO MB001 AL ALCANZAR EL LÍMITE DIARIO DE AGUA
    // ════════════════════════════════════════════════════════════════════
    try {
      const configActual = await Config.findOne();
      const limiteAgua = configActual?.limite_consumo_bomba_1 ?? 600;

      if (volumenRealEnBD >= limiteAgua) {
        // 1. Auto-apagar MB001 si está encendida
        const mb001 = await Motorbomb.findOne({
          $or: [{ codigo_bomba: 'MB001' }, { nombre: /bomba 1/i }]
        });

        if (mb001 && mb001.estado === false) { // false = encendida (lógica invertida)
          mb001.estado       = true; // apagar
          mb001.fecha_cambio = Date.now();
          await mb001.save();

          const alertaBomba = new Alert({
            tipo: 'alerta',
            mensaje: `Bomba 1 apagada automáticamente: límite diario de ${limiteAgua}L alcanzado (${volumenRealEnBD.toFixed(1)}L)`
          });
          await alertaBomba.save();
          enviarPushATodos({ title: '💧 Límite de agua alcanzado', body: `Bomba 1 apagada — ${volumenRealEnBD.toFixed(1)}L / ${limiteAgua}L`, tag: 'agua_limite' }).catch(() => {});

          if (req.io) {
            req.io.emit('bomba_actualizada', {
              bomba_id:  mb001._id,
              codigo:    mb001.codigo_bomba,
              estado:    mb001.estado,
              nombre:    mb001.nombre,
              timestamp: Date.now()
            });
            req.io.emit('nueva_alerta', alertaBomba);
          }

          notificarBomba(mb001).catch(e => console.error('[AUTO-OFF] Notif bomba:', e.message));
          console.log(`[AUTO-OFF] MB001 apagada por límite de ${limiteAgua}L (${volumenRealEnBD.toFixed(1)}L)`);
        }

        // 2. Alerta de consumo alto — independiente del estado de la bomba
        //    Solo una vez por día (evitar spam en cada lectura)
        const ahoraCol2 = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
        const inicioDia = new Date(Date.UTC(ahoraCol2.getFullYear(), ahoraCol2.getMonth(), ahoraCol2.getDate()));
        const yaAlertado = await Alert.findOne({
          mensaje: { $regex: /consumo.*agua.*alto|agua.*alto/i },
          createdAt: { $gte: inicioDia }
        });

        if (!yaAlertado) {
          const alertaAlta = new Alert({
            tipo: 'advertencia',
            mensaje: `⚠️ Consumo de agua alto: ${volumenRealEnBD.toFixed(1)}L hoy (límite configurado: ${limiteAgua}L)`
          });
          await alertaAlta.save();
          enviarPushATodos({ title: '⚠️ Consumo de agua alto', body: `${volumenRealEnBD.toFixed(1)}L hoy (límite: ${limiteAgua}L)`, tag: 'agua_alto' }).catch(() => {});
          if (req.io) req.io.emit('nueva_alerta', alertaAlta);
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
    // Esperar inicialización
    if (flujoInitPromise) {
      await flujoInitPromise;
      flujoInitPromise = null;
    }

    const ultimaLectura = await Reading.findOne({ tipo: 'flujo_agua' })
      .sort({ createdAt: -1 });
    
    const ahoraCol = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    const hoy = new Date(Date.UTC(ahoraCol.getFullYear(), ahoraCol.getMonth(), ahoraCol.getDate()));
    const mananaGet = new Date(hoy.getTime() + 86400000);

    const consumoHoy = await WaterConsumption.findOne({
      fecha: { $gte: hoy, $lt: mananaGet },
      tipo: 'diario'
    });
    
    const conectado = ultimosDatosFlujo.fecha && 
      (new Date() - ultimosDatosFlujo.fecha) < 120000;
    
    // ⚡ PRIORIZAR BD SOBRE MEMORIA
    res.json({
      caudal: ultimosDatosFlujo.caudal || 0,
      volumen_total: ultimosDatosFlujo.volumen_total || 0,
      volumen_diario: consumoHoy !== null && consumoHoy !== undefined
        ? consumoHoy.litros
        : (ultimosDatosFlujo.volumen_diario || 0),
      fecha: ultimaLectura?.createdAt || ultimosDatosFlujo.fecha,
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
      { fecha: { $gte: targetDate, $lt: nextDay }, tipo: 'diario' },
      { $set: { litros, fecha: targetDate } },
      { upsert: true, new: true }
    );

    // Si es corrección de hoy, actualizar cache
    const ahoraCol = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    const hoy = new Date(Date.UTC(ahoraCol.getFullYear(), ahoraCol.getMonth(), ahoraCol.getDate()));
    
    if (targetDate.getTime() === hoy.getTime()) {
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
    const dias = parseInt(req.query.dias) || 7;
    const ahoraColombia = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    const fechaLimite = new Date(Date.UTC(ahoraColombia.getFullYear(), ahoraColombia.getMonth(), ahoraColombia.getDate() - dias));
    
    const consumos = await WaterConsumption.find({
      fecha: { $gte: fechaLimite },
      tipo: 'diario'
    })
    .sort({ fecha: 1 })
    .select('fecha litros')
    .lean();
    
    if (consumos.length === 0) {
      const lecturas = await Reading.aggregate([
        {
          $match: {
            tipo: 'volumen_diario',
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
      peso: pesoNumerico,
      unidad: unidad || 'kg',
      estable,
      sensor_id: sensor_id || 'bascula',
      fecha: new Date(),
      conectado: true,
      historial: pesoEnTiempoReal.historial
    };
    
    if (req.io) {
      req.io.emit('peso_live', {
        peso: pesoNumerico,
        unidad: unidad || 'kg',
        estable,
        timestamp: Date.now()
      });
    }
    
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
  const conectado = pesoEnTiempoReal.fecha && 
    (new Date() - pesoEnTiempoReal.fecha) < 5000;
  
  res.json({
    peso: pesoEnTiempoReal.peso,
    unidad: pesoEnTiempoReal.unidad,
    estable: pesoEnTiempoReal.estable,
    conectado,
    fecha: pesoEnTiempoReal.fecha
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

    console.log('[ESP32] Peso para GUARDAR:', peso, unidad || 'kg');
    
    let loteAsociado = null;
    if (lote_id) {
      loteAsociado = await Lote.findById(lote_id);
    } else {
      loteAsociado = await Lote.findOne({ activo: true }).sort({ createdAt: -1 });
    }
    
    const pesaje = new Pesaje({
      lote: loteAsociado ? loteAsociado._id : null,
      peso: parseFloat(peso),
      unidad: unidad || 'kg',
      sensor_id: sensor_id || 'bascula',
      cantidad_cerdos_pesados: cantidad_cerdos || 1,
      notas: notas || ''
    });
    await pesaje.save();
    
    if (loteAsociado) {
      console.log('[ESP32] Peso guardado y asociado a lote:', loteAsociado.nombre);
    }
    
    const lectura = new Reading({
      sensor: sensor_id || 'bascula',
      tipo: 'peso',
      valor: peso,
      unidad: unidad || 'kg'
    });
    await lectura.save();
    
    if (req.io) {
      req.io.emit('nuevo_peso', { 
        peso, 
        unidad: unidad || 'kg',
        lote: loteAsociado ? loteAsociado.nombre : null,
        pesaje_id: pesaje._id
      });
    }
    
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
    const limite = parseInt(req.query.limite) || 20;
    const pesajes = await Pesaje.find()
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
    const bombas = await Motorbomb.find();
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