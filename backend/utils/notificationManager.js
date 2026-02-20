/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - GESTOR DE NOTIFICACIONES INTELIGENTE
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Controla cuándo y qué notificaciones enviar para evitar spam/costos.
 * - Cooldowns por tipo de alerta
 * - Mensajes contextuales por horario (bombas)
 * - Umbral dinámico de temperatura según etapa del lote
 * - Monitoreo de bomba olvidada
 * - Resumen diario de agua
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

const { enviarWhatsApp } = require('./whatsappService');
const Lote = require('../models/lote');
const WaterConsumption = require('../models/WaterConsumption');
const Motorbomb = require('../models/Motorbomb');

// ═══════════════════════════════════════════════════════════════════════
// ESTADO EN MEMORIA (cooldowns y tracking)
// ═══════════════════════════════════════════════════════════════════════

let ultimaAlertaCalor = null;
let ultimaAlertaNivel = {};        // { '20': timestamp, '10': timestamp, '100': timestamp }
let bombaEncendidaDesde = {};      // { 'MB001': timestamp, 'MB002': timestamp }
let bombaOlvidadaTimers = {};      // { 'MB001': setTimeout_id }
let ultimaEtapaNotificada = null;  // última etapa notificada del lote

const COOLDOWN_CALOR_MS = 60 * 60 * 1000;     // 60 min entre alertas de calor
const BOMBA_OLVIDADA_MS = 45 * 60 * 1000;     // 45 min para alerta "bomba olvidada"

// ═══════════════════════════════════════════════════════════════════════
// HORA COLOMBIA
// ═══════════════════════════════════════════════════════════════════════

function getHoraColombia() {
  const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  return ahora.getHours();
}

