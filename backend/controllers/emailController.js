const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

exports.enviarReporte = async (req, res) => {
  try {
    const { destinatario, asunto, contenido, datos } = req.body;

    // Crear tabla HTML con datos
    let tablaHTML = `
      <h2>🐷 Reporte COP Alianza</h2>
      <p>Fecha: ${new Date().toLocaleString()}</p>
      <table border="1" cellpadding="10" style="border-collapse: collapse;">
        <tr style="background: #1a5f2a; color: white;">
          <th>Parámetro</th>
          <th>Valor</th>
        </tr>
    `;

    if (datos) {
      Object.entries(datos).forEach(([key, value]) => {
        tablaHTML += `<tr><td>${key}</td><td>${value}</td></tr>`;
      });
    }

    tablaHTML += '</table>';

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: destinatario,
      subject: asunto || '📊 Reporte COP Alianza',
      html: tablaHTML
    };

    await transporter.sendMail(mailOptions);
    res.json({ mensaje: 'Reporte enviado correctamente' });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

exports.enviarAlerta = async (destinatario, tipo, mensaje) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: destinatario,
      subject: `🚨 Alerta COP Alianza: ${tipo}`,
      html: `
        <div style="padding: 20px; background: #ffebee; border-left: 4px solid #f44336;">
          <h2>⚠️ Alerta del Sistema</h2>
          <p><strong>Tipo:</strong> ${tipo}</p>
          <p><strong>Mensaje:</strong> ${mensaje}</p>
          <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.log('Error enviando email:', error.message);
    return false;
  }
};