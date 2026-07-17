/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - MOTORBOMB CONTROLLER (CORREGIDO)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * CORRECCIONES en toggleMotorbomb:
 *
 * 1. BLOQUEO A 600L (Bomba 1 / MB001):
 *    Antes de encender, consulta WaterConsumption del día actual.
 *    Si ya se consumieron >= 600L (o el límite configurado), rechaza.
 *
 * 2. RESTRICCIÓN DE HORARIOS (Bomba 1 / MB001):
 *    Solo permite encender entre 6am-12pm y 12pm-3pm (hora Colombia).
 *    Fuera de ese rango devuelve error 400 con los horarios permitidos.
 *
 * 3. Códigos de error claros (LIMITE_AGUA, HORARIO_NO_PERMITIDO) para que
 *    el frontend pueda mostrar mensajes específicos.
 *
 * 4. El socket emite 'bomba_actualizada' con información completa.
 * ═══════════════════════════════════════════════════════════════════════
 */

const Motorbomb       = require('../models/Motorbomb');
const Alert           = require('../models/Alert');
const Config          = require('../models/Config');
const WaterConsumption = require('../models/WaterConsumption');
const { notificarBomba } = require('../utils/notificationManager');

async function motorbombDeLaGranja(id, granjaId) {
  const motorbomb = await Motorbomb.findById(id);
  if (!motorbomb || String(motorbomb.granja) !== String(granjaId)) {
    return null;
  }
  return motorbomb;
}

