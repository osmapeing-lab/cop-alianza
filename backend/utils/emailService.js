const axios = require('axios');
const { Resend } = require('resend');

/**
 * Envía email via Brevo API (primario) o Resend (fallback).
 * No usa SMTP, funciona en Render sin restricciones de puerto.
 */
const enviarEmail = async ({ to, subject, html, attachments }) => {
  if (!to || !to.includes('@')) throw new Error('Correo destinatario inválido');

  if (process.env.BREVO_API_KEY) {
    const body = {
      sender:      { name: 'COO Alianzas', email: process.env.BREVO_USER || process.env.EMAIL_USER },
      to:          [{ email: to }],
      subject,
      htmlContent: html
    };
    if (attachments?.length) {
      body.attachment = attachments.map(a => ({
        name:    a.filename,
        content: Buffer.isBuffer(a.content) ? a.content.toString('base64') : a.content
      }));
    }
    const resp = await axios.post('https://api.brevo.com/v3/smtp/email', body, {
      headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json' }
    });
    if (resp.status >= 300) throw new Error(`Brevo error ${resp.status}`);
  } else if (process.env.RESEND_API_KEY) {
    const resend   = new Resend(process.env.RESEND_API_KEY);
    const fromAddr = process.env.RESEND_FROM || 'COO Alianzas <onboarding@resend.dev>';
    const resAttach = attachments?.map(a => ({
      filename:    a.filename,
      content:     Buffer.isBuffer(a.content) ? a.content.toString('base64') : a.content,
      contentType: a.contentType
    }));
    const { error } = await resend.emails.send({ from: fromAddr, to, subject, html, attachments: resAttach });
    if (error) throw new Error(error.message);
  } else {
    throw new Error('No hay proveedor de email configurado (BREVO_API_KEY o RESEND_API_KEY)');
  }
};

module.exports = { enviarEmail };
