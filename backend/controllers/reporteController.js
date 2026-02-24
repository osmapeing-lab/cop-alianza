/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - CONTROLADOR DE REPORTES (COMPLETO)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Hojas del reporte Excel:
 *   1. Resumen Ejecutivo
 *   2. Lotes
 *   3. Pesajes
 *   4. Contabilidad
 *   5. Alertas
 *   6. Temperatura y Humedad 24h
 *   7. Consumo de Agua por Hora
 *   8. Historial Motobomba
 *   9. Gastos por Lote
 *  10. Inventario Alimento
 * ═══════════════════════════════════════════════════════════════════════
 */

const ExcelJS    = require('exceljs');
const nodemailer = require('nodemailer');
const Reading    = require('../models/Reading');
const Weighing   = require('../models/pesaje');
const Lote       = require('../models/lote');
const Contabilidad = require('../models/contabilidad');
const Costo      = require('../models/Costo');
const Venta      = require('../models/Venta');
const WaterConsumption = require('../models/WaterConsumption');
const Alert      = require('../models/Alert');
const InventarioAlimento = require('../models/InventarioAlimento');

// ═══════════════════════════════════════════════════════════════════════
// HELPER: CONSTRUIR WORKBOOK COMPLETO
// ═══════════════════════════════════════════════════════════════════════

