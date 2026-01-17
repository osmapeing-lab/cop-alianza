const ExcelJS = require('exceljs');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

exports.generarReporteExcel = async (datos) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'COP Alianza';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Reporte Granja', {
    properties: { tabColor: { argb: '2d6a4f' } }
  });

  // Configurar anchos de columna
  sheet.columns = [
    { width: 30 },
    { width: 25 },
    { width: 20 }
  ];

  // Título principal
  sheet.mergeCells('A1:C1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'REPORTE GRANJA PORCINA COO-ALIANZAS';
  titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2d6a4f' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 35;

  // Subtítulo con fecha
  sheet.mergeCells('A2:C2');
  const subtitleCell = sheet.getCell('A2');
  subtitleCell.value = `Fecha de generación: ${new Date().toLocaleString()}`;
  subtitleCell.font = { italic: true, size: 10, color: { argb: '666666' } };
  subtitleCell.alignment = { horizontal: 'center' };
  sheet.getRow(2).height = 25;

  // Espacio
  sheet.getRow(3).height = 10;

  // Sección: Condiciones Climáticas
  sheet.mergeCells('A4:C4');
  const climaHeader = sheet.getCell('A4');
  climaHeader.value = 'CONDICIONES CLIMATICAS';
  climaHeader.font = { bold: true, size: 12, color: { argb: 'FFFFFF' } };
  climaHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '40916c' } };
  climaHeader.alignment = { horizontal: 'center' };
  sheet.getRow(4).height = 28;

  // Headers de tabla
  const headerRow = sheet.getRow(5);
  headerRow.values = ['Parámetro', 'Valor', 'Estado'];
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'e8f5e9' } };
  headerRow.alignment = { horizontal: 'center' };
  headerRow.height = 22;

  // Datos climáticos
  const climaData = [
    ['Temperatura Ambiente', `${datos.temp_ambiente || '--'} °C`, datos.temp_ambiente ? 'Conectado' : 'Sin datos'],
    ['Temperatura Porqueriza', `${datos.temp_porqueriza || '--'} °C`, datos.temp_porqueriza ? (datos.temp_porqueriza > 34 ? 'ALERTA' : 'Normal') : 'Sin datos'],
    ['Humedad Ambiente', `${datos.humedad_ambiente || '--'} %`, datos.humedad_ambiente ? 'Conectado' : 'Sin datos'],
    ['Humedad Porqueriza', `${datos.humedad_porqueriza || '--'} %`, datos.humedad_porqueriza ? 'Normal' : 'Sin datos'],
    ['Sensación Térmica', `${datos.sensacion_termica || '--'} °C`, datos.sensacion_termica ? 'Calculado' : 'Sin datos']
  ];

  let rowIndex = 6;
  climaData.forEach((row, index) => {
    const dataRow = sheet.getRow(rowIndex);
    dataRow.values = row;
    dataRow.alignment = { horizontal: 'center' };
    
    // Alternar colores de fila
    if (index % 2 === 0) {
      dataRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'f8f9fa' } };
    }
    
    // Color de estado
    const estadoCell = dataRow.getCell(3);
    if (row[2] === 'ALERTA') {
      estadoCell.font = { bold: true, color: { argb: 'dc2626' } };
    } else if (row[2] === 'Normal' || row[2] === 'Conectado') {
      estadoCell.font = { color: { argb: '16a34a' } };
    } else {
      estadoCell.font = { color: { argb: '6b7280' } };
    }
    
    rowIndex++;
  });

  // Espacio
  rowIndex++;

  // Sección: Consumo de Agua
  sheet.mergeCells(`A${rowIndex}:C${rowIndex}`);
  const aguaHeader = sheet.getCell(`A${rowIndex}`);
  aguaHeader.value = 'CONSUMO DE AGUA';
  aguaHeader.font = { bold: true, size: 12, color: { argb: 'FFFFFF' } };
  aguaHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0ea5e9' } };
  aguaHeader.alignment = { horizontal: 'center' };
  sheet.getRow(rowIndex).height = 28;
  rowIndex++;

  const aguaData = [
    ['Consumo Diario', `${datos.consumo_diario || 0} L`, ''],
    ['Consumo Mensual', `${datos.consumo_mensual || 0} L`, ''],
    ['Nivel Tanque Principal', `${datos.nivel_tanque1 || 0} %`, datos.nivel_tanque1 < 20 ? 'BAJO' : 'Normal'],
    ['Nivel Tanque Reserva', `${datos.nivel_tanque2 || 0} %`, datos.nivel_tanque2 < 20 ? 'BAJO' : 'Normal']
  ];

  aguaData.forEach((row, index) => {
    const dataRow = sheet.getRow(rowIndex);
    dataRow.values = row;
    dataRow.alignment = { horizontal: 'center' };
    
    if (index % 2 === 0) {
      dataRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'f0f9ff' } };
    }
    
    const estadoCell = dataRow.getCell(3);
    if (row[2] === 'BAJO') {
      estadoCell.font = { bold: true, color: { argb: 'f59e0b' } };
    }
    
    rowIndex++;
  });

  // Espacio
  rowIndex++;

  // Sección: Estado de Bombas
  sheet.mergeCells(`A${rowIndex}:C${rowIndex}`);
  const bombasHeader = sheet.getCell(`A${rowIndex}`);
  bombasHeader.value = 'ESTADO DE BOMBAS';
  bombasHeader.font = { bold: true, size: 12, color: { argb: 'FFFFFF' } };
  bombasHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '8b5cf6' } };
  bombasHeader.alignment = { horizontal: 'center' };
  sheet.getRow(rowIndex).height = 28;
  rowIndex++;

  if (datos.bombas && datos.bombas.length > 0) {
    datos.bombas.forEach((bomba, index) => {
      const dataRow = sheet.getRow(rowIndex);
      dataRow.values = [
        bomba.nombre,
        bomba.estado ? 'ENCENDIDA' : 'APAGADA',
        bomba.conectada ? 'Conectada' : 'Sin conexión'
      ];
      dataRow.alignment = { horizontal: 'center' };
      
      if (index % 2 === 0) {
        dataRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'faf5ff' } };
      }
      
      const estadoCell = dataRow.getCell(2);
      estadoCell.font = { bold: true, color: { argb: bomba.estado ? '16a34a' : '6b7280' } };
      
      const conexionCell = dataRow.getCell(3);
      conexionCell.font = { color: { argb: bomba.conectada ? '16a34a' : 'dc2626' } };
      
      rowIndex++;
    });
  }

  // Bordes a todas las celdas con datos
  for (let i = 4; i < rowIndex; i++) {
    const row = sheet.getRow(i);
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'dee2e6' } },
        left: { style: 'thin', color: { argb: 'dee2e6' } },
        bottom: { style: 'thin', color: { argb: 'dee2e6' } },
        right: { style: 'thin', color: { argb: 'dee2e6' } }
      };
    });
  }

  // Pie de página
  rowIndex += 2;
  sheet.mergeCells(`A${rowIndex}:C${rowIndex}`);
  const footerCell = sheet.getCell(`A${rowIndex}`);
  footerCell.value = 'Cooperativa Alianzas - Lorica, Córdoba | Sistema de Monitoreo Inteligente';
  footerCell.font = { italic: true, size: 9, color: { argb: '6b7280' } };
  footerCell.alignment = { horizontal: 'center' };

  return workbook;
};

