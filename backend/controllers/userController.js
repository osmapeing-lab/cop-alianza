const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { registrarEntrada } = require('./sessionController');

exports.register = async (req, res) => {
  try {
    const { usuario, correo, password, rol, granja_id } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
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
    
    user.ultimo_acceso = Date.now();
    await user.save();
    
    const session = await registrarEntrada(user._id, user.usuario, req.ip);
    
    const token = jwt.sign({ id: user._id, rol: user.rol }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, usuario: user.usuario, rol: user.rol, session_id: session._id });
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
    await user.save();
    res.json(user);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ mensaje: 'Usuario eliminado' });
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};