async function construirWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'COO Alianzas - Sistema de Gestión Porcina';
  workbook.created = new Date();

  // Paleta de colores
  const VERDE_OSCURO = '2D6A4F';
  const VERDE_MEDIO  = '40916C';
  const VERDE_CLARO  = 'D8F3DC';
  const AZUL_OSCURO  = '1E3A5F';
  const AZUL_CLARO   = 'DBEAFE';
  const NARANJA      = 'F97316';
  const NARANJA_CLAR = 'FED7AA';
  const MORADO       = '7C3AED';
  const MORADO_CLAR  = 'EDE9FE';

  const ROJO         = 'DC2626';
  const GRIS_CLARO   = 'F8FAFC';
  const BLANCO       = 'FFFFFF';

  const borderThin = {
    top:    { style: 'thin', color: { argb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
    left:   { style: 'thin', color: { argb: 'CBD5E1' } },
    right:  { style: 'thin', color: { argb: 'CBD5E1' } }
  };

  // Helper: encabezado de hoja con color personalizado
  const estilizarHeader = (sheet, colorFondo = VERDE_OSCURO) => {
    const row = sheet.getRow(1);
    row.height = 32;
    row.eachCell(cell => {
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorFondo } };
      cell.font   = { bold: true, color: { argb: BLANCO }, size: 11 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = borderThin;
    });
  };

  // Helper: estilizar filas de datos
  const estilizarFilas = (sheet, startRow, colorPar = GRIS_CLARO) => {
    for (let i = startRow; i <= (sheet.lastRow?.number || startRow); i++) {
      const row = sheet.getRow(i);
      row.eachCell(cell => {
        cell.border    = borderThin;
        cell.alignment = { vertical: 'middle' };
        if (i % 2 === 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorPar } };
        }
      });
    }
  };

  // Helper: añadir título de sección dentro de una hoja
  const addTituloSeccion = (sheet, texto, col1, col2, rowNum, color = VERDE_OSCURO) => {
    sheet.mergeCells(`${col1}${rowNum}:${col2}${rowNum}`);
    const cell = sheet.getCell(`${col1}${rowNum}`);
    cell.value = texto;
    cell.font  = { bold: true, size: 12, color: { argb: BLANCO } };
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
    sheet.getRow(rowNum).height = 26;
  };

  // ── Datos comunes ───────────────────────────────────────────────────
  const ahoraCol = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  const hoyUTC   = new Date(Date.UTC(ahoraCol.getFullYear(), ahoraCol.getMonth(), ahoraCol.getDate()));
  const hace24h  = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const hace7d   = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const fechaStr = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota'
  });

  // ──────────────────────────────────────────────────────────────────────
  // HOJA 1: RESUMEN EJECUTIVO
  // ──────────────────────────────────────────────────────────────────────
  const resumen = workbook.addWorksheet('Resumen Ejecutivo');
  resumen.columns = [{ width: 4 }, { width: 32 }, { width: 26 }, { width: 20 }, { width: 4 }];

  resumen.mergeCells('B1:D1');
  const titleCell = resumen.getCell('B1');
  titleCell.value     = 'COO ALIANZAS — GRANJA PORCINA';
  titleCell.font      = { bold: true, size: 22, color: { argb: VERDE_OSCURO } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  resumen.getRow(1).height = 54;

  resumen.mergeCells('B2:D2');
  resumen.getCell('B2').value     = 'Sistema Integral de Gestión Porcícola';
  resumen.getCell('B2').font      = { italic: true, size: 12, color: { argb: VERDE_MEDIO } };
  resumen.getCell('B2').alignment = { horizontal: 'center' };

  resumen.mergeCells('B3:D3');
  resumen.getCell('B3').value     = `Generado: ${fechaStr}`;
  resumen.getCell('B3').font      = { size: 10, color: { argb: '64748B' } };
  resumen.getCell('B3').alignment = { horizontal: 'center' };

  resumen.getRow(4).height = 6;
  ['B4', 'C4', 'D4'].forEach(c => {
    resumen.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE_OSCURO } };
  });

  const [ultimaTemp, ultimaHum, consumoHoy, lotesActivos, totalCerdosAgg] = await Promise.all([
    Reading.findOne({ tipo: 'temp_porqueriza' }).sort({ createdAt: -1 }),
    Reading.findOne({ tipo: 'humedad_porqueriza' }).sort({ createdAt: -1 }),
    WaterConsumption.findOne({ fecha: { $gte: hoyUTC }, tipo: 'diario' }),
    Lote.countDocuments({ activo: true }),
    Lote.aggregate([{ $match: { activo: true } }, { $group: { _id: null, total: { $sum: '$cantidad_cerdos' } } }])
  ]);

  const [costosTotAgg, ventasTotAgg] = await Promise.all([
    Costo.aggregate([{ $match: { estado: { $ne: 'anulado' } } }, { $group: { _id: null, t: { $sum: '$total' } } }]),
    Venta.aggregate([{ $match: { activa: true } }, { $group: { _id: null, t: { $sum: '$total' } } }])
  ]);

  const costosTot = costosTotAgg[0]?.t || 0;
  const ventasTot = ventasTotAgg[0]?.t || 0;
  const totalCerdos = totalCerdosAgg[0]?.total || 0;

  const addSeccion = (titulo, datos, startRow) => {
    resumen.mergeCells(`B${startRow}:D${startRow}`);
    resumen.getCell(`B${startRow}`).value     = titulo;
    resumen.getCell(`B${startRow}`).font      = { bold: true, size: 13, color: { argb: BLANCO } };
    resumen.getCell(`B${startRow}`).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE_OSCURO } };
    resumen.getCell(`B${startRow}`).alignment = { horizontal: 'left', vertical: 'middle' };
    resumen.getRow(startRow).height = 28;

    datos.forEach((d, i) => {
      const r = startRow + 1 + i;
      resumen.getCell(`B${r}`).value     = d[0];
      resumen.getCell(`B${r}`).font      = { size: 11, color: { argb: '475569' } };
      resumen.getCell(`C${r}`).value     = d[1];
      resumen.getCell(`C${r}`).font      = { bold: true, size: 12, color: { argb: '1E293B' } };
      resumen.getCell(`C${r}`).alignment = { horizontal: 'right' };
      if (d[2]) {  // color de alerta opcional
        resumen.getCell(`C${r}`).font = { bold: true, size: 12, color: { argb: d[2] } };
      }
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
    ['Temperatura Granja Porcina', ultimaTemp?.valor ? `${ultimaTemp.valor} °C` : 'Sin datos',
      ultimaTemp?.valor > 37 ? ROJO : null],
    ['Humedad Granja Porcina', ultimaHum?.valor ? `${ultimaHum.valor} %` : 'Sin datos',
      ultimaHum?.valor > 85 ? ROJO : null],
    ['Consumo de Agua Hoy', consumoHoy ? `${consumoHoy.litros.toFixed(1)} L` : 'Sin datos']
  ], row);

  row = addSeccion('PRODUCCIÓN PORCINA', [
    ['Lotes Activos',  lotesActivos],
    ['Total Cerdos',   totalCerdos]
  ], row);

  row = addSeccion('FINANZAS', [
    ['Total Ingresos (Ventas)', `$${ventasTot.toLocaleString('es-CO')}`],
    ['Total Costos',            `$${costosTot.toLocaleString('es-CO')}`],
    ['Utilidad Neta',           `$${(ventasTot - costosTot).toLocaleString('es-CO')}`,
      (ventasTot - costosTot) >= 0 ? '16A34A' : ROJO]
  ], row);

  // Inventario alimento resumen
  const invResumen = await InventarioAlimento.getResumen();
  row = addSeccion('INVENTARIO ALIMENTO', [
    ['Total Bultos en Stock', invResumen.total_bultos],
    ['Total Kg en Stock',     `${invResumen.total_kg.toFixed(1)} kg`],
    ['Valor Total Inventario',`$${invResumen.valor_total.toLocaleString('es-CO')}`],
    ['Productos Bajo Stock',  invResumen.bajo_stock.length > 0
      ? invResumen.bajo_stock.map(b => b.nombre).join(', ')
      : 'Ninguno',
      invResumen.bajo_stock.length > 0 ? ROJO : '16A34A']
  ], row);

  // ──────────────────────────────────────────────────────────────────────
  // HOJA 2: LOTES
  // ──────────────────────────────────────────────────────────────────────
  const lotesSheet = workbook.addWorksheet('Lotes');
  lotesSheet.columns = [
    { header: 'Nombre',            key: 'nombre',     width: 22 },
    { header: 'Cerdos',            key: 'cantidad',   width: 10 },
    { header: 'Estado',            key: 'estado',     width: 14 },
    { header: 'Peso Prom (kg)',    key: 'peso',       width: 15 },
    { header: 'Peso Total Est.(kg)',key:'pesoTotal',  width: 18 },
    { header: 'Alimento Total (kg)',key: 'alimento',  width: 20 },
    { header: 'Conversión kg/kg',  key: 'conversion', width: 16 },
    { header: 'Gastos Semanales',  key: 'gastos',     width: 18 },
    { header: 'Fecha Inicio',      key: 'fecha',      width: 16 },
    { header: 'Activo',            key: 'activo',     width: 8 }
  ];
  estilizarHeader(lotesSheet);

  const lotes = await Lote.find().sort({ activo: -1, createdAt: -1 });
  lotes.forEach(lote => {
    const ganancia = (lote.peso_promedio_actual || 0) - (lote.peso_inicial_promedio || 0);
    const conv = ganancia > 0 && (lote.alimento_total_kg || 0) > 0
      ? (lote.alimento_total_kg / ganancia).toFixed(2)
      : '-';
    const pesoTotalEst = ((lote.peso_promedio_actual || 0) * (lote.cantidad_cerdos || 0)).toFixed(1);
    lotesSheet.addRow({
      nombre:    lote.nombre,
      cantidad:  lote.cantidad_cerdos,
      estado:    lote.estado || (lote.activo ? 'activo' : 'finalizado'),
      peso:      lote.peso_promedio_actual || 0,
      pesoTotal: pesoTotalEst,
      alimento:  (lote.alimento_total_kg || 0).toFixed(1),
      conversion: conv,
      gastos:    lote.total_gastos || 0,
      fecha:     lote.fecha_inicio?.toLocaleDateString('es-CO') || '-',
      activo:    lote.activo ? 'Sí' : 'No'
    });
  });
  estilizarFilas(lotesSheet, 2);
  // Formato moneda en gastos
  lotesSheet.getColumn('gastos').numFmt = '$#,##0';

  // ──────────────────────────────────────────────────────────────────────
  // HOJA 3: PESAJES
  // ──────────────────────────────────────────────────────────────────────
  const pesajesSheet = workbook.addWorksheet('Pesajes');
  pesajesSheet.columns = [
    { header: 'Fecha',                key: 'fecha',    width: 20 },
    { header: 'Lote',                 key: 'lote',     width: 22 },
    { header: 'Peso Total (kg)',      key: 'peso',     width: 16 },
    { header: 'Cerdos Pesados',       key: 'cantidad', width: 15 },
    { header: 'Peso Promedio (kg)',   key: 'promedio', width: 18 },
    { header: 'Observaciones',        key: 'obs',      width: 35 }
  ];
  estilizarHeader(pesajesSheet);

  const pesajes = await Weighing.find().populate('lote', 'nombre').sort({ createdAt: -1 }).limit(200);
  pesajes.forEach(p => {
    pesajesSheet.addRow({
      fecha:    p.createdAt?.toLocaleString('es-CO', { timeZone: 'America/Bogota' }) || '-',
      lote:     p.lote?.nombre || 'Sin lote',
      peso:     p.peso,
      cantidad: p.cantidad_cerdos_pesados || 1,
      promedio: p.peso_promedio || '-',
      obs:      p.observaciones || ''
    });
  });
  estilizarFilas(pesajesSheet, 2);

  // ──────────────────────────────────────────────────────────────────────
  // HOJA 4: CONTABILIDAD
  // ──────────────────────────────────────────────────────────────────────
  const contaSheet = workbook.addWorksheet('Contabilidad');
  contaSheet.columns = [
    { header: 'Fecha',        key: 'fecha',       width: 14 },
    { header: 'Tipo',         key: 'tipo',        width: 12 },
    { header: 'Categoría',    key: 'categoria',   width: 22 },
    { header: 'Descripción',  key: 'descripcion', width: 38 },
    { header: 'Cantidad',     key: 'cantidad',    width: 10 },
    { header: 'Precio Unit.', key: 'precio',      width: 15 },
    { header: 'Total',        key: 'total',       width: 16 },
    { header: 'Lote',         key: 'lote',        width: 20 }
  ];
  estilizarHeader(contaSheet);

  const contabilidad = await Contabilidad.find().populate('lote', 'nombre').sort({ fecha: -1 });
  let totalIngresos = 0, totalGastosConta = 0;

  contabilidad.forEach(c => {
    if (c.tipo === 'ingreso') totalIngresos  += c.total;
    if (c.tipo === 'gasto')   totalGastosConta += c.total;
    const addedRow = contaSheet.addRow({
      fecha:       c.fecha?.toLocaleDateString('es-CO') || '-',
      tipo:        c.tipo === 'ingreso' ? 'Ingreso' : 'Gasto',
      categoria:   c.categoria,
      descripcion: c.descripcion || '-',
      cantidad:    c.cantidad,
      precio:      c.precio_unitario,
      total:       c.total,
      lote:        c.lote?.nombre || '-'
    });
    addedRow.getCell('tipo').font = {
      bold: true,
      color: { argb: c.tipo === 'ingreso' ? '16A34A' : ROJO }
    };
  });
  estilizarFilas(contaSheet, 2);
  contaSheet.getColumn('precio').numFmt = '$#,##0';
  contaSheet.getColumn('total').numFmt  = '$#,##0';

  const lr = (contaSheet.lastRow?.number || 1) + 2;
  [[lr, 'Total Ingresos:', totalIngresos, '16A34A'],
   [lr+1, 'Total Gastos:', totalGastosConta, ROJO],
   [lr+2, 'Balance:', totalIngresos - totalGastosConta, VERDE_OSCURO]
  ].forEach(([r, label, val, col]) => {
    contaSheet.getCell(`F${r}`).value = label;
    contaSheet.getCell(`F${r}`).font  = { bold: true, size: 11 };
    contaSheet.getCell(`G${r}`).value = val;
    contaSheet.getCell(`G${r}`).font  = { bold: true, size: 12, color: { argb: col } };
    contaSheet.getCell(`G${r}`).numFmt = '$#,##0';
  });

  // ──────────────────────────────────────────────────────────────────────
  // HOJA 5: ALERTAS
  // ──────────────────────────────────────────────────────────────────────
  const alertasSheet = workbook.addWorksheet('Alertas');
  alertasSheet.columns = [
    { header: 'Fecha y Hora', key: 'fecha',   width: 24 },
    { header: 'Tipo',         key: 'tipo',    width: 16 },
    { header: 'Mensaje',      key: 'mensaje', width: 60 }
  ];
  estilizarHeader(alertasSheet);

  const alertas = await Alert.find().sort({ createdAt: -1 }).limit(100);
  alertas.forEach(a => {
    const addedRow = alertasSheet.addRow({
      fecha:   a.createdAt?.toLocaleString('es-CO', { timeZone: 'America/Bogota' }) || '-',
      tipo:    a.tipo,
      mensaje: a.mensaje
    });
    if (a.tipo === 'temperatura_alta' || a.tipo === 'alerta') {
      addedRow.getCell('tipo').font = { bold: true, color: { argb: ROJO } };
    } else if (a.tipo === 'info') {
      addedRow.getCell('tipo').font = { color: { argb: VERDE_MEDIO } };
    }
  });
  estilizarFilas(alertasSheet, 2);

  // ──────────────────────────────────────────────────────────────────────
  // HOJA 6: TEMPERATURA Y HUMEDAD — ÚLTIMAS 24 HORAS
  // ──────────────────────────────────────────────────────────────────────
  const tempSheet = workbook.addWorksheet('Temp y Humedad 24h');
  tempSheet.columns = [
    { header: 'Hora',               key: 'hora',    width: 18 },
    { header: 'Temp. Mín (°C)',     key: 'tMin',    width: 16 },
    { header: 'Temp. Prom (°C)',    key: 'tProm',   width: 16 },
    { header: 'Temp. Máx (°C)',     key: 'tMax',    width: 16 },
    { header: 'Humedad Mín (%)',    key: 'hMin',    width: 16 },
    { header: 'Humedad Prom (%)',   key: 'hProm',   width: 17 },
    { header: 'Humedad Máx (%)',    key: 'hMax',    width: 16 },
    { header: 'Lecturas Temp',      key: 'nTemp',   width: 13 },
    { header: 'Lecturas Hum',       key: 'nHum',    width: 12 }
  ];
  estilizarHeader(tempSheet, AZUL_OSCURO);

  const [lectTemp, lectHum] = await Promise.all([
    Reading.find({ tipo: 'temp_porqueriza', createdAt: { $gte: hace24h } }).sort({ createdAt: 1 }),
    Reading.find({ tipo: 'humedad_porqueriza', createdAt: { $gte: hace24h } }).sort({ createdAt: 1 })
  ]);

  // Agrupar por hora
  const tempPorHora = {};
  const humPorHora  = {};

  lectTemp.forEach(r => {
    const horaKey = new Date(r.createdAt).toLocaleString('es-CO', {
      timeZone: 'America/Bogota', year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', hour12: false
    }).replace(',', '');
    if (!tempPorHora[horaKey]) tempPorHora[horaKey] = [];
    tempPorHora[horaKey].push(r.valor);
  });

  lectHum.forEach(r => {
    const horaKey = new Date(r.createdAt).toLocaleString('es-CO', {
      timeZone: 'America/Bogota', year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', hour12: false
    }).replace(',', '');
    if (!humPorHora[horaKey]) humPorHora[horaKey] = [];
    humPorHora[horaKey].push(r.valor);
  });

  const horasUnicas = [...new Set([...Object.keys(tempPorHora), ...Object.keys(humPorHora)])].sort();

  if (horasUnicas.length === 0) {
    const nr = tempSheet.addRow({ hora: 'Sin lecturas en las últimas 24 horas' });
    nr.getCell('hora').font = { italic: true, color: { argb: '94A3B8' } };
  } else {
    horasUnicas.forEach(hora => {
      const tVals = tempPorHora[hora] || [];
      const hVals = humPorHora[hora] || [];
      const avg   = arr => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : '-';
      const min   = arr => arr.length ? Math.min(...arr).toFixed(1) : '-';
      const max   = arr => arr.length ? Math.max(...arr).toFixed(1) : '-';

      const addedRow = tempSheet.addRow({
        hora:  hora,
        tMin:  tVals.length ? parseFloat(min(tVals)) : '-',
        tProm: tVals.length ? parseFloat(avg(tVals)) : '-',
        tMax:  tVals.length ? parseFloat(max(tVals)) : '-',
        hMin:  hVals.length ? parseFloat(min(hVals)) : '-',
        hProm: hVals.length ? parseFloat(avg(hVals)) : '-',
        hMax:  hVals.length ? parseFloat(max(hVals)) : '-',
        nTemp: tVals.length,
        nHum:  hVals.length
      });

      // Resaltar temperatura alta
      const tMaxVal = parseFloat(max(tVals));
      if (tMaxVal > 37) {
        addedRow.getCell('tMax').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };
        addedRow.getCell('tMax').font = { bold: true, color: { argb: ROJO } };
      }
      // Resaltar humedad alta
      const hMaxVal = parseFloat(max(hVals));
      if (hMaxVal > 85) {
        addedRow.getCell('hMax').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } };
        addedRow.getCell('hMax').font = { bold: true, color: { argb: '92400E' } };
      }
    });
  }

  estilizarFilas(tempSheet, 2, AZUL_CLARO);

  // Resumen al final
  if (lectTemp.length > 0) {
    const todosTemp = lectTemp.map(r => r.valor);
    const todosHum  = lectHum.map(r => r.valor);
    const lastR = (tempSheet.lastRow?.number || 1) + 2;
    addTituloSeccion(tempSheet, 'RESUMEN DE LAS 24H', 'A', 'I', lastR, AZUL_OSCURO);
    const dataRows = [
      ['Temp. Mínima registrada', `${Math.min(...todosTemp).toFixed(1)} °C`],
      ['Temp. Máxima registrada', `${Math.max(...todosTemp).toFixed(1)} °C`],
      ['Temp. Promedio 24h',      `${(todosTemp.reduce((a,b)=>a+b,0)/todosTemp.length).toFixed(1)} °C`],
      ['Hum. Mínima registrada',  todosHum.length ? `${Math.min(...todosHum).toFixed(1)} %` : 'Sin datos'],
      ['Hum. Máxima registrada',  todosHum.length ? `${Math.max(...todosHum).toFixed(1)} %` : 'Sin datos'],
      ['Total Lecturas Temp',     lectTemp.length],
      ['Total Lecturas Hum',      lectHum.length]
    ];
    dataRows.forEach((d, i) => {
      const r = lastR + 1 + i;
      tempSheet.getCell(`A${r}`).value = d[0];
      tempSheet.getCell(`B${r}`).value = d[1];
      tempSheet.getCell(`B${r}`).font  = { bold: true };
    });
  }

  // ──────────────────────────────────────────────────────────────────────
  // HOJA 7: CONSUMO DE AGUA POR HORA — ÚLTIMAS 24 HORAS
  // ──────────────────────────────────────────────────────────────────────
  const aguaSheet = workbook.addWorksheet('Agua por Hora 24h');
  aguaSheet.columns = [
    { header: 'Rango Horario',        key: 'rango',   width: 28 },
    { header: 'Litros Consumidos',    key: 'litros',  width: 20 },
    { header: 'Lecturas Registradas', key: 'lecturas',width: 22 },
    { header: 'Promedio L/lectura',   key: 'promedio',width: 20 }
  ];
  estilizarHeader(aguaSheet, AZUL_OSCURO);

  // Los registros de flujo se guardan en Reading tipo:'flujo_agua' cada 5 min
  // El valor es el total acumulado del día → calculamos delta entre lecturas consecutivas
  const lecturasFlujo = await Reading.find({
    tipo: 'flujo_agua',
    createdAt: { $gte: hace24h }
  }).sort({ createdAt: 1 });

  const aguaPorHora = {};
  for (let i = 1; i < lecturasFlujo.length; i++) {
    const prev = lecturasFlujo[i - 1];
    const curr = lecturasFlujo[i];
    const delta = (curr.valor || 0) - (prev.valor || 0);
    if (delta <= 0) continue; // saltar resets o sin consumo

    const dCol = new Date(new Date(curr.createdAt).toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    const fechaKey = `${dCol.getFullYear()}-${String(dCol.getMonth()+1).padStart(2,'0')}-${String(dCol.getDate()).padStart(2,'0')}_${String(dCol.getHours()).padStart(2,'0')}`;
    if (!aguaPorHora[fechaKey]) aguaPorHora[fechaKey] = { hora: dCol.getHours(), fecha: dCol, litros: 0, count: 0 };
    aguaPorHora[fechaKey].litros += delta;
    aguaPorHora[fechaKey].count++;
  }

  const horasAgua = Object.entries(aguaPorHora).sort(([a], [b]) => a.localeCompare(b));

  if (horasAgua.length === 0) {
    const nr = aguaSheet.addRow({ rango: 'Sin registros de consumo en las últimas 24 horas' });
    nr.getCell('rango').font = { italic: true, color: { argb: '94A3B8' } };
  } else {
    let totalLitros = 0;
    horasAgua.forEach(([, d]) => {
      const horaStr = `${String(d.hora).padStart(2,'0')}:00`;
      const horaFin = `${String((d.hora + 1) % 24).padStart(2,'0')}:00`;
      const fechaDisplay = d.fecha.toLocaleDateString('es-CO');
      aguaSheet.addRow({
        rango:    `${fechaDisplay}  ${horaStr} – ${horaFin}`,
        litros:   parseFloat(d.litros.toFixed(2)),
        lecturas: d.count,
        promedio: parseFloat((d.litros / d.count).toFixed(2))
      });
      totalLitros += d.litros;
    });

    const totalRow = aguaSheet.addRow({
      rango:    'TOTAL 24 HORAS',
      litros:   parseFloat(totalLitros.toFixed(2)),
      lecturas: lecturasFlujo.length,
      promedio: '-'
    });
    totalRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_OSCURO } };
      cell.font = { bold: true, color: { argb: BLANCO } };
    });
  }
  estilizarFilas(aguaSheet, 2, AZUL_CLARO);
  aguaSheet.getColumn('litros').numFmt = '#,##0.00';
  aguaSheet.getColumn('promedio').numFmt = '#,##0.00';

  // También mostrar consumo diario
  const consumosDiarios = await WaterConsumption.find({
    tipo: 'diario',
    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
  }).sort({ createdAt: -1 });

  if (consumosDiarios.length > 0) {
    const lastR2 = (aguaSheet.lastRow?.number || 1) + 2;
    addTituloSeccion(aguaSheet, 'CONSUMO DIARIO — ÚLTIMOS 30 DÍAS', 'A', 'D', lastR2, AZUL_OSCURO);
    aguaSheet.getCell(`A${lastR2+1}`).value = 'Fecha';
    aguaSheet.getCell(`B${lastR2+1}`).value = 'Litros Consumidos';
    aguaSheet.getRow(lastR2+1).font = { bold: true };
    consumosDiarios.forEach((c, i) => {
      const r = lastR2 + 2 + i;
      aguaSheet.getCell(`A${r}`).value = c.fecha?.toLocaleDateString('es-CO') || '-';
      aguaSheet.getCell(`B${r}`).value = parseFloat((c.litros || 0).toFixed(2));
      aguaSheet.getCell(`B${r}`).numFmt = '#,##0.00';
    });
  }

  // ──────────────────────────────────────────────────────────────────────
  // HOJA 8: HISTORIAL MOTOBOMBA
  // ──────────────────────────────────────────────────────────────────────
  const bombaSheet = workbook.addWorksheet('Historial Motobomba');
  bombaSheet.columns = [
    { header: 'Fecha y Hora',     key: 'fecha',   width: 26 },
    { header: 'Bomba',            key: 'bomba',   width: 20 },
    { header: 'Evento',           key: 'evento',  width: 18 },
    { header: 'Descripción',      key: 'desc',    width: 55 }
  ];
  estilizarHeader(bombaSheet, NARANJA);

  // Obtener alertas relacionadas con bombas (últimos 30 días)
  const alertasBomba = await Alert.find({
    createdAt: { $gte: hace7d },
    $or: [
      { mensaje: { $regex: /bomba/i } },
      { mensaje: { $regex: /encendid|apagad|motobomba|pump/i } }
    ]
  }).sort({ createdAt: -1 }).limit(200);

  if (alertasBomba.length === 0) {
    const nr = bombaSheet.addRow({ fecha: 'Sin actividad registrada en los últimos 7 días' });
    nr.getCell('fecha').font = { italic: true, color: { argb: '94A3B8' } };
  } else {
    alertasBomba.forEach(a => {
      // Determinar el evento
      let evento = 'Evento';
      let colorEvento = null;
      const msg = a.mensaje.toLowerCase();
      if (msg.includes('encendid')) { evento = 'ENCENDIDA'; colorEvento = '16A34A'; }
      else if (msg.includes('apagad'))  { evento = 'APAGADA';   colorEvento = ROJO; }
      else if (msg.includes('bloqueada') || msg.includes('límite')) { evento = 'BLOQUEADA'; colorEvento = ROJO; }
      else if (msg.includes('horario'))  { evento = 'BLOQ. HORARIO'; colorEvento = NARANJA; }
      else if (msg.includes('automátic')) { evento = 'AUTOMÁTICO'; colorEvento = AZUL_OSCURO; }

      // Extraer nombre de bomba del mensaje
      const matchBomba = a.mensaje.match(/"([^"]+)"/);
      const nombreBomba = matchBomba ? matchBomba[1] : 'Bomba';

      const addedRow = bombaSheet.addRow({
        fecha:  a.createdAt?.toLocaleString('es-CO', { timeZone: 'America/Bogota' }) || '-',
        bomba:  nombreBomba,
        evento: evento,
        desc:   a.mensaje
      });
      if (colorEvento) {
        addedRow.getCell('evento').font = { bold: true, color: { argb: colorEvento } };
      }
    });
  }
  estilizarFilas(bombaSheet, 2, NARANJA_CLAR);

  // ──────────────────────────────────────────────────────────────────────
  // HOJA 9: GASTOS POR LOTE
  // ──────────────────────────────────────────────────────────────────────
  const gastosSheet = workbook.addWorksheet('Gastos por Lote');
  gastosSheet.columns = [
    { header: 'Lote',              key: 'nombre',    width: 24 },
    { header: 'Cerdos',            key: 'cerdos',    width: 10 },
    { header: 'Estado',            key: 'estado',    width: 14 },
    { header: 'Total Gastos',      key: 'total',     width: 18 },
    { header: 'Gasto/Cerdo',       key: 'porCerdo',  width: 16 },
    { header: 'Último Gasto',      key: 'ultimoGasto', width: 20 },
    { header: 'Descripción Último',key: 'ultimaDesc',  width: 35 }
  ];
  estilizarHeader(gastosSheet, MORADO);

  const lotesConGastos = await Lote.find().sort({ activo: -1, total_gastos: -1 });
  let totalGastosGlobal = 0;

  lotesConGastos.forEach(lote => {
    const totalGastos = lote.total_gastos || 0;
    totalGastosGlobal += totalGastos;
    const porCerdo = lote.cantidad_cerdos > 0 ? totalGastos / lote.cantidad_cerdos : 0;
    const ultimoGasto = lote.gastos_semanales && lote.gastos_semanales.length > 0
      ? lote.gastos_semanales[lote.gastos_semanales.length - 1]
      : null;

    const addedRow = gastosSheet.addRow({
      nombre:     lote.nombre,
      cerdos:     lote.cantidad_cerdos,
      estado:     lote.activo ? 'Activo' : 'Finalizado',
      total:      totalGastos,
      porCerdo:   parseFloat(porCerdo.toFixed(0)),
      ultimoGasto: ultimoGasto
        ? ultimoGasto.fecha?.toLocaleDateString('es-CO') || '-'
        : '-',
      ultimaDesc: ultimoGasto ? `${ultimoGasto.descripcion || ''} (${ultimoGasto.categoria || ''})` : '-'
    });

    if (!lote.activo) {
      addedRow.getCell('estado').font = { color: { argb: '94A3B8' } };
    } else {
      addedRow.getCell('estado').font = { color: { argb: '16A34A' }, bold: true };
    }
  });

  // Fila de total
  const totalGastosRow = gastosSheet.addRow({
    nombre:   'TOTAL GENERAL',
    total:    totalGastosGlobal
  });
  totalGastosRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MORADO } };
    cell.font = { bold: true, color: { argb: BLANCO } };
  });

  estilizarFilas(gastosSheet, 2, MORADO_CLAR);
  gastosSheet.getColumn('total').numFmt   = '$#,##0';
  gastosSheet.getColumn('porCerdo').numFmt = '$#,##0';

  // ──────────────────────────────────────────────────────────────────────
  // HOJA 10: INVENTARIO ALIMENTO
  // ──────────────────────────────────────────────────────────────────────
  const invSheet = workbook.addWorksheet('Inventario Alimento');
  invSheet.columns = [
    { header: 'Producto',           key: 'nombre',    width: 24 },
    { header: 'Tipo',               key: 'tipo',      width: 14 },
    { header: 'Bultos en Stock',    key: 'bultos',    width: 16 },
    { header: 'Kg en Stock',        key: 'kg',        width: 14 },
    { header: 'Stock Mínimo (blt)', key: 'minimo',    width: 18 },
    { header: 'Precio por Bulto',   key: 'precio',    width: 17 },
    { header: 'Valor Total',        key: 'valor',     width: 16 },
    { header: 'Estado Stock',       key: 'estadoStock', width: 14 }
  ];
  estilizarHeader(invSheet, VERDE_OSCURO);

  const inventarios = await InventarioAlimento.find({ activo: true });
  inventarios.forEach(inv => {
    const totalKg = (inv.cantidad_bultos || 0) * (inv.peso_por_bulto_kg || 40);
    const valorTot = (inv.cantidad_bultos || 0) * (inv.precio_bulto || 0);
    const bajoProd  = (inv.cantidad_bultos || 0) <= (inv.stock_minimo_bultos || 5);

    const addedRow = invSheet.addRow({
      nombre:      inv.nombre,
      tipo:        inv.tipo,
      bultos:      inv.cantidad_bultos || 0,
      kg:          parseFloat(totalKg.toFixed(1)),
      minimo:      inv.stock_minimo_bultos || 5,
      precio:      inv.precio_bulto || 0,
      valor:       parseFloat(valorTot.toFixed(0)),
      estadoStock: bajoProd ? 'BAJO STOCK' : 'Normal'
    });

    if (bajoProd) {
      addedRow.getCell('estadoStock').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };
      addedRow.getCell('estadoStock').font = { bold: true, color: { argb: ROJO } };
      addedRow.getCell('bultos').font      = { bold: true, color: { argb: ROJO } };
    } else {
      addedRow.getCell('estadoStock').font = { color: { argb: '16A34A' } };
    }
  });
  estilizarFilas(invSheet, 2);
  invSheet.getColumn('precio').numFmt = '$#,##0';
  invSheet.getColumn('valor').numFmt  = '$#,##0';

  // Movimientos recientes
  const lastInvRow = (invSheet.lastRow?.number || 1) + 2;
  addTituloSeccion(invSheet, 'MOVIMIENTOS RECIENTES (ÚLTIMOS 30 DÍAS)', 'A', 'H', lastInvRow, VERDE_OSCURO);
  const movHeaders = ['Fecha', 'Producto', 'Tipo Mov', 'Bultos', 'Kg', 'Precio Uni.', 'Total', 'Descripción'];
  movHeaders.forEach((h, i) => {
    const cell = invSheet.getCell(lastInvRow + 1, i + 1);
    cell.value = h;
    cell.font  = { bold: true };
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: VERDE_CLARO } };
  });

  const hace30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  inventarios.forEach(inv => {
    const movRecientes = (inv.movimientos || [])
      .filter(m => m.fecha >= hace30d)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    movRecientes.forEach(m => {
      const r = invSheet.addRow([
        m.fecha?.toLocaleDateString('es-CO') || '-',
        inv.nombre,
        m.tipo === 'entrada' ? 'Entrada (Compra)' : 'Salida (Consumo)',
        m.cantidad_bultos,
        m.cantidad_kg || 0,
        m.precio_unitario || 0,
        m.total || 0,
        m.descripcion || ''
      ]);
      r.getCell(3).font = {
        bold: true,
        color: { argb: m.tipo === 'entrada' ? '16A34A' : ROJO }
      };
      r.getCell(6).numFmt = '$#,##0';
      r.getCell(7).numFmt = '$#,##0';
    });
  });

  return workbook;
}

