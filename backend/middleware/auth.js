const jwt = require('jsonwebtoken');
const Session = require('../models/Session');

const verificarToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ mensaje: 'Token no proporcionado' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verificar sesión activa
    const session = await Session.findOne({ token, activa: true });
    if (!session) {
      return res.status(401).json({ mensaje: 'Sesión expirada' });
    }

    // Verificar expiración
    if (session.verificarExpiracion()) {
      await session.save();
      return res.status(401).json({ mensaje: 'Sesión expirada por inactividad' });
    }

    // Actualizar última actividad (extender sesión)
    session.ultima_actividad = new Date();
    session.expira_en = new Date(Date.now() + 30*60*1000); // +30 min
    await session.save();

    req.usuario = decoded;
    req.session = session;
    next();
  } catch (error) {
    return res.status(401).json({ mensaje: 'Token inválido' });
  }
};

const verificarAdmin = (req, res, next) => {
  if (req.usuario.rol !== 'superadmin') {
    return res.status(403).json({ mensaje: 'Acceso denegado' });
  }
  next();
};

module.exports = { verificarToken, verificarAdmin };