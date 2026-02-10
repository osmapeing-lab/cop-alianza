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
    const { sensor_id, caudal_l_min, volumen_l, volumen_diario_l, rssi } = req.body;
    
    // ═══════════════════════════════════════════════════════════════════
    // ✅ CÁLCULO AUTOMÁTICO DE VOLUMEN DIARIO
    // ═══════════════════════════════════════════════════════════════════
    
    let volumenDiarioCalculado = volumen_diario_l;
    
    if (volumenDiarioCalculado === undefined && volumen_l !== undefined) {
      
      if (esNuevoDia(ultimosDatosFlujo.fecha_inicio_dia)) {
        ultimosDatosFlujo.volumen_inicio_dia = volumen_l;
        ultimosDatosFlujo.fecha_inicio_dia = new Date();
        volumenDiarioCalculado = 0;
        
        console.log('[FLUJO] Nuevo día detectado. Volumen inicial:', volumen_l, 'L');
      } else {
        volumenDiarioCalculado = volumen_l - ultimosDatosFlujo.volumen_inicio_dia;
        
        if (volumenDiarioCalculado < 0) {
          ultimosDatosFlujo.volumen_inicio_dia = volumen_l;
          volumenDiarioCalculado = 0;
        }
      }
    }
    
    volumenDiarioCalculado = Math.round((volumenDiarioCalculado || 0) * 100) / 100;
    
    console.log('========================================');
    console.log('[ESP32] Datos flujo de agua recibidos');
    console.log('  Sensor:', sensor_id);
    console.log('  Caudal:', caudal_l_min, 'L/min');
    console.log('  Volumen total:', volumen_l, 'L');
    console.log('  Volumen diario (calculado):', volumenDiarioCalculado, 'L');
    console.log('  RSSI:', rssi, 'dBm');
    console.log('========================================');
    
    const lecturas = [];
    
    if (caudal_l_min !== undefined) {
      lecturas.push({
        sensor: sensor_id || 'esp_flujo',
        tipo: 'caudal_agua',
        valor: caudal_l_min,
        unidad: 'L/min'
      });
    }
    
    if (volumen_l !== undefined) {
      lecturas.push({
        sensor: sensor_id || 'esp_flujo',
        tipo: 'volumen_agua',
        valor: volumen_l,
        unidad: 'L'
      });
    }
    
    if (volumenDiarioCalculado !== undefined) {
      lecturas.push({
        sensor: sensor_id || 'esp_flujo',
        tipo: 'volumen_diario',
        valor: volumenDiarioCalculado,
        unidad: 'L'
      });
      
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      
      await WaterConsumption.findOneAndUpdate(
        { fecha: { $gte: hoy }, tipo: 'diario' },
        { 
          litros: volumenDiarioCalculado,
          tipo: 'diario',
          fecha: new Date()
        },
        { upsert: true, new: true }
      );
    }
    
    if (lecturas.length > 0) {
      await Reading.insertMany(lecturas);
    }
    
    ultimosDatosFlujo = {
      ...ultimosDatosFlujo,
      caudal: caudal_l_min || 0,
      volumen_total: volumen_l || 0,
      volumen_diario: volumenDiarioCalculado,
      sensor_id,
      fecha: new Date(),
      conectado: true
    };
    
    if (req.io) {
      req.io.emit('lectura_actualizada', {
        caudal_l_min,
        volumen_l,
        volumen_diario_l: volumenDiarioCalculado,
        sensor_id,
        timestamp: new Date()
      });
    }
    
    res.status(201).json({ 
      mensaje: 'Datos de flujo registrados',
      caudal: caudal_l_min,
      volumen: volumen_l,
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
    const ultimoCaudal = await Reading.findOne({ tipo: 'caudal_agua' })
      .sort({ createdAt: -1 });
    
    const ultimoVolumen = await Reading.findOne({ tipo: 'volumen_agua' })
      .sort({ createdAt: -1 });
    
    const ultimoVolumenDiario = await Reading.findOne({ tipo: 'volumen_diario' })
      .sort({ createdAt: -1 });
    
    const conectado = ultimosDatosFlujo.fecha && 
      (new Date() - ultimosDatosFlujo.fecha) < 120000;
    
    res.json({
      caudal: ultimoCaudal?.valor || ultimosDatosFlujo.caudal || 0,
      volumen_total: ultimoVolumen?.valor || ultimosDatosFlujo.volumen_total || 0,
      volumen_diario: ultimoVolumenDiario?.valor || ultimosDatosFlujo.volumen_diario || 0,
      fecha: ultimoCaudal?.createdAt || ultimosDatosFlujo.fecha,
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