// ═══════════════════════════════════════════════════════════════════════
// GENERAR REPORTE EXCEL — DESCARGA DIRECTA
// GET /api/reporte/excel
// ═══════════════════════════════════════════════════════════════════════

exports.generarReporteExcel = async (_req, res) => {
  try {
    const workbook = await construirWorkbook();

    const fecha = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Reporte_COO_Alianzas_${fecha}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('[REPORTE] Error generando Excel:', error);
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ENVIAR REPORTE POR EMAIL
// POST /api/reporte/email
// Body: { correo: "destino@ejemplo.com" }
// ═══════════════════════════════════════════════════════════════════════

exports.enviarReportePorEmail = (req, res) => {
  const { correo } = req.body;

  if (!correo || !correo.includes('@')) {
    return res.status(400).json({ mensaje: 'Correo electrónico inválido' });
  }
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return res.status(500).json({ mensaje: 'Configuración de email no encontrada en el servidor (EMAIL_USER / EMAIL_PASS).' });
  }

  // ── Responder inmediatamente para evitar timeout ─────────────────────
  res.json({ ok: true, mensaje: `Reporte siendo generado. Recibirás el correo en ${correo} en unos momentos.` });

  // ── Generar y enviar en segundo plano ────────────────────────────────
  const fecha        = new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Bogota' });
  const fechaArchivo = new Date().toISOString().split('T')[0];

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });

  construirWorkbook()
    .then(workbook => workbook.xlsx.writeBuffer())
    .then(buffer => transporter.sendMail({
      from:    `"COO Alianzas - Granja Porcina" <${process.env.EMAIL_USER}>`,
      to:      correo,
      subject: `Reporte Completo Granja Porcina — ${fecha}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto;">
          <div style="background: #2D6A4F; color: white; padding: 28px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 22px;">COO ALIANZAS</h1>
            <p style="margin: 6px 0 0; opacity: 0.85;">Sistema de Gestión Granja Porcina</p>
          </div>
          <div style="padding: 28px; background: #f8fafc; border: 1px solid #e2e8f0;">
            <h2 style="color: #2D6A4F; margin-top: 0;">Reporte Completo adjunto</h2>
            <p>Hola,</p>
            <p>Se adjunta el reporte completo de la granja porcina generado el <strong>${fecha}</strong>.</p>
            <p>El archivo Excel incluye:</p>
            <ul style="color: #475569;">
              <li>Resumen ejecutivo con métricas clave</li>
              <li>Estado de todos los lotes activos y finalizados</li>
              <li>Historial completo de pesajes</li>
              <li>Registro contable (ingresos y gastos)</li>
              <li>Alertas del sistema</li>
              <li>Temperatura y humedad — últimas 24 horas (por hora)</li>
              <li>Consumo de agua — últimas 24 horas (por hora)</li>
              <li>Historial de motobomba (encendidos/apagados)</li>
              <li>Gastos detallados por lote</li>
              <li>Inventario de alimento con movimientos recientes</li>
            </ul>
            <p style="margin-top: 20px; color: #94a3b8; font-size: 0.85em;">
              Este correo fue enviado automáticamente desde el sistema COO Alianzas.<br>
              Fecha de generación: ${fecha}
            </p>
          </div>
          <div style="background: #2D6A4F; color: #d1fae5; padding: 12px; text-align: center; font-size: 0.8em; border-radius: 0 0 8px 8px;">
            COO Alianzas © ${new Date().getFullYear()}
          </div>
        </div>
      `,
      attachments: [{
        filename:    `Reporte_COO_Alianzas_${fechaArchivo}.xlsx`,
        content:     buffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }]
    }))
    .then(() => console.log(`[REPORTE] Email enviado exitosamente a ${correo}`))
    .catch(err => console.error(`[REPORTE] Error enviando email a ${correo}:`, err.message));
};

