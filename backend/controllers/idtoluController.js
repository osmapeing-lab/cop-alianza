const axios = require('axios');
const Reading = require('../models/Reading');

// CONFIGURACION IDTOLU - Modificar cuando tengas los datos reales
const IDTOLU_URL = process.env.IDTOLU_URL || '';
const INTERVALO_MINUTOS = 5;

let ultimaLectura = {
  temperatura: null,
  humedad: null,
  nivel_tanque1: null,
  nivel_tanque2: null,
  consumo_agua: null,
  conectado: false,
  ultima_actualizacion: null
};

// Obtener datos de idtolu (MODIFICAR cuando tengas la URL y estructura)
exports.scrapearDatos = async () => {
  if (!IDTOLU_URL) {
    console.log('URL de idtolu no configurada');
    return null;
  }

  try {
    const response = await axios.get(IDTOLU_URL, {
      timeout: 10000,
      headers: {
        'User-Agent': 'COP-Alianza-Monitor/1.0'
      }
    });

    // MODIFICAR estos selectores segun la estructura real de idtolu
    // Por ahora es estructura de ejemplo
    const datos = response.data;

    ultimaLectura = {
      temperatura: datos.temperatura || null,
      humedad: datos.humedad || null,
      nivel_tanque1: datos.nivel_tanque1 || null,
      nivel_tanque2: datos.nivel_tanque2 || null,
      consumo_agua: datos.consumo_agua || null,
      conectado: true,
      ultima_actualizacion: new Date()
    };

    // Guardar en base de datos
    const lecturas = [];

    if (ultimaLectura.temperatura) {
      lecturas.push(new Reading({
        sensor: 'idtolu',
        tipo: 'temperatura_porqueriza',
        valor: ultimaLectura.temperatura,
        unidad: '°C'
      }));
    }

    if (ultimaLectura.humedad) {
      lecturas.push(new Reading({
        sensor: 'idtolu',
        tipo: 'humedad_porqueriza',
        valor: ultimaLectura.humedad,
        unidad: '%'
      }));
    }

    if (lecturas.length > 0) {
      await Reading.insertMany(lecturas);
    }

    console.log('Datos idtolu actualizados:', ultimaLectura);
    return ultimaLectura;

  } catch (error) {
    console.log('Error conectando con idtolu:', error.message);
    ultimaLectura.conectado = false;
    return null;
  }
};

// Obtener ultima lectura
exports.getUltimaLectura = (req, res) => {
  res.json(ultimaLectura);
};

// Forzar actualizacion manual
exports.forzarActualizacion = async (req, res) => {
  try {
    const datos = await exports.scrapearDatos();
    if (datos) {
      res.json({ mensaje: 'Datos actualizados', datos });
    } else {
      res.status(503).json({ mensaje: 'No se pudo conectar con idtolu', datos: ultimaLectura });
    }
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// Recibir datos manualmente (si idtolu envia por POST)
exports.recibirDatos = async (req, res) => {
  try {
    const { temperatura, humedad, nivel_tanque1, nivel_tanque2, consumo_agua } = req.body;

    ultimaLectura = {
      temperatura: temperatura || ultimaLectura.temperatura,
      humedad: humedad || ultimaLectura.humedad,
      nivel_tanque1: nivel_tanque1 || ultimaLectura.nivel_tanque1,
      nivel_tanque2: nivel_tanque2 || ultimaLectura.nivel_tanque2,
      consumo_agua: consumo_agua || ultimaLectura.consumo_agua,
      conectado: true,
      ultima_actualizacion: new Date()
    };

    // Emitir por WebSocket si esta disponible
    if (req.io) {
      req.io.emit('idtolu_datos', ultimaLectura);
    }

    res.json({ mensaje: 'Datos recibidos', datos: ultimaLectura });
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

// Verificar conexion
exports.verificarConexion = (req, res) => {
  const tiempoSinDatos = ultimaLectura.ultima_actualizacion 
    ? (new Date() - new Date(ultimaLectura.ultima_actualizacion)) / 1000 / 60 
    : null;

  res.json({
    conectado: ultimaLectura.conectado && tiempoSinDatos < 10,
    ultima_actualizacion: ultimaLectura.ultima_actualizacion,
    minutos_sin_datos: tiempoSinDatos ? Math.round(tiempoSinDatos) : null
  });
};

// Iniciar scraping automatico
exports.iniciarScrapingAutomatico = () => {
  if (!IDTOLU_URL) {
    console.log('Scraping idtolu desactivado - URL no configurada');
    return;
  }

  console.log(`Scraping idtolu cada ${INTERVALO_MINUTOS} minutos`);
  
  exports.scrapearDatos();
  
  setInterval(() => {
    exports.scrapearDatos();
  }, INTERVALO_MINUTOS * 60 * 1000);
};