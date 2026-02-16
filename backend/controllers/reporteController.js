/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - CONTROLADOR DE REPORTES
 * ═══════════════════════════════════════════════════════════════════════
 */

const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const Reading = require('../models/Reading');
const Weighing = require('../models/pesaje');
const Lote = require('../models/lote');
const Contabilidad = require('../models/contabilidad');
const Costo = require('../models/Costo');
const Venta = require('../models/Venta');
const WaterConsumption = require('../models/WaterConsumption');
const Alert = require('../models/Alert');

// ═══════════════════════════════════════════════════════════════════════
// GENERAR REPORTE EXCEL PROFESIONAL
// GET /api/reporte/excel
// ═══════════════════════════════════════════════════════════════════════

exports.generarReporteExcel = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'COO Alianzas - Sistema de Gestión Porcina';
    workbook.created = new Date();

    // Colores corporativos
    const VERDE_OSCURO = '2D6A4F';
    const VERDE_MEDIO = '40916C';
    const VERDE_CLARO = 'D8F3DC';
    const AMARILLO = 'FFD633';
    const ROJO = 'DC2626';
    const GRIS_CLARO = 'F8FAFC';
    const BLANCO = 'FFFFFF';

    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE_OSCURO } };
    const headerFont = { bold: true, color: { argb: BLANCO }, size: 11 };
    const headerAlign = { horizontal: 'center', vertical: 'middle', wrapText: true };
    const borderThin = {
      top: { style: 'thin', color: { argb: 'E2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
      left: { style: 'thin', color: { argb: 'E2E8F0' } },
      right: { style: 'thin', color: { argb: 'E2E8F0' } }
    };

    // Helper: estilizar header de hoja
    const estilizarHeader = (sheet) => {
      const row = sheet.getRow(1);
      row.height = 32;
      row.eachCell(cell => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = headerAlign;
        cell.border = borderThin;
      });
    };

    // Helper: alternar colores filas
    const estilizarFilas = (sheet, startRow) => {
      for (let i = startRow; i <= (sheet.lastRow?.number || startRow); i++) {
        const row = sheet.getRow(i);
        row.eachCell(cell => {
          cell.border = borderThin;
          cell.alignment = { vertical: 'middle' };
          if (i % 2 === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS_CLARO } };
          }
        });
      }
    };

    // ─── HOJA 1: RESUMEN EJECUTIVO ───
    const resumen = workbook.addWorksheet('Resumen Ejecutivo');
    resumen.columns = [{ width: 5 }, { width: 30 }, { width: 25 }, { width: 20 }, { width: 5 }];

    // Logo / título
    resumen.mergeCells('B1:D1');
    const titleCell = resumen.getCell('B1');
    titleCell.value = 'COO ALIANZAS - GRANJA PORCINA';
    titleCell.font = { bold: true, size: 20, color: { argb: VERDE_OSCURO } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    resumen.getRow(1).height = 50;

    resumen.mergeCells('B2:D2');
    resumen.getCell('B2').value = 'Sistema Integral de Gestión Porcícola';
    resumen.getCell('B2').font = { italic: true, size: 12, color: { argb: VERDE_MEDIO } };
    resumen.getCell('B2').alignment = { horizontal: 'center' };

    resumen.mergeCells('B3:D3');
    const fechaCol = new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' });
    resumen.getCell('B3').value = `Generado: ${fechaCol}`;
    resumen.getCell('B3').font = { size: 10, color: { argb: '64748B' } };
    resumen.getCell('B3').alignment = { horizontal: 'center' };

    // Línea separadora
    resumen.getRow(4).height = 5;
    ['B4', 'C4', 'D4'].forEach(c => {
      resumen.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE_OSCURO } };
    });

    // Datos
    const ultimaTemp = await Reading.findOne({ tipo: 'temp_porqueriza' }).sort({ createdAt: -1 });
    const ultimaHum = await Reading.findOne({ tipo: 'humedad_porqueriza' }).sort({ createdAt: -1 });
    const ahoraCol = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    const hoyUTC = new Date(Date.UTC(ahoraCol.getFullYear(), ahoraCol.getMonth(), ahoraCol.getDate()));
    const consumoHoy = await WaterConsumption.findOne({ fecha: { $gte: hoyUTC }, tipo: 'diario' });
    const lotesActivos = await Lote.countDocuments({ activo: true });
    const totalCerdosAgg = await Lote.aggregate([{ $match: { activo: true } }, { $group: { _id: null, total: { $sum: '$cantidad_cerdos' } } }]);
    const totalCerdos = totalCerdosAgg[0]?.total || 0;

    const addSeccion = (titulo, datos, startRow) => {
      resumen.mergeCells(`B${startRow}:D${startRow}`);
      resumen.getCell(`B${startRow}`).value = titulo;
      resumen.getCell(`B${startRow}`).font = { bold: true, size: 13, color: { argb: BLANCO } };
      resumen.getCell(`B${startRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE_OSCURO } };
      resumen.getCell(`B${startRow}`).alignment = { horizontal: 'left', vertical: 'middle' };
      resumen.getRow(startRow).height = 28;

      datos.forEach((d, i) => {
        const r = startRow + 1 + i;
        resumen.getCell(`B${r}`).value = d[0];
        resumen.getCell(`B${r}`).font = { size: 11, color: { argb: '475569' } };
        resumen.getCell(`C${r}`).value = d[1];
        resumen.getCell(`C${r}`).font = { bold: true, size: 12, color: { argb: '1E293B' } };
        resumen.getCell(`C${r}`).alignment = { horizontal: 'right' };
        if (i % 2 === 0) {
          ['B', 'C', 'D'].forEach(col => {
            resumen.getCell(`${col}${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE_CLARO } };
          });
        }
      });
      return startRow + 1 + datos.length + 1;
    };

    let row = 6;
    row = addSeccion('MONITOREO EN TIEMPO REAL', [
      ['Temperatura Porqueriza', ultimaTemp?.valor ? `${ultimaTemp.valor} °C` : 'Sin datos'],
      ['Humedad Porqueriza', ultimaHum?.valor ? `${ultimaHum.valor} %` : 'Sin datos'],
      ['Consumo Agua Hoy', consumoHoy ? `${consumoHoy.litros.toFixed(1)} L` : 'Sin datos']
    ], row);

    row = addSeccion('PRODUCCIÓN', [
      ['Lotes Activos', lotesActivos],
      ['Total Cerdos', totalCerdos]
    ], row);

    // Costos/Ventas resumen
    const totalCostos = await Costo.aggregate([{ $match: { estado: { $ne: 'anulado' } } }, { $group: { _id: null, t: { $sum: '$total' } } }]);
    const totalVentas = await Venta.aggregate([{ $match: { activa: true } }, { $group: { _id: null, t: { $sum: '$total' } } }]);
    const costosTot = totalCostos[0]?.t || 0;
    const ventasTot = totalVentas[0]?.t || 0;

    row = addSeccion('FINANZAS', [
      ['Total Ingresos (Ventas)', `$${ventasTot.toLocaleString()}`],
      ['Total Costos', `$${costosTot.toLocaleString()}`],
      ['Utilidad', `$${(ventasTot - costosTot).toLocaleString()}`]
    ], row);

    // ─── HOJA 2: LOTES ───
    const lotesSheet = workbook.addWorksheet('Lotes');
    lotesSheet.columns = [
      { header: 'Nombre', key: 'nombre', width: 22 },
      { header: 'Cerdos', key: 'cantidad', width: 12 },
      { header: 'Estado', key: 'estado', width: 14 },
      { header: 'Peso Prom (kg)', key: 'peso', width: 16 },
      { header: 'Alimento Total (kg)', key: 'alimento', width: 20 },
      { header: 'Conversión', key: 'conversion', width: 14 },
      { header: 'Fecha Inicio', key: 'fecha', width: 16 },
      { header: 'Activo', key: 'activo', width: 10 }
    ];
    estilizarHeader(lotesSheet);

    const lotes = await Lote.find().sort({ activo: -1, createdAt: -1 });
    lotes.forEach(lote => {
      const ganancia = (lote.peso_promedio_actual || 0) - (lote.peso_inicial_promedio || 0);
      const conv = ganancia > 0 && lote.alimento_total_kg > 0 ? (lote.alimento_total_kg / ganancia).toFixed(2) : '-';
      lotesSheet.addRow({
        nombre: lote.nombre,
        cantidad: lote.cantidad_cerdos,
        estado: lote.estado,
        peso: lote.peso_promedio_actual || 0,
        alimento: lote.alimento_total_kg?.toFixed(1) || 0,
        conversion: conv,
        fecha: lote.fecha_inicio?.toLocaleDateString('es-CO') || '-',
        activo: lote.activo ? 'Sí' : 'No'
      });
    });
    estilizarFilas(lotesSheet, 2);

    // ─── HOJA 3: PESAJES ───
    const pesajesSheet = workbook.addWorksheet('Pesajes');
    pesajesSheet.columns = [
      { header: 'Fecha', key: 'fecha', width: 18 },
      { header: 'Lote', key: 'lote', width: 22 },
      { header: 'Peso (kg)', key: 'peso', width: 14 },
      { header: 'Cerdos Pesados', key: 'cantidad', width: 16 },
      { header: 'Peso Promedio (kg)', key: 'promedio', width: 18 }
    ];
    estilizarHeader(pesajesSheet);

    const pesajes = await Weighing.find().populate('lote', 'nombre').sort({ createdAt: -1 }).limit(100);
    pesajes.forEach(p => {
      pesajesSheet.addRow({
        fecha: p.createdAt?.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' }) || '-',
        lote: p.lote?.nombre || 'Sin lote',
        peso: p.peso,
        cantidad: p.cantidad_cerdos_pesados || 1,
        promedio: p.peso_promedio || '-'
      });
    });
    estilizarFilas(pesajesSheet, 2);

    // ─── HOJA 4: CONTABILIDAD ───
    const contaSheet = workbook.addWorksheet('Contabilidad');
    contaSheet.columns = [
      { header: 'Fecha', key: 'fecha', width: 14 },
      { header: 'Tipo', key: 'tipo', width: 12 },
      { header: 'Categoría', key: 'categoria', width: 22 },
      { header: 'Descripción', key: 'descripcion', width: 35 },
      { header: 'Cantidad', key: 'cantidad', width: 12 },
      { header: 'Precio Unit.', key: 'precio', width: 15 },
      { header: 'Total', key: 'total', width: 16 },
      { header: 'Lote', key: 'lote', width: 18 }
    ];
    estilizarHeader(contaSheet);

    const contabilidad = await Contabilidad.find().populate('lote', 'nombre').sort({ fecha: -1 });
    let totalIngresos = 0, totalGastos = 0;

    contabilidad.forEach(c => {
      if (c.tipo === 'ingreso') totalIngresos += c.total;
      if (c.tipo === 'gasto') totalGastos += c.total;
      const addedRow = contaSheet.addRow({
        fecha: c.fecha?.toLocaleDateString('es-CO') || '-',
        tipo: c.tipo === 'ingreso' ? 'Ingreso' : 'Gasto',
        categoria: c.categoria,
        descripcion: c.descripcion || '-',
        cantidad: c.cantidad,
        precio: c.precio_unitario,
        total: c.total,
        lote: c.lote?.nombre || '-'
      });
      // Color por tipo
      if (c.tipo === 'ingreso') {
        addedRow.getCell('tipo').font = { bold: true, color: { argb: '16A34A' } };
      } else {
        addedRow.getCell('tipo').font = { bold: true, color: { argb: ROJO } };
      }
    });
    estilizarFilas(contaSheet, 2);

    // Totales al final
    const lr = (contaSheet.lastRow?.number || 1) + 2;
    const addTotal = (row, label, valor, color) => {
      contaSheet.getCell(`F${row}`).value = label;
      contaSheet.getCell(`F${row}`).font = { bold: true, size: 11 };
      contaSheet.getCell(`G${row}`).value = valor;
      contaSheet.getCell(`G${row}`).font = { bold: true, size: 12, color: { argb: color } };
      contaSheet.getCell(`G${row}`).numFmt = '$#,##0';
    };
    addTotal(lr, 'Total Ingresos:', totalIngresos, '16A34A');
    addTotal(lr + 1, 'Total Gastos:', totalGastos, ROJO);
    addTotal(lr + 2, 'Balance:', totalIngresos - totalGastos, VERDE_OSCURO);

    // ─── HOJA 5: ALERTAS ───
    const alertasSheet = workbook.addWorksheet('Alertas');
    alertasSheet.columns = [
      { header: 'Fecha', key: 'fecha', width: 22 },
      { header: 'Tipo', key: 'tipo', width: 14 },
      { header: 'Mensaje', key: 'mensaje', width: 55 }
    ];
    estilizarHeader(alertasSheet);

    const alertas = await Alert.find().sort({ createdAt: -1 }).limit(50);
    alertas.forEach(a => {
      alertasSheet.addRow({
        fecha: a.createdAt?.toLocaleString('es-CO', { timeZone: 'America/Bogota' }) || '-',
        tipo: a.tipo,
        mensaje: a.mensaje
      });
    });
    estilizarFilas(alertasSheet, 2);

    // Enviar
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
