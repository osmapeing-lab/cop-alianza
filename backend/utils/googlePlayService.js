/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - VERIFICACIÓN DE COMPRAS DE GOOGLE PLAY (planes de suscripción)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Requisitos para activar (Google Play Console + Google Cloud):
 *   1. Publicar la app en Play Console (al menos en prueba interna) y crear
 *      ahí las suscripciones: plan_granja_mensual, plan_alianza_mensual.
 *   2. Crear una cuenta de servicio en Google Cloud con acceso a la Android
 *      Publisher API, vincularla en Play Console (Configuración de la API).
 *   3. Copiar al .env del servidor:
 *        GOOGLE_PLAY_PACKAGE_NAME=com.example.coolianzas
 *        GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}  (JSON en una línea)
 * ═══════════════════════════════════════════════════════════════════════
 */

let androidpublisher = null;
let initialized = false;

function initGooglePlay() {
  if (initialized) return true;
  if (!process.env.GOOGLE_PLAY_PACKAGE_NAME || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return false;
  }
  try {
    const { google } = require('googleapis');
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/androidpublisher']
    });
    androidpublisher = google.androidpublisher({ version: 'v3', auth });
    initialized = true;
    return true;
  } catch (e) {
    console.error('[GOOGLE-PLAY] Error inicializando:', e.message);
    return false;
  }
}

exports.googlePlayConfigurado = () => initGooglePlay();

/**
 * Verifica una compra/suscripción de Google Play Billing contra la Android
 * Publisher API. Retorna `false` en cualquier caso de duda (sin
 * credenciales, token inválido, no pagada, error de red, etc.).
 */
exports.verificarCompra = async ({ productId, purchaseToken }) => {
  if (!productId || !purchaseToken) return false;
  if (!initGooglePlay()) return false;

  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME;
  try {
    const resp = await androidpublisher.purchases.subscriptions.get({
      packageName,
      subscriptionId: productId,
      token: purchaseToken
    });
    // paymentState: 1 = pago recibido, 2 = período de gracia.
    return resp.data.paymentState === 1 || resp.data.paymentState === 2;
  } catch (e) {
    console.error('[GOOGLE-PLAY] Error verificando compra:', e.message);
    return false;
  }
};
