/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - CONTROLADOR DE REPORTES
 * ═══════════════════════════════════════════════════════════════════════
 */

const ExcelJS = require('exceljs');
const Reading = require('../models/Reading');
const Weighing = require('../models/Weighing');
const Lote = require('../models/lote');
const Contabilidad = require('../models/contabilidad');
const WaterConsumption = require('../models/WaterConsumption');
const Alert = require('../models/Alert');

// ═══════════════════════════════════════════════════════════════════════
// GENERAR REPORTE EXCEL COMPLETO
// GET /api/reporte/excel
// ═══════════════════════════════════════════════════════════════════════

exports.generarReporteExcel = async (req, res) => {
  try {
    const { tipo } = req.query;
    
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'COO Alianzas';
    workbook.created = new Date();

    // Estilos comunes
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD633' } },
      alignment: { horizontal: 'center', vertical: 'middle' }
    };

    const titleStyle = {
      font: { bold: true, size: 16, color: { argb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'middle' }
    };

    // ─────────────────────────────────────────────────────────────────────
    // HOJA 1: RESUMEN EJECUTIVO
    // ─────────────────────────────────────────────────────────────────────
    const resumenSheet = workbook.addWorksheet('Resumen Ejecutivo');
    resumenSheet.columns = [
      { width: 30 },
      { width: 25 },
      { width: 20 }
    ];

    resumenSheet.mergeCells('A1:C1');
    resumenSheet.getCell('A1').value = 'REPORTE COO ALIANZAS - GRANJA PORCINA';
    resumenSheet.getCell('A1').style = titleStyle;
    resumenSheet.getRow(1).height = 35;

    resumenSheet.getCell('A2').value = `Fecha: ${new Date().toLocaleString()}`;
    
    // Obtener datos
    const ultimaTemp = await Reading.findOne({ tipo: 'temp_porqueriza' }).sort({ createdAt: -1 });
    const ultimaHum = await Reading.findOne({ tipo: 'humedad_porqueriza' }).sort({ createdAt: -1 });
    const ultimoFlujo = await Reading.findOne({ tipo: 'volumen_diario' }).sort({ createdAt: -1 });
    const lotesActivos = await Lote.countDocuments({ activo: true });
    const totalCerdos = await Lote.aggregate([
      { $match: { activo: true } },
      { $group: { _id: null, total: { $sum: '$cantidad_cerdos' } } }
    ]);

    const datosResumen = [
      ['', '', ''],
      ['MONITOREO ACTUAL', '', ''],
      ['Temperatura Porqueriza', ultimaTemp?.valor ? `${ultimaTemp.valor} °C` : 'Sin datos', ''],
      ['Humedad Porqueriza', ultimaHum?.valor ? `${ultimaHum.valor} %` : 'Sin datos', ''],
      ['Consumo Agua Hoy', ultimoFlujo?.valor ? `${ultimoFlujo.valor} L` : 'Sin datos', ''],
      ['', '', ''],
      ['PRODUCCION', '', ''],
      ['Lotes Activos', lotesActivos, ''],
      ['Total Cerdos', totalCerdos[0]?.total || 0, '']
    ];

    datosResumen.forEach((row, i) => {
      const rowNum = i + 4;
      resumenSheet.getRow(rowNum).values = row;
      if (row[0] === 'MONITOREO ACTUAL' || row[0] === 'PRODUCCION') {
        resumenSheet.getRow(rowNum).font = { bold: true };
        resumenSheet.getRow(rowNum).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3CD' } };
      }
    });

    // ─────────────────────────────────────────────────────────────────────
    // HOJA 2: LOTES
    // ─────────────────────────────────────────────────────────────────────
    const lotesSheet = workbook.addWorksheet('Lotes');
    lotesSheet.columns = [
      { header: 'Nombre', key: 'nombre', width: 20 },
      { header: 'Cantidad Cerdos', key: 'cantidad', width: 18 },
      { header: 'Estado', key: 'estado', width: 15 },
      { header: 'Peso Promedio', key: 'peso', width: 18 },
      { header: 'Fecha Inicio', key: 'fecha', width: 20 },
      { header: 'Activo', key: 'activo', width: 10 }
    ];

    lotesSheet.getRow(1).style = headerStyle;

    const lotes = await Lote.find().sort({ createdAt: -1 });
    lotes.forEach(lote => {
      lotesSheet.addRow({
        nombre: lote.nombre,
        cantidad: lote.cantidad_cerdos,
        estado: lote.estado,
        peso: lote.peso_promedio_actual ? `${lote.peso_promedio_actual} kg` : '-',
        fecha: lote.fecha_inicio?.toLocaleDateString() || '-',
        activo: lote.activo ? 'Si' : 'No'
      });
    });

    // ─────────────────────────────────────────────────────────────────────
    // HOJA 3: PESAJES
    // ─────────────────────────────────────────────────────────────────────
    const pesajesSheet = workbook.addWorksheet('Pesajes');
    pesajesSheet.columns = [
      { header: 'Fecha', key: 'fecha', width: 20 },
      { header: 'Lote', key: 'lote', width: 20 },
      { header: 'Peso Total', key: 'peso', width: 15 },
      { header: 'Cerdos Pesados', key: 'cantidad', width: 18 },
      { header: 'Peso Promedio', key: 'promedio', width: 18 }
    ];

    pesajesSheet.getRow(1).style = headerStyle;

    const pesajes = await Weighing.find().populate('lote', 'nombre').sort({ createdAt: -1 }).limit(100);
    pesajes.forEach(p => {
      pesajesSheet.addRow({
        fecha: p.createdAt?.toLocaleString() || '-',
        lote: p.lote?.nombre || 'Sin lote',
        peso: `${p.peso} kg`,
        cantidad: p.cantidad_cerdos_pesados || 1,
        promedio: p.peso_promedio ? `${p.peso_promedio} kg` : '-'
      });
    });

    // ─────────────────────────────────────────────────────────────────────
    // HOJA 4: CONTABILIDAD
    // ─────────────────────────────────────────────────────────────────────
    const contaSheet = workbook.addWorksheet('Contabilidad');
    contaSheet.columns = [
      { header: 'Fecha', key: 'fecha', width: 15 },
      { header: 'Tipo', key: 'tipo', width: 12 },
      { header: 'Categoria', key: 'categoria', width: 18 },
      { header: 'Descripcion', key: 'descripcion', width: 30 },
      { header: 'Cantidad', key: 'cantidad', width: 12 },
      { header: 'Precio Unit', key: 'precio', width: 15 },
      { header: 'Total', key: 'total', width: 15 },
      { header: 'Lote', key: 'lote', width: 15 }
    ];

    contaSheet.getRow(1).style = headerStyle;

    const contabilidad = await Contabilidad.find().populate('lote', 'nombre').sort({ fecha: -1 });
    let totalIngresos = 0;
    let totalGastos = 0;

    contabilidad.forEach(c => {
      if (c.tipo === 'ingreso') totalIngresos += c.total;
      if (c.tipo === 'gasto') totalGastos += c.total;

      contaSheet.addRow({
        fecha: c.fecha?.toLocaleDateString() || '-',
        tipo: c.tipo,
        categoria: c.categoria,
        descripcion: c.descripcion || '-',
        cantidad: c.cantidad,
        precio: `$${c.precio_unitario?.toLocaleString()}`,
        total: `$${c.total?.toLocaleString()}`,
        lote: c.lote?.nombre || '-'
      });
    });

    // Totales
    const lastRow = contaSheet.lastRow.number + 2;
    contaSheet.getCell(`F${lastRow}`).value = 'Total Ingresos:';
    contaSheet.getCell(`G${lastRow}`).value = `$${totalIngresos.toLocaleString()}`;
    contaSheet.getCell(`G${lastRow}`).font = { bold: true, color: { argb: '10B981' } };

    contaSheet.getCell(`F${lastRow + 1}`).value = 'Total Gastos:';
    contaSheet.getCell(`G${lastRow + 1}`).value = `$${totalGastos.toLocaleString()}`;
    contaSheet.getCell(`G${lastRow + 1}`).font = { bold: true, color: { argb: 'DC2626' } };

    contaSheet.getCell(`F${lastRow + 2}`).value = 'Balance:';
    contaSheet.getCell(`G${lastRow + 2}`).value = `$${(totalIngresos - totalGastos).toLocaleString()}`;
    contaSheet.getCell(`G${lastRow + 2}`).font = { bold: true };

    // ─────────────────────────────────────────────────────────────────────
    // HOJA 5: ALERTAS
    // ─────────────────────────────────────────────────────────────────────
    const alertasSheet = workbook.addWorksheet('Alertas');
    alertasSheet.columns = [
      { header: 'Fecha', key: 'fecha', width: 20 },
      { header: 'Tipo', key: 'tipo', width: 15 },
      { header: 'Mensaje', key: 'mensaje', width: 50 }
    ];

    alertasSheet.getRow(1).style = headerStyle;

    const alertas = await Alert.find().sort({ createdAt: -1 }).limit(50);
    alertas.forEach(a => {
      alertasSheet.addRow({
        fecha: a.createdAt?.toLocaleString() || '-',
        tipo: a.tipo,
        mensaje: a.mensaje
      });
    });

    // Enviar archivo
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Reporte_COO_Alianzas_${new Date().toISOString().split('T')[0]}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('[REPORTE] Error:', error);
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// OBTENER RESUMEN PARA DASHBOARD
// GET /api/reporte/resumen
// ═══════════════════════════════════════════════════════════════════════

exports.obtenerResumen = async (req, res) => {
  try {
    const lotesActivos = await Lote.countDocuments({ activo: true });
    
    const totalCerdos = await Lote.aggregate([
      { $match: { activo: true } },
      { $group: { _id: null, total: { $sum: '$cantidad_cerdos' } } }
    ]);

    const contabilidad = await Contabilidad.find();
    const gastos = contabilidad.filter(c => c.tipo === 'gasto').reduce((sum, c) => sum + c.total, 0);
    const ingresos = contabilidad.filter(c => c.tipo === 'ingreso').reduce((sum, c) => sum + c.total, 0);

    const ultimoPesaje = await Weighing.findOne().sort({ createdAt: -1 });

    res.json({
      lotes_activos: lotesActivos,
      total_cerdos: totalCerdos[0]?.total || 0,
      total_gastos: gastos,
      total_ingresos: ingresos,
      balance: ingresos - gastos,
      ultimo_peso: ultimoPesaje?.peso || 0
    });

  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};