exports.enviarReporteEmail = async (req, res) => {
  try {
    const { destinatario, datos } = req.body;

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      return res.status(500).json({ mensaje: 'Email no configurado en el servidor' });
    }

    // Generar Excel
    const workbook = await exports.generarReporteExcel(datos);
    
    // Guardar temporalmente
    const fileName = `reporte_${Date.now()}.xlsx`;
    const filePath = path.join('/tmp', fileName);
    await workbook.xlsx.writeFile(filePath);

    // Enviar email con adjunto
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: destinatario || process.env.EMAIL_USER,
      subject: `Reporte Diario - Granja COO-Alianzas - ${new Date().toLocaleDateString()}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #2d6a4f;">Reporte Diario - COP Alianza</h2>
          <p>Adjunto encontrará el reporte generado del sistema de monitoreo.</p>
          <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
          <hr style="border: 1px solid #dee2e6; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 12px;">
            Este es un mensaje automático del Sistema de Monitoreo Inteligente.<br>
            Cooperativa Alianzas - Lorica, Córdoba
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `Reporte_COP_Alianza_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`,
          path: filePath
        }
      ]
    });

    // Eliminar archivo temporal
    fs.unlinkSync(filePath);

    res.json({ mensaje: 'Reporte enviado correctamente' });
  } catch (error) {
    console.log('Error enviando reporte:', error);
    res.status(500).json({ mensaje: error.message });
  }
};

exports.descargarReporte = async (req, res) => {
  try {
    const { datos } = req.body;

    const workbook = await exports.generarReporteExcel(datos);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Reporte_COP_Alianza_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};