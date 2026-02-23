/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - ESP CONTROLLER
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Controlador para recibir datos de sensores ESP32
 * 
 * Endpoints:
 *   POST /api/esp/riego                      -> Temperatura/humedad porqueriza
 *   GET  /api/esp/porqueriza                 -> Obtener ultimos datos temp
 *   GET  /api/esp/porqueriza/historico       -> Historial 24 horas temperatura
 *   POST /api/esp/flujo                      -> Datos de flujo de agua
 *   GET  /api/esp/flujo                      -> Obtener ultimos datos flujo
 *   GET  /api/esp/flujo/historico            -> Historial 7 días agua
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
  volumen_total: 0,           // Último volumen_l recibido del ESP
  volumen_diario: 0,          // Consumo diario total calculado
  volumen_offset: 0,          // Acumulado de sesiones ESP anteriores (persiste entre reinicios ESP)
  volumen_inicio_sesion: null, // Primer volumen_l de la sesión ESP actual (null = necesita calibrar)
  fecha_inicio_dia: null,
  ultima_lectura_guardada: null,
  sensor_id: null,
  fecha: null,
  conectado: false
};

// ═══════════════════════════════════════════════════════════════════════
// INICIALIZAR DATOS DE FLUJO DESDE BD (PERSISTENCIA)
// Con reintentos automáticos si la BD no está lista
// ═══════════════════════════════════════════════════════════════════════

let flujoInicializado = false;

async function inicializarDatosFlujo(intento = 1) {
  const MAX_INTENTOS = 5;
  try {
    const ahoraColombia = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    const hoy = new Date(Date.UTC(ahoraColombia.getFullYear(), ahoraColombia.getMonth(), ahoraColombia.getDate()));

    const consumoHoy = await WaterConsumption.findOne({
      fecha: { $gte: hoy },
      tipo: 'diario'
    });

    // ✅ FIX 1: Guardar en hora Colombia para que esNuevoDia() detecte correctamente el cambio de día
    // ANTES: new Date() → UTC, causaba desfase de 5h y no detectaba el nuevo día a medianoche Colombia
    ultimosDatosFlujo.fecha_inicio_dia = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));

    if (consumoHoy) {
      ultimosDatosFlujo.volumen_diario = consumoHoy.litros;
      ultimosDatosFlujo.volumen_offset = consumoHoy.litros;
      // volumen_inicio_sesion queda null → se calibrará con la primera lectura ESP
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
      const espera = intento * 3000; // 3s, 6s, 9s, 12s
      console.log(`[FLUJO] Reintentando en ${espera / 1000}s...`);
      await new Promise(r => setTimeout(r, espera));
      return inicializarDatosFlujo(intento + 1);
    }
    console.error('[FLUJO] ⚠️ No se pudo inicializar tras', MAX_INTENTOS, 'intentos. $max en MongoDB protegerá los datos.');
  }
}

// Ejecutar al cargar el módulo - guardar promesa para esperar en requests
let flujoInitPromise = inicializarDatosFlujo();

// ═══════════════════════════════════════════════════════════════════════
// RESPALDO PERIÓDICO: Cada 2 minutos guardar en BD con $max
// Garantiza que si el servidor se apaga, el último valor queda persistido
// ═══════════════════════════════════════════════════════════════════════

setInterval(async () => {
  try {
    if (!flujoInicializado || ultimosDatosFlujo.volumen_diario <= 0) return;

    const ahoraColombia = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    const hoy = new Date(Date.UTC(ahoraColombia.getFullYear(), ahoraColombia.getMonth(), ahoraColombia.getDate()));

    await WaterConsumption.findOneAndUpdate(
      { fecha: { $gte: hoy }, tipo: 'diario' },
      {
        $max: { litros: ultimosDatosFlujo.volumen_diario },
        $setOnInsert: { fecha: hoy, tipo: 'diario' }
      },
      { upsert: true }
    );
    console.log(`[FLUJO] Respaldo periódico: ${ultimosDatosFlujo.volumen_diario}L guardado en BD`);
  } catch (err) {
    console.error('[FLUJO] Error en respaldo periódico:', err.message);
  }
}, 2 * 60 * 1000); // Cada 2 minutos

// ═══════════════════════════════════════════════════════════════════════
// ✅ FIX 2: RESET AUTOMÁTICO A MEDIANOCHE COLOMBIA
// Sin esto el volumen_diario nunca se resetea si el servidor no se reinicia
// Se verifica cada minuto y ejecuta SOLO entre 00:00 y 00:02 hora Colombia
// ═══════════════════════════════════════════════════════════════════════

