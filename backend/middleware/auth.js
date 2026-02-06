const jwt = require('jsonwebtoken');
const Session = require('../models/Session');

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
    req.usuario = decoded;
    req.session = session;

    next();

  } catch (error) {
    // 🔥 LOG REAL PARA RENDER
    console.error('ERROR EN verificarToken:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ mensaje: 'Token inválido' });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ mensaje: 'Token expirado' });
    }

    return res.status(500).json({
      mensaje: 'Error interno de autenticación',
      error: error.message
    });
  }
};

const verificarAdmin = (req, res, next) => {
  try {
    if (!req.usuario || req.usuario.rol !== 'superadmin') {
      return res.status(403).json({ mensaje: 'Acceso denegado' });
    }
    next();
  } catch (error) {
    console.error('ERROR EN verificarAdmin:', error);
    return res.status(500).json({ mensaje: 'Error interno de autorización' });
  }
};

module.exports = { verificarToken, verificarAdmin };
