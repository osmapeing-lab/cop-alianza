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

async function enviarASuscripciones(subs, payload) {
  if (subs.length === 0) return 0;

  const FRONTEND = process.env.FRONTEND_URL || 'https://cop-alianza.vercel.app';
  const notifPayload = JSON.stringify({
    title: payload.title || 'SAMTR',
    body:  payload.body  || '',
    icon:  payload.icon  || `${FRONTEND}/cerdito_analisis.png`,
    badge: payload.badge || `${FRONTEND}/cerdito_analisis.png`,
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
}

/**
 * Envía una notificación push a todos los dispositivos suscritos, sin
 * importar la granja — usar solo para avisos genuinamente de toda la
 * plataforma (ej. mantenimiento). Para alertas de sensores/hardware de UNA
 * granja, usar `enviarPushAGranja`.
 * @param {object} payload  { title, body, icon, badge, data }
 * @returns {number} cantidad de notificaciones enviadas
 */
exports.enviarPushATodos = async (payload) => {
  if (!initVapid()) {
    console.log('[PUSH] VAPID no configurado — omitiendo push');
    return 0;
  }
  const subs = await PushSub.find({ activo: true });
  return enviarASuscripciones(subs, payload);
};

/**
 * Envía una notificación push solo a los usuarios de una granja — las
 * suscripciones web-push se guardan por `usuario` (nombre de usuario, ver
 * POST /api/push/subscribe), así que primero se resuelve qué usuarios
 * pertenecen a esa granja.
 * @param {string} granjaId
 * @param {object} payload
 */
exports.enviarPushAGranja = async (granjaId, payload) => {
  if (!granjaId) return 0;
  if (!initVapid()) {
    console.log('[PUSH] VAPID no configurado — omitiendo push');
    return 0;
  }
  const User = require('../models/User');
  const usuariosGranja = await User.find({ granja_id: granjaId }).select('usuario');
  const nombresUsuario = usuariosGranja.map(u => u.usuario);
  if (nombresUsuario.length === 0) return 0;

  const subs = await PushSub.find({ activo: true, usuario: { $in: nombresUsuario } });
  return enviarASuscripciones(subs, payload);
};
