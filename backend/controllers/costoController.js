/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - CONTROLADOR DE COSTOS (Contabilidad)
 * ═══════════════════════════════════════════════════════════════════════
 */

const Costo             = require('../models/Costo');
const Venta             = require('../models/Venta');
const Lote              = require('../models/lote');
const InventarioAlimento = require('../models/InventarioAlimento');

// ═══════════════════════════════════════════════════════════════════════
// OBTENER TODOS LOS COSTOS
// GET /api/costos
// ═══════════════════════════════════════════════════════════════════════
exports.obtenerCostos = async (req, res) => {
  try {
    const { tipo_costo, categoria, mes, año, lote, limite = 100 } = req.query;
    
    let filtro = { estado: { $ne: 'anulado' } };
    
    if (tipo_costo) filtro.tipo_costo = tipo_costo;
    if (categoria) filtro.categoria = categoria;
    if (lote) filtro.lote = lote;
    
    if (mes && año) {
      filtro['periodo.mes'] = parseInt(mes);
      filtro['periodo.año'] = parseInt(año);
    }
    
    const costos = await Costo.find(filtro)
      .populate('lote', 'nombre')
      .sort({ fecha: -1 })
      .limit(parseInt(limite));
    
    res.json(costos);
  } catch (error) {
    console.error('[COSTO] Error al obtener costos:', error);
    res.status(500).json({ mensaje: 'Error al obtener costos', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// REGISTRAR NUEVO COSTO
// POST /api/costos
// ═══════════════════════════════════════════════════════════════════════
exports.registrarCosto = async (req, res) => {
  try {
    const nuevoCosto = new Costo(req.body);
    await nuevoCosto.save();
    
    console.log(`[COSTO] Nuevo costo registrado: ${nuevoCosto.categoria} - $${nuevoCosto.total}`);
    
    res.status(201).json(nuevoCosto);
  } catch (error) {
    console.error('[COSTO] Error al registrar:', error);
    res.status(500).json({ mensaje: 'Error al registrar costo', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ACTUALIZAR COSTO
// PUT /api/costos/:id
// ═══════════════════════════════════════════════════════════════════════
exports.actualizarCosto = async (req, res) => {
  try {
    const costo = await Costo.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!costo) {
      return res.status(404).json({ mensaje: 'Costo no encontrado' });
    }
    
    res.json(costo);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ANULAR COSTO
// DELETE /api/costos/:id
// ═══════════════════════════════════════════════════════════════════════
exports.anularCosto = async (req, res) => {
  try {
    const costo = await Costo.findByIdAndDelete(req.params.id);

    if (!costo) {
      return res.status(404).json({ mensaje: 'Costo no encontrado' });
    }

    // Si el costo pertenece a un lote, eliminar también el gasto semanal asociado
    if (costo.lote) {
      const lote = await Lote.findById(costo.lote);
      if (lote) {
        const idx = lote.gastos_semanales.findIndex(
          g => (g.costo_id && g.costo_id.toString() === costo._id.toString())
            || (g.monto === costo.total && g.descripcion === costo.descripcion)
        );
        if (idx !== -1) {
          lote.gastos_semanales.splice(idx, 1);
          lote.total_gastos = lote.gastos_semanales.reduce((s, g) => s + (g.monto || 0), 0);
          await lote.save();
        }
      }
    }

    // Si el costo tiene inventario_ref, revertir los bultos en inventario
    if (costo.inventario_ref && costo.bultos_ref > 0) {
      const inv = await InventarioAlimento.findById(costo.inventario_ref);
      if (inv) {
        inv.cantidad_bultos = Math.max(0, (inv.cantidad_bultos || 0) - costo.bultos_ref);
        inv.movimientos.push({
          tipo: 'salida',
          cantidad_bultos: costo.bultos_ref,
          cantidad_kg: costo.bultos_ref * (inv.peso_por_bulto_kg || 40),
          precio_unitario: inv.precio_bulto || 0,
          total: costo.total || 0,
          descripcion: `Reversión por eliminación de costo: ${costo.descripcion}`
        });
        await inv.save();
      }
    }

    res.json({ mensaje: 'Costo eliminado' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// RESUMEN CONTABLE (Estado de Resultados)
// GET /api/costos/resumen
// ═══════════════════════════════════════════════════════════════════════
exports.obtenerResumen = async (req, res) => {
  try {
    const { mes, año } = req.query;
    
    const mesActual = mes ? parseInt(mes) : new Date().getMonth() + 1;
    const añoActual = año ? parseInt(año) : new Date().getFullYear();
    
    // Filtro de periodo
    const filtroPeriodo = {
      'periodo.mes': mesActual,
      'periodo.año': añoActual,
      estado: { $ne: 'anulado' }
    };
    
    // COSTOS por tipo
    const costosPorTipo = await Costo.aggregate([
      { $match: filtroPeriodo },
      {
        $group: {
          _id: '$tipo_costo',
          total: { $sum: '$total_con_iva' },
          cantidad: { $sum: 1 }
        }
      }
    ]);
    
    // COSTOS por categoría
    const costosPorCategoria = await Costo.aggregate([
      { $match: filtroPeriodo },
      {
        $group: {
          _id: '$categoria',
          tipo: { $first: '$tipo_costo' },
          total: { $sum: '$total_con_iva' },
          cantidad: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } }
    ]);
    
    // Total COSTOS
    const totalCostos = await Costo.aggregate([
      { $match: filtroPeriodo },
      {
        $group: {
          _id: null,
          total: { $sum: '$total_con_iva' }
        }
      }
    ]);
    
    // INGRESOS (ventas del mes)
    const inicioMes = new Date(añoActual, mesActual - 1, 1);
    const finMes = new Date(añoActual, mesActual, 0, 23, 59, 59);
    
    const totalIngresos = await Venta.aggregate([
      { 
        $match: { 
          fecha_venta: { $gte: inicioMes, $lte: finMes },
          activa: true
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' },
          cobrado: { $sum: '$monto_pagado' },
          cantidad_ventas: { $sum: 1 }
        }
      }
    ]);
    
    // Calcular utilidad
    const ingresos = totalIngresos[0]?.total || 0;
    const costos = totalCostos[0]?.total || 0;
    const utilidad = ingresos - costos;
    const margen = ingresos > 0 ? ((utilidad / ingresos) * 100).toFixed(2) : 0;
    
    res.json({
      periodo: {
        mes: mesActual,
        año: añoActual,
        nombre_mes: new Date(añoActual, mesActual - 1).toLocaleString('es', { month: 'long' })
      },
      ingresos: {
        total: ingresos,
        cobrado: totalIngresos[0]?.cobrado || 0,
        cantidad_ventas: totalIngresos[0]?.cantidad_ventas || 0
      },
      costos: {
        total: costos,
        por_tipo: costosPorTipo,
        por_categoria: costosPorCategoria
      },
      resultado: {
        utilidad_bruta: utilidad,
        margen_porcentaje: parseFloat(margen),
        estado: utilidad >= 0 ? 'ganancia' : 'perdida'
      }
    });
  } catch (error) {
    console.error('[COSTO] Error en resumen:', error);
    res.status(500).json({ mensaje: 'Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// COMPARATIVO MENSUAL
// GET /api/costos/comparativo
// ═══════════════════════════════════════════════════════════════════════
exports.obtenerComparativo = async (req, res) => {
  try {
    const { meses = 6 } = req.query;
    
    const resultado = [];
    const hoy = new Date();
    
    for (let i = 0; i < parseInt(meses); i++) {
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const mes = fecha.getMonth() + 1;
      const año = fecha.getFullYear();
      
      // Costos del mes
      const costosMes = await Costo.aggregate([
        { 
          $match: { 
            'periodo.mes': mes, 
            'periodo.año': año,
            estado: { $ne: 'anulado' }
          }
        },
        { $group: { _id: null, total: { $sum: '$total_con_iva' } } }
      ]);
      
      // Ingresos del mes
      const inicioMes = new Date(año, mes - 1, 1);
      const finMes = new Date(año, mes, 0, 23, 59, 59);
      
      const ingresosMes = await Venta.aggregate([
        { 
          $match: { 
            fecha_venta: { $gte: inicioMes, $lte: finMes },
            activa: true
          }
        },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]);
      
      resultado.push({
        mes,
        año,
        nombre: fecha.toLocaleString('es', { month: 'short' }),
        costos: costosMes[0]?.total || 0,
        ingresos: ingresosMes[0]?.total || 0,
        utilidad: (ingresosMes[0]?.total || 0) - (costosMes[0]?.total || 0)
      });
    }
    
    res.json(resultado.reverse());
  } catch (error) {
    console.error('[COSTO] Error en comparativo:', error);
    res.status(500).json({ mensaje: 'Error', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// CATEGORIAS DISPONIBLES
// GET /api/costos/categorias
// ═══════════════════════════════════════════════════════════════════════
exports.obtenerCategorias = async (req, res) => {
  const categorias = {
    directo: [
      { value: 'alimento_concentrado', label: 'Alimento Concentrado' },
      { value: 'alimento_suplemento', label: 'Suplementos Alimenticios' },
      { value: 'medicamentos', label: 'Medicamentos' },
      { value: 'vacunas', label: 'Vacunas' },
      { value: 'vitaminas', label: 'Vitaminas' },
      { value: 'desparasitantes', label: 'Desparasitantes' },
      { value: 'compra_lechones', label: 'Compra de Lechones' },
      { value: 'compra_cerdos', label: 'Compra de Cerdos' },
      { value: 'inseminacion', label: 'Inseminación' },
      { value: 'mano_obra_directa', label: 'Mano de Obra Directa' }
    ],
    indirecto: [
      { value: 'agua', label: 'Agua' },
      { value: 'electricidad', label: 'Electricidad' },
      { value: 'gas', label: 'Gas' },
      { value: 'transporte', label: 'Transporte' },
      { value: 'mantenimiento_equipos', label: 'Mantenimiento de Equipos' },
      { value: 'mantenimiento_instalaciones', label: 'Mantenimiento de Instalaciones' },
      { value: 'limpieza_desinfeccion', label: 'Limpieza y Desinfección' },
      { value: 'mano_obra_indirecta', label: 'Mano de Obra Indirecta' }
    ],
    fijo: [
      { value: 'arriendo', label: 'Arriendo' },
      { value: 'seguros', label: 'Seguros' },
      { value: 'depreciacion', label: 'Depreciación' },
      { value: 'administracion', label: 'Administración' },
      { value: 'contabilidad', label: 'Contabilidad' },
      { value: 'impuestos', label: 'Impuestos' }
    ]
  };
  
  res.json(categorias);
};