setInterval(() => {
  const ahoraColombia = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  const horas = ahoraColombia.getHours();
  const minutos = ahoraColombia.getMinutes();

  if (horas === 0 && minutos <= 2) {
    // Solo resetear si aún no se reseteó (evitar múltiples resets en el mismo minuto)
    if (ultimosDatosFlujo.volumen_diario > 0 || ultimosDatosFlujo.volumen_offset > 0) {
      ultimosDatosFlujo.volumen_offset = 0;
      ultimosDatosFlujo.volumen_inicio_sesion = null;
      ultimosDatosFlujo.volumen_diario = 0;
      ultimosDatosFlujo.fecha_inicio_dia = ahoraColombia;
      console.log('[FLUJO] ✓ Reset diario ejecutado a medianoche Colombia');
    }
  }
}, 60 * 1000); // Verificar cada minuto

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
  // Si ya hay un ciclo activo, no duplicar
  if (cicloBomba.enCiclo) {
    console.log('[BOMBA] Ciclo ya activo, ignorando');
    return;
  }

  // Verificar cooldown de 30 minutos
  const ahora = Date.now();
  if (cicloBomba.ultimaActivacion && (ahora - cicloBomba.ultimaActivacion) < BOMBA_COOLDOWN_MS) {
    const restanteMin = Math.round((BOMBA_COOLDOWN_MS - (ahora - cicloBomba.ultimaActivacion)) / 60000);
    console.log(`[BOMBA] En cooldown, faltan ${restanteMin} min para siguiente ciclo`);
    return;
  }

  cicloBomba.enCiclo = true;
  cicloBomba.ultimaActivacion = ahora;

  // Encender SOLO bomba de riego MB002 (estado: false = ON para relé invertido)
  await Motorbomb.updateOne({ codigo_bomba: 'MB002' }, { estado: false, fecha_cambio: Date.now() });
  console.log('[BOMBA] Ciclo iniciado - Bomba Riego (MB002) ON por 45 segundos');

  // Registrar alerta
  const hora = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: true });
  const alerta = new Alert({
    tipo: 'info',
    mensaje: `Bomba de riego activada automáticamente por temperatura crítica (45s) a las ${hora}`
  });
  await alerta.save();

  // WhatsApp: notificar activación automática
  enviarWhatsApp(
    `🚿 *BOMBA RIEGO AUTOMÁTICA*\nActivada por temperatura crítica en chiquero (45s)\nHora: ${hora}`
  ).catch(() => {});

  // Programar apagado automático después de 45 segundos
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
  
  // Usar hora de Colombia (UTC-5)
  const ahoraColombia = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  const anteriorColombia = new Date(new Date(fechaAnterior).toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  
  return ahoraColombia.getFullYear() !== anteriorColombia.getFullYear() ||
         ahoraColombia.getMonth() !== anteriorColombia.getMonth() ||
         ahoraColombia.getDate() !== anteriorColombia.getDate();
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
        const alerta = new Alert({
          tipo: 'critico',
          mensaje: `CRITICO: Temperatura ${temperatura}°C - Riesgo de estrés térmico`,
          valor: temperatura
        });
        await alerta.save();
        
        if (config.bomba_automatica) {
          await activarCicloBomba();
        }
      } else if (temperatura >= config.umbral_temp_max) {
        const alerta = new Alert({
          tipo: 'alerta',
          mensaje: `ALERTA: Temperatura ${temperatura}°C - Por encima del umbral`,
          valor: temperatura
        });
        await alerta.save();
      }

      // WhatsApp: evalúa con umbral dinámico según etapa del lote y cooldown 60min
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
// RECIBIR DATOS DE FLUJO DE AGUA (YF-S201)
// POST /api/esp/flujo
// ═══════════════════════════════════════════════════════════════════════

