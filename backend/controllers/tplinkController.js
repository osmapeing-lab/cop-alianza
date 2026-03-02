/*
 * TP-LINK VIGI — Controller
 * API base: use1-vms-api.tplinkcloud.com  (distinto del portal web use1-vms.tplinkcloud.com)
 */

const axios  = require('axios');
const crypto = require('crypto');

const VMS_PORTAL = 'https://use1-vms.tplinkcloud.com';
const API_BASE   = 'https://use1-vms-api.tplinkcloud.com';
const EMAIL      = process.env.TPLINK_EMAIL    || '';
const PASSWORD   = process.env.TPLINK_PASSWORD || '';

let _cache = { token: null, expiry: 0, deviceId: null };

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

// Prueba múltiples combinaciones de endpoint + hash hasta que una funcione
async function login() {
  const intentos = [
    { url: `${API_BASE}/vms/user/login`,    body: { email: EMAIL, password: sha256(PASSWORD), timeZone: 'America/Bogota' } },
    { url: `${API_BASE}/api/v1/user/login`, body: { email: EMAIL, password: sha256(PASSWORD) } },
    { url: `${API_BASE}/vms/user/login`,    body: { email: EMAIL, password: PASSWORD } },
    { url: `${API_BASE}/api/v2/user/login`, body: { email: EMAIL, password: sha256(PASSWORD) } },
  ];

  let lastErr = null;
  for (const { url, body } of intentos) {
    try {
      const res  = await axios.post(url, body, { headers: { 'Content-Type': 'application/json' }, timeout: 8000 });
      const data = res.data;
      const token = data?.result?.token || data?.token || data?.data?.token || data?.accessToken;
      if (token) {
        _cache.token  = token;
        _cache.expiry = Date.now() + 50 * 60 * 1000;
        console.log('[TPLINK] ✓ Login OK con:', url);
        return token;
      }
      console.log('[TPLINK] Login sin token en:', url, JSON.stringify(data).slice(0, 200));
    } catch (e) {
      lastErr = e;
      console.log('[TPLINK] Login falló en:', url, e.response?.status, e.message);
    }
  }
  throw lastErr || new Error('Todos los intentos de login fallaron');
}

async function getToken() {
  if (_cache.token && Date.now() < _cache.expiry) return _cache.token;
  return login();
}

async function getDeviceId(token) {
  if (_cache.deviceId) return _cache.deviceId;

  const endpoints = [
    `${API_BASE}/vms/device/list`,
    `${API_BASE}/api/v1/device/list`,
    `${API_BASE}/vms/devices`,
  ];

  for (const url of endpoints) {
    try {
      const res     = await axios.get(url, { headers: { Authorization: `Bearer ${token}` }, timeout: 8000 });
      const devices = res.data?.result?.devices || res.data?.devices || res.data?.data || [];
      if (devices.length) {
        const cam = devices.find(d =>
          d.deviceType?.toLowerCase().includes('cam') ||
          d.type?.toLowerCase().includes('cam')
        ) || devices[0];
        _cache.deviceId = cam.deviceId || cam.id || cam.uuid;
        console.log('[TPLINK] ✓ Cámara:', cam.deviceName || cam.name || _cache.deviceId);
        return _cache.deviceId;
      }
    } catch (e) {
      console.log('[TPLINK] device/list falló en:', url, e.response?.status);
    }
  }
  throw new Error('No se encontraron cámaras en la cuenta TP-Link');
}

// ─────────────────────────────────────────────────────────────────
// GET /api/camaras/tplink/snapshot
// ─────────────────────────────────────────────────────────────────
exports.getSnapshot = async (_req, res) => {
  if (!EMAIL || !PASSWORD) {
    return res.status(503).json({ ok: false, mensaje: 'Faltan TPLINK_EMAIL / TPLINK_PASSWORD en .env' });
  }

  try {
    const token    = await getToken();
    const deviceId = await getDeviceId(token);

    const snapEndpoints = [
      `${API_BASE}/vms/device/${deviceId}/snapshot`,
      `${API_BASE}/vms/device/${deviceId}/capture`,
      `${API_BASE}/vms/stream/${deviceId}/snapshot`,
      `${API_BASE}/api/v1/device/${deviceId}/snapshot`,
    ];

    for (const url of snapEndpoints) {
      try {
        const snap = await axios.get(url, {
          headers:      { Authorization: `Bearer ${token}` },
          responseType: 'arraybuffer',
          timeout:      6000
        });
        if (snap.status === 200 && snap.data?.byteLength > 500) {
          res.set('Content-Type', 'image/jpeg');
          res.set('Cache-Control', 'no-cache, no-store');
          return res.send(snap.data);
        }
      } catch (_) {}
    }

    return res.status(502).json({
      ok: false,
      mensaje: 'La API de TP-Link VIGI no expone snapshots REST. Usa la vista integrada (iframe) o abre el portal.',
      portal: `${VMS_PORTAL}/#/vms/video`
    });

  } catch (err) {
    if (err.response?.status === 401 || err.response?.status === 403) {
      _cache.token = null; _cache.expiry = 0;
    }
    console.error('[TPLINK] snapshot error:', err.message);
    res.status(502).json({ ok: false, mensaje: err.message, portal: `${VMS_PORTAL}/#/vms/video` });
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/camaras/tplink/status  — diagnóstico completo
// ─────────────────────────────────────────────────────────────────
exports.getStatus = async (_req, res) => {
  const resultado = { email: EMAIL ? EMAIL.replace(/(.{2}).*(@.*)/, '$1***$2') : 'no configurado', pasos: [] };

  if (!EMAIL || !PASSWORD) {
    resultado.ok = false;
    resultado.pasos.push('❌ Faltan TPLINK_EMAIL o TPLINK_PASSWORD en .env');
    return res.json(resultado);
  }

  try {
    resultado.pasos.push('🔄 Intentando login...');
    const token = await getToken();
    resultado.pasos.push('✅ Login exitoso');
    resultado.token_preview = token.slice(0, 12) + '...';

    try {
      const deviceId = await getDeviceId(token);
      resultado.pasos.push(`✅ Cámara encontrada: ${deviceId}`);
      resultado.deviceId = deviceId;
      resultado.ok = true;
    } catch (e) {
      resultado.pasos.push(`⚠️ Login OK pero no se encontraron cámaras: ${e.message}`);
      resultado.ok = false;
    }
  } catch (err) {
    _cache.token = null; _cache.expiry = 0;
    resultado.pasos.push(`❌ Login falló: ${err.message}`);
    resultado.ok = false;
    if (err.response) {
      resultado.http_status   = err.response.status;
      resultado.http_response = JSON.stringify(err.response.data).slice(0, 400);
    }
  }

  resultado.portal = `${VMS_PORTAL}/#/vms/video`;
  res.json(resultado);
};
