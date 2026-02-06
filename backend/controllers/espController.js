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
 *   GET  /api/esp/porqueriza/historico       -> Historial 24 horas temperatura ✅ NUEVO
 *   POST /api/esp/flujo                      -> Datos de flujo de agua
 *   GET  /api/esp/flujo                      -> Obtener ultimos datos flujo
 *   GET  /api/esp/flujo/historico            -> Historial 7 días agua ✅ NUEVO
 *   POST /api/esp/peso                       -> Datos de bascula
 *   GET  /api/esp/pesos                      -> Historial de pesos
 *   GET  /api/esp/bombas                     -> Estado de bombas
 *   POST /api/esp/heartbeat                  -> Heartbeat dispositivos
 * 
 * ═══════════════════════════════════════════════════════════════════════
 */

const Reading = require('../models/Reading');
const Alert = require('../models/Alert');
const Motorbomb = require('../models/Motorbomb');
const Pesaje = require('../models/pesaje');  // ✅ CORREGIDO: Era Weighing
const Lote = require('../models/lote');      // ✅ CORREGIDO: Era lote (minúscula)
const WaterConsumption = require('../models/WaterConsumption');
const Config = require('../models/Config');

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
    
    // Obtener configuracion de umbrales
    const config = await Config.findOne() || { umbral_temp_max: 37, umbral_temp_critico: 40 };
    
    const lecturas = [];
    
    if (temperatura !== undefined) {
      lecturas.push({
        sensor: sensor_id || 'esp_porqueriza',
        tipo: 'temp_porqueriza',
        valor: temperatura,
        unidad: 'C'
      });
      
      // Alertas de temperatura usando config
      if (temperatura >= config.umbral_temp_critico) {
        const alerta = new Alert({
          tipo: 'critico',
          mensaje: `CRITICO: Temperatura ${temperatura}°C - Riesgo de estrés térmico`,
          valor: temperatura
        });
        await alerta.save();
        
        // Activar bombas automaticamente si esta habilitado
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
    
    // Actualizar cache
    ultimosDatosPorqueriza = {
      temperatura,
      humedad,
      sensor_id,
      fecha: new Date(),
      conectado: true
    };
    
    // WebSocket
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
// ✅ NUEVO: OBTENER HISTÓRICO DE TEMPERATURA (24 HORAS)
// GET /api/esp/porqueriza/historico?horas=24
// ═══════════════════════════════════════════════════════════════════════

exports.obtenerHistoricoTemperatura = async (req, res) => {
  try {
    const horas = parseInt(req.query.horas) || 24;
    const fechaLimite = new Date();
    fechaLimite.setHours(fechaLimite.getHours() - horas);
    
    // Obtener lecturas de temperatura
    const temperaturas = await Reading.find({
      tipo: 'temp_porqueriza',
      createdAt: { $gte: fechaLimite }
    })
    .sort({ createdAt: 1 })
    .select('valor createdAt')
    .lean();
    
    // Obtener lecturas de humedad
    const humedades = await Reading.find({
      tipo: 'humedad_porqueriza',
      createdAt: { $gte: fechaLimite }
    })
    .sort({ createdAt: 1 })
    .select('valor createdAt')
    .lean();
    
    // Combinar por timestamp (aproximado)
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
      
      // Guardar consumo diario en WaterConsumption
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      
      await WaterConsumption.findOneAndUpdate(
        { fecha: { $gte: hoy }, tipo: 'diario' },
        { 
          litros: volumen_diario_l,
          tipo: 'diario',
          fecha: new Date()
        },
        { upsert: true, new: true }
      );
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
    if (req.io) {
      req.io.emit('lectura_actualizada', {
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
// ✅ NUEVO: OBTENER HISTÓRICO DE AGUA (7 DÍAS)
// GET /api/esp/flujo/historico?dias=7
// ═══════════════════════════════════════════════════════════════════════

exports.obtenerHistoricoAgua = async (req, res) => {
  try {
    const dias = parseInt(req.query.dias) || 7;
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() - dias);
    
    // Obtener consumos diarios desde WaterConsumption
    const consumos = await WaterConsumption.find({
      fecha: { $gte: fechaLimite },
      tipo: 'diario'
    })
    .sort({ fecha: 1 })
    .select('fecha litros')
    .lean();
    
    // Si no hay datos en WaterConsumption, agrupar desde Reading
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
    
    // Formatear respuesta
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
// RECIBIR DATOS DE PESO (HX711)
// POST /api/esp/peso
// ═══════════════════════════════════════════════════════════════════════

exports.recibirPeso = async (req, res) => {
  try {
    const { sensor_id, peso, unidad } = req.body;
    
    console.log('[ESP32] Peso recibido:', peso, unidad || 'kg');
    
    // Buscar lote activo para asociar el pesaje
    const loteActivo = await Lote.findOne({ activo: true }).sort({ createdAt: -1 });
    
    const pesaje = new Pesaje({  // ✅ CORREGIDO: Era Weighing
      lote: loteActivo ? loteActivo._id : null,
      peso,
      unidad: unidad || 'kg',
      sensor_id: sensor_id || 'bascula',
      cantidad_cerdos_pesados: 1
    });
    await pesaje.save();
    
    // Actualizar peso promedio del lote si existe (el middleware lo hace automáticamente)
    if (loteActivo) {
      console.log('[ESP32] Peso asociado a lote:', loteActivo.nombre);
    }
    
    // Guardar lectura
    const lectura = new Reading({
      sensor: sensor_id || 'bascula',
      tipo: 'peso',
      valor: peso,
      unidad: unidad || 'kg'
    });
    await lectura.save();
    
    // WebSocket
    if (req.io) {
      req.io.emit('nuevo_peso', { 
        peso, 
        unidad: unidad || 'kg',
        lote: loteActivo ? loteActivo.nombre : null
      });
    }
    
    res.status(201).json({ 
      mensaje: 'Peso registrado', 
      peso,
      lote: loteActivo ? loteActivo.nombre : 'Sin lote activo'
    });
    
  } catch (error) {
    console.error('[ESP32] Error peso:', error);
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
    const pesajes = await Pesaje.find()  // ✅ CORREGIDO: Era Weighing
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
    
    // Emitir al frontend por Socket.IO
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