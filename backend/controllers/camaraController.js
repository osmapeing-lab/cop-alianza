/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - CONTROLADOR DE CAMARAS
 * ═══════════════════════════════════════════════════════════════════════
 */

const Camara = require('../models/Camara');
const Grabacion = require('../models/Grabacion');

// ═══════════════════════════════════════════════════════════════════════
// OBTENER TODAS LAS CAMARAS
// GET /api/camaras
// ═══════════════════════════════════════════════════════════════════════
exports.obtenerCamaras = async (req, res) => {
  try {
    const camaras = await Camara.find().sort({ createdAt: -1 });
    res.json(camaras);
  } catch (error) {
    console.error('[CAMARA] Error al obtener cámaras:', error);
    res.status(500).json({ mensaje: 'Error al obtener cámaras', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// OBTENER CAMARA POR ID
// GET /api/camaras/:id
// ═══════════════════════════════════════════════════════════════════════
exports.obtenerCamaraPorId = async (req, res) => {
  try {
    const camara = await Camara.findById(req.params.id);
    if (!camara) {
      return res.status(404).json({ mensaje: 'Cámara no encontrada' });
    }
    res.json(camara);
  } catch (error) {
    console.error('[CAMARA] Error al obtener cámara:', error);
    res.status(500).json({ mensaje: 'Error al obtener cámara', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// CREAR NUEVA CAMARA
// POST /api/camaras
// ═══════════════════════════════════════════════════════════════════════
exports.crearCamara = async (req, res) => {
  try {
    const { codigo, nombre, ubicacion, tipo, ip_local, resolucion } = req.body;
    
    // Verificar si ya existe
    const existente = await Camara.findOne({ codigo });
    if (existente) {
      return res.status(400).json({ mensaje: 'Ya existe una cámara con ese código' });
    }
    
    const nuevaCamara = new Camara({
      codigo,
      nombre,
      ubicacion,
      tipo,
      ip_local,
      url_stream: ip_local ? `http://${ip_local}:81/stream` : '',
      resolucion: resolucion || 'VGA'
    });
    
    await nuevaCamara.save();
    console.log('[CAMARA] Nueva cámara registrada:', codigo);
    res.status(201).json(nuevaCamara);
  } catch (error) {
    console.error('[CAMARA] Error al crear cámara:', error);
    res.status(500).json({ mensaje: 'Error al crear cámara', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ACTUALIZAR CAMARA
// PUT /api/camaras/:id
// ═══════════════════════════════════════════════════════════════════════
exports.actualizarCamara = async (req, res) => {
  try {
    const camara = await Camara.findByIdAndUpdate(
      req.params.id,
      { ...req.body, ultima_conexion: Date.now() },
      { new: true }
    );
    
    if (!camara) {
      return res.status(404).json({ mensaje: 'Cámara no encontrada' });
    }
    
    res.json(camara);
  } catch (error) {
    console.error('[CAMARA] Error al actualizar cámara:', error);
    res.status(500).json({ mensaje: 'Error al actualizar cámara', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ELIMINAR CAMARA
// DELETE /api/camaras/:id
// ═══════════════════════════════════════════════════════════════════════
exports.eliminarCamara = async (req, res) => {
  try {
    const camara = await Camara.findByIdAndDelete(req.params.id);
    if (!camara) {
      return res.status(404).json({ mensaje: 'Cámara no encontrada' });
    }
    
    // Eliminar grabaciones asociadas
    await Grabacion.deleteMany({ camara: req.params.id });
    
    res.json({ mensaje: 'Cámara eliminada correctamente' });
  } catch (error) {
    console.error('[CAMARA] Error al eliminar cámara:', error);
    res.status(500).json({ mensaje: 'Error al eliminar cámara', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// HEARTBEAT DE CAMARA (ESP32-CAM envía cada X segundos)
// POST /api/camaras/heartbeat
// ═══════════════════════════════════════════════════════════════════════
exports.heartbeat = async (req, res) => {
  try {
    const { codigo, ip_local, rssi } = req.body;
    
    let camara = await Camara.findOne({ codigo });
    
    if (!camara) {
      // Auto-registrar cámara si no existe
      camara = new Camara({
        codigo,
        nombre: `Cámara ${codigo}`,
        ubicacion: 'Por configurar',
        ip_local,
        url_stream: `http://${ip_local}:81/stream`,
        estado: 'activa'
      });
      await camara.save();
      console.log('[CAMARA] Nueva cámara auto-registrada:', codigo);
    } else {
      // Actualizar IP y estado
      camara.ip_local = ip_local;
      camara.url_stream = `http://${ip_local}:81/stream`;
      camara.estado = 'activa';
      camara.ultima_conexion = Date.now();
      await camara.save();
    }
    
    res.json({ 
      mensaje: 'OK',
      camara_id: camara._id,
      configuracion: camara.configuracion
    });
  } catch (error) {
    console.error('[CAMARA] Error en heartbeat:', error);
    res.status(500).json({ mensaje: 'Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// CAMBIAR ESTADO DE CAMARA
// PUT /api/camaras/:id/estado
// ═══════════════════════════════════════════════════════════════════════
exports.cambiarEstado = async (req, res) => {
  try {
    const { estado } = req.body;
    
    const camara = await Camara.findByIdAndUpdate(
      req.params.id,
      { estado },
      { new: true }
    );
    
    if (!camara) {
      return res.status(404).json({ mensaje: 'Cámara no encontrada' });
    }
    
    res.json(camara);
  } catch (error) {
    console.error('[CAMARA] Error al cambiar estado:', error);
    res.status(500).json({ mensaje: 'Error al cambiar estado', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// OBTENER CONFIGURACION DE CAMARA
// GET /api/camaras/:id/config
// ═══════════════════════════════════════════════════════════════════════
exports.obtenerConfiguracion = async (req, res) => {
  try {
    const camara = await Camara.findById(req.params.id);
    if (!camara) {
      return res.status(404).json({ mensaje: 'Cámara no encontrada' });
    }
    res.json(camara.configuracion);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ACTUALIZAR CONFIGURACION DE CAMARA
// PUT /api/camaras/:id/config
// ═══════════════════════════════════════════════════════════════════════
exports.actualizarConfiguracion = async (req, res) => {
  try {
    const camara = await Camara.findByIdAndUpdate(
      req.params.id,
      { configuracion: req.body },
      { new: true }
    );
    
    if (!camara) {
      return res.status(404).json({ mensaje: 'Cámara no encontrada' });
    }
    
    res.json(camara.configuracion);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error', error: error.message });
  }
};