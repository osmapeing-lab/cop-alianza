const jwt = require('jsonwebtoken');
const Session = require('../models/Session');
const User = require('../models/User');
const Farm = require('../models/Farm');

const verificarToken = async (req, res, next) => {
  try {
    // 1️⃣ Obtener token del header Authorization
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : null;

    if (!token) {
      return res.status(401).json({ mensaje: 'Token no proporcionado' });
    }

    // 2️⃣ Verificar JWT
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET NO DEFINIDO EN ENTORNO');
      return res.status(500).json({ mensaje: 'Configuración de servidor inválida' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3️⃣ Verificar sesión activa en BD
    const session = await Session.findOne({ token, activa: true });

    if (!session) {
      return res.status(401).json({ mensaje: 'Sesión expirada o no válida' });
    }

    // 4️⃣ Verificar expiración por inactividad
    if (typeof session.verificarExpiracion === 'function' && session.verificarExpiracion()) {
      session.activa = false;
      await session.save();
      return res.status(401).json({ mensaje: 'Sesión expirada por inactividad' });
    }

    // 5️⃣ Actualizar actividad y extender sesión
    session.ultima_actividad = new Date();
    session.expira_en = new Date(Date.now() + 30 * 60 * 1000); // +30 min
    await session.save();

    // 6️⃣ Pasar datos al request
    // ✅ CAMBIO AQUÍ: req.usuario → req.user
    req.user = decoded;  // ← CAMBIAR ESTA LÍNEA
    req.session = session;

    // 7️⃣ Adjuntar la granja del usuario — el JWT no la trae (se generó
    // antes de que existiera aislamiento por granja), así que se busca
    // aquí una sola vez para que todos los controladores puedan filtrar
    // sus datos por `req.user.granja_id` sin repetir esta consulta.
    const usuarioDb = await User.findById(decoded.id).select('granja_id plan permisos');
    if (!usuarioDb) {
      return res.status(401).json({ mensaje: 'Usuario no encontrado' });
    }
    req.user.granja_id = usuarioDb.granja_id;
    req.user.plan = usuarioDb.plan;
    req.user.permisos = usuarioDb.permisos || [];

    // 8️⃣ Bloquear el acceso si un superadmin desactivó la granja desde el
    // panel de administración — sin esto, "desactivar granja" no tendría
    // ningún efecto real sobre las cuentas de esa granja.
    if (req.user.granja_id) {
      const granja = await Farm.findById(req.user.granja_id).select('activo');
      if (granja && !granja.activo) {
        return res.status(403).json({ mensaje: 'Tu granja fue desactivada. Contacta al administrador.' });
      }
    }

    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ mensaje: 'Token inválido' });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ mensaje: 'Token expirado' });
    }

    console.error('ERROR EN verificarToken:', error);

    return res.status(500).json({
      mensaje: 'Error interno de autenticación',
      error: error.message
    });
  }
};

// Middleware genérico de rol — uso: requireRole('superadmin'), o varios roles:
// requireRole('superadmin', 'jefa'). Debe ir siempre después de verificarToken.
const requireRole = (...roles) => (req, res, next) => {
  try {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({ mensaje: 'Acceso denegado' });
    }
    next();
  } catch (error) {
    console.error('ERROR EN requireRole:', error);
    return res.status(500).json({ mensaje: 'Error interno de autorización' });
  }
};

// Middleware de permisos para cuentas restringidas — uso:
// requirePermiso('bombas'), o varios: requirePermiso('bombas', 'alertas').
// Una cuenta SIN `permisos` seteado (acceso completo, ej. jefa/superadmin/
// cliente normal) siempre pasa; una cuenta CON `permisos` seteado solo pasa
// si incluye al menos uno de los permisos pedidos. Debe ir siempre después
// de verificarToken.
const requirePermiso = (...permisos) => (req, res, next) => {
  try {
    const permisosUsuario = req.user?.permisos;
    if (!permisosUsuario || permisosUsuario.length === 0) return next();
    const tieneAlguno = permisos.some(p => permisosUsuario.includes(p));
    if (!tieneAlguno) {
      return res.status(403).json({ mensaje: 'No tienes permiso para esta función' });
    }
    next();
  } catch (error) {
    console.error('ERROR EN requirePermiso:', error);
    return res.status(500).json({ mensaje: 'Error interno de autorización' });
  }
};

// Middleware para operaciones que NUNCA debe poder hacer una cuenta
// restringida (ej. gestionar el hardware de motobombas), sin importar su
// `rol` — la mayoría de las cuentas reales de dueños de granja tienen
// rol 'cliente' (el registro público siempre lo fuerza), así que filtrar
// por rol aquí dejaría afuera al dueño real. Se filtra por si la cuenta
// tiene `permisos` restringidos en vez de por `rol`.
const requireAccesoCompleto = (req, res, next) => {
  const permisosUsuario = req.user?.permisos;
  if (permisosUsuario && permisosUsuario.length > 0) {
    return res.status(403).json({ mensaje: 'Acceso denegado' });
  }
  next();
};

module.exports = { verificarToken, requireRole, requirePermiso, requireAccesoCompleto };