// ═══════════════════════════════════════════════════════════════════════
// OBTENER TODAS LAS MOTOBOMBAS
// GET /api/motorbombs
// ═══════════════════════════════════════════════════════════════════════
exports.getAllMotorbombs = async (req, res) => {
  try {
    const motorbombs = await Motorbomb.find({ granja: req.user.granja_id });
    res.json(motorbombs);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// TOGGLE MOTORBOMBA — CORREGIDO
// PUT /api/motorbombs/:id/toggle
// ═══════════════════════════════════════════════════════════════════════
exports.toggleMotorbomb = async (req, res) => {
  try {
    const { id } = req.params;
    const motorbomb = await motorbombDeLaGranja(id, req.user.granja_id);

    if (!motorbomb) {
      return res.status(404).json({ mensaje: 'Motorbomba no encontrada' });
    }

    const config = await Config.findOne({ granja_id: req.user.granja_id });

    // ──────────────────────────────────────────────────────────────────
    // VALIDACIONES SOLO PARA BOMBA 1 (MB001) AL ENCENDER
    // Condición de encendido: estado actual es TRUE (apagada en lógica
    // invertida del modelo) → el toggle la encendería (false = encendida)
    // ──────────────────────────────────────────────────────────────────
    const esBomba1 = motorbomb.codigo_bomba === 'MB001' ||
                     motorbomb.nombre?.toLowerCase().includes('bomba 1');

    const vaAEncender = motorbomb.estado === true; // true=apagada, false=encendida

    // Ingeniero/superadmin puede forzar el encendido enviando { forzar: true }
    const forzar = req.body.forzar === true;

    // ──────────────────────────────────────────────────────────────────
    // RESTRICCIÓN NOCTURNA (TODAS LAS BOMBAS)
    // Ninguna bomba puede encenderse entre 6:00pm y 6:00am (hora Colombia)
    // ──────────────────────────────────────────────────────────────────
    if (vaAEncender && !forzar) {
      const ahoraColombiaNoche = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' })
      );
      const horaActualNoche = ahoraColombiaNoche.getHours();
      const minActualNoche  = ahoraColombiaNoche.getMinutes();
      const esHorarioNocturno = horaActualNoche >= 18 || horaActualNoche < 6;

      if (esHorarioNocturno) {
        const horaStrNoche = `${String(horaActualNoche).padStart(2, '0')}:${String(minActualNoche).padStart(2, '0')}`;

        const alertaNoche = new Alert({
          tipo: 'alerta',
          mensaje: `🌙 Intento de encender "${motorbomb.nombre}" en horario nocturno no permitido (${horaStrNoche} hora Colombia)`
        });
        await alertaNoche.save();

        return res.status(400).json({
          mensaje: 'Horario no permitido. Las bombas no pueden encenderse entre las 6:00pm y las 6:00am.',
          hora_actual: horaStrNoche,
          codigo: 'HORARIO_NOCTURNO_NO_PERMITIDO'
        });
      }
    }

    if (esBomba1 && vaAEncender && !forzar) {

      // ── VALIDACIÓN 1: Horario permitido ─────────────────────────────
      const ahoraColombia = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' })
      );
      const horaActual = ahoraColombia.getHours();
      const minActual  = ahoraColombia.getMinutes();

      const horaInicio = config?.hora_inicio_bombas ?? 6;
      const horaFin    = config?.hora_fin_bombas    ?? 12;

      // Rango 1: horaInicio → horaFin (configurable, defecto 6-12)
      // Rango 2: 12pm → 15pm (fijo como segunda ventana)
      const enRango1 = horaActual >= horaInicio && horaActual < horaFin;
      const enRango2 = horaActual >= 12 && horaActual < 15;
      const horarioPermitido = enRango1 || enRango2;

      if (!horarioPermitido) {
        const horaStr = `${String(horaActual).padStart(2, '0')}:${String(minActual).padStart(2, '0')}`;

        const alerta = new Alert({
          tipo: 'alerta',
          mensaje: `⏰ Intento de encender "${motorbomb.nombre}" fuera de horario permitido (${horaStr} hora Colombia)`
        });
        await alerta.save();

        return res.status(400).json({
          mensaje: `Horario no permitido. La bomba solo puede encenderse entre ${horaInicio}:00-${horaFin}:00 y 12:00-15:00.`,
          hora_actual: horaStr,
          horarios_permitidos: [
            `${String(horaInicio).padStart(2, '0')}:00 - ${String(horaFin).padStart(2, '0')}:00`,
            '12:00 - 15:00'
          ],
          codigo: 'HORARIO_NO_PERMITIDO'
        });
      }

      // ── VALIDACIÓN 2: Límite de consumo de agua ─────────────────────
      const ahoraCol = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' })
      );
      const hoy = new Date(
        Date.UTC(ahoraCol.getFullYear(), ahoraCol.getMonth(), ahoraCol.getDate())
      );

      const consumoHoy = await WaterConsumption.findOne({
        fecha: { $gte: hoy },
        tipo: 'diario',
        granja_id: req.user.granja_id
      });

      const limite = config?.limite_consumo_bomba_1 ?? 600;
      const consumoActual = consumoHoy?.litros ?? 0;

      if (consumoActual >= limite) {
        const alerta = new Alert({
          tipo: 'alerta',
          mensaje: `🚫 Bomba 1 bloqueada: límite diario de ${limite}L alcanzado (${consumoActual.toFixed(1)}L consumidos)`
        });
        await alerta.save();

        return res.status(400).json({
          mensaje: `Límite de consumo diario alcanzado: ${consumoActual.toFixed(1)}L / ${limite}L`,
          consumo_actual: consumoActual,
          limite,
          codigo: 'LIMITE_AGUA'
        });
      }
    }

    // ── Ejecutar el toggle ───────────────────────────────────────────
    motorbomb.estado      = !motorbomb.estado;
    motorbomb.fecha_cambio = Date.now();
    await motorbomb.save();

    // Registrar alerta informativa
    const horaStr = new Date().toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
    const estadoTexto = !motorbomb.estado ? 'ENCENDIDA' : 'APAGADA'; // post-toggle

    const alerta = new Alert({
      tipo: 'info',
      mensaje: `Bomba "${motorbomb.nombre}" ${estadoTexto} manualmente a las ${horaStr}`
    });
    await alerta.save();

    // Emitir socket con información completa
    if (req.io) {
      req.io.emit('bomba_actualizada', {
        bomba_id:    motorbomb._id,
        codigo:      motorbomb.codigo_bomba,
        estado:      motorbomb.estado,
        nombre:      motorbomb.nombre,
        timestamp:   Date.now()
      });
    }

    // Notificación WhatsApp
    notificarBomba(motorbomb).catch(e =>
      console.error('[NOTIF] Error WhatsApp bomba:', e.message)
    );

    res.json({
      ok:           true,
      mensaje:      `Bomba "${motorbomb.nombre}" ${estadoTexto}`,
      estado:       motorbomb.estado,
      codigo_bomba: motorbomb.codigo_bomba,
      nombre:       motorbomb.nombre
    });

  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// CREAR MOTORBOMBA
// POST /api/motorbombs
// ═══════════════════════════════════════════════════════════════════════
exports.createMotorbomb = async (req, res) => {
  try {
    const motorbomb = new Motorbomb({ ...req.body, granja: req.user.granja_id });
    await motorbomb.save();
    res.status(201).json(motorbomb);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ACTUALIZAR MOTORBOMBA
// PUT /api/motorbombs/:id
// ═══════════════════════════════════════════════════════════════════════
exports.updateMotorbomb = async (req, res) => {
  try {
    const motorbomb = await motorbombDeLaGranja(req.params.id, req.user.granja_id);
    if (!motorbomb) return res.status(404).json({ mensaje: 'Motorbomba no encontrada' });

    delete req.body.granja;

    // Evitar que esta ruta genérica se use para saltarse la restricción
    // nocturna del /toggle: si el body intenta encender la bomba
    // (estado true→false) fuera de 6am-6pm, se rechaza igual.
    const vaAEncender = motorbomb.estado === true && req.body.estado === false;
    const forzar = req.body.forzar === true;

    if (vaAEncender && !forzar) {
      const ahoraColombia = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' })
      );
      const horaActual = ahoraColombia.getHours();
      const esHorarioNocturno = horaActual >= 18 || horaActual < 6;

      if (esHorarioNocturno) {
        return res.status(400).json({
          mensaje: 'Horario no permitido. Las bombas no pueden encenderse entre las 6:00pm y las 6:00am.',
          codigo: 'HORARIO_NOCTURNO_NO_PERMITIDO'
        });
      }
    }

    Object.assign(motorbomb, req.body);
    motorbomb.fecha_cambio = Date.now();
    await motorbomb.save();
    res.json(motorbomb);
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ELIMINAR MOTORBOMBA
// DELETE /api/motorbombs/:id
// ═══════════════════════════════════════════════════════════════════════
exports.deleteMotorbomb = async (req, res) => {
  try {
    const motorbomb = await motorbombDeLaGranja(req.params.id, req.user.granja_id);
    if (!motorbomb) return res.status(404).json({ mensaje: 'Motorbomba no encontrada' });
    await Motorbomb.findByIdAndDelete(req.params.id);
    res.json({ mensaje: 'Motorbomba eliminada' });
  } catch (error) {
    res.status(400).json({ mensaje: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════
// ESTADO DE TODAS LAS BOMBAS
// GET /api/motorbombs/status
// ═══════════════════════════════════════════════════════════════════════
exports.getMotorbombStatus = async (req, res) => {
  try {
    const motorbombs = await Motorbomb.find({ granja: req.user.granja_id });
    const status = {};
    motorbombs.forEach(b => { status[b.codigo_bomba] = b.estado; });
    res.json(status);
  } catch (error) {
    res.status(500).json({ mensaje: error.message });
  }
};