/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - SERVICIO WHATSAPP (Meta Graph API)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Envía mensajes de WhatsApp usando la API oficial de Meta.
 * Variables de entorno necesarias:
 *   WA_TOKEN            - Token de acceso de Meta
 *   WA_PHONE_NUMBER_ID  - ID del número de teléfono de WhatsApp Business
 *   WA_DESTINATARIO     - Número destino (con código país, ej: 573001234567)
 *   WA_VERSION          - Versión de la API (default: v21.0)
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

const axios = require('axios');

const WA_TOKEN = process.env.WA_TOKEN;
const WA_PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID;
const WA_VERSION = process.env.WA_VERSION || 'v21.0';
const WA_DESTINATARIO = process.env.WA_DESTINATARIO;

async function enviarWhatsApp(mensaje) {
  if (!WA_TOKEN || !WA_PHONE_NUMBER_ID || !WA_DESTINATARIO) {
    console.log('[WHATSAPP] No configurado. Mensaje:', mensaje);
    return null;
  }

  try {
    const url = `https://graph.facebook.com/${WA_VERSION}/${WA_PHONE_NUMBER_ID}/messages`;

    const response = await axios.post(url, {
      messaging_product: 'whatsapp',
      to: WA_DESTINATARIO,
      type: 'text',
      text: { body: mensaje }
    }, {
      headers: {
        'Authorization': `Bearer ${WA_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('[WHATSAPP] Mensaje enviado:', mensaje.substring(0, 60));
    return response.data;
  } catch (error) {
    console.error('[WHATSAPP] Error:', error.response?.data?.error?.message || error.message);
    return null;
  }
}

module.exports = { enviarWhatsApp };
