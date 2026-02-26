const express  = require('express');
const router   = express.Router();
const webpush  = require('web-push');
const PushSub  = require('../models/PushSubscription');

// Configurar VAPID solo si las claves están disponibles
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.BREVO_USER || process.env.EMAIL_USER || 'cooalianzas@gmail.com'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn('[PUSH] VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY no configuradas — push desactivado');
}

// GET /api/push/vapid-public-key  → devuelve la clave pública al frontend
router.get('/vapid-public-key', (_req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
});

// POST /api/push/subscribe  → guarda la suscripción del dispositivo
router.post('/subscribe', async (req, res) => {
  try {
    const { subscription, usuario, dispositivo } = req.body;
    if (!subscription?.endpoint) return res.status(400).json({ mensaje: 'Suscripción inválida' });

    await PushSub.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        endpoint:    subscription.endpoint,
        keys:        subscription.keys,
        usuario:     usuario || '',
        dispositivo: dispositivo || 'web',
        activo:      true
      },
      { upsert: true, new: true }
    );
    console.log(`[PUSH] Suscripción registrada: ${subscription.endpoint.slice(-30)}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ mensaje: err.message });
  }
});

// DELETE /api/push/subscribe  → desactiva la suscripción
router.delete('/subscribe', async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) await PushSub.findOneAndUpdate({ endpoint }, { activo: false });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ mensaje: err.message });
  }
});

// GET /api/push/test  → envía notificación de prueba a todos los dispositivos
router.get('/test', async (req, res) => {
  try {
    const { enviarPushATodos } = require('../utils/pushService');
    const enviados = await enviarPushATodos({
      title: 'COO Alianzas — Prueba',
      body:  'Sistema de notificaciones funcionando correctamente.',
      icon:  '/favicon.png',
      data:  { url: '/' }
    });
    const subs = await PushSub.countDocuments({ activo: true });
    res.json({ ok: true, enviados, dispositivos: subs });
  } catch (err) {
    res.status(500).json({ mensaje: err.message });
  }
});

module.exports = router;
