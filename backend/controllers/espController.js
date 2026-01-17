const Reading = require('../models/Reading');
const { alertaTemperatura, alertaTanqueBajo } = require('./alertController');

// Guardar último peso para mostrar en frontend
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
    
    console.log(`[ESP32] Peso recibido: ${peso} ${unidad} de ${sensor_id}`);
    
    // Guardar en base de datos
    const reading = new Reading({
      sensor: sensor_id || 'bascula_granja',
      tipo: 'peso',
      valor: peso,
      unidad
    });
    await reading.save();
    
    // Actualizar último peso
    ultimoPeso = {
      peso,
      unidad,
      fecha: new Date(),
      sensor_id
    };
    
    // Emitir por WebSocket a todos los clientes
    if (req.io) {
      req.io.emit('nuevo_peso', ultimoPeso);
      console.log('[SOCKET] Peso emitido a clientes');
    }
    
    res.json({ 
      mensaje: 'Peso registrado', 
      peso,
      fecha: ultimoPeso.fecha
    });
  } catch (error) {
    console.log('[ESP32] Error:', error.message);
    res.status(400).json({ mensaje: error.message });
  }
};

// Obtener último peso
exports.obtenerUltimoPeso = (req, res) => {
  res.json(ultimoPeso);
};

// Obtener historial de pesos
exports.obtenerHistorialPeso = async (req, res) => {
  try {
    const lecturas = await Reading.find({ tipo: 'peso' })
      .sort({ fecha: -1 })
      .limit(50);
    res.json(lecturas);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// Recibir datos de riego (temperatura, humedad, tanques)
exports.recibirRiego = async (req, res) => {
  try {
    const { temperatura, humedad, nivel_tanque1, nivel_tanque2, sensor_id } = req.body;
    
    console.log(`[ESP32] Riego recibido: temp=${temperatura}, hum=${humedad}`);
    
    const lecturas = [];
    
    if (temperatura !== undefined) {
      lecturas.push(new Reading({
        sensor: sensor_id || 'esp_riego',
        tipo: 'temperatura_porqueriza',
        valor: temperatura,
        unidad: '°C'
      }));
      
      // Alerta si temperatura > 34°C
      if (temperatura > 34) {
        await alertaTemperatura({
          temperatura,
          umbral: 34,
          bomba_activada: true,
          consumo_agua: 50,
          resultado: 'Riego activado automaticamente'
        });
      }
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
      
      if (nivel_tanque1 < 20) {
        await alertaTanqueBajo({
          tanque: 'Tanque Principal',
          nivel: nivel_tanque1,
          umbral_minimo: 20
        });
      }
    }
    
    if (nivel_tanque2 !== undefined) {
      lecturas.push(new Reading({
        sensor: sensor_id || 'esp_riego',
        tipo: 'nivel_tanque2',
        valor: nivel_tanque2,
        unidad: '%'
      }));
      
      if (nivel_tanque2 < 20) {
        await alertaTanqueBajo({
          tanque: 'Tanque Reserva',
          nivel: nivel_tanque2,
          umbral_minimo: 20
        });
      }
    }
    
    if (lecturas.length > 0) {
      await Reading.insertMany(lecturas);
    }
    
    // Emitir por WebSocket
    if (req.io) {
      req.io.emit('datos_riego', {
        temperatura,
        humedad,
        nivel_tanque1,
        nivel_tanque2,
        fecha: new Date()
      });
    }
    
    res.json({ mensaje: 'Datos de riego registrados' });
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