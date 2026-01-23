/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - ESP CONTROLLER (ACTUALIZADO)
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Controlador para recibir datos de sensores ESP32
 * 
 * Endpoints:
 *   POST /api/esp/riego    → Recibir temp/humedad de porqueriza
 *   POST /api/esp/peso     → Recibir datos de báscula
 *   GET  /api/esp/bombas   → Estado de bombas para ESP-01
 *   POST /api/esp/heartbeat → Heartbeat de dispositivos
 * 
 * ═══════════════════════════════════════════════════════════════════════
 */

const Reading = require('../models/Reading');
const Alert = require('../models/Alert');
const Motorbomb = require('../models/Motorbomb');
const Weighing = require('../models/Weighing');

// Variable para almacenar último dato recibido (para consulta rápida)
let ultimosDatosPorqueriza = {
  temperatura: null,
  humedad: null,
  sensor_id: null,
  fecha: null,
  rssi: null
};

// ═══════════════════════════════════════════════════════════════════════
// RECIBIR DATOS DE TEMPERATURA Y HUMEDAD (DHT22)
// POST /api/esp/riego
// ═══════════════════════════════════════════════════════════════════════
exports.recibirRiego = async (req, res) => {
  try {
    const { 
      sensor_id, 
      temperatura, 
      humedad, 
      temp_porqueriza,      // Alias
      humedad_porqueriza,   // Alias
      nivel_tanque1, 
      nivel_tanque2,
      alerta,
      critico,
      rssi,
      uptime,
      ip
    } = req.body;
    
    console.log('═══════════════════════════════════════════════');
    console.log('[ESP32] Datos recibidos:', new Date().toISOString());
    console.log('  Sensor ID:', sensor_id);
    console.log('  Temperatura:', temperatura || temp_porqueriza, '°C');
    console.log('  Humedad:', humedad || humedad_porqueriza, '%');
    console.log('  RSSI:', rssi, 'dBm');
    console.log('  IP:', ip);
    console.log('═══════════════════════════════════════════════');
    
    const temp = temperatura || temp_porqueriza;
    const hum = humedad || humedad_porqueriza;
    const lecturas = [];
    
    // Guardar temperatura
    if (temp !== undefined && temp !== null) {
      lecturas.push({
        sensor: sensor_id || 'esp_porqueriza',
        tipo: 'temp_porqueriza',
        valor: temp,
        unidad: '°C'
      });
      
      // Verificar umbrales y crear alertas
      if (temp >= 40) {
        const alertaCritica = new Alert({
          tipo: 'critica',
          mensaje: `🔴 CRÍTICO: Temperatura ${temp}°C en porqueriza - Riesgo de estrés térmico severo`,
          valor: temp,
          sensor_id: sensor_id
        });
        await alertaCritica.save();
        
        // Activar bombas automáticamente
        await Motorbomb.updateMany({ conectada: true }, { estado: true });
        console.log('🚨 ALERTA CRÍTICA: Bombas activadas automáticamente');
        
      } else if (temp >= 37) {
        const alertaAlta = new Alert({
          tipo: 'alerta',
          mensaje: `🟠 ALERTA: Temperatura ${temp}°C en porqueriza - Por encima del umbral`,
          valor: temp,
          sensor_id: sensor_id
        });
        await alertaAlta.save();
        console.log('⚠️ ALERTA: Temperatura alta');
        
      } else if (temp < 34) {
        // Temperatura normal, desactivar bombas automáticas
        // (Solo las que fueron activadas automáticamente)
        console.log('✓ Temperatura normal');
      }
    }
    
    // Guardar humedad
    if (hum !== undefined && hum !== null) {
      lecturas.push({
        sensor: sensor_id || 'esp_porqueriza',
        tipo: 'humedad_porqueriza',
        valor: hum,
        unidad: '%'
      });
    }
    
    // Guardar niveles de tanque (si vienen)
    if (nivel_tanque1 !== undefined) {
      lecturas.push({
        sensor: sensor_id || 'esp_tanques',
        tipo: 'nivel_tanque1',
        valor: nivel_tanque1,
        unidad: '%'
      });
      
      // Alerta si tanque bajo
      if (nivel_tanque1 < 20) {
        const alertaTanque = new Alert({
          tipo: 'nivel_bajo',
          mensaje: `🛢️ Tanque 1 nivel crítico: ${nivel_tanque1}%`,
          valor: nivel_tanque1
        });
        await alertaTanque.save();
      }
    }
    
    if (nivel_tanque2 !== undefined) {
      lecturas.push({
        sensor: sensor_id || 'esp_tanques',
        tipo: 'nivel_tanque2',
        valor: nivel_tanque2,
        unidad: '%'
      });
    }
    
    // Guardar todas las lecturas
    if (lecturas.length > 0) {
      await Reading.insertMany(lecturas);
    }
    
    // Actualizar últimos datos para consulta rápida
    ultimosDatosPorqueriza = {
      temperatura: temp,
      humedad: hum,
      sensor_id: sensor_id,
      fecha: new Date(),
      rssi: rssi,
      ip: ip
    };
    
    // Emitir por WebSocket si está disponible
    if (global.io) {
      global.io.emit('lectura_actualizada', {
        temp_porqueriza: temp,
        humedad_porqueriza: hum,
        sensor_id: sensor_id,
        timestamp: new Date()
      });
    }
    
    res.status(201).json({ 
      mensaje: 'Datos registrados correctamente',
      datos: {
        temperatura: temp,
        humedad: hum,
        lecturas_guardadas: lecturas.length
      }
    });
    
  } catch (error) {
    console.error('[ESP32] Error en recibirRiego:', error);
    res.status(400).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// OBTENER ÚLTIMO DATO DE PORQUERIZA (para frontend)
// GET /api/esp/porqueriza
// ═══════════════════════════════════════════════════════════════════════
exports.obtenerDatosPorqueriza = async (req, res) => {
  try {
    // Buscar última lectura de temperatura
    const ultimaTemp = await Reading.findOne({ tipo: 'temp_porqueriza' })
      .sort({ createdAt: -1 });
    
    const ultimaHum = await Reading.findOne({ tipo: 'humedad_porqueriza' })
      .sort({ createdAt: -1 });
    
    res.json({
      temperatura: ultimaTemp?.valor || ultimosDatosPorqueriza.temperatura,
      humedad: ultimaHum?.valor || ultimosDatosPorqueriza.humedad,
      fecha: ultimaTemp?.createdAt || ultimosDatosPorqueriza.fecha,
      conectado: ultimosDatosPorqueriza.fecha && 
        (new Date() - ultimosDatosPorqueriza.fecha) < 120000 // 2 minutos
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
    const { sensor_id, peso, unidad, cerdo, tipo_animal, manual } = req.body;
    
    console.log('[ESP32] Peso recibido:', peso, unidad || 'kg');
    
    // Guardar en colección de pesajes
    const pesaje = new Weighing({
      cerdo: cerdo || `Cerdo_${Date.now()}`,
      peso: peso,
      unidad: unidad || 'kg',
      tipo_animal: tipo_animal,
      manual: manual || false,
      validado: false
    });
    await pesaje.save();
    
    // También guardar como lectura
    const lectura = new Reading({
      sensor: sensor_id || 'bascula_granja',
      tipo: 'peso',
      valor: peso,
      unidad: unidad || 'kg'
    });
    await lectura.save();
    
    // Emitir por WebSocket
    if (global.io) {
      global.io.emit('nuevo_peso', {
        peso: peso,
        unidad: unidad || 'kg',
        timestamp: new Date()
      });
    }
    
    res.status(201).json({ 
      mensaje: 'Peso registrado correctamente',
      id: pesaje._id,
      peso: peso
    });
    
  } catch (error) {
    console.error('[ESP32] Error en recibirPeso:', error);
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
    
    const pesajes = await Weighing.find()
      .sort({ createdAt: -1 })
      .limit(limite);
    
    res.json(pesajes);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// OBTENER ESTADO DE BOMBAS (para ESP-01)
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
// HEARTBEAT DE DISPOSITIVOS
// POST /api/esp/heartbeat
// ═══════════════════════════════════════════════════════════════════════
exports.heartbeat = async (req, res) => {
  try {
    const { dispositivo_id, tipo, rssi, uptime, ip, estados } = req.body;
    
    console.log(`[HEARTBEAT] ${tipo} - ${dispositivo_id} - RSSI: ${rssi} dBm`);
    
    res.json({ 
      mensaje: 'OK',
      timestamp: new Date()
    });
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// CONFIRMAR CAMBIO DE BOMBA
// POST /api/esp/confirmar
// ═══════════════════════════════════════════════════════════════════════
exports.confirmarCambio = async (req, res) => {
  try {
    const { bomba_id, estado, dispositivo_id } = req.body;
    
    console.log(`[ESP] Bomba ${bomba_id} confirmada: ${estado ? 'ON' : 'OFF'}`);
    
    // Actualizar estado confirmado en BD
    await Motorbomb.findByIdAndUpdate(bomba_id, {
      estado: estado,
      ultima_confirmacion: new Date()
    });
    
    res.json({ mensaje: 'Confirmado' });
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};