/*
 * ═══════════════════════════════════════════════════════════════════════
 * TP-LINK VIGI — Controller
 * ═══════════════════════════════════════════════════════════════════════
 * Estrategia:
 *  1. Autenticar con VIGI VMS cloud (use1-vms.tplinkcloud.com)
 *  2. Obtener snapshot de la cámara y servirlo como imagen
 *  3. El frontend hace polling cada 3s para simular video en tiempo real
 * ═══════════════════════════════════════════════════════════════════════
 */

const axios = require('axios');
const crypto = require('crypto');

const VMS_BASE  = (process.env.TPLINK_VMS_URL || 'https://use1-vms.tplinkcloud.com').replace(/\/$/, '');
const EMAIL     = process.env.TPLINK_EMAIL    || '';
const PASSWORD  = process.env.TPLINK_PASSWORD || '';

// Cache del token (se renueva al expirar)
let _cache = { token: null, expiry: 0, deviceId: null };

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

async function login() {
  const body = {
    email:    EMAIL,
    password: sha256(PASSWORD),
    timeZone: 'America/Bogota'
  };

  const res = await axios.post(`${VMS_BASE}/vms/user/login`, body, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 8000
  });

  const data = res.data;
  // El token puede venir en distintas rutas según versión del API
  const token = data?.result?.token
    || data?.token
    || data?.data?.token
    || data?.accessToken;

  if (!token) {
    console.error('[TPLINK] Login response sin token:', JSON.stringify(data).slice(0, 300));
    throw new Error('No se obtuvo token de autenticación de TP-Link');
  }

  // Guardar en cache 50 minutos (tokens suelen durar 1h)
  _cache.token  = token;
  _cache.expiry = Date.now() + 50 * 60 * 1000;
  console.log('[TPLINK] ✓ Autenticado con VIGI VMS');
  return token;
}

async function getToken() {
  if (_cache.token && Date.now() < _cache.expiry) return _cache.token;
  return login();
}

async function getDeviceId(token) {
  if (_cache.deviceId) return _cache.deviceId;

  const res = await axios.get(`${VMS_BASE}/vms/device/list`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 8000
  });

  const devices = res.data?.result?.devices
    || res.data?.devices
    || res.data?.data
    || [];

  if (!devices.length) throw new Error('No se encontraron cámaras en la cuenta');

  // Tomar el primer dispositivo (o el que tenga tipo cámara)
  const cam = devices.find(d =>
    d.deviceType?.toLowerCase().includes('cam') ||
    d.type?.toLowerCase().includes('cam')
  ) || devices[0];

  _cache.deviceId = cam.deviceId || cam.id || cam.uuid;
  console.log('[TPLINK] ✓ Cámara encontrada:', cam.deviceName || cam.name || _cache.deviceId);
  return _cache.deviceId;
}

// ─────────────────────────────────────────────────────────────────
// GET /api/tplink/snapshot
// Devuelve la imagen actual de la cámara (JPEG)
// ─────────────────────────────────────────────────────────────────

exports.getSnapshot = async (req, res) => {
  if (!EMAIL || !PASSWORD) {
    return res.status(503).json({ ok: false, mensaje: 'Variables TPLINK_EMAIL / TPLINK_PASSWORD no configuradas en .env' });
  }

  try {
    const token    = await getToken();
    const deviceId = await getDeviceId(token);

    // Intentar endpoint de snapshot (distintos formatos según versión API)
    let imgBuffer = null;
    const endpoints = [
      `${VMS_BASE}/vms/device/${deviceId}/snapshot`,
      `${VMS_BASE}/vms/device/${deviceId}/capture`,
      `${VMS_BASE}/vms/stream/${deviceId}/snapshot`
    ];

    for (const url of endpoints) {
      try {
        const snap = await axios.get(url, {
          headers:      { Authorization: `Bearer ${token}` },
          responseType: 'arraybuffer',
          timeout:      6000
        });
        if (snap.status === 200 && snap.data?.byteLength > 1000) {
          imgBuffer = snap.data;
          break;
        }
      } catch (_) { /* probar siguiente */ }
    }

    if (!imgBuffer) {
      return res.status(502).json({
        ok: false,
        mensaje: 'No se pudo obtener snapshot de la cámara. La API de TP-Link puede requerir acceso local.',
        vms_url: `${VMS_BASE}/#/vms/video`
      });
    }

    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'no-cache, no-store');
    res.send(imgBuffer);

  } catch (err) {
    console.error('[TPLINK] Error snapshot:', err.message);
    // Invalidar cache si hay error de auth
    if (err.response?.status === 401 || err.response?.status === 403) {
      _cache.token  = null;
      _cache.expiry = 0;
    }
    res.status(502).json({
      ok:      false,
      mensaje: err.message,
      vms_url: `${VMS_BASE}/#/vms/video`
    });
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/tplink/status
// Verifica si la autenticación con TP-Link funciona
// ─────────────────────────────────────────────────────────────────

exports.getStatus = async (req, res) => {
  if (!EMAIL || !PASSWORD) {
    return res.json({ ok: false, motivo: 'env_missing', vms_url: `${VMS_BASE}/#/vms/video` });
  }

  try {
    const token    = await getToken();
    const deviceId = await getDeviceId(token);
    res.json({ ok: true, deviceId, vms_url: `${VMS_BASE}/#/vms/video` });
  } catch (err) {
    _cache.token  = null;
    _cache.expiry = 0;
    res.json({ ok: false, motivo: err.message, vms_url: `${VMS_BASE}/#/vms/video` });
  }
};