// ═══════════════════════════════════════════════════════════════════════
// OBTENER RESUMEN PARA DASHBOARD
// GET /api/reporte/resumen
// ═══════════════════════════════════════════════════════════════════════

exports.obtenerResumen = async (_req, res) => {
  try {
    const [lotesActivos, totalCerdos, contabilidad, ultimoPesaje] = await Promise.all([
      Lote.countDocuments({ activo: true }),
      Lote.aggregate([{ $match: { activo: true } }, { $group: { _id: null, total: { $sum: '$cantidad_cerdos' } } }]),
      Contabilidad.find(),
      Weighing.findOne().sort({ createdAt: -1 })
    ]);

    const gastos   = contabilidad.filter(c => c.tipo === 'gasto').reduce((s, c) => s + c.total, 0);
    const ingresos = contabilidad.filter(c => c.tipo === 'ingreso').reduce((s, c) => s + c.total, 0);

    res.json({
      lotes_activos:  lotesActivos,
      total_cerdos:   totalCerdos[0]?.total || 0,
      total_gastos:   gastos,
      total_ingresos: ingresos,
      balance:        ingresos - gastos,
      ultimo_peso:    ultimoPesaje?.peso || 0
    });

  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// VERIFICAR CONFIGURACIÓN DE EMAIL
// GET /api/reporte/test-email
// Verifica que Gmail SMTP esté configurado correctamente y devuelve
// el error exacto si hay algún problema (App Password, credenciales, etc.)
// ═══════════════════════════════════════════════════════════════════════

exports.testEmail = async (_req, res) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return res.status(400).json({
      ok: false,
      problema: 'VARIABLES_FALTANTES',
      mensaje: 'Las variables EMAIL_USER y/o EMAIL_PASS no están configuradas en el servidor.',
      solucion: 'Configura EMAIL_USER (tu correo Gmail) y EMAIL_PASS (App Password de 16 dígitos) en las variables de entorno del servidor.'
    });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });

  try {
    await transporter.verify();
    res.json({
      ok: true,
      mensaje: `Conexión SMTP exitosa con ${process.env.EMAIL_USER}. El envío de correos está funcionando correctamente.`
    });
  } catch (error) {
    let problema = 'ERROR_DESCONOCIDO';
    let solucion = 'Revisa los logs del servidor para más detalles.';

    if (error.code === 'EAUTH' || error.responseCode === 535 || error.message?.includes('Invalid credentials')) {
      problema = 'CREDENCIALES_INVALIDAS';
      solucion = [
        '1. Gmail ya NO acepta contraseñas normales para apps externas.',
        '2. Debes usar una "Contraseña de Aplicación" (App Password) de 16 dígitos.',
        '3. Para generarla: Google Account → Seguridad → Verificación en 2 pasos → Contraseñas de aplicaciones.',
        '4. Selecciona "Correo" y "Otro dispositivo" → Copia los 16 dígitos.',
        '5. Pega esos 16 dígitos en EMAIL_PASS (sin espacios).'
      ].join(' ');
    } else if (error.code === 'ECONNECTION' || error.code === 'ENOTFOUND') {
      problema = 'SIN_CONEXION';
      solucion = 'El servidor no puede conectarse a Gmail. Verifica la conexión a internet del servidor.';
    } else if (error.message?.includes('Username and Password not accepted')) {
      problema = 'CONTRASEÑA_NO_ACEPTADA';
      solucion = 'Contraseña no aceptada. Usa una App Password de 16 dígitos generada en tu cuenta Google, no la contraseña normal de Gmail.';
    }

    res.status(400).json({
      ok: false,
      problema,
      error_tecnico: error.message,
      correo_configurado: process.env.EMAIL_USER,
      solucion
    });
  }
};
