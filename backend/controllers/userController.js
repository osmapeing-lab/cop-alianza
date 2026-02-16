/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - CONTROLADOR DE USUARIOS
 * ═══════════════════════════════════════════════════════════════════════
 */

const User = require('../models/User');
const Session = require('../models/Session');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');

// ═══════════════════════════════════════════════════════════════════════
// REGISTRAR NUEVO USUARIO
// ═══════════════════════════════════════════════════════════════════════
exports.register = async (req, res) => {
  try {
    const { usuario, correo, password, rol, granja_id } = req.body;
    
    // Verificar si ya existe
    const existe = await User.findOne({ $or: [{ usuario }, { correo }] });
    if (existe) {
      return res.status(400).json({ mensaje: 'Usuario o correo ya existe' });
    }
    
    // Hash de contraseña
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Crear usuario
    const user = new User({ 
      usuario, 
      correo, 
      password: hashedPassword, 
      rol, 
      granja_id 
    });
    await user.save();
    
    res.status(201).json({ 
      mensaje: 'Usuario creado exitosamente',
      usuario: {
        id: user._id,
        usuario: user.usuario,
        correo: user.correo,
        rol: user.rol
      }
    });
  } catch (error) {
    console.error('Error en register:', error);
    res.status(400).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// HELPER: Detectar dispositivo desde User-Agent
// ═══════════════════════════════════════════════════════════════════════
function detectarDispositivo(ua) {
  if (!ua) return 'Desconocido';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android.*Mobile/i.test(ua)) return 'Android (Móvil)';
  if (/Android/i.test(ua)) return 'Android (Tablet)';
  if (/Macintosh/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Linux/i.test(ua)) return 'Linux PC';
  return 'Navegador Web';
}

// ═══════════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════════
exports.login = async (req, res) => {
  try {
    const { usuario, password, forzar, captchaToken } = req.body;

    // Verificar reCAPTCHA
    if (process.env.RECAPTCHA_SECRET && !forzar) {
      if (!captchaToken) {
        return res.status(400).json({ mensaje: 'Completa el captcha' });
      }
      try {
        const captchaRes = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
          params: { secret: process.env.RECAPTCHA_SECRET, response: captchaToken }
        });
        if (!captchaRes.data.success) {
          return res.status(400).json({ mensaje: 'Captcha inválido, intenta de nuevo' });
        }
      } catch (err) {
        console.error('[CAPTCHA] Error verificando:', err.message);
      }
    }

    // Buscar usuario
    const user = await User.findOne({ usuario });

    if (!user) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    if (!user.activo) {
      return res.status(401).json({ mensaje: 'Usuario desactivado' });
    }

    // Verificar contraseña
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ mensaje: 'Contraseña incorrecta' });
    }

    // Verificar si hay sesión activa en otro dispositivo
    const sesionActiva = await Session.findOne({
      usuario_id: user._id,
      activa: true,
      fecha_salida: null
    }).sort({ fecha_entrada: -1 });

    if (sesionActiva && !forzar) {
      // Hay sesión activa y no se pidió forzar → informar al usuario
      return res.status(409).json({
        mensaje: 'Sesión activa en otro dispositivo',
        sesion_existente: {
          dispositivo: sesionActiva.dispositivo || 'Desconocido',
          ip: sesionActiva.ip,
          desde: sesionActiva.fecha_entrada
        }
      });
    }

    // Cerrar sesiones anteriores del usuario
    await Session.updateMany(
      { usuario_id: user._id, activa: true },
      { activa: false, fecha_salida: new Date() }
    );

    // Generar token JWT
    const token = jwt.sign(
      {
        id: user._id,
        rol: user.rol,
        usuario: user.usuario
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Detectar dispositivo actual
    const dispositivo = detectarDispositivo(req.headers['user-agent']);

    // Crear nueva sesión
    const session = new Session({
      usuario_id: user._id,
      usuario: user.usuario,
      ip: req.ip || req.connection.remoteAddress,
      dispositivo,
      token
    });
    await session.save();

    // Actualizar último acceso
    user.ultimo_acceso = Date.now();
    await user.save();

    res.json({
      token,
      usuario: {
        id: user._id,
        usuario: user.usuario,
        correo: user.correo,
        rol: user.rol,
        granja_id: user.granja_id
      },
      session_id: session._id,
      expira_en: session.expira_en
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// OBTENER USUARIO ACTUAL (ME)
// ═══════════════════════════════════════════════════════════════════════
exports.getMe = async (req, res) => {
  try {
    // req.user viene del middleware verificarToken
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('granja_id', 'nombre ubicacion');
    
    if (!user) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error en getMe:', error);
    res.status(500).json({ mensaje: 'Error del servidor' });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// OBTENER TODOS LOS USUARIOS
// ═══════════════════════════════════════════════════════════════════════
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .populate('granja_id', 'nombre ubicacion')
      .sort({ createdAt: -1 });
    
    res.json(users);
  } catch (error) {
    console.error('Error en getAllUsers:', error);
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ACTIVAR/DESACTIVAR USUARIO
// ═══════════════════════════════════════════════════════════════════════
exports.toggleUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    
    user.activo = !user.activo;
    
    // Si se desactiva, cerrar sus sesiones activas
    if (!user.activo) {
      await Session.updateMany(
        { usuario_id: user._id, activa: true },
        { activa: false, fecha_salida: new Date() }
      );
    }
    
    await user.save();
    
    res.json({
      mensaje: `Usuario ${user.activo ? 'activado' : 'desactivado'} exitosamente`,
      usuario: {
        id: user._id,
        usuario: user.usuario,
        activo: user.activo
      }
    });
  } catch (error) {
    console.error('Error en toggleUser:', error);
    res.status(400).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ELIMINAR USUARIO
// ═══════════════════════════════════════════════════════════════════════
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    
    // Eliminar todas las sesiones del usuario
    await Session.deleteMany({ usuario_id: req.params.id });
    
    // Eliminar usuario
    await User.findByIdAndDelete(req.params.id);
    
    res.json({ 
      mensaje: 'Usuario eliminado exitosamente',
      usuario: user.usuario
    });
  } catch (error) {
    console.error('Error en deleteUser:', error);
    res.status(400).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// CAMBIAR CONTRASEÑA
// ═══════════════════════════════════════════════════════════════════════
exports.cambiarPassword = async (req, res) => {
  try {
    const { password_actual, password_nuevo } = req.body;
    
    // Obtener usuario
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }
    
    // Verificar contraseña actual
    const valid = await bcrypt.compare(password_actual, user.password);
    if (!valid) {
      return res.status(401).json({ mensaje: 'Contraseña actual incorrecta' });
    }
    
    // Hash nueva contraseña
    const hashedPassword = await bcrypt.hash(password_nuevo, 12);
    
    // Actualizar
    user.password = hashedPassword;
    await user.save();
    
    // Cerrar todas las sesiones (forzar re-login)
    await Session.updateMany(
      { usuario_id: user._id, activa: true },
      { activa: false, fecha_salida: new Date() }
    );
    
    res.json({ mensaje: 'Contraseña cambiada exitosamente. Por favor inicia sesión nuevamente.' });
  } catch (error) {
    console.error('Error en cambiarPassword:', error);
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ACTUALIZAR PERFIL
// ═══════════════════════════════════════════════════════════════════════
exports.actualizarPerfil = async (req, res) => {
  try {
    const { usuario, correo } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

    if (usuario && usuario !== user.usuario) {
      const existe = await User.findOne({ usuario });
      if (existe) return res.status(400).json({ mensaje: 'Ese nombre de usuario ya existe' });
      user.usuario = usuario;
    }
    if (correo && correo !== user.correo) {
      const existe = await User.findOne({ correo });
      if (existe) return res.status(400).json({ mensaje: 'Ese correo ya está registrado' });
      user.correo = correo;
    }

    await user.save();
    res.json({ mensaje: 'Perfil actualizado', user: { _id: user._id, usuario: user.usuario, correo: user.correo, rol: user.rol } });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};