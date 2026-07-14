/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - VERIFICACIÓN FIREBASE APP CHECK (login app móvil)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * La web protege el login con reCAPTCHA v2 (checkbox), que no existe en
 * apps nativas. Para el login desde la app Flutter, en su lugar se exige un
 * token de Firebase App Check (generado por el SDK del dispositivo, prueba
 * que la petición viene de un build legítimo de la app y no de un bot/script).
 *
 * Reutiliza las mismas credenciales de servicio que fcmService.js
 * (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY) —
 * mismo proyecto de Firebase, sin configuración adicional.
 *
 * IMPORTANTE: esas credenciales ya existían en el servidor para FCM (push)
 * antes de que la app móvil implementara App Check de verdad. Si
 * `appCheckConfigurado()` dependiera solo de que existan esas credenciales,
 * el login móvil empezaría a exigir un token que la app todavía no sabe
 * generar (el SDK de App Check no está integrado del lado de Flutter) y
 * nadie podría iniciar sesión. Por eso la exigencia requiere ADEMÁS la
 * bandera explícita `APP_CHECK_ENFORCE=true` — actívala en las variables
 * de entorno del servidor únicamente cuando la app ya envíe `appCheckToken`
 * de verdad.
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
    return true;
  } catch (e) {
    console.error('[APP-CHECK] Error inicializando Firebase:', e.message);
    return false;
  }
}

/**
 * Verifica un token de Firebase App Check enviado por la app móvil.
 * Retorna `true` si es válido, `false` en cualquier otro caso (token
 * ausente/expirado/inválido, o Firebase no configurado en este servidor).
 */
exports.verificarAppCheckToken = async (token) => {
  if (!token) return false;
  if (!initFirebase()) {
    console.warn('[APP-CHECK] Firebase no configurado — no se puede verificar el token');
    return false;
  }
  try {
    await admin.appCheck().verifyToken(token);
    return true;
  } catch (e) {
    console.error('[APP-CHECK] Token inválido:', e.message);
    return false;
  }
};

exports.appCheckConfigurado = () => process.env.APP_CHECK_ENFORCE === 'true' && initFirebase();
