/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - ESP CONTROLLER
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Controlador para recibir datos de sensores ESP32
 * 
 * Endpoints:
 *   POST /api/esp/riego      -> Temperatura/humedad porqueriza
 *   GET  /api/esp/porqueriza -> Obtener ultimos datos temp
 *   POST /api/esp/flujo      -> Datos de flujo de agua
 *   GET  /api/esp/flujo      -> Obtener ultimos datos flujo
 *   POST /api/esp/peso       -> Datos de bascula
 *   GET  /api/esp/bombas     -> Estado de bombas
 * 
 * ═══════════════════════════════════════════════════════════════════════
 */

const Reading = require('../models/Reading');
const Alert = require('../models/Alert');
const Motorbomb = require('../models/Motorbomb');
const Weighing = require('../models/Weighing');

// Ultimos datos para consulta rapida
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
  sensor_id: null,
  fecha: null,
  conectado: false
};

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
    
    const lecturas = [];
    
    if (temperatura !== undefined) {
      lecturas.push({
        sensor: sensor_id || 'esp_porqueriza',
        tipo: 'temp_porqueriza',
        valor: temperatura,
        unidad: 'C'
      });
      
      // Alertas de temperatura
      if (temperatura >= 40) {
        const alerta = new Alert({
          tipo: 'critico',
          mensaje: 'CRITICO: Temperatura ' + temperatura + 'C - Riesgo de estres termico',
          valor: temperatura
        });
        await alerta.save();
        await Motorbomb.updateMany({ conectada: true }, { estado: true });
        console.log('[ALERTA] Temperatura critica - Bombas activadas');
      } else if (temperatura >= 35) {
        const alerta = new Alert({
          tipo: 'alerta',
          mensaje: 'ALERTA: Temperatura ' + temperatura + 'C - Por encima del umbral',
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
    
    // Actualizar cache
    ultimosDatosPorqueriza = {
      temperatura,
      humedad,
      sensor_id,
      fecha: new Date(),
      conectado: true
    };
    
    // WebSocket
    if (global.io) {
      global.io.emit('lectura_actualizada', {
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
// RECIBIR DATOS DE FLUJO DE AGUA (YF-S201)
// POST /api/esp/flujo
// ═══════════════════════════════════════════════════════════════════════

exports.recibirFlujo = async (req, res) => {
  try {
    const { sensor_id, caudal_l_min, volumen_l, volumen_diario_l, rssi } = req.body;
    
    console.log('========================================');
    console.log('[ESP32] Datos flujo de agua recibidos');
    console.log('  Sensor:', sensor_id);
    console.log('  Caudal:', caudal_l_min, 'L/min');
    console.log('  Volumen total:', volumen_l, 'L');
    console.log('  Volumen diario:', volumen_diario_l, 'L');
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
    
    if (volumen_diario_l !== undefined) {
      lecturas.push({
        sensor: sensor_id || 'esp_flujo',
        tipo: 'volumen_diario',
        valor: volumen_diario_l,
        unidad: 'L'
      });
    }
    
    if (lecturas.length > 0) {
      await Reading.insertMany(lecturas);
    }
    
    // Actualizar cache
    ultimosDatosFlujo = {
      caudal: caudal_l_min,
      volumen_total: volumen_l,
      volumen_diario: volumen_diario_l,
      sensor_id,
      fecha: new Date(),
      conectado: true
    };
    
    // WebSocket
    if (global.io) {
      global.io.emit('lectura_actualizada', {
        caudal_l_min,
        volumen_l,
        volumen_diario_l,
        sensor_id,
        timestamp: new Date()
      });
    }
    
    res.status(201).json({ 
      mensaje: 'Datos de flujo registrados',
      caudal: caudal_l_min,
      volumen: volumen_l
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
      caudal: ultimoCaudal?.valor || ultimosDatosFlujo.caudal,
      volumen_total: ultimoVolumen?.valor || ultimosDatosFlujo.volumen_total,
      volumen_diario: ultimoVolumenDiario?.valor || ultimosDatosFlujo.volumen_diario,
      fecha: ultimoCaudal?.createdAt || ultimosDatosFlujo.fecha,
      conectado
    });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// RECIBIR DATOS DE PESO (HX711)
// POST /api/esp/peso
// ═══════════════════════════════════════════════════════════════════════

exports.recibirPeso = async (req, res) => {
  try {
    const { sensor_id, peso, unidad, tipo_animal } = req.body;
    
    console.log('[ESP32] Peso recibido:', peso, unidad || 'kg');
    
    const pesaje = new Weighing({
      cerdo: 'Cerdo_' + Date.now(),
      peso,
      unidad: unidad || 'kg',
      tipo_animal,
      validado: false
    });
    await pesaje.save();
    
    const lectura = new Reading({
      sensor: sensor_id || 'bascula',
      tipo: 'peso',
      valor: peso,
      unidad: unidad || 'kg'
    });
    await lectura.save();
    
    if (global.io) {
      global.io.emit('nuevo_peso', { peso, unidad: unidad || 'kg' });
    }
    
    res.status(201).json({ mensaje: 'Peso registrado', peso });
    
  } catch (error) {
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
    const pesajes = await Weighing.find().sort({ createdAt: -1 }).limit(limite);
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
    const { dispositivo_id, tipo, rssi } = req.body;
    console.log('[HEARTBEAT]', tipo, '-', dispositivo_id, '- RSSI:', rssi);
    res.json({ mensaje: 'OK', timestamp: new Date() });
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};