function getHoraFormateada() {
  return new Date().toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

// ═══════════════════════════════════════════════════════════════════════
// TEMPERATURA DEL CHIQUERO
// ═══════════════════════════════════════════════════════════════════════

/**
 * Obtiene el umbral de temperatura según la etapa del lote.
 * Cerdos en engorde (>120 días) son más sensibles al calor.
 */
async function getUmbralTemperatura() {
  try {
    const lote = await Lote.findOne({ activo: true }).sort({ createdAt: -1 });
    if (lote) {
      const edad = lote.edad_dias;
      // Engorde: umbral más bajo porque sufren más el calor
      if (edad > 120) return { umbral: 30, etapa: 'engorde' };
      if (edad > 42) return { umbral: 32, etapa: 'levante' };
      return { umbral: 32, etapa: 'destete' };
    }
  } catch (e) { /* fallback */ }
  return { umbral: 32, etapa: 'desconocida' };
}

/**
 * Evalúa si debe enviar alerta de calor en el chiquero.
 * Solo envía si supera el umbral Y han pasado >60 min desde la última.
 */
async function evaluarTemperatura(temperatura, humedad) {
  const { umbral, etapa } = await getUmbralTemperatura();

  if (temperatura <= umbral) return;

  // Cooldown: no repetir en menos de 60 min
  if (ultimaAlertaCalor && (Date.now() - ultimaAlertaCalor) < COOLDOWN_CALOR_MS) return;

  ultimaAlertaCalor = Date.now();

  const hora = getHoraFormateada();
  let msg = `🌡️ *ALERTA CALOR EN CHIQUERO*\n`;
  msg += `Temperatura: ${temperatura}°C (umbral: ${umbral}°C)\n`;
  msg += `Humedad: ${humedad}%\n`;
  msg += `Hora: ${hora}\n`;

  if (etapa === 'engorde') {
    msg += `⚠️ Lote en ENGORDE - Mayor riesgo de estrés térmico`;
  }

  await enviarWhatsApp(msg);
}

// ═══════════════════════════════════════════════════════════════════════
// BOMBAS (Lógica inversa: estado false = ON, true = OFF)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Genera mensaje contextual según la hora del día.
 */
function getMensajeBombaEncendida(nombreBomba) {
  const h = getHoraColombia();
  const hora = getHoraFormateada();

  if (h >= 6 && h < 9) return `🚿 *Iniciando Lavado de Chiqueros*\n${nombreBomba} encendida a las ${hora}`;
  if (h >= 16 && h < 18) return `🌱 *Iniciando Riego de Pastos*\n${nombreBomba} encendida a las ${hora}`;
  return `🔌 *Bomba Activada*\n${nombreBomba} encendida a las ${hora}`;
}

/**
 * Notifica encendido/apagado de bomba por WhatsApp.
 * Inicia timer de "bomba olvidada" al encender.
 */
async function notificarBomba(bomba) {
  const codigo = bomba.codigo_bomba;
  const nombre = bomba.nombre;
  // Recordar: estado false = encendida (relé invertido)
  const encendida = !bomba.estado;

  if (encendida) {
    // ── ENCENDIDA ──
    bombaEncendidaDesde[codigo] = Date.now();

    const msg = getMensajeBombaEncendida(nombre);
    await enviarWhatsApp(msg);

    // Iniciar timer de "bomba olvidada"
    if (bombaOlvidadaTimers[codigo]) clearTimeout(bombaOlvidadaTimers[codigo]);
    bombaOlvidadaTimers[codigo] = setTimeout(async () => {
      // Verificar si sigue encendida
      try {
        const bombaActual = await Motorbomb.findOne({ codigo_bomba: codigo });
        if (bombaActual && !bombaActual.estado) { // sigue ON
          const minutos = Math.round((Date.now() - bombaEncendidaDesde[codigo]) / 60000);
          await enviarWhatsApp(
            `⚠️ *AVISO: ${nombre} lleva ${minutos} min encendida*\n` +
            `¿Sigue el lavado/riego en proceso?\n` +
            `Apágala si ya terminó para evitar desperdicio de agua.`
          );
        }
      } catch (e) { console.error('[NOTIF] Error bomba olvidada:', e.message); }
    }, BOMBA_OLVIDADA_MS);
  } else {
    // ── APAGADA ──
    // Cancelar timer de "bomba olvidada"
    if (bombaOlvidadaTimers[codigo]) {
      clearTimeout(bombaOlvidadaTimers[codigo]);
      delete bombaOlvidadaTimers[codigo];
    }

    let duracion = '';
    if (bombaEncendidaDesde[codigo]) {
      const min = Math.round((Date.now() - bombaEncendidaDesde[codigo]) / 60000);
      duracion = ` (estuvo ${min} min encendida)`;
      delete bombaEncendidaDesde[codigo];
    }

    const hora = getHoraFormateada();
    await enviarWhatsApp(`✅ *Tarea finalizada*\n${nombre} apagada a las ${hora}${duracion}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// NIVEL DE AGUA (Solo notifica en 100%, 20%, 10%)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Evalúa si debe notificar cambio de nivel de agua.
 * Solo envía en umbrales críticos: tanque lleno (100%), bajo (20%), crítico (10%).
 */
async function evaluarNivelAgua(porcentaje) {
  let umbral = null;
  let mensaje = '';

  if (porcentaje >= 100 && !ultimaAlertaNivel['100']) {
    umbral = '100';
    mensaje = `💧 *Tanque de agua LLENO* (${porcentaje}%)\nEl tanque se ha llenado completamente.`;
    // Al llenarse, resetear alertas de bajo nivel
    delete ultimaAlertaNivel['20'];
    delete ultimaAlertaNivel['10'];
  } else if (porcentaje <= 10 && !ultimaAlertaNivel['10']) {
    umbral = '10';
    mensaje = `🚨 *NIVEL CRÍTICO DE AGUA* (${porcentaje}%)\n¡El tanque está casi vacío! Verificar suministro.`;
  } else if (porcentaje <= 20 && !ultimaAlertaNivel['20']) {
    umbral = '20';
    mensaje = `⚠️ *Nivel de agua BAJO* (${porcentaje}%)\nConsiderar rellenar el tanque pronto.`;
  }

  if (umbral) {
    ultimaAlertaNivel[umbral] = Date.now();
    await enviarWhatsApp(mensaje);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// TAREAS DIARIAS DE SALUD Y ETAPAS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Calendario de salud porcina (día de edad → tarea).
 */
const CALENDARIO_SALUD = [
  { dia: 3, tarea: '💉 Aplicar hierro inyectable a lechones' },
  { dia: 7, tarea: '✂️ Castración de lechones machos' },
  { dia: 10, tarea: '💉 Primera desparasitación' },
  { dia: 21, tarea: '💉 Vacuna contra Mycoplasma' },
  { dia: 42, tarea: '🍼➡️🌾 *CAMBIO DE ETAPA: DESTETE → LEVANTE*\nCambiar plan de alimentación a Fase Inicio' },
  { dia: 49, tarea: '💉 Refuerzo de vacuna + segunda desparasitación' },
  { dia: 70, tarea: '💉 Vacuna contra Peste Porcina Clásica' },
  { dia: 90, tarea: '⚖️ *PESAJE DE CONTROL*\nVerificar que el peso esté según la tabla de producción' },
  { dia: 120, tarea: '🌾➡️🥩 *CAMBIO DE ETAPA: LEVANTE → ENGORDE*\nCambiar plan de alimentación a Fase Engorde.\n⚠️ A partir de ahora el umbral de calor baja a 30°C' },
  { dia: 150, tarea: '⚖️ *PESAJE PRE-VENTA*\nEvaluar peso y planificar fecha de venta' },
  { dia: 180, tarea: '🏁 *LOTE LISTO PARA VENTA*\nLos cerdos deberían estar en peso de mercado (~100-110 kg)' }
];

/**
 * Revisa el lote activo y envía notificaciones de salud/etapa si corresponde.
 * Se ejecuta una vez al día.
 */
async function revisarTareasDiarias() {
  try {
    const lote = await Lote.findOne({ activo: true }).sort({ createdAt: -1 });
    if (!lote) return;

    const edadDias = lote.edad_dias;
    console.log(`[TAREAS] Revisando lote "${lote.nombre}" - Edad: ${edadDias} días`);

    // Buscar tareas que coincidan con la edad actual (±1 día de tolerancia)
    for (const item of CALENDARIO_SALUD) {
      if (edadDias >= item.dia && edadDias <= item.dia + 1) {
        const msg = `📋 *TAREA DEL DÍA - ${lote.nombre}*\n` +
          `Edad del lote: ${edadDias} días\n\n` +
          item.tarea;
        await enviarWhatsApp(msg);
        break; // Solo una tarea por día
      }
    }
  } catch (error) {
    console.error('[TAREAS] Error revisando tareas diarias:', error.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// RESUMEN DIARIO DE AGUA (se envía a las 7PM Colombia)
// ═══════════════════════════════════════════════════════════════════════

async function enviarResumenDiarioAgua() {
  try {
    const ahoraColombia = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    const hoy = new Date(Date.UTC(ahoraColombia.getFullYear(), ahoraColombia.getMonth(), ahoraColombia.getDate()));

    const consumoHoy = await WaterConsumption.findOne({
      fecha: { $gte: hoy },
      tipo: 'diario'
    });

    const litros = consumoHoy ? consumoHoy.litros : 0;

    // Obtener consumo de ayer para comparar
    const ayer = new Date(hoy.getTime() - 24 * 60 * 60 * 1000);
    const consumoAyer = await WaterConsumption.findOne({
      fecha: { $gte: ayer, $lt: hoy },
      tipo: 'diario'
    });

    const litrosAyer = consumoAyer ? consumoAyer.litros : 0;
    const diferencia = litrosAyer > 0 ? Math.round(((litros - litrosAyer) / litrosAyer) * 100) : 0;
    const tendencia = diferencia > 0 ? `📈 +${diferencia}%` : diferencia < 0 ? `📉 ${diferencia}%` : '➡️ igual';

    const msg = `📊 *RESUMEN DIARIO DE AGUA*\n` +
      `Consumo hoy: ${litros.toFixed(1)} litros\n` +
      `Consumo ayer: ${litrosAyer.toFixed(1)} litros\n` +
      `Tendencia: ${tendencia} vs ayer`;

    await enviarWhatsApp(msg);
  } catch (error) {
    console.error('[RESUMEN] Error enviando resumen agua:', error.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// RESET DIARIO (limpiar cooldowns a medianoche)
// ═══════════════════════════════════════════════════════════════════════

function resetearNotificacionesDiarias() {
  ultimaAlertaCalor = null;
  ultimaAlertaNivel = {};
  console.log('[NOTIF] Cooldowns reseteados para nuevo día');
}

// ═══════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════

module.exports = {
  evaluarTemperatura,
  notificarBomba,
  evaluarNivelAgua,
  revisarTareasDiarias,
  enviarResumenDiarioAgua,
  resetearNotificacionesDiarias,
  getUmbralTemperatura
};
