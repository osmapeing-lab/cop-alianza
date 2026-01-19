const Reading = require('../models/Reading');

let ultimoPeso = {
  peso: null,
  unidad: 'kg',
  fecha: null,
  sensor_id: null
};

// Recibir peso del ESP32
exports.recibirPeso = async (req, res) => {
  try {
    const { peso, unidad = 'kg', sensor_id } = req.body;
    
    console.log(`[ESP32] Peso recibido: ${peso} ${unidad}`);
    
    const reading = new Reading({
      sensor: sensor_id || 'bascula_granja',
      tipo: 'peso',
      valor: peso,
      unidad
    });
    await reading.save();
    
    ultimoPeso = {
      peso,
      unidad,
      fecha: new Date(),
      sensor_id
    };
    
    if (req.io) {
      req.io.emit('nuevo_peso', ultimoPeso);
    }
    
    res.json({ mensaje: 'Peso registrado', peso, fecha: ultimoPeso.fecha });
  } catch (error) {
    console.log('[ESP32] Error:', error.message);
    res.status(400).json({ mensaje: error.message });
  }
};

// Obtener último peso
exports.obtenerUltimoPeso = async (req, res) => {
  try {
    // Buscar el último peso en la base de datos
    const ultimo = await Reading.findOne({ tipo: 'peso' }).sort({ fecha: -1 });
    
    if (ultimo) {
      res.json({
        peso: ultimo.valor,
        unidad: ultimo.unidad,
        fecha: ultimo.fecha,
        sensor_id: ultimo.sensor
      });
    } else {
      res.json(ultimoPeso);
    }
  } catch (error) {
    res.json(ultimoPeso);
  }
};

// Obtener historial de pesos
exports.obtenerHistorialPeso = async (req, res) => {
  try {
    const lecturas = await Reading.find({ tipo: 'peso' })
      .sort({ fecha: -1 })
      .limit(20);
    
    // Formatear respuesta
    const historial = lecturas.map(l => ({
      peso: l.valor,
      valor: l.valor,
      unidad: l.unidad,
      fecha: l.fecha,
      sensor_id: l.sensor
    }));
    
    res.json(historial);
  } catch (error) {
    console.log('Error historial:', error.message);
    res.status(500).json({ mensaje: error.message });
  }
};

// Recibir datos de riego
exports.recibirRiego = async (req, res) => {
  try {
    const { temperatura, humedad, nivel_tanque1, nivel_tanque2, sensor_id } = req.body;
    
    const lecturas = [];
    
    if (temperatura !== undefined) {
      lecturas.push(new Reading({
        sensor: sensor_id || 'esp_riego',
        tipo: 'temperatura_porqueriza',
        valor: temperatura,
        unidad: '°C'
      }));
    }
    
    if (humedad !== undefined) {
      lecturas.push(new Reading({
        sensor: sensor_id || 'esp_riego',
        tipo: 'humedad_porqueriza',
        valor: humedad,
        unidad: '%'
      }));
    }
    
    if (nivel_tanque1 !== undefined) {
      lecturas.push(new Reading({
        sensor: sensor_id || 'esp_riego',
        tipo: 'nivel_tanque1',
        valor: nivel_tanque1,
        unidad: '%'
      }));
    }
    
    if (nivel_tanque2 !== undefined) {
      lecturas.push(new Reading({
        sensor: sensor_id || 'esp_riego',
        tipo: 'nivel_tanque2',
        valor: nivel_tanque2,
        unidad: '%'
      }));
    }
    
    if (lecturas.length > 0) {
      await Reading.insertMany(lecturas);
    }
    
    if (req.io) {
      req.io.emit('datos_riego', { temperatura, humedad, nivel_tanque1, nivel_tanque2, fecha: new Date() });
    }
    
    res.json({ mensaje: 'Datos registrados' });
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

// Estado de bombas
exports.obtenerEstadoBombas = async (req, res) => {
  try {
    const Motorbomb = require('../models/Motorbomb');
    const bombas = await Motorbomb.find();
    res.json(bombas);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};