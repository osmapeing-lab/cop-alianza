const Alert = require('../models/Alert');
const axios = require('axios');

// CallMeBot WhatsApp - Configurar número y apikey
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || '573001234567';
const WHATSAPP_APIKEY = process.env.WHATSAPP_APIKEY || 'tu_apikey';

exports.enviarWhatsApp = async (mensaje) => {
  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(mensaje)}&apikey=${WHATSAPP_APIKEY}`;
    await axios.get(url);
    return true;
  } catch (error) {
    console.log('Error enviando WhatsApp:', error.message);
    return false;
  }
};

exports.crearAlerta = async (req, res) => {
  try {
    const { tipo, mensaje, enviar_whatsapp } = req.body;
    
    const alerta = new Alert({
      tipo,
      mensaje,
      enviado_whatsapp: false,
      enviado_email: false
    });
    
    if (enviar_whatsapp) {
      const enviado = await exports.enviarWhatsApp(`🚨 ALERTA COP ALIANZA\n${mensaje}`);
      alerta.enviado_whatsapp = enviado;
    }
    
    await alerta.save();
    res.status(201).json(alerta);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

exports.getAlertas = async (req, res) => {
  try {
    const alertas = await Alert.find().sort({ fecha: -1 }).limit(50);
    res.json(alertas);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};