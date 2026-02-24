/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - RUTAS FCM (Firebase Cloud Messaging)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * POST /api/fcm/token          → La app Android registra su device token
 * DELETE /api/fcm/token        → La app elimina su token al cerrar sesión
 * GET  /api/fcm/test           → Enviar notificación de prueba
 * GET  /api/fcm/estado         → Ver si Firebase está configurado
 * ═══════════════════════════════════════════════════════════════════════
 */

const express   = require('express');
const router    = express.Router();
const FCMToken  = require('../models/FCMToken');
const { enviarNotificacion, verificarConfiguracion } = require('../utils/fcmService');

// Registrar token del dispositivo Android
// La app Android llama esto al iniciar sesión o al iniciar la app
router.post('/token', async (req, res) => {
  try {
    const { token, dispositivo, usuario } = req.body;
    if (!token) return res.status(400).json({ mensaje: 'Token FCM requerido' });

    await FCMToken.findOneAndUpdate(
      { token },
      { token, dispositivo: dispositivo || 'android', usuario: usuario || '', activo: true },
      { upsert: true, new: true }
    );
    console.log(`[FCM] Token registrado: ${token.slice(-12)} (${dispositivo || 'android'})`);
    res.json({ ok: true, mensaje: 'Token FCM registrado exitosamente' });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
});

// Eliminar token (al cerrar sesión en la app Android)
router.delete('/token', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ mensaje: 'Token requerido' });
    await FCMToken.findOneAndUpdate({ token }, { activo: false });
    res.json({ ok: true, mensaje: 'Token desregistrado' });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
});

// Enviar notificación de prueba
router.get('/test', async (req, res) => {
  try {
    const result = await enviarNotificacion({
      titulo: 'COO Alianzas — Prueba',
      cuerpo:  'Sistema de notificaciones push funcionando correctamente.',
      tipo:    'info',
      datos:   { pantalla: 'dashboard' }
    });
    const tokens = await FCMToken.countDocuments({ activo: true });
    res.json({
      ok:      result,
      tokens_registrados: tokens,
      mensaje: result
        ? `Notificación enviada a ${tokens} dispositivo(s)`
        : tokens === 0
          ? 'Sin dispositivos registrados. La app Android debe llamar POST /api/fcm/token primero.'
          : 'Error enviando. Verifica FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY.'
    });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
});

// Estado de configuración FCM
router.get('/estado', (req, res) => {
  const estado = verificarConfiguracion();
  res.json({
    ...estado,
    instrucciones: !estado.configurado ? [
      '1. Crea un proyecto en console.firebase.google.com',
      '2. Ve a Project Settings → Service Accounts → Generate new private key',
      '3. Agrega al .env del servidor:',
      '   FIREBASE_PROJECT_ID=tu-proyecto',
      '   FIREBASE_CLIENT_EMAIL=xxx@xxx.iam.gserviceaccount.com',
      '   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"',
      '4. En la app Android: llama POST /api/fcm/token con el FCM registration token'
    ] : []
  });
});

module.exports = router;
