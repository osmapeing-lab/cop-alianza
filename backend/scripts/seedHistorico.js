const mongoose = require('mongoose');
require('dotenv').config();

const Reading = require('../models/Reading');
const WaterConsumption = require('../models/WaterConsumption');

const MONGO_URI = process.env.MONGO_URI;

async function seedHistorico() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Conectado a MongoDB');

    const ahora = new Date();
    
    // ═══════════════════════════════════════════════════════════════════
    // DATOS DE TEMPERATURA (últimos 7 días, cada 30 min)
    // ═══════════════════════════════════════════════════════════════════
    
    const lecturasTemp = [];
    
    for (let dia = 6; dia >= 0; dia--) {
      for (let media_hora = 0; media_hora < 48; media_hora++) {
        const fecha = new Date(ahora);
        fecha.setDate(fecha.getDate() - dia);
        fecha.setHours(Math.floor(media_hora / 2), (media_hora % 2) * 30, 0, 0);
        
        const hora = fecha.getHours();
        
        // Temperatura según hora del día
        let tempBase;
        if (hora >= 10 && hora <= 16) {
          tempBase = 32 + Math.random() * 4; // 32-36°C día
        } else if (hora >= 6 && hora < 10) {
          tempBase = 26 + Math.random() * 3; // 26-29°C mañana
        } else if (hora > 16 && hora <= 20) {
          tempBase = 28 + Math.random() * 3; // 28-31°C tarde
        } else {
          tempBase = 24 + Math.random() * 3; // 24-27°C noche
        }
        
        const humedad = 60 + Math.random() * 25;
        
        lecturasTemp.push({
          sensor: 'esp_porqueriza',
          tipo: 'temp_porqueriza',
          valor: Math.round(tempBase * 10) / 10,
          unidad: 'C',
          fecha: fecha,
          createdAt: fecha,
          updatedAt: fecha
        });
        
        lecturasTemp.push({
          sensor: 'esp_porqueriza',
          tipo: 'humedad_porqueriza',
          valor: Math.round(humedad * 10) / 10,
          unidad: '%',
          fecha: fecha,
          createdAt: fecha,
          updatedAt: fecha
        });
      }
    }
    
    // Borrar lecturas antiguas de temperatura/humedad
    await Reading.deleteMany({ tipo: { $in: ['temp_porqueriza', 'humedad_porqueriza'] } });
    await Reading.insertMany(lecturasTemp);
    console.log(`✅ ${lecturasTemp.length} lecturas de temperatura/humedad creadas (7 días)`);

    // ═══════════════════════════════════════════════════════════════════
    // DATOS DE CONSUMO DE AGUA (últimos 7 días - niveles bajos)
    // ═══════════════════════════════════════════════════════════════════
    
    const consumosAgua = [];
    for (let i = 6; i >= 1; i--) {
      const fecha = new Date(ahora);
      fecha.setDate(fecha.getDate() - i);
      fecha.setHours(23, 59, 0, 0);
      
      // Consumo bajo: entre 20 y 80 litros diarios
      const litros = 20 + Math.random() * 60;
      
      consumosAgua.push({
        fecha: fecha,
        litros: Math.round(litros * 100) / 100,
        tipo: 'diario'
      });
    }
    
    // Borrar solo consumos de días anteriores (no el de hoy)
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    await WaterConsumption.deleteMany({ fecha: { $lt: hoy }, tipo: 'diario' });
    await WaterConsumption.insertMany(consumosAgua);
    console.log(`✅ ${consumosAgua.length} registros de consumo de agua creados (niveles bajos)`);

    console.log('\n✅ Datos históricos creados correctamente');
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

seedHistorico();