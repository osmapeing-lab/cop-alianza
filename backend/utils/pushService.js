/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - SERVICIO WEB PUSH (VAPID)
 * ═══════════════════════════════════════════════════════════════════════
 * Envía notificaciones push a todos los dispositivos suscritos.
 * Funciona en Chrome, Firefox y WebViews modernas de Android.
 * ═══════════════════════════════════════════════════════════════════════
 */

const webpush = require('web-push');
const PushSub = require('../models/PushSubscription');

let vapidConfigured = false;

function initVapid() {
  if (vapidConfigured) return true;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(
    `mailto:${process.env.BREVO_USER || process.env.EMAIL_USER || 'cooalianzas@gmail.com'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  vapidConfigured = true;
  return true;
}

/**
 * Envía una notificación push a todos los dispositivos suscritos.
 * @param {object} payload  { title, body, icon, badge, data }
 * @returns {number} cantidad de notificaciones enviadas
 */
exports.enviarPushATodos = async (payload) => {
  if (!initVapid()) {
    console.log('[PUSH] VAPID no configurado — omitiendo push');
    return 0;
  }

  const subs = await PushSub.find({ activo: true });
  if (subs.length === 0) return 0;

  const notifPayload = JSON.stringify({
    title: payload.title || 'COO Alianzas',
    body:  payload.body  || '',
    icon:  payload.icon  || '/favicon.png',
    badge: payload.badge || '/favicon.png',
    data:  payload.data  || {},
    timestamp: Date.now()
  });

  let enviados = 0;
  const invalidos = [];

  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        notifPayload
      );
      enviados++;
    } catch (err) {
      // 410 Gone = suscripción expirada, desactivar
      if (err.statusCode === 410 || err.statusCode === 404) {
        invalidos.push(sub._id);
      }
      console.log(`[PUSH] Error enviando a ${sub.endpoint.slice(-20)}: ${err.message}`);
    }
  }));

  // Limpiar suscripciones inválidas
  if (invalidos.length > 0) {
    await PushSub.updateMany({ _id: { $in: invalidos } }, { activo: false });
  }

  console.log(`[PUSH] Enviadas ${enviados}/${subs.length} notificaciones`);
  return enviados;
};
