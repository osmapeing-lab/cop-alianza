const Reading = require('../models/Reading');
const Alert = require('../models/Alert');
const { enviarWhatsApp } = require('./alertController');

// Recibir datos del ESP32 de peso (HX711)
exports.recibirPeso = async (req, res) => {
  try {
    const { peso, unidad = 'kg', sensor_id } = req.body;
    
    const reading = new Reading({
      sensor: sensor_id || 'peso_bascula',
      tipo: 'peso',
      valor: peso,
      unidad
    });
    await reading.save();
    
    res.json({ mensaje: 'Peso registrado', peso });
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

// Recibir datos del ESP32 de riego (temperatura, humedad, nivel tanques)
exports.recibirRiego = async (req, res) => {
  try {
    const { temperatura, humedad, nivel_tanque1, nivel_tanque2, sensor_id } = req.body;
    
    // Guardar lecturas
    const lecturas = [];
    
    if (temperatura !== undefined) {
      lecturas.push(new Reading({ sensor: sensor_id, tipo: 'temperatura', valor: temperatura, unidad: '°C' }));
      
      // Alerta si temperatura muy alta
      if (temperatura > 34) {
        const alerta = new Alert({
          tipo: 'temperatura_alta',
          mensaje: `🌡️ Temperatura crítica: ${temperatura}°C - Activando riego automático`
        });
        await alerta.save();
        await enviarWhatsApp(`🚨 ALERTA: Temperatura ${temperatura}°C en la granja`);
      }
    }
    
    if (humedad !== undefined) {
      lecturas.push(new Reading({ sensor: sensor_id, tipo: 'humedad', valor: humedad, unidad: '%' }));
    }
    
    if (nivel_tanque1 !== undefined) {
      lecturas.push(new Reading({ sensor: sensor_id, tipo: 'nivel_tanque1', valor: nivel_tanque1, unidad: '%' }));
      
      // Alerta si tanque bajo
      if (nivel_tanque1 < 20) {
        const alerta = new Alert({
          tipo: 'nivel_bajo',
          mensaje: `🛢️ Tanque 1 nivel crítico: ${nivel_tanque1}%`
        });
        await alerta.save();
        await enviarWhatsApp(`🚨 ALERTA: Tanque 1 bajo ${nivel_tanque1}%`);
      }
    }
    
    if (nivel_tanque2 !== undefined) {
      lecturas.push(new Reading({ sensor: sensor_id, tipo: 'nivel_tanque2', valor: nivel_tanque2, unidad: '%' }));
    }
    
    await Reading.insertMany(lecturas);
    
    res.json({ mensaje: 'Datos de riego registrados', datos: req.body });
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

// Obtener estado de bombas para ESP32
exports.obtenerEstadoBombas = async (req, res) => {
  try {
    const Motorbomb = require('../models/Motorbomb');
    const bombas = await Motorbomb.find();
    res.json(bombas);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};