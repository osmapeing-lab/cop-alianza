/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - CONTROLADOR DE GRABACIONES
 * ═══════════════════════════════════════════════════════════════════════
 */

const Grabacion = require('../models/Grabacion');
const Camara = require('../models/Camara');

// ═══════════════════════════════════════════════════════════════════════
// OBTENER GRABACIONES (con filtros)
// GET /api/grabaciones
// ═══════════════════════════════════════════════════════════════════════
exports.obtenerGrabaciones = async (req, res) => {
  try {
    const { camara, tipo, motivo, desde, hasta, limite = 50 } = req.query;
    
    let filtro = { eliminada: false };
    
    if (camara) filtro.camara = camara;
    if (tipo) filtro.tipo = tipo;
    if (motivo) filtro.motivo = motivo;
    
    if (desde || hasta) {
      filtro.fecha_inicio = {};
      if (desde) filtro.fecha_inicio.$gte = new Date(desde);
      if (hasta) filtro.fecha_inicio.$lte = new Date(hasta);
    }
    
    const grabaciones = await Grabacion.find(filtro)
      .populate('camara', 'codigo nombre ubicacion')
      .sort({ fecha_inicio: -1 })
      .limit(parseInt(limite));
    
    res.json(grabaciones);
  } catch (error) {
    console.error('[GRABACION] Error al obtener grabaciones:', error);
    res.status(500).json({ mensaje: 'Error al obtener grabaciones', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// OBTENER GRABACIONES DE UNA CAMARA
// GET /api/grabaciones/camara/:camaraId
// ═══════════════════════════════════════════════════════════════════════
exports.obtenerGrabacionesPorCamara = async (req, res) => {
  try {
    const grabaciones = await Grabacion.find({ 
      camara: req.params.camaraId,
      eliminada: false 
    })
      .sort({ fecha_inicio: -1 })
      .limit(100);
    
    res.json(grabaciones);
  } catch (error) {
    console.error('[GRABACION] Error:', error);
    res.status(500).json({ mensaje: 'Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// REGISTRAR NUEVA GRABACION (desde ESP32-CAM o manualmente)
// POST /api/grabaciones
// ═══════════════════════════════════════════════════════════════════════
exports.registrarGrabacion = async (req, res) => {
  try {
    const { 
      camara_codigo, 
      camara_id,
      tipo, 
      motivo, 
      archivo_nombre,
      archivo_url,
      archivo_size,
      duracion_segundos,
      evento_asociado,
      notas
    } = req.body;
    
    // Buscar cámara por código o ID
    let camara;
    if (camara_id) {
      camara = await Camara.findById(camara_id);
    } else if (camara_codigo) {
      camara = await Camara.findOne({ codigo: camara_codigo });
    }
    
    if (!camara) {
      return res.status(404).json({ mensaje: 'Cámara no encontrada' });
    }
    
    const nuevaGrabacion = new Grabacion({
      camara: camara._id,
      tipo,
      motivo: motivo || 'manual',
      archivo_nombre,
      archivo_url,
      archivo_size,
      duracion_segundos,
      evento_asociado,
      notas
    });
    
    await nuevaGrabacion.save();
    
    console.log(`[GRABACION] Nueva ${tipo} registrada - Cámara: ${camara.codigo}`);
    
    res.status(201).json(nuevaGrabacion);
  } catch (error) {
    console.error('[GRABACION] Error al registrar:', error);
    res.status(500).json({ mensaje: 'Error al registrar grabación', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// CAPTURAR FOTO (ESP32-CAM envia foto)
// POST /api/grabaciones/foto
// ═══════════════════════════════════════════════════════════════════════
exports.capturarFoto = async (req, res) => {
  try {
    const { camara_codigo, motivo, evento_asociado } = req.body;
    
    const camara = await Camara.findOne({ codigo: camara_codigo });
    if (!camara) {
      return res.status(404).json({ mensaje: 'Cámara no encontrada' });
    }
    
    // Generar nombre de archivo
    const timestamp = Date.now();
    const archivo_nombre = `${camara_codigo}_${timestamp}.jpg`;
    
    const nuevaGrabacion = new Grabacion({
      camara: camara._id,
      tipo: 'foto',
      motivo: motivo || 'manual',
      archivo_nombre,
      evento_asociado
    });
    
    await nuevaGrabacion.save();
    
    // Actualizar última conexión de cámara
    camara.ultima_conexion = Date.now();
    await camara.save();
    
    console.log(`[GRABACION] Foto capturada - Cámara: ${camara_codigo}`);
    
    res.status(201).json({
      mensaje: 'Foto registrada',
      grabacion_id: nuevaGrabacion._id,
      archivo: archivo_nombre
    });
  } catch (error) {
    console.error('[GRABACION] Error al capturar foto:', error);
    res.status(500).json({ mensaje: 'Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ELIMINAR GRABACION (soft delete)
// DELETE /api/grabaciones/:id
// ═══════════════════════════════════════════════════════════════════════
exports.eliminarGrabacion = async (req, res) => {
  try {
    const grabacion = await Grabacion.findByIdAndUpdate(
      req.params.id,
      { eliminada: true },
      { new: true }
    );
    
    if (!grabacion) {
      return res.status(404).json({ mensaje: 'Grabación no encontrada' });
    }
    
    res.json({ mensaje: 'Grabación eliminada' });
  } catch (error) {
    console.error('[GRABACION] Error al eliminar:', error);
    res.status(500).json({ mensaje: 'Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ESTADISTICAS DE GRABACIONES
// GET /api/grabaciones/estadisticas
// ═══════════════════════════════════════════════════════════════════════
exports.obtenerEstadisticas = async (req, res) => {
  try {
    const totalFotos = await Grabacion.countDocuments({ tipo: 'foto', eliminada: false });
    const totalVideos = await Grabacion.countDocuments({ tipo: 'video', eliminada: false });
    const totalAlertas = await Grabacion.countDocuments({ motivo: 'alerta', eliminada: false });
    const totalMovimiento = await Grabacion.countDocuments({ motivo: 'movimiento', eliminada: false });
    
    // Grabaciones de hoy
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const grabacionesHoy = await Grabacion.countDocuments({
      fecha_inicio: { $gte: hoy },
      eliminada: false
    });
    
    // Espacio usado (aproximado)
    const espacioUsado = await Grabacion.aggregate([
      { $match: { eliminada: false } },
      { $group: { _id: null, total: { $sum: '$archivo_size' } } }
    ]);
    
    res.json({
      total_fotos: totalFotos,
      total_videos: totalVideos,
      total_alertas: totalAlertas,
      total_movimiento: totalMovimiento,
      grabaciones_hoy: grabacionesHoy,
      espacio_usado_bytes: espacioUsado[0]?.total || 0
    });
  } catch (error) {
    console.error('[GRABACION] Error en estadísticas:', error);
    res.status(500).json({ mensaje: 'Error', error: error.message });
  }
};