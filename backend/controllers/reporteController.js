const ExcelJS = require('exceljs');
const { Resend } = require('resend');
const path = require('path');
const os = require('os');
const fs = require('fs');

const resend = new Resend(process.env.RESEND_API_KEY);

exports.generarReporteExcel = async (datos) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'COP Alianza';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Reporte Granja');

  sheet.columns = [
    { width: 30 },
    { width: 25 },
    { width: 20 }
  ];

  sheet.mergeCells('A1:C1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'REPORTE GRANJA PORCINA COO-ALIANZAS';
  titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2d6a4f' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 35;

  sheet.mergeCells('A2:C2');
  const fechaCell = sheet.getCell('A2');
  fechaCell.value = `Fecha: ${new Date().toLocaleString()}`;
  fechaCell.font = { italic: true, size: 10 };
  fechaCell.alignment = { horizontal: 'center' };

  const headerRow = sheet.getRow(4);
  headerRow.values = ['Parametro', 'Valor', 'Estado'];
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'e8f5e9' } };

  const filas = [
    ['Temperatura Ambiente', `${datos.temp_ambiente || '--'} °C`, datos.temp_ambiente ? 'OK' : 'Sin datos'],
    ['Temperatura Porqueriza', `${datos.temp_porqueriza || '--'} °C`, datos.temp_porqueriza ? 'OK' : 'Sin datos'],
    ['Humedad Ambiente', `${datos.humedad_ambiente || '--'} %`, datos.humedad_ambiente ? 'OK' : 'Sin datos'],
    ['Humedad Porqueriza', `${datos.humedad_porqueriza || '--'} %`, datos.humedad_porqueriza ? 'OK' : 'Sin datos'],
    ['Sensacion Termica', `${datos.sensacion_termica || '--'} °C`, ''],
    ['Consumo Diario', `${datos.consumo_diario || 0} L`, ''],
    ['Consumo Mensual', `${datos.consumo_mensual || 0} L`, ''],
    ['Tanque Principal', `${datos.nivel_tanque1 || '--'} %`, datos.nivel_tanque1 < 20 ? 'BAJO' : 'OK'],
    ['Tanque Reserva', `${datos.nivel_tanque2 || '--'} %`, datos.nivel_tanque2 < 20 ? 'BAJO' : 'OK']
  ];

  let rowIndex = 5;
  filas.forEach((fila) => {
    const row = sheet.getRow(rowIndex);
    row.values = fila;
    row.alignment = { horizontal: 'center' };
    rowIndex++;
  });

  rowIndex++;
  sheet.getCell(`A${rowIndex}`).value = 'ESTADO DE BOMBAS';
  sheet.getCell(`A${rowIndex}`).font = { bold: true };
  rowIndex++;

  if (datos.bombas && datos.bombas.length > 0) {
    datos.bombas.forEach((bomba) => {
      const row = sheet.getRow(rowIndex);
      row.values = [bomba.nombre, bomba.estado ? 'ENCENDIDA' : 'APAGADA', bomba.conectada ? 'Conectada' : 'Sin conexion'];
      rowIndex++;
    });
  }

  return workbook;
};

exports.enviarReporteEmail = async (req, res) => {
  try {
    const { datos } = req.body;

    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ mensaje: 'API de email no configurada' });
    }

    const workbook = await exports.generarReporteExcel(datos || {});
    
    const tempDir = os.tmpdir();
    const fileName = `reporte_${Date.now()}.xlsx`;
    const filePath = path.join(tempDir, fileName);
    
    await workbook.xlsx.writeFile(filePath);

    const fileBuffer = fs.readFileSync(filePath);
    const base64File = fileBuffer.toString('base64');

    await resend.emails.send({
      from: 'COP Alianza <onboarding@resend.dev>',
      to: ['osmapeing@gmail.com'],
      subject: `Reporte Diario - COP Alianza - ${new Date().toLocaleDateString()}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #2d6a4f;">Reporte Diario - COP Alianza</h2>
          <p>Adjunto el reporte generado del sistema de monitoreo.</p>
          <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
          <hr>
          <p style="color: #6b7280; font-size: 12px;">Cooperativa Alianzas - Lorica, Córdoba</p>
        </div>
      `,
      attachments: [
        {
          filename: `Reporte_COP_Alianza_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`,
          content: base64File
        }
      ]
    });

    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.log('No se pudo eliminar archivo temporal');
    }

    res.json({ mensaje: 'Reporte enviado correctamente' });
  } catch (error) {
    console.log('Error enviando reporte:', error);
    res.status(500).json({ mensaje: error.message });
  }
};

exports.descargarReporte = async (req, res) => {
  try {
    const { datos } = req.body;
    const workbook = await exports.generarReporteExcel(datos || {});

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Reporte_COP_Alianza.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};