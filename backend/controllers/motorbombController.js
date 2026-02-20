const Motorbomb = require('../models/Motorbomb');
const Alert = require('../models/Alert');
const { notificarBomba } = require('../utils/notificationManager');

exports.getAllMotorbombs = async (req, res) => {
  try {
    const motorbombs = await Motorbomb.find();
    res.json(motorbombs);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

exports.toggleMotorbomb = async (req, res) => {
  try {
    const { id } = req.params;
    const motorbomb = await Motorbomb.findById(id);
    motorbomb.estado = !motorbomb.estado;
    motorbomb.fecha_cambio = Date.now();
    await motorbomb.save();

    // Registrar alerta de cambio de estado
    const hora = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: true });
    const alerta = new Alert({
      tipo: 'info',
      mensaje: `Bomba "${motorbomb.nombre}" ${!motorbomb.estado ? 'ENCENDIDA' : 'APAGADA'} manualmente a las ${hora}`
    });
    await alerta.save();

    // WhatsApp: mensaje contextual por horario + timer bomba olvidada
    notificarBomba(motorbomb).catch(e =>
      console.error('[NOTIF] Error WhatsApp bomba:', e.message)
    );

    res.json(motorbomb);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

exports.createMotorbomb = async (req, res) => {
  try {
    const motorbomb = new Motorbomb(req.body);
    await motorbomb.save();
    res.status(201).json(motorbomb);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};
exports.updateMotorbomb = async (req, res) => {
  try {
    const motorbomb = await Motorbomb.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!motorbomb) return res.status(404).json({ mensaje: 'Motorbomba no encontrada' });
    res.json(motorbomb);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

exports.deleteMotorbomb = async (req, res) => {
  try {
    const motorbomb = await Motorbomb.findByIdAndDelete(req.params.id);
    if (!motorbomb) return res.status(404).json({ mensaje: 'Motorbomba no encontrada' });
    res.json({ mensaje: 'Motorbomba eliminada' });
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

exports.getMotorbombStatus = async (req, res) => {
  try {
    const motorbombs = await Motorbomb.find();

    const status = {};

    motorbombs.forEach(bomba => {
      status[bomba.codigo_bomba] = bomba.estado;
    });

    res.json(status);

  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};
