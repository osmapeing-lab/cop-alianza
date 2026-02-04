/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - CONTROLADOR DE VENTAS
 * ═══════════════════════════════════════════════════════════════════════
 */

const Venta = require('../models/Venta');
const Inventario = require('../models/Inventario');
const Lote = require('../models/lote');

// ═══════════════════════════════════════════════════════════════════════
// OBTENER TODAS LAS VENTAS
// GET /api/ventas
// ═══════════════════════════════════════════════════════════════════════
exports.obtenerVentas = async (req, res) => {
  try {
    const { tipo_venta, estado_pago, desde, hasta, limite = 50 } = req.query;
    
    let filtro = { activa: true };
    
    if (tipo_venta) filtro.tipo_venta = tipo_venta;
    if (estado_pago) filtro.estado_pago = estado_pago;
    
    if (desde || hasta) {
      filtro.fecha_venta = {};
      if (desde) filtro.fecha_venta.$gte = new Date(desde);
      if (hasta) filtro.fecha_venta.$lte = new Date(hasta);
    }
    
    const ventas = await Venta.find(filtro)
      .populate('lote', 'nombre')
      .sort({ fecha_venta: -1 })
      .limit(parseInt(limite));
    
    res.json(ventas);
  } catch (error) {
    console.error('[VENTA] Error al obtener ventas:', error);
    res.status(500).json({ mensaje: 'Error al obtener ventas', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// OBTENER VENTA POR ID
// GET /api/ventas/:id
// ═══════════════════════════════════════════════════════════════════════
exports.obtenerVentaPorId = async (req, res) => {
  try {
    const venta = await Venta.findById(req.params.id)
      .populate('lote', 'nombre cantidad_cerdos')
      .populate('registrado_por', 'usuario');
    
    if (!venta) {
      return res.status(404).json({ mensaje: 'Venta no encontrada' });
    }
    
    res.json(venta);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// REGISTRAR NUEVA VENTA
// POST /api/ventas
// ═══════════════════════════════════════════════════════════════════════
exports.registrarVenta = async (req, res) => {
  try {
    const nuevaVenta = new Venta(req.body);
    await nuevaVenta.save();
    
    console.log(`[VENTA] Nueva venta registrada: ${nuevaVenta.numero_factura}`);
    
    // Si hay lote asociado, actualizar cantidad de cerdos
    if (req.body.lote && req.body.cantidad) {
      await Lote.findByIdAndUpdate(req.body.lote, {
        $inc: { cantidad_cerdos: -req.body.cantidad }
      });
    }
    
    res.status(201).json(nuevaVenta);
  } catch (error) {
    console.error('[VENTA] Error al registrar:', error);
    res.status(500).json({ mensaje: 'Error al registrar venta', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ACTUALIZAR VENTA
// PUT /api/ventas/:id
// ═══════════════════════════════════════════════════════════════════════
exports.actualizarVenta = async (req, res) => {
  try {
    const venta = await Venta.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!venta) {
      return res.status(404).json({ mensaje: 'Venta no encontrada' });
    }
    
    res.json(venta);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// REGISTRAR PAGO
// POST /api/ventas/:id/pago
// ═══════════════════════════════════════════════════════════════════════
exports.registrarPago = async (req, res) => {
  try {
    const { monto, metodo, referencia, notas } = req.body;
    
    const venta = await Venta.findById(req.params.id);
    if (!venta) {
      return res.status(404).json({ mensaje: 'Venta no encontrada' });
    }
    
    // Agregar pago al historial
    venta.pagos.push({
      monto,
      metodo: metodo || 'efectivo',
      referencia,
      notas
    });
    
    // Actualizar monto pagado
    venta.monto_pagado += monto;
    
    await venta.save();
    
    console.log(`[VENTA] Pago registrado: $${monto} - Factura: ${venta.numero_factura}`);
    
    res.json(venta);
  } catch (error) {
    console.error('[VENTA] Error al registrar pago:', error);
    res.status(500).json({ mensaje: 'Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ANULAR VENTA
// PUT /api/ventas/:id/anular
// ═══════════════════════════════════════════════════════════════════════
exports.anularVenta = async (req, res) => {
  try {
    const venta = await Venta.findByIdAndUpdate(
      req.params.id,
      { 
        activa: false,
        estado_pago: 'cancelado'
      },
      { new: true }
    );
    
    if (!venta) {
      return res.status(404).json({ mensaje: 'Venta no encontrada' });
    }
    
    // Restaurar cantidad de cerdos al lote
    if (venta.lote && venta.cantidad) {
      await Lote.findByIdAndUpdate(venta.lote, {
        $inc: { cantidad_cerdos: venta.cantidad }
      });
    }
    
    res.json({ mensaje: 'Venta anulada', venta });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ESTADISTICAS DE VENTAS
// GET /api/ventas/estadisticas
// ═══════════════════════════════════════════════════════════════════════
exports.obtenerEstadisticas = async (req, res) => {
  try {
    const { mes, año } = req.query;
    
    let filtroFecha = { activa: true };
    
    if (mes && año) {
      const inicioMes = new Date(año, mes - 1, 1);
      const finMes = new Date(año, mes, 0, 23, 59, 59);
      filtroFecha.fecha_venta = { $gte: inicioMes, $lte: finMes };
    }
    
    // Total por tipo de venta
    const ventasPorTipo = await Venta.aggregate([
      { $match: filtroFecha },
      { 
        $group: { 
          _id: '$tipo_venta',
          cantidad_ventas: { $sum: 1 },
          cantidad_cerdos: { $sum: '$cantidad' },
          peso_total: { $sum: '$peso_total_kg' },
          total_vendido: { $sum: '$total' },
          total_cobrado: { $sum: '$monto_pagado' }
        }
      }
    ]);
    
    // Totales generales
    const totales = await Venta.aggregate([
      { $match: filtroFecha },
      {
        $group: {
          _id: null,
          total_ventas: { $sum: 1 },
          total_cerdos: { $sum: '$cantidad' },
          total_kg: { $sum: '$peso_total_kg' },
          ingresos_totales: { $sum: '$total' },
          cobrado: { $sum: '$monto_pagado' },
          pendiente: { $sum: '$saldo_pendiente' }
        }
      }
    ]);
    
    // Ventas pendientes de pago
    const ventasPendientes = await Venta.countDocuments({
      ...filtroFecha,
      estado_pago: { $in: ['pendiente', 'parcial'] }
    });
    
    res.json({
      por_tipo: ventasPorTipo,
      totales: totales[0] || {
        total_ventas: 0,
        total_cerdos: 0,
        total_kg: 0,
        ingresos_totales: 0,
        cobrado: 0,
        pendiente: 0
      },
      ventas_pendientes_pago: ventasPendientes
    });
  } catch (error) {
    console.error('[VENTA] Error en estadísticas:', error);
    res.status(500).json({ mensaje: 'Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// PRECIOS SUGERIDOS POR TIPO
// GET /api/ventas/precios
// ═══════════════════════════════════════════════════════════════════════
exports.obtenerPrecios = async (req, res) => {
  try {
    // Precios promedio de las últimas 10 ventas por tipo
    const precios = await Venta.aggregate([
      { $match: { activa: true } },
      { $sort: { fecha_venta: -1 } },
      {
        $group: {
          _id: '$tipo_venta',
          precio_promedio: { $avg: '$precio_kg' },
          precio_min: { $min: '$precio_kg' },
          precio_max: { $max: '$precio_kg' },
          ultima_venta: { $first: '$precio_kg' }
        }
      }
    ]);
    
    // Precios base sugeridos si no hay historial
    const preciosBase = {
      en_pie: { precio_sugerido: 8000, unidad: 'kg' },
      carne: { precio_sugerido: 14000, unidad: 'kg' },
      lechon: { precio_sugerido: 180000, unidad: 'unidad' }
    };
    
    res.json({
      historial: precios,
      base: preciosBase
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error', error: error.message });
  }
};