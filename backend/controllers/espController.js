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
  volumen_inicio_dia: 0,
  fecha_inicio_dia: null,
  ultima_lectura_guardada: null,  // ← AGREGADO
  sensor_id: null,
  fecha: null,
  conectado: false
};

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
  
  const ahora = new Date();
  const anterior = new Date(fechaAnterior);
  
  return ahora.getFullYear() !== anterior.getFullYear() ||
         ahora.getMonth() !== anterior.getMonth() ||
         ahora.getDate() !== anterior.getDate();
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
          await Motorbomb.updateMany({ conectada: true }, { estado: true });
          console.log('[ALERTA] Temperatura critica - Bombas activadas');
        }
      } else if (temperatura >= config.umbral_temp_max) {
        const alerta = new Alert({
          tipo: 'alerta',
          mensaje: `ALERTA: Temperatura ${temperatura}°C - Por encima del umbral`,
          valor: temperatura
        });
        await alerta.save();
      }
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
    // CÁLCULO DE VOLUMEN DIARIO
    // ═══════════════════════════════════════════════════════════════════
    
    let volumenDiarioCalculado = 0;
    
    // Verificar si es un nuevo día
    if (esNuevoDia(ultimosDatosFlujo.fecha_inicio_dia)) {
      ultimosDatosFlujo.volumen_inicio_dia = volumen;
      ultimosDatosFlujo.fecha_inicio_dia = new Date();
      volumenDiarioCalculado = 0;
      console.log('[FLUJO] Nuevo día. Volumen inicial:', volumen, 'L');
    } else if (volumen >= (ultimosDatosFlujo.volumen_inicio_dia || 0)) {
      // Calcular diferencia solo si el volumen actual es mayor o igual
      volumenDiarioCalculado = volumen - (ultimosDatosFlujo.volumen_inicio_dia || 0);
    } else {
      // ESP se reinició - el nuevo volumen es menor que el inicial
      // Acumular lo que teníamos + el nuevo volumen
      const volumenPrevio = ultimosDatosFlujo.volumen_diario || 0;
      ultimosDatosFlujo.volumen_inicio_dia = 0;
      volumenDiarioCalculado = volumenPrevio + volumen;
      console.log('[FLUJO] ESP reiniciado. Acumulando:', volumenDiarioCalculado, 'L');
    }
    
    volumenDiarioCalculado = Math.round(volumenDiarioCalculado * 100) / 100;
    
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
// Obtener inicio del día en UTC (medianoche)
const hoy = new Date();
hoy.setUTCHours(0, 0, 0, 0);
    
    await WaterConsumption.findOneAndUpdate(
      { 
        fecha: { $gte: hoy }, 
        tipo: 'diario' 
      },
      { 
        $set: {
          litros: volumenDiarioCalculado,
          fecha: new Date()
        }
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
// OBTENER DATOS DE FLUJO
// GET /api/esp/flujo
// ═══════════════════════════════════════════════════════════════════════

exports.obtenerDatosFlujo = async (req, res) => {
  try {
    // Buscar última lectura de flujo
    const ultimaLectura = await Reading.findOne({ tipo: 'flujo_agua' })
      .sort({ createdAt: -1 });
    
    // Buscar consumo diario de hoy
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
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
    const fechaLimite = new Date();
fechaLimite.setDate(fechaLimite.getDate() - dias);
fechaLimite.setHours(0, 0, 0, 0);
    
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
      volumen_total: c.litros
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