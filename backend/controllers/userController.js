const User = require('../models/User');
const Session = require('../models/Session');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
  try {
    const { usuario, correo, password, rol, granja_id } = req.body;
    const existe = await User.findOne({ $or: [{ usuario }, { correo }] });
    if (existe) return res.status(400).json({ mensaje: 'Usuario o correo ya existe' });
    
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = new User({ usuario, correo, password: hashedPassword, rol, granja_id });
    await user.save();
    res.status(201).json({ mensaje: 'Usuario creado' });
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { usuario, password } = req.body;
    const user = await User.findOne({ usuario });
    
    if (!user) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    if (!user.activo) return res.status(401).json({ mensaje: 'Usuario desactivado' });
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ mensaje: 'Contraseña incorrecta' });
    
    // Cerrar sesiones anteriores del usuario
    await Session.updateMany(
      { usuario_id: user._id, activa: true },
      { activa: false, fecha_salida: new Date() }
    );
    
    const token = jwt.sign(
      { id: user._id, rol: user.rol, usuario: user.usuario },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    
    // Crear nueva sesión
    const session = new Session({
      usuario_id: user._id,
      usuario: user.usuario,
      ip: req.ip || req.connection.remoteAddress,
      token
    });
    await session.save();
    
    user.ultimo_acceso = Date.now();
    await user.save();
    
    res.json({
      token,
      usuario: user.usuario,
      rol: user.rol,
      session_id: session._id,
      expira_en: session.expira_en
    });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').populate('granja_id');
    res.json(users);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

exports.toggleUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    user.activo = !user.activo;
    
    // Si se desactiva, cerrar sus sesiones
    if (!user.activo) {
      await Session.updateMany(
        { usuario_id: user._id, activa: true },
        { activa: false, fecha_salida: new Date() }
      );
    }
    
    await user.save();
    res.json(user);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    await Session.deleteMany({ usuario_id: req.params.id });
    await User.findByIdAndDelete(req.params.id);
    res.json({ mensaje: 'Usuario eliminado' });
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};