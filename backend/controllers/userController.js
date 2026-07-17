/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - CONTROLADOR DE USUARIOS
 * ═══════════════════════════════════════════════════════════════════════
 */

const crypto = require('crypto');
const User = require('../models/User');
const Session = require('../models/Session');
const Farm = require('../models/Farm');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { verificarAppCheckToken, appCheckConfigurado } = require('../utils/appCheckService');
const { enviarEmail } = require('../utils/emailService');
const { verificarCompra, googlePlayConfigurado } = require('../utils/googlePlayService');

const PLANES_VALIDOS = ['corral', 'granja', 'alianza', 'empresas', 'corporativo'];

// ═══════════════════════════════════════════════════════════════════════
// REGISTRAR NUEVO USUARIO
// ═══════════════════════════════════════════════════════════════════════
exports.register = async (req, res) => {
  try {
    const { usuario, correo, password } = req.body;

    // Verificar si ya existe
    const existe = await User.findOne({ $or: [{ usuario }, { correo }] });
    if (existe) {
      return res.status(400).json({ mensaje: 'Usuario o correo ya existe' });
    }

    // Hash de contraseña
    const hashedPassword = await bcrypt.hash(password, 12);

    // Cada registro público crea su propia granja nueva y vacía — nunca se
    // toma un `granja_id` del cuerpo de la petición (eso permitiría que
    // cualquiera se uniera a los datos de otra granja con solo mandar su
    // id). Unirse a una granja existente (varios usuarios de un mismo
    // cliente) queda para una fase posterior con código de invitación.
    const farm = await Farm.create({ nombre: `Granja de ${usuario}` });

    // Crear usuario — esta ruta es pública, así que el rol nunca se toma
    // del body: siempre se crea como 'cliente'. Roles superiores solo se
    // asignan desde el panel de administración autenticado. `plan` también
    // se fuerza a 'corral' (el más básico) — subir de plan se hace vía
    // POST /api/users/me/plan (compra en la app) o manualmente por un
    // admin, nunca a elección del propio registro público.
    const user = new User({
      usuario,
      correo,
      password: hashedPassword,
      rol: 'cliente',
      granja_id: farm._id,
      plan: 'corral'
    });
    await user.save();

    res.status(201).json({
      mensaje: 'Usuario creado exitosamente',
      usuario: {
        id: user._id,
        usuario: user.usuario,
        correo: user.correo,
        rol: user.rol,
        plan: user.plan
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
// LÍMITE DE DISPOSITIVOS SIMULTÁNEOS POR PLAN (planes de suscripción)
// ═══════════════════════════════════════════════════════════════════════
// Un superadmin puede fijar un límite personalizado por cuenta —
// `limite_dispositivos_custom` — sin importar el plan (ver
// `actualizarLimiteDispositivos`); si no lo configura, se usa el valor fijo
// del plan (20 por defecto para 'corporativo', que se vende por contrato y
// no tiene un número fijo propio).
const LIMITE_DISPOSITIVOS_POR_PLAN = { corral: 1, granja: 3, alianza: 5, empresas: 10 };
const DEFAULT_LIMITE_CORPORATIVO = 20;

function limiteDispositivos(user) {
  if (user.limite_dispositivos_custom) return user.limite_dispositivos_custom;
  if (user.plan === 'corporativo') return DEFAULT_LIMITE_CORPORATIVO;
  return LIMITE_DISPOSITIVOS_POR_PLAN[user.plan] || 1;
}

// ═══════════════════════════════════════════════════════════════════════
// LOGIN
// ═══════════════════════════════════════════════════════════════════════
exports.login = async (req, res) => {
  try {
    const { password, forzar, captchaToken, recordar, appCheckToken } = req.body;
    const usuario = (req.body.usuario || '').trim();
    // 'mobile' solo si lo envía explícitamente la app Flutter; cualquier otro
    // valor (o ausencia del campo) preserva el comportamiento actual de la web.
    const plataforma = req.body.plataforma === 'mobile' ? 'mobile' : 'web';

    if (plataforma === 'mobile' && appCheckConfigurado() && !forzar) {
      // Firebase App Check real (ver utils/appCheckService.js) — solo se
      // exige cuando el servidor lo activa explícitamente con
      // APP_CHECK_ENFORCE=true, una vez la app ya sepa generar el token.
      const valido = await verificarAppCheckToken(appCheckToken);
      if (!valido) {
        return res.status(400).json({
          mensaje: 'No se pudo verificar la app. Actualiza a la última versión e intenta de nuevo.'
        });
      }
    } else if (process.env.RECAPTCHA_SECRET && !forzar) {
      // reCAPTCHA v2 — mismo checkbox que la web, embebido en un WebView
      // dentro de la app para el login móvil (ver LoginScreen/RecaptchaScreen
      // en Flutter). Se usa aquí también mientras App Check no esté activo.
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

    // Verificar límite de dispositivos simultáneos según el plan del usuario
    // (Corral: 1, Granja: 3, Alianza: 5 — ver planes de suscripción). Se
    // cuentan TODAS las sesiones activas del usuario sin importar la
    // plataforma (web+móvil comparten el mismo cupo).
    const limite = limiteDispositivos(user);
    const sesionesActivas = await Session.find({
      usuario_id: user._id,
      activa: true,
      fecha_salida: null
    }).sort({ fecha_entrada: 1 }); // más antigua primero

    const alcanzoLimite = sesionesActivas.length >= limite;

    if (alcanzoLimite && !forzar) {
      // En el límite y no se pidió forzar → informar cuál sesión (la más
      // antigua) se cerraría si el usuario decide continuar.
      const masAntigua = sesionesActivas[0];
      return res.status(409).json({
        mensaje: `Alcanzaste el límite de ${limite} dispositivo(s) simultáneo(s) de tu plan.`,
        codigo: 'LIMITE_DISPOSITIVOS',
        limite_dispositivos: limite,
        sesion_existente: {
          dispositivo: masAntigua.dispositivo || 'Desconocido',
          ip: masAntigua.ip,
          desde: masAntigua.fecha_entrada
        }
      });
    }

    if (alcanzoLimite && forzar) {
      // Cerrar SOLO la sesión más antigua para liberar un cupo — las demás
      // sesiones activas del usuario (otros dispositivos) no se tocan.
      await Session.updateOne(
        { _id: sesionesActivas[0]._id },
        { activa: false, fecha_salida: new Date() }
      );
    }

    // Generar token JWT (30 días si "recordar sesión", 7d normal)
    const token = jwt.sign(
      {
        id: user._id,
        rol: user.rol,
        usuario: user.usuario
      },
      process.env.JWT_SECRET,
      { expiresIn: recordar ? '30d' : '7d' }
    );

    // Detectar dispositivo actual
    const dispositivo = detectarDispositivo(req.headers['user-agent']);

    // Crear nueva sesión
    const session = new Session({
      usuario_id: user._id,
      usuario: user.usuario,
      ip: req.ip || req.connection.remoteAddress,
      dispositivo,
      plataforma,
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
        plan: user.plan,
        limite_dispositivos_custom: user.limite_dispositivos_custom,
        granja_id: user.granja_id,
        permisos: user.permisos || []
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

// ═══════════════════════════════════════════════════════════════════════
// RECUPERAR CONTRASEÑA — PASO 1: SOLICITAR CÓDIGO
// POST /api/users/forgot-password
// ═══════════════════════════════════════════════════════════════════════
exports.forgotPassword = async (req, res) => {
  try {
    const correo = (req.body.correo || '').trim();
    if (!correo) {
      return res.status(400).json({ mensaje: 'El correo es requerido' });
    }

    const user = await User.findOne({ correo });

    // Respuesta genérica exista o no el usuario, para no filtrar qué
    // correos están registrados en el sistema.
    const respuestaGenerica = {
      mensaje: 'Si el correo está registrado, recibirás un código de recuperación en unos minutos.'
    };

    if (!user || !user.activo) {
      return res.json(respuestaGenerica);
    }

    // Código de 6 dígitos, fácil de escribir a mano en la app móvil.
    // Se guarda solo el hash (igual que la contraseña) — el código en claro
    // solo viaja por correo.
    const codigo = String(crypto.randomInt(100000, 1000000));
    user.reset_token_hash = crypto.createHash('sha256').update(codigo).digest('hex');
    user.reset_token_expira = new Date(Date.now() + 15 * 60 * 1000); // 15 min
    await user.save();

    try {
      await enviarEmail({
        to: correo,
        subject: 'COO Alianzas — Código para restablecer tu contraseña',
        html: `
          <p>Hola ${user.usuario},</p>
          <p>Tu código para restablecer la contraseña es:</p>
          <h2 style="letter-spacing:4px">${codigo}</h2>
          <p>Vence en 15 minutos. Si no solicitaste esto, ignora este correo.</p>
        `
      });
    } catch (emailError) {
      console.error('[FORGOT-PASSWORD] Error enviando correo:', emailError.message);
      // No revelamos el fallo de envío al cliente (mismo motivo que la
      // respuesta genérica arriba); queda registrado en logs del servidor.
    }

    res.json(respuestaGenerica);
  } catch (error) {
    console.error('Error en forgotPassword:', error);
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// RECUPERAR CONTRASEÑA — PASO 2: CONFIRMAR CÓDIGO Y CAMBIAR
// POST /api/users/reset-password
// ═══════════════════════════════════════════════════════════════════════
exports.resetPassword = async (req, res) => {
  try {
    const { token, password_nuevo } = req.body;
    if (!token || !password_nuevo) {
      return res.status(400).json({ mensaje: 'Token y nueva contraseña son requeridos' });
    }
    if (password_nuevo.length < 6) {
      return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const tokenHash = crypto.createHash('sha256').update(String(token).trim()).digest('hex');
    const user = await User.findOne({ reset_token_hash: tokenHash }).select('+reset_token_hash +reset_token_expira');

    if (!user || !user.reset_token_expira || user.reset_token_expira < new Date()) {
      return res.status(400).json({ mensaje: 'Código inválido o vencido. Solicita uno nuevo.' });
    }

    user.password = await bcrypt.hash(password_nuevo, 12);
    user.reset_token_hash = undefined;
    user.reset_token_expira = undefined;
    await user.save();

    // Igual que cambiarPassword: invalidar sesiones activas y forzar re-login.
    await Session.updateMany(
      { usuario_id: user._id, activa: true },
      { activa: false, fecha_salida: new Date() }
    );

    res.json({ mensaje: 'Contraseña restablecida exitosamente. Ya puedes iniciar sesión.' });
  } catch (error) {
    console.error('Error en resetPassword:', error);
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ACTUALIZAR PLAN (tras una compra de Google Play Billing)
// PUT /api/users/me/plan
// ═══════════════════════════════════════════════════════════════════════
//
// ⚠️  IMPORTANTE: si la verificación de Google Play NO está configurada
// (faltan GOOGLE_PLAY_PACKAGE_NAME / GOOGLE_SERVICE_ACCOUNT_JSON en el
// .env — ver utils/googlePlayService.js), este endpoint:
//   - En PRODUCCIÓN: rechaza la solicitud (no se puede confiar en el
//     cliente para otorgar un plan pago sin verificar el pago real).
//   - Fuera de producción: confía en el cliente para poder probar el
//     flujo de compra de punta a punta sin credenciales de Play Console.
// Antes de cobrar de verdad, hay que completar la configuración de Google
// Play (ver utils/googlePlayService.js) para que la verificación real se
// active también en producción.
exports.actualizarPlan = async (req, res) => {
  try {
    const { plan, productId, purchaseToken } = req.body;

    if (!PLANES_VALIDOS.includes(plan)) {
      return res.status(400).json({ mensaje: `Plan inválido. Debe ser: ${PLANES_VALIDOS.join(', ')}` });
    }

    if (googlePlayConfigurado()) {
      const valido = await verificarCompra({ productId, purchaseToken });
      if (!valido) {
        return res.status(400).json({ mensaje: 'No se pudo verificar la compra en Google Play.' });
      }
    } else if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({
        mensaje: 'La verificación de compras de Google Play aún no está configurada en el servidor.',
        codigo: 'GOOGLE_PLAY_NO_CONFIGURADO'
      });
    }

    const user = await User.findByIdAndUpdate(req.user.id, { plan }, { new: true });
    if (!user) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

    res.json({ mensaje: `Plan actualizado a ${plan}`, plan: user.plan });
  } catch (error) {
    console.error('Error en actualizarPlan:', error);
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURAR LÍMITE DE DISPOSITIVOS DE UNA CUENTA (solo superadmin)
// PUT /api/users/:id/limite-dispositivos
// ═══════════════════════════════════════════════════════════════════════
//
// Un superadmin puede fijar un límite de dispositivos simultáneos a
// cualquier cuenta, sin importar su plan — pensado sobre todo para
// 'corporativo' (que se vende por contrato y no tiene un número fijo
// propio), pero no restringido a ese plan.
exports.actualizarLimiteDispositivos = async (req, res) => {
  try {
    if (req.user.rol !== 'superadmin') {
      return res.status(403).json({ mensaje: 'No tienes permiso para configurar esto.' });
    }

    const limite = Number(req.body.limite);
    if (!Number.isInteger(limite) || limite < 1) {
      return res.status(400).json({ mensaje: 'El límite debe ser un número entero mayor a 0.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

    user.limite_dispositivos_custom = limite;
    await user.save();

    res.json({
      mensaje: `Límite de dispositivos actualizado a ${limite}`,
      limite_dispositivos_custom: user.limite_dispositivos_custom
    });
  } catch (error) {
    console.error('Error en actualizarLimiteDispositivos:', error);
    res.status(500).json({ mensaje: error.message });
  }
};