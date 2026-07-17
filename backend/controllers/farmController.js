/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - CONTROLADOR DE ADMINISTRACIÓN DE GRANJAS
 * Solo accesible por rol 'superadmin' (ver routes/farms.js) — administra
 * TODAS las granjas de la plataforma, a diferencia del resto de
 * controladores que siempre filtran por la granja del usuario logueado.
 * ═══════════════════════════════════════════════════════════════════════
 */

const bcrypt = require('bcryptjs');
const Farm = require('../models/Farm');
const User = require('../models/User');
const Lote = require('../models/lote');
const Costo = require('../models/Costo');
const Venta = require('../models/Venta');
const InventarioAlimento = require('../models/InventarioAlimento');
const Inventario = require('../models/Inventario');
const Alert = require('../models/Alert');
const Camara = require('../models/Camara');
const Pesaje = require('../models/pesaje');
const Motorbomb = require('../models/Motorbomb');
const AlimentacionLote = require('../models/AlimentacionLote');
const Config = require('../models/Config');
const WaterConsumption = require('../models/WaterConsumption');
const Session = require('../models/Session');

const PERMISOS_VALIDOS = ['bombas', 'alertas', 'pesajes'];

// Modelos que aíslan sus datos con el campo `granja`
const MODELOS_POR_GRANJA = [Lote, Costo, Venta, InventarioAlimento, Inventario, Alert, Camara, Pesaje, Motorbomb];
// Modelos que usan `granja_id` en vez de `granja` (naming heredado)
const MODELOS_POR_GRANJA_ID = [Config, WaterConsumption];

