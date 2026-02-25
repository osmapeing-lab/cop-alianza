/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - CONTROLADOR INVENTARIO DE ALIMENTO (CORREGIDO)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * CORRECCIONES:
 * - registrarSalida: la alerta de stock bajo se evalúa DESPUÉS de llamar a
 *   registrarSalida() y recargando el documento desde BD, no con el
 *   objeto viejo en memoria.
 * - Se diferencia entre "stock agotado" (critico) y "stock bajo" (alerta).
 * - Se emite socket 'alerta_stock' para notificación en tiempo real.
 * - El costo creado en salida usa los valores actualizados del inventario.
 * ═══════════════════════════════════════════════════════════════════════
 */

const InventarioAlimento = require('../models/InventarioAlimento');
const Costo = require('../models/Costo');
const Lote = require('../models/lote');
const Alert = require('../models/Alert');
const { verificarStockCriticoAlimento, resetearAlertaStockAlimento } = require('../utils/notificationManager');

// ═══════════════════════════════════════════════════════════════════════
// OBTENER TODOS LOS INVENTARIOS DE ALIMENTO
// GET /api/inventario-alimento
// ═══════════════════════════════════════════════════════════════════════
exports.getAll = async (req, res) => {
  try {
    const inventarios = await InventarioAlimento.find({ activo: true })
      .sort({ nombre: 1 });
    res.json(inventarios);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// OBTENER UN INVENTARIO POR ID
// GET /api/inventario-alimento/:id
// ═══════════════════════════════════════════════════════════════════════
exports.getById = async (req, res) => {
  try {
    const inventario = await InventarioAlimento.findById(req.params.id);
    if (!inventario) {
      return res.status(404).json({ mensaje: 'Inventario no encontrado' });
    }
    res.json(inventario);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// OBTENER RESUMEN GENERAL
// GET /api/inventario-alimento/resumen
// ═══════════════════════════════════════════════════════════════════════
exports.getResumen = async (req, res) => {
  try {
    const resumen = await InventarioAlimento.getResumen();
    res.json(resumen);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// CREAR INVENTARIO DE ALIMENTO
// POST /api/inventario-alimento
// ═══════════════════════════════════════════════════════════════════════
exports.create = async (req, res) => {
  try {
    const inventario = new InventarioAlimento(req.body);
    await inventario.save();
    res.status(201).json(inventario);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ACTUALIZAR INVENTARIO
// PUT /api/inventario-alimento/:id
// ═══════════════════════════════════════════════════════════════════════
exports.update = async (req, res) => {
  try {
    const inventario = await InventarioAlimento.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!inventario) {
      return res.status(404).json({ mensaje: 'Inventario no encontrado' });
    }
    res.json(inventario);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ELIMINAR INVENTARIO (soft delete)
// DELETE /api/inventario-alimento/:id
// ═══════════════════════════════════════════════════════════════════════
exports.delete = async (req, res) => {
  try {
    const inventario = await InventarioAlimento.findByIdAndUpdate(
      req.params.id,
      { activo: false },
      { new: true }
    );
    if (!inventario) {
      return res.status(404).json({ mensaje: 'Inventario no encontrado' });
    }
    res.json({ mensaje: 'Inventario eliminado' });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// REGISTRAR ENTRADA (compra de alimento)
// POST /api/inventario-alimento/:id/entrada
// ═══════════════════════════════════════════════════════════════════════
exports.registrarEntrada = async (req, res) => {
  try {
    const { cantidad_bultos, precio_bulto, descripcion } = req.body;

    if (!cantidad_bultos || cantidad_bultos <= 0) {
      return res.status(400).json({ mensaje: 'Cantidad de bultos requerida' });
    }

    const inventario = await InventarioAlimento.findById(req.params.id);
    if (!inventario) {
      return res.status(404).json({ mensaje: 'Inventario no encontrado' });
    }

    await inventario.registrarEntrada(
      cantidad_bultos,
      precio_bulto || inventario.precio_bulto,
      descripcion,
      req.user?._id
    );

    // Al reponer stock, resetear alerta de 10 kg para este producto
    await resetearAlertaStockAlimento(inventario._id).catch(() => {});

    res.json({
      mensaje: 'Entrada registrada correctamente',
      inventario
    });
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// REGISTRAR SALIDA (consumo por lote) — CORREGIDA
// POST /api/inventario-alimento/:id/salida
//
// CORRECCIÓN PRINCIPAL:
//   La alerta de stock se evalúa DESPUÉS de llamar a registrarSalida()
//   y recargando el documento actualizado desde BD. El objeto 'inventario'
//   en memoria aún tiene el stock anterior y daría valores erróneos.
// ═══════════════════════════════════════════════════════════════════════
exports.registrarSalida = async (req, res) => {
  try {
    const { cantidad_bultos, lote_id, descripcion } = req.body;

    if (!cantidad_bultos || cantidad_bultos <= 0) {
      return res.status(400).json({ mensaje: 'Cantidad de bultos requerida' });
    }

    const inventario = await InventarioAlimento.findById(req.params.id);
    if (!inventario) {
      return res.status(404).json({ mensaje: 'Inventario no encontrado' });
    }

    // ── Validar stock ANTES de intentar la salida ─────────────────
    if (cantidad_bultos > inventario.cantidad_bultos) {
      const alerta = new Alert({
        tipo: 'critico',
        mensaje: `🚫 Stock insuficiente de ${inventario.nombre}. Solicitado: ${cantidad_bultos} bultos, Disponible: ${inventario.cantidad_bultos}`
      });
      await alerta.save();

      if (req.io) {
        req.io.emit('alerta_critica', alerta);
      }

      return res.status(400).json({
        mensaje: 'Stock insuficiente',
        disponible: inventario.cantidad_bultos,
        solicitado: cantidad_bultos
      });
    }

    // ── Ejecutar la salida ────────────────────────────────────────
    await inventario.registrarSalida(
      cantidad_bultos,
      lote_id,
      descripcion,
      req.user?._id
    );

    // ── Recargar documento ACTUALIZADO desde BD ───────────────────
    // CORRECCIÓN: No usar 'inventario' viejo para calcular stock restante
    const inventarioActualizado = await InventarioAlimento.findById(req.params.id);

    // ── Crear costo con valores actualizados ──────────────────────
    if (lote_id) {
      const lote = await Lote.findById(lote_id);
      const precioPorKg = inventarioActualizado.peso_por_bulto_kg > 0
        ? inventarioActualizado.precio_bulto / inventarioActualizado.peso_por_bulto_kg
        : 0;

      const costo = new Costo({
        tipo_costo: 'directo',
        categoria: 'alimento_concentrado',
        descripcion: descripcion || `Alimento para lote: ${lote?.nombre || 'Sin nombre'}`,
        cantidad: cantidad_bultos * inventarioActualizado.peso_por_bulto_kg,
        unidad: 'kg',
        precio_unitario: precioPorKg,
        total: cantidad_bultos * inventarioActualizado.precio_bulto,
        lote: lote_id,
        estado: 'registrado'
      });
      await costo.save();
    }

    // ── Verificar stock DESPUÉS de actualizar ─────────────────────
    // CORRECCIÓN: usa inventarioActualizado con el stock real post-salida
    if (inventarioActualizado.cantidad_bultos <= inventarioActualizado.stock_minimo_bultos) {
      const agotado = inventarioActualizado.cantidad_bultos === 0;
      const tipoAlerta = agotado ? 'critico' : 'alerta';
      const emoji    = agotado ? '🔴' : '⚠️';
      const estado   = agotado ? 'AGOTADO' : 'bajo';

      const alerta = new Alert({
        tipo: tipoAlerta,
        mensaje: `${emoji} Stock ${estado} de ${inventarioActualizado.nombre}. ` +
                 `Quedan ${inventarioActualizado.cantidad_bultos} bultos ` +
                 `(mínimo: ${inventarioActualizado.stock_minimo_bultos})`
      });
      await alerta.save();

      // Notificación en tiempo real al frontend
      if (req.io) {
        req.io.emit('alerta_stock', alerta);
      }
    }

    // ── Alerta crítica si quedan ≤ 10 kg ─────────────────────────
    await verificarStockCriticoAlimento(inventarioActualizado).catch(e =>
      console.error('[STOCK] Error alerta 10kg:', e.message)
    );

    res.json({
      mensaje: 'Salida registrada correctamente',
      inventario: inventarioActualizado
    });
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// OBTENER MOVIMIENTOS DE UN INVENTARIO
// GET /api/inventario-alimento/:id/movimientos
// ═══════════════════════════════════════════════════════════════════════
exports.getMovimientos = async (req, res) => {
  try {
    const limite = parseInt(req.query.limite) || 50;
    const inventario = await InventarioAlimento.findById(req.params.id)
      .populate('movimientos.lote', 'nombre')
      .populate('movimientos.registrado_por', 'usuario');

    if (!inventario) {
      return res.status(404).json({ mensaje: 'Inventario no encontrado' });
    }

    const movimientos = inventario.movimientos
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .slice(0, limite);

    res.json(movimientos);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// OBTENER CONSUMO POR LOTE
// GET /api/inventario-alimento/consumo-por-lote
// ═══════════════════════════════════════════════════════════════════════
exports.getConsumoPorLote = async (req, res) => {
  try {
    const inventarios = await InventarioAlimento.find({ activo: true });

    const consumoPorLote = {};

    inventarios.forEach(inv => {
      inv.movimientos
        .filter(m => m.tipo === 'salida' && m.lote)
        .forEach(m => {
          const loteId = m.lote.toString();
          if (!consumoPorLote[loteId]) {
            consumoPorLote[loteId] = { lote: m.lote, bultos: 0, kg: 0, costo: 0 };
          }
          consumoPorLote[loteId].bultos += m.cantidad_bultos;
          consumoPorLote[loteId].kg     += m.cantidad_kg;
          consumoPorLote[loteId].costo  += m.total;
        });
    });

    const loteIds = Object.keys(consumoPorLote);
    const lotes   = await Lote.find({ _id: { $in: loteIds } });
    const loteMap = {};
    lotes.forEach(l => { loteMap[l._id.toString()] = l.nombre; });

    const resultado = Object.entries(consumoPorLote).map(([loteId, data]) => ({
      lote_id:    loteId,
      lote_nombre: loteMap[loteId] || 'Sin nombre',
      bultos: data.bultos,
      kg:     data.kg,
      costo:  data.costo
    }));

    res.json(resultado);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// VERIFICAR ALERTAS DE STOCK BAJO
// GET /api/inventario-alimento/verificar-stock
// ═══════════════════════════════════════════════════════════════════════
exports.verificarStock = async (req, res) => {
  try {
    const inventarios = await InventarioAlimento.find({ activo: true });
    const alertas = [];

    inventarios.forEach(inv => {
      if (inv.cantidad_bultos <= inv.stock_minimo_bultos) {
        alertas.push({
          inventario_id: inv._id,
          nombre:          inv.nombre,
          tipo:            inv.tipo,
          cantidad_actual: inv.cantidad_bultos,
          stock_minimo:    inv.stock_minimo_bultos,
          prioridad:       inv.cantidad_bultos === 0 ? 'critico' : 'alerta'
        });
      }
    });

    res.json(alertas);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};