/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - CONTROLADOR DE INVENTARIO
 * ═══════════════════════════════════════════════════════════════════════
 */

const Inventario = require('../models/Inventario');

// ═══════════════════════════════════════════════════════════════════════
// OBTENER INVENTARIO
// GET /api/inventario
// ═══════════════════════════════════════════════════════════════════════
exports.obtenerInventario = async (req, res) => {
  try {
    const { tipo, estado = 'activo', lote, limite = 100 } = req.query;
    
    let filtro = {};
    
    if (tipo) filtro.tipo = tipo;
    if (estado) filtro.estado = estado;
    if (lote) filtro.lote = lote;
    
    const inventario = await Inventario.find(filtro)
      .populate('lote', 'nombre')
      .sort({ createdAt: -1 })
      .limit(parseInt(limite));
    
    res.json(inventario);
  } catch (error) {
    console.error('[INVENTARIO] Error:', error);
    res.status(500).json({ mensaje: 'Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// OBTENER CERDO POR ID
// GET /api/inventario/:id
// ═══════════════════════════════════════════════════════════════════════
exports.obtenerPorId = async (req, res) => {
  try {
    const cerdo = await Inventario.findById(req.params.id)
      .populate('lote', 'nombre')
      .populate('madre', 'codigo')
      .populate('padre', 'codigo');
    
    if (!cerdo) {
      return res.status(404).json({ mensaje: 'Cerdo no encontrado' });
    }
    
    res.json(cerdo);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// REGISTRAR NUEVO CERDO
// POST /api/inventario
// ═══════════════════════════════════════════════════════════════════════
exports.registrarCerdo = async (req, res) => {
  try {
    // Generar código automático
    const count = await Inventario.countDocuments();
    const codigo = `CERDO-${String(count + 1).padStart(4, '0')}`;
    
    const nuevoCerdo = new Inventario({
      ...req.body,
      codigo
    });
    
    // Si hay peso inicial, agregarlo al historial
    if (req.body.peso_actual) {
      nuevoCerdo.peso_ingreso = req.body.peso_actual;
      nuevoCerdo.historial_peso.push({
        peso: req.body.peso_actual,
        fecha: new Date()
      });
    }
    
    await nuevoCerdo.save();
    
    console.log(`[INVENTARIO] Nuevo cerdo registrado: ${nuevoCerdo.codigo}`);
    
    res.status(201).json(nuevoCerdo);
  } catch (error) {
    console.error('[INVENTARIO] Error al registrar:', error);
    res.status(500).json({ mensaje: 'Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ACTUALIZAR CERDO
// PUT /api/inventario/:id
// ═══════════════════════════════════════════════════════════════════════
exports.actualizarCerdo = async (req, res) => {
  try {
    const cerdo = await Inventario.findById(req.params.id);
    
    if (!cerdo) {
      return res.status(404).json({ mensaje: 'Cerdo no encontrado' });
    }
    
    // Si cambió el peso, agregar al historial
    if (req.body.peso_actual && req.body.peso_actual !== cerdo.peso_actual) {
      cerdo.historial_peso.push({
        peso: req.body.peso_actual,
        fecha: new Date()
      });
    }
    
    Object.assign(cerdo, req.body);
    await cerdo.save();
    
    res.json(cerdo);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// REGISTRAR PESO
// POST /api/inventario/:id/peso
// ═══════════════════════════════════════════════════════════════════════
exports.registrarPeso = async (req, res) => {
  try {
    const { peso } = req.body;
    
    const cerdo = await Inventario.findById(req.params.id);
    if (!cerdo) {
      return res.status(404).json({ mensaje: 'Cerdo no encontrado' });
    }
    
    cerdo.peso_actual = peso;
    cerdo.historial_peso.push({ peso, fecha: new Date() });
    
    await cerdo.save();
    
    res.json(cerdo);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// REGISTRAR SALIDA (venta, muerte, descarte)
// PUT /api/inventario/:id/salida
// ═══════════════════════════════════════════════════════════════════════
exports.registrarSalida = async (req, res) => {
  try {
    const { estado, motivo_salida, venta } = req.body;
    
    const cerdo = await Inventario.findByIdAndUpdate(
      req.params.id,
      {
        estado,
        motivo_salida,
        venta,
        fecha_salida: new Date()
      },
      { new: true }
    );
    
    if (!cerdo) {
      return res.status(404).json({ mensaje: 'Cerdo no encontrado' });
    }
    
    res.json(cerdo);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ESTADISTICAS DE INVENTARIO
// GET /api/inventario/estadisticas
// ═══════════════════════════════════════════════════════════════════════
exports.obtenerEstadisticas = async (req, res) => {
  try {
    // Total por tipo
    const porTipo = await Inventario.aggregate([
      { $match: { estado: 'activo' } },
      {
        $group: {
          _id: '$tipo',
          cantidad: { $sum: 1 },
          peso_promedio: { $avg: '$peso_actual' }
        }
      }
    ]);
    
    // Total por sexo
    const porSexo = await Inventario.aggregate([
      { $match: { estado: 'activo' } },
      {
        $group: {
          _id: '$sexo',
          cantidad: { $sum: 1 }
        }
      }
    ]);
    
    // Total activos
    const totalActivos = await Inventario.countDocuments({ estado: 'activo' });
    
    // Peso total
    const pesoTotal = await Inventario.aggregate([
      { $match: { estado: 'activo' } },
      { $group: { _id: null, total: { $sum: '$peso_actual' } } }
    ]);
    
    // Por estado de salud
    const porSalud = await Inventario.aggregate([
      { $match: { estado: 'activo' } },
      {
        $group: {
          _id: '$estado_salud',
          cantidad: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      total_activos: totalActivos,
      peso_total_kg: pesoTotal[0]?.total || 0,
      por_tipo: porTipo,
      por_sexo: porSexo,
      por_salud: porSalud
    });
  } catch (error) {
    console.error('[INVENTARIO] Error en estadísticas:', error);
    res.status(500).json({ mensaje: 'Error', error: error.message });
  }
};