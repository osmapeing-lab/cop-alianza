const Alert = require('../models/Alert');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  tls: { rejectUnauthorized: false }
});

exports.enviarAlertaEmail = async (asunto, contenidoHTML) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('Email no configurado');
      return false;
    }

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: asunto,
      html: contenidoHTML
    });

    console.log('Email enviado:', asunto);
    return true;
  } catch (error) {
    console.log('Error enviando email:', error.message);
    return false;
  }
};

exports.alertaTemperatura = async (datos) => {
  const { temperatura, umbral, bomba_activada, consumo_agua, resultado } = datos;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #dc2626; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">ALERTA COP ALIANZA</h1>
      </div>
      <div style="padding: 30px; background: #fef2f2; border: 1px solid #fecaca;">
        <h2 style="color: #dc2626; margin-top: 0;">Temperatura fuera de rango</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Temperatura actual:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd; color: #dc2626; font-size: 1.2em;">${temperatura}°C</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Umbral permitido:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${umbral}°C</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Sistema de riego:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd; color: ${bomba_activada ? '#16a34a' : '#6b7280'};">
              ${bomba_activada ? 'ACTIVADO' : 'NO ACTIVADO'}
            </td>
          </tr>
          ${bomba_activada ? `
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Consumo de agua:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #ddd;">${consumo_agua} litros</td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding: 10px;"><strong>Resultado:</strong></td>
            <td style="padding: 10px;">${resultado}</td>
          </tr>
        </table>
        <p style="margin-top: 20px; color: #6b7280; font-size: 0.9em;">Fecha: ${new Date().toLocaleString()}</p>
      </div>
    </div>
  `;

  const alerta = new Alert({
    tipo: 'temperatura_alta',
    mensaje: `Temperatura ${temperatura}°C supera umbral de ${umbral}°C`,
    enviado_email: false
  });

  const enviado = await exports.enviarAlertaEmail(`ALERTA: Temperatura ${temperatura}°C - COP Alianza`, html);
  alerta.enviado_email = enviado;
  await alerta.save();
  return alerta;
};

exports.alertaTanqueBajo = async (datos) => {
  const { tanque, nivel, umbral_minimo } = datos;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #f59e0b; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">ALERTA COP ALIANZA</h1>
      </div>
      <div style="padding: 30px; background: #fffbeb; border: 1px solid #fde68a;">
        <h2 style="color: #d97706; margin-top: 0;">Nivel de tanque bajo</h2>
        <p><strong>Tanque:</strong> ${tanque}</p>
        <p><strong>Nivel actual:</strong> ${nivel}%</p>
        <p><strong>Nivel minimo:</strong> ${umbral_minimo}%</p>
        <p style="margin-top: 20px; color: #6b7280; font-size: 0.9em;">Fecha: ${new Date().toLocaleString()}</p>
      </div>
    </div>
  `;

  const alerta = new Alert({
    tipo: 'nivel_bajo',
    mensaje: `${tanque} al ${nivel}%`,
    enviado_email: false
  });

  const enviado = await exports.enviarAlertaEmail(`ALERTA: ${tanque} nivel bajo - COP Alianza`, html);
  alerta.enviado_email = enviado;
  await alerta.save();
  return alerta;
};

exports.alertaSensorDesconectado = async (sensor) => {
  const alerta = new Alert({
    tipo: 'sensor_desconectado',
    mensaje: `Sensor ${sensor} sin conexion`,
    enviado_email: false
  });
  await alerta.save();
  return alerta;
};

exports.getAlertas = async (req, res) => {
  try {
    const alertas = await Alert.find().sort({ fecha: -1 }).limit(50);
    res.json(alertas);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

exports.crearAlerta = async (req, res) => {
  try {
    const { tipo, mensaje } = req.body;
    const alerta = new Alert({ tipo, mensaje, enviado_email: false });
    await alerta.save();
    res.status(201).json(alerta);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};