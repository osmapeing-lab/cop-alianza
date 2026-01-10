const Session = require('../models/Session');

exports.registrarEntrada = async (usuario_id, usuario, ip) => {
  const session = new Session({ usuario_id, usuario, ip });
  await session.save();
  return session;
};

exports.registrarSalida = async (session_id) => {
  await Session.findByIdAndUpdate(session_id, { fecha_salida: Date.now() });
};

exports.getHistorial = async (req, res) => {
  try {
    const sessions = await Session.find().sort({ fecha_entrada: -1 }).limit(100);
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};