exports.getAllFarms = async (req, res) => {
  try {
    const farms = await Farm.find().sort({ createdAt: -1 }).lean();

    const conDatos = await Promise.all(farms.map(async (farm) => {
      const [owner, lotes, ventas] = await Promise.all([
        User.findOne({ granja_id: farm._id }).select('usuario correo plan ultimo_acceso activo'),
        Lote.countDocuments({ granja: farm._id }),
        Venta.countDocuments({ granja: farm._id })
      ]);
      return { ...farm, owner, lotes, ventas };
    }));

    res.json(conDatos);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

exports.getFarmDetail = async (req, res) => {
  try {
    const farm = await Farm.findById(req.params.id).lean();
    if (!farm) return res.status(404).json({ mensaje: 'Granja no encontrada' });

    const [usuarios, lotes, pesajes, costos, ventas, alertas, inventario] = await Promise.all([
      User.find({ granja_id: farm._id }).select('usuario correo rol plan ultimo_acceso activo'),
      Lote.countDocuments({ granja: farm._id }),
      Pesaje.countDocuments({ granja: farm._id }),
      Costo.countDocuments({ granja: farm._id }),
      Venta.countDocuments({ granja: farm._id }),
      Alert.countDocuments({ granja: farm._id }),
      InventarioAlimento.countDocuments({ granja: farm._id })
    ]);

    res.json({ farm, usuarios, conteos: { lotes, pesajes, costos, ventas, alertas, inventario } });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

exports.createFarm = async (req, res) => {
  try {
    const farm = new Farm(req.body);
    await farm.save();
    res.status(201).json(farm);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

exports.updateFarm = async (req, res) => {
  try {
    const farm = await Farm.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!farm) return res.status(404).json({ mensaje: 'Granja no encontrada' });
    res.json(farm);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

exports.updateFarmPlan = async (req, res) => {
  try {
    const { plan } = req.body;
    const planesValidos = ['corral', 'granja', 'alianza', 'empresas', 'corporativo'];
    if (!planesValidos.includes(plan)) {
      return res.status(400).json({ mensaje: 'Plan inválido' });
    }

    const farm = await Farm.findById(req.params.id);
    if (!farm) return res.status(404).json({ mensaje: 'Granja no encontrada' });

    await User.updateMany({ granja_id: farm._id }, { plan });

    res.json({ mensaje: 'Plan actualizado', plan });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// CREAR SUB-USUARIO RESTRINGIDO DENTRO DE UNA GRANJA EXISTENTE
// POST /api/admin/farms/:id/usuarios
// Cuenta "extensión" de la granja (ej. un empleado que solo debe operar
// bombas o registrar pesajes) — siempre rol 'cliente', la restricción real
// vive en `permisos` (ver middleware/auth.js requirePermiso).
// ═══════════════════════════════════════════════════════════════════════
exports.crearUsuarioGranja = async (req, res) => {
  try {
    const farm = await Farm.findById(req.params.id);
    if (!farm) return res.status(404).json({ mensaje: 'Granja no encontrada' });

    const { usuario, correo, password, permisos = [] } = req.body;
    if (!usuario || !correo || !password) {
      return res.status(400).json({ mensaje: 'usuario, correo y password son requeridos' });
    }
    if (!Array.isArray(permisos) || permisos.some(p => !PERMISOS_VALIDOS.includes(p))) {
      return res.status(400).json({ mensaje: `Permisos inválidos. Válidos: ${PERMISOS_VALIDOS.join(', ')}` });
    }

    const existe = await User.findOne({ $or: [{ usuario }, { correo }] });
    if (existe) {
      return res.status(400).json({ mensaje: 'Usuario o correo ya existe' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const nuevoUsuario = new User({
      usuario,
      correo,
      password: hashedPassword,
      rol: 'cliente',
      granja_id: farm._id,
      permisos: permisos.length > 0 ? permisos : undefined
    });
    await nuevoUsuario.save();

    res.status(201).json({
      mensaje: 'Miembro restringido creado exitosamente',
      usuario: {
        id: nuevoUsuario._id,
        usuario: nuevoUsuario.usuario,
        correo: nuevoUsuario.correo,
        permisos: nuevoUsuario.permisos || []
      }
    });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

exports.toggleFarm = async (req, res) => {
  try {
    const farm = await Farm.findById(req.params.id);
    if (!farm) return res.status(404).json({ mensaje: 'Granja no encontrada' });
    farm.activo = !farm.activo;
    await farm.save();
    res.json(farm);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

exports.deleteFarm = async (req, res) => {
  try {
    const farm = await Farm.findById(req.params.id);
    if (!farm) return res.status(404).json({ mensaje: 'Granja no encontrada' });

    // Confirmación server-side: el nombre exacto de la granja debe venir en
    // el body, para evitar un borrado accidental por un click de más.
    const { confirmarNombre } = req.body;
    if (confirmarNombre !== farm.nombre) {
      return res.status(400).json({ mensaje: 'El nombre de confirmación no coincide con el de la granja' });
    }

    const farmId = farm._id;

    // Se excluyen cuentas 'superadmin' del borrado — el dueño de la
    // plataforma administra todas las granjas y no debe desaparecer si su
    // usuario quedó asociado a esta granja por datos heredados.
    const usuarios = await User.find({ granja_id: farmId, rol: { $ne: 'superadmin' } }).select('_id');
    const usuarioIds = usuarios.map(u => u._id);

    const lotes = await Lote.find({ granja: farmId }).select('_id');
    const loteIds = lotes.map(l => l._id);

    const resumen = {};

    for (const Modelo of MODELOS_POR_GRANJA) {
      const r = await Modelo.deleteMany({ granja: farmId });
      resumen[Modelo.modelName] = r.deletedCount;
    }
    for (const Modelo of MODELOS_POR_GRANJA_ID) {
      const r = await Modelo.deleteMany({ granja_id: farmId });
      resumen[Modelo.modelName] = r.deletedCount;
    }

    if (loteIds.length) {
      const rAlim = await AlimentacionLote.deleteMany({ lote: { $in: loteIds } });
      resumen.AlimentacionLote = rAlim.deletedCount;
    }
    if (usuarioIds.length) {
      const rSesiones = await Session.deleteMany({ usuario_id: { $in: usuarioIds } });
      resumen.Session = rSesiones.deletedCount;
    }

    const rUsuarios = await User.deleteMany({ _id: { $in: usuarioIds } });
    resumen.User = rUsuarios.deletedCount;

    await Farm.findByIdAndDelete(farmId);

    console.log(`[ADMIN] Granja "${farm.nombre}" (${farmId}) eliminada por ${req.user.usuario}. Resumen:`, resumen);

    res.json({ mensaje: 'Granja eliminada', resumen });
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};
