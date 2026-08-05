/*
 * Migración de un solo uso para el aislamiento de datos ESP32 por granja.
 *
 * Investigación previa (ver conteos manuales) mostró que:
 *  - Reading, Pesaje, Alert y Motorbomb YA tenían `granja` poblado en casi
 *    todo el histórico (una migración anterior no documentada lo dejó
 *    así) — todo apuntando a Granja Porcina COO-Alianzas, la única granja
 *    con hardware real. Los únicos Reading sin `granja` son lecturas
 *    `temp_clima_gps` (clima por GPS desde el celular, sin sensor físico,
 *    ver Reading.js) — esas NO son de un ESP32 y a propósito se dejan
 *    sin tocar aquí.
 *  - WaterConsumption es la excepción: el histórico tiene un campo
 *    `granja` (no `granja_id`, que es el nombre real en el schema y el
 *    que usan las consultas — ver motorbombController.toggleMotorbomb).
 *    Ese desajuste de nombre significa que el bloqueo de Bomba 1 a 600L/
 *    día nunca encontró el consumo real del día — esta migración lo
 *    corrige renombrando el campo.
 *
 * Uso: node scripts/seedDispositivos.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const GRANJA_PRINCIPAL_ID = '696413ec1dff9fe7d6baea75'; // Granja Porcina COO-Alianzas

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Conectado a MongoDB');

  const Dispositivo = require('../models/Dispositivo');
  const Reading = require('../models/Reading');
  const db = mongoose.connection.db;

  // 1. Registrar los ESP32 físicos existentes contra su granja real.
  const dispositivos = [
    { sensor_id: 'esp_porqueriza', tipo: 'temperatura', descripcion: 'Sensor DHT22 porqueriza (hardware original)' },
    { sensor_id: 'esp_flujo', tipo: 'flujo_agua', descripcion: 'Sensor de flujo YF-S201 (hardware original)' },
    { sensor_id: 'bascula', tipo: 'bascula', descripcion: 'Báscula HX711 (hardware original)' }
  ];
  for (const d of dispositivos) {
    const res = await Dispositivo.updateOne(
      { sensor_id: d.sensor_id },
      { $setOnInsert: { ...d, granja: GRANJA_PRINCIPAL_ID, activo: true } },
      { upsert: true }
    );
    console.log(`Dispositivo ${d.sensor_id}:`, res.upsertedCount ? 'creado' : 'ya existía');
  }

  // 2. Reading: backfill defensivo — solo lecturas de ESP32 real, nunca
  // temp_clima_gps (esas son de la app móvil, no de este hardware).
  const readingRes = await Reading.updateMany(
    { granja: { $exists: false }, tipo: { $ne: 'temp_clima_gps' } },
    { $set: { granja: GRANJA_PRINCIPAL_ID } }
  );
  console.log(`Reading backfilled (excluyendo temp_clima_gps): ${readingRes.modifiedCount}`);

  // 3. WaterConsumption: corregir el nombre de campo granja → granja_id.
  const waterCol = db.collection('waterconsumptions');
  const renombrados = await waterCol.updateMany(
    { granja_id: { $exists: false } },
    [{ $set: { granja_id: { $ifNull: ['$granja', GRANJA_PRINCIPAL_ID] } } }, { $unset: 'granja' }]
  );
  console.log(`WaterConsumption granja→granja_id corregido: ${renombrados.modifiedCount}`);

  console.log('Migración completa.');
  await mongoose.disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
