/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - SERVICIO FIREBASE FCM (Push Notifications)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Requisitos para activar:
 *   1. Crear proyecto en console.firebase.google.com
 *   2. Project Settings → Service Accounts → Generate new private key
 *   3. Copiar los valores al .env del servidor:
 *        FIREBASE_PROJECT_ID=tu-proyecto-id
 *        FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tu-proyecto.iam.gserviceaccount.com
 *        FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
 *   4. En la app Android: registrar token con POST /api/fcm/token
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

let admin = null;
let initialized = false;

function initFirebase() {
  if (initialized) return true;
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    return false;
  }
  try {
    admin = require('firebase-admin');
    // Evitar inicializar más de una vez si hay hot-reload
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId:   process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        })
      });
    }
    initialized = true;
    console.log('[FCM] Firebase Admin inicializado correctamente');
    return true;
  } catch (e) {
    console.error('[FCM] Error inicializando Firebase:', e.message);
    return false;
  }
}

/**
 * Envía una notificación push a todos los dispositivos registrados.
 * @param {object} opts
 * @param {string} opts.titulo  - Título de la notificación
 * @param {string} opts.cuerpo  - Cuerpo / mensaje
 * @param {string} [opts.tipo]  - Tipo para la app Android (alerta, info, bomba, etc.)
 * @param {object} [opts.datos] - Datos extra para la app
 */
exports.enviarNotificacion = async ({ titulo, cuerpo, tipo = 'info', datos = {} }) => {
  if (!initFirebase()) {
    // FCM no configurado — no es un error crítico
    return false;
  }

  const FCMToken = require('../models/FCMToken');
  const tokens = await FCMToken.find({ activo: true }).lean();
  if (tokens.length === 0) return false;

  let enviados = 0;
  for (const t of tokens) {
    try {
      await admin.messaging().send({
        token: t.token,
        notification: {
          title: titulo,
          body:  cuerpo
        },
        data: {
          tipo,
          timestamp: Date.now().toString(),
          ...Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, String(v)]))
        },
        android: {
          priority: tipo === 'critico' ? 'high' : 'normal',
          notification: {
            sound:       'default',
            channelId:   'coo_alianzas_alertas',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK'
          }
        }
      });
      enviados++;
    } catch (e) {
      console.error(`[FCM] Error enviando a token ${t.token.slice(-10)}:`, e.message);
      // Desactivar tokens inválidos/expirados
      if (
        e.code === 'messaging/registration-token-not-registered' ||
        e.code === 'messaging/invalid-registration-token'
      ) {
        await FCMToken.updateOne({ token: t.token }, { activo: false });
      }
    }
  }

  console.log(`[FCM] Notificacion enviada a ${enviados}/${tokens.length} dispositivos: "${titulo}"`);
  return enviados > 0;
};

/**
 * Verifica si Firebase está configurado correctamente.
 */
exports.verificarConfiguracion = () => {
  const ok = initFirebase();
  return {
    configurado: ok,
    proyecto: process.env.FIREBASE_PROJECT_ID || null,
    correo_servicio: process.env.FIREBASE_CLIENT_EMAIL || null
  };
};