exports.recibirFlujo = async (req, res) => {
  try {
    // Esperar inicialización antes de procesar cualquier lectura
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
    console.log('  Volumen total:', volumen, 'L');
    console.log('========================================');
    
    // ═══════════════════════════════════════════════════════════════════
    // CÁLCULO DE VOLUMEN DIARIO (modelo offset + sesión)
    //
    // volumen_diario = volumen_offset + (volumen_ESP - volumen_inicio_sesion)
    //
    // - volumen_offset: acumulado de sesiones ESP anteriores del día
    // - volumen_inicio_sesion: primer volumen_l de la sesión ESP actual
    // - Cuando ESP se reinicia: offset += lo acumulado, nueva sesión
    // - Cuando servidor se reinicia: offset = valor guardado en BD
    // ═══════════════════════════════════════════════════════════════════

    let volumenDiarioCalculado = 0;
    const prevVolumenTotal = ultimosDatosFlujo.volumen_total || 0;

    if (esNuevoDia(ultimosDatosFlujo.fecha_inicio_dia)) {
      // ── NUEVO DÍA: reset completo ──
      ultimosDatosFlujo.volumen_offset = 0;
      ultimosDatosFlujo.volumen_inicio_sesion = volumen;
      // ✅ FIX 3: Usar hora Colombia también aquí para consistencia
      ultimosDatosFlujo.fecha_inicio_dia = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
      volumenDiarioCalculado = 0;
      console.log('[FLUJO] Nuevo día. Sesión inicia en:', volumen, 'L');

    } else if (ultimosDatosFlujo.volumen_inicio_sesion === null) {
      // ── SERVIDOR SE REINICIÓ: calibrar con valor guardado ──
      ultimosDatosFlujo.volumen_inicio_sesion = volumen;
      // offset ya tiene el valor de BD (seteado en inicializarDatosFlujo)
      volumenDiarioCalculado = ultimosDatosFlujo.volumen_offset;
      console.log('[FLUJO] Servidor reiniciado. Offset:', ultimosDatosFlujo.volumen_offset, 'L. Sesión inicia en:', volumen, 'L');

    } else if (volumen < prevVolumenTotal - 0.5) {
      // ── ESP SE REINICIÓ: contador bajó → guardar acumulado y nueva sesión ──
      ultimosDatosFlujo.volumen_offset = ultimosDatosFlujo.volumen_diario;
      ultimosDatosFlujo.volumen_inicio_sesion = volumen;
      volumenDiarioCalculado = ultimosDatosFlujo.volumen_offset;
      console.log('[FLUJO] ESP reiniciado. Offset guardado:', ultimosDatosFlujo.volumen_offset, 'L. Nueva sesión en:', volumen, 'L');

    } else {
      // ── OPERACIÓN NORMAL: offset + diferencia de sesión ──
      volumenDiarioCalculado = ultimosDatosFlujo.volumen_offset + (volumen - ultimosDatosFlujo.volumen_inicio_sesion);
    }
    
    volumenDiarioCalculado = Math.round(volumenDiarioCalculado * 100) / 100;

    // ═══════════════════════════════════════════════════════════════════
    // TRIPLE PROTECCIÓN: El consumo diario NUNCA puede disminuir
    // 1. Comparar con valor en memoria
    // 2. Comparar con valor en BD (por si la memoria está corrupta)
    // 3. $max en MongoDB como última barrera
    // ═══════════════════════════════════════════════════════════════════
    const noEsDiaNuevo = !esNuevoDia(ultimosDatosFlujo.fecha_inicio_dia);

    // Capa 1: Protección en memoria
    const volumenPrevioEnMemoria = ultimosDatosFlujo.volumen_diario || 0;
    if (volumenDiarioCalculado < volumenPrevioEnMemoria && noEsDiaNuevo) {
      console.log(`[FLUJO] PROTECCIÓN MEMORIA: ${volumenDiarioCalculado}L < ${volumenPrevioEnMemoria}L → manteniendo`);
      volumenDiarioCalculado = volumenPrevioEnMemoria;
    }

    // Capa 2: Protección desde BD (contra memoria corrupta tras reinicio)
    if (noEsDiaNuevo) {
      try {
        const ahoraColCheck = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
        const hoyCheck = new Date(Date.UTC(ahoraColCheck.getFullYear(), ahoraColCheck.getMonth(), ahoraColCheck.getDate()));
        const consumoActualBD = await WaterConsumption.findOne({ fecha: { $gte: hoyCheck }, tipo: 'diario' }).lean();
        if (consumoActualBD && consumoActualBD.litros > volumenDiarioCalculado) {
          console.log(`[FLUJO] PROTECCIÓN BD: ${volumenDiarioCalculado}L < BD ${consumoActualBD.litros}L → usando BD`);
          volumenDiarioCalculado = consumoActualBD.litros;
        }
      } catch (e) { /* Si falla la lectura, $max en MongoDB protegerá */ }
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // GUARDAR EN READING (Solo cada 5 minutos para no saturar)
    // ═══════════════════════════════════════════════════════════════════
    
    const ahora = new Date();
    const ultimaLectura = ultimosDatosFlujo.ultima_lectura_guardada;
    const minutosPasados = ultimaLectura ? (ahora - ultimaLectura) / 60000 : 999;
    
    if (minutosPasados >= 5 || caudal > 0) {
      // Guardar solo si pasaron 5 min O si hay flujo activo
      const lectura = new Reading({
        sensor: sensor_id || 'esp_flujo',
        tipo: 'flujo_agua',
        valor: volumenDiarioCalculado,
        unidad: 'L',
        metadata: {
          caudal: caudal,
          volumen_total: volumen
        }
      });
      await lectura.save();
      ultimosDatosFlujo.ultima_lectura_guardada = ahora;
    }
    
    // ═══════════════════════════════════════════════════════════════════
    // GUARDAR/ACTUALIZAR CONSUMO DIARIO EN WATERCONSUMPTION
    // ═══════════════════════════════════════════════════════════════════
    
    // Ajustar a zona horaria Colombia (UTC-5)

// Fecha de hoy en Colombia (UTC-5)
const ahoraColombia = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
const hoy = new Date(Date.UTC(ahoraColombia.getFullYear(), ahoraColombia.getMonth(), ahoraColombia.getDate()));
    
    // Usar $max para que MongoDB NUNCA sobreescriba con un valor menor
    // El consumo de agua solo puede subir durante el día, nunca bajar
    await WaterConsumption.findOneAndUpdate(
      {
        fecha: { $gte: hoy },
        tipo: 'diario'
      },
      {
        $max: { litros: volumenDiarioCalculado },
        $setOnInsert: { fecha: hoy, tipo: 'diario' }
      },
      { upsert: true }
    );
    
    // ═══════════════════════════════════════════════════════════════════
    // ACTUALIZAR CACHE EN MEMORIA
    // ═══════════════════════════════════════════════════════════════════
    
    ultimosDatosFlujo = {
      ...ultimosDatosFlujo,
      caudal: caudal,
      volumen_total: volumen,
      volumen_diario: volumenDiarioCalculado,
      sensor_id,
      fecha: ahora,
      conectado: true
    };
    
    // ═══════════════════════════════════════════════════════════════════
    // EMITIR POR WEBSOCKET (Siempre, para tiempo real)
    // ═══════════════════════════════════════════════════════════════════
    
    if (req.io) {
      req.io.emit('flujo_actualizado', {
        caudal: caudal,
        volumen_total: volumen,
        volumen_diario: volumenDiarioCalculado,
        timestamp: ahora
      });
    }
    
    res.status(200).json({ 
      ok: true,
      volumen_diario: volumenDiarioCalculado
    });
    
  } catch (error) {
    console.error('[ESP32] Error flujo:', error);
    res.status(400).json({ mensaje: error.message });
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
      // Fecha específica proporcionada (para correcciones históricas)
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

    // Si es corrección de hoy, actualizar cache en memoria
    const ahoraCol = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    const hoy = new Date(Date.UTC(ahoraCol.getFullYear(), ahoraCol.getMonth(), ahoraCol.getDate()));
    if (targetDate.getTime() === hoy.getTime()) {
      ultimosDatosFlujo.volumen_diario = litros;
      ultimosDatosFlujo.volumen_offset = litros;
      // ✅ FIX 4: Usar hora Colombia también aquí para consistencia
      ultimosDatosFlujo.fecha_inicio_dia = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
      // Recalibrar sesión ESP en la próxima lectura
      ultimosDatosFlujo.volumen_inicio_sesion = null;
    }

    console.log('[FLUJO] Consumo corregido manualmente a', litros, 'L');

    res.json({ ok: true, litros: result.litros, fecha: result.fecha });
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// OBTENER DATOS DE FLUJO
// GET /api/esp/flujo
// ═══════════════════════════════════════════════════════════════════════

exports.obtenerDatosFlujo = async (req, res) => {
  try {
    // Esperar inicialización
    if (flujoInitPromise) {
      await flujoInitPromise;
      flujoInitPromise = null;
    }

    // Buscar última lectura de flujo
    const ultimaLectura = await Reading.findOne({ tipo: 'flujo_agua' })
      .sort({ createdAt: -1 });
    
    // Buscar consumo diario de hoy (zona horaria Colombia UTC-5)
    const ahoraCol = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    const hoy = new Date(Date.UTC(ahoraCol.getFullYear(), ahoraCol.getMonth(), ahoraCol.getDate()));
    
    const consumoHoy = await WaterConsumption.findOne({
      fecha: { $gte: hoy },
      tipo: 'diario'
    });
    
    const conectado = ultimosDatosFlujo.fecha && 
      (new Date() - ultimosDatosFlujo.fecha) < 120000;
    
    res.json({
      caudal: ultimosDatosFlujo.caudal || 0,
      volumen_total: ultimosDatosFlujo.volumen_total || 0,
      volumen_diario: consumoHoy?.litros || ultimosDatosFlujo.volumen_diario || 0,
      fecha: ultimaLectura?.createdAt || ultimosDatosFlujo.fecha,
      conectado
    });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// OBTENER HISTÓRICO DE AGUA (7 DÍAS)
// GET /api/esp/flujo/historico?dias=7
// ═══════════════════════════════════════════════════════════════════════

exports.obtenerHistoricoAgua = async (req, res) => {
  try {
    const dias = parseInt(req.query.dias) || 7;
// Usar hora de Colombia (UTC-5), almacenada como medianoche UTC
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