/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - GESTOR DE NOTIFICACIONES INTELIGENTE
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Controla cuándo y qué notificaciones enviar para evitar spam/costos.
 * - Cooldowns persistidos en BD (sobrevive reinicios de Render)
 * - Mensajes contextuales por horario (bombas ON y OFF)
 * - Umbrales de temperatura leídos desde Config
 * - Monitoreo de bomba olvidada
 * - Resumen diario de agua
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

const { enviarWhatsApp } = require('./whatsappService');
const { enviarNotificacion: enviarFCM } = require('./fcmService');
const { enviarPushATodos } = require('./pushService');
const Lote = require('../models/lote');
const WaterConsumption = require('../models/WaterConsumption');
const Motorbomb = require('../models/Motorbomb');
const Config = require('../models/Config');
const NotificationState = require('../models/NotificationState');
const Pesaje = require('../models/pesaje');

// ═══════════════════════════════════════════════════════════════════════
// SOLO EN MEMORIA: timers de setTimeout (no se pueden persistir)
// ═══════════════════════════════════════════════════════════════════════

let bombaOlvidadaTimers = {};  // { 'MB001': setTimeout_id }

const COOLDOWN_CALOR_MS = 60 * 60 * 1000;     // 60 min entre alertas de calor
const BOMBA_OLVIDADA_MS = 45 * 60 * 1000;     // 45 min para alerta "bomba olvidada"

// ═══════════════════════════════════════════════════════════════════════
// HELPERS: BD persistente para cooldowns
// ═══════════════════════════════════════════════════════════════════════

async function getEstado(clave) {
  try {
    const doc = await NotificationState.findOne({ clave });
    return doc ? doc.valor : null;
  } catch (e) {
    console.error('[NOTIF] Error leyendo estado:', clave, e.message);
    return null;
  }
}

async function setEstado(clave, valor) {
  try {
    await NotificationState.findOneAndUpdate(
      { clave },
      { valor, actualizado: new Date() },
      { upsert: true }
    );
  } catch (e) {
    console.error('[NOTIF] Error guardando estado:', clave, e.message);
  }
}

async function eliminarEstado(clave) {
  try {
    await NotificationState.deleteOne({ clave });
  } catch (e) {
    console.error('[NOTIF] Error eliminando estado:', clave, e.message);
  }
}

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
// TEMPERATURA DEL CHIQUERO (umbrales desde Config)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Obtiene el umbral de temperatura desde Config + ajuste por etapa del lote.
 * Si Config tiene umbral_temp_max, lo usa como base.
 * Cerdos en engorde (>120 días) reducen el umbral en 2°C.
 */
async function getUmbralTemperatura() {
  try {
    // Leer umbral desde Config
    const config = await Config.findOne().sort({ createdAt: -1 });
    let umbralBase = config?.umbral_temp_max || 32;

    const lote = await Lote.findOne({ activo: true }).sort({ createdAt: -1 });
    if (lote) {
      const edad = lote.edad_dias;
      if (edad > 120) return { umbral: Math.min(umbralBase, 30), etapa: 'engorde' };
      if (edad > 42) return { umbral: umbralBase, etapa: 'levante' };
      return { umbral: umbralBase, etapa: 'destete' };
    }
    return { umbral: umbralBase, etapa: 'desconocida' };
  } catch (e) {
    return { umbral: 32, etapa: 'desconocida' };
  }
}

/**
 * Evalúa si debe enviar alerta de calor en el chiquero.
 * Cooldown de 60 min persistido en BD.
 */
async function evaluarTemperatura(temperatura, humedad) {
  const { umbral, etapa } = await getUmbralTemperatura();

  if (temperatura <= umbral) return;

  // Cooldown desde BD
  const ultimaAlerta = await getEstado('ultima_alerta_calor');
  if (ultimaAlerta && (Date.now() - new Date(ultimaAlerta).getTime()) < COOLDOWN_CALOR_MS) return;

  // Guardar cooldown en BD
  await setEstado('ultima_alerta_calor', new Date().toISOString());

  const hora = getHoraFormateada();
  let msg = `🌡️ *ALERTA CALOR EN CHIQUERO*\n`;
  msg += `Temperatura: ${temperatura}°C (umbral: ${umbral}°C)\n`;
  msg += `Humedad: ${humedad}%\n`;
  msg += `Hora: ${hora}\n`;

  if (etapa === 'engorde') {
    msg += `⚠️ Lote en ENGORDE - Mayor riesgo de estrés térmico`;
  }

  await Promise.all([
    enviarWhatsApp(msg),
    enviarFCM({
      titulo: `🌡️ Alerta Calor — ${temperatura}°C`,
      cuerpo: `Temperatura sobre umbral (${umbral}°C). Humedad: ${humedad}%. ${etapa !== 'desconocida' ? `Etapa: ${etapa}` : ''}`.trim(),
      tipo: 'alerta',
      datos: { pantalla: 'dashboard', temperatura: String(temperatura), umbral: String(umbral) }
    }).catch(e => console.error('[FCM] Error temperatura:', e.message)),
    enviarPushATodos({
      title: `🌡️ Alerta Calor — ${temperatura}°C`,
      body: `Temperatura sobre umbral (${umbral}°C). Humedad: ${humedad}%.`,
      data: { url: '/' }
    }).catch(e => console.error('[PUSH] Error temperatura:', e.message))
  ]);
}

// ═══════════════════════════════════════════════════════════════════════
// BOMBAS (Lógica inversa: estado false = ON, true = OFF)
// Mensajes contextuales al encender Y al apagar
// ═══════════════════════════════════════════════════════════════════════

/**
 * Genera mensaje contextual de ENCENDIDO según la hora del día.
 */
function getMensajeBombaEncendida(nombreBomba) {
  const h = getHoraColombia();
  const hora = getHoraFormateada();

  if (h >= 6 && h < 9) return `🚿 *Iniciando Lavado de Chiqueros*\n${nombreBomba} encendida a las ${hora}`;
  if (h >= 16 && h < 18) return `🌱 *Iniciando Riego de Pastos*\n${nombreBomba} encendida a las ${hora}`;
  return `🔌 *Bomba Activada*\n${nombreBomba} encendida a las ${hora}`;
}

/**
 * Genera mensaje contextual de APAGADO según la hora del día.
 */
function getMensajeBombaApagada(nombreBomba, duracion) {
  const h = getHoraColombia();
  const hora = getHoraFormateada();

  if (h >= 6 && h < 9) {
    return `✅ *Lavado de Chiqueros Completado*\n${nombreBomba} apagada a las ${hora}${duracion}`;
  }
  if (h >= 16 && h < 18) {
    return `✅ *Riego de Pastos Completado*\n${nombreBomba} apagada a las ${hora}${duracion}`;
  }
  return `✅ *Tarea Finalizada*\n${nombreBomba} apagada a las ${hora}${duracion}`;
}

/**
 * Notifica encendido/apagado de bomba por WhatsApp.
 * Timestamp de encendido persistido en BD.
 */
async function notificarBomba(bomba) {
  const codigo = bomba.codigo_bomba;
  const nombre = bomba.nombre;
  // Recordar: estado false = encendida (relé invertido)
  const encendida = !bomba.estado;

  if (encendida) {
    // ── ENCENDIDA ──
    await setEstado(`bomba_encendida_${codigo}`, new Date().toISOString());

    const msg = getMensajeBombaEncendida(nombre);
    await Promise.all([
      enviarWhatsApp(msg),
      enviarFCM({
        titulo: `Bomba Encendida`,
        cuerpo: `${nombre} ha sido encendida`,
        tipo: 'info',
        datos: { pantalla: 'bombas', codigo }
      }).catch(e => console.error('[FCM] Error bomba encendida:', e.message)),
      enviarPushATodos({
        title: `Bomba Encendida`,
        body: `${nombre} ha sido encendida`,
        data: { url: '/' }
      }).catch(e => console.error('[PUSH] Error bomba encendida:', e.message))
    ]);

    // Iniciar timer de "bomba olvidada"
    if (bombaOlvidadaTimers[codigo]) clearTimeout(bombaOlvidadaTimers[codigo]);
    bombaOlvidadaTimers[codigo] = setTimeout(async () => {
      try {
        const bombaActual = await Motorbomb.findOne({ codigo_bomba: codigo });
        if (bombaActual && !bombaActual.estado) { // sigue ON
          const tsEncendido = await getEstado(`bomba_encendida_${codigo}`);
          const desde = tsEncendido ? new Date(tsEncendido).getTime() : Date.now();
          const minutos = Math.round((Date.now() - desde) / 60000);
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
    const tsEncendido = await getEstado(`bomba_encendida_${codigo}`);
    if (tsEncendido) {
      const min = Math.round((Date.now() - new Date(tsEncendido).getTime()) / 60000);
      duracion = ` (estuvo ${min} min encendida)`;
      await eliminarEstado(`bomba_encendida_${codigo}`);
    }

    const msg = getMensajeBombaApagada(nombre, duracion);
    await Promise.all([
      enviarWhatsApp(msg),
      enviarFCM({
        titulo: `Bomba Apagada`,
        cuerpo: `${nombre} apagada${duracion}`,
        tipo: 'info',
        datos: { pantalla: 'bombas', codigo }
      }).catch(e => console.error('[FCM] Error bomba apagada:', e.message)),
      enviarPushATodos({
        title: `Bomba Apagada`,
        body: `${nombre} apagada${duracion}`,
        data: { url: '/' }
      }).catch(e => console.error('[PUSH] Error bomba apagada:', e.message))
    ]);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// NIVEL DE AGUA (Solo notifica en 100%, 20%, 10%)
// Cooldowns persistidos en BD
// ═══════════════════════════════════════════════════════════════════════

/**
 * Evalúa si debe notificar cambio de nivel de agua.
 * Solo envía en umbrales críticos: tanque lleno (100%), bajo (20%), crítico (10%).
 */
async function evaluarNivelAgua(porcentaje) {
  let umbral = null;
  let mensaje = '';

  const alerta100 = await getEstado('alerta_nivel_100');
  const alerta20 = await getEstado('alerta_nivel_20');
  const alerta10 = await getEstado('alerta_nivel_10');

  if (porcentaje >= 100 && !alerta100) {
    umbral = '100';
    mensaje = `💧 *Tanque de agua LLENO* (${porcentaje}%)\nEl tanque se ha llenado completamente.`;
    // Al llenarse, resetear alertas de bajo nivel
    await eliminarEstado('alerta_nivel_20');
    await eliminarEstado('alerta_nivel_10');
  } else if (porcentaje <= 10 && !alerta10) {
    umbral = '10';
    mensaje = `🚨 *NIVEL CRÍTICO DE AGUA* (${porcentaje}%)\n¡El tanque está casi vacío! Verificar suministro.`;
  } else if (porcentaje <= 20 && !alerta20) {
    umbral = '20';
    mensaje = `⚠️ *Nivel de agua BAJO* (${porcentaje}%)\nConsiderar rellenar el tanque pronto.`;
  }

  if (umbral) {
    await setEstado(`alerta_nivel_${umbral}`, new Date().toISOString());
    const esCritico = umbral === '10';
    const tituloAgua = esCritico ? 'Nivel Crítico de Agua' : umbral === '100' ? 'Tanque Lleno' : 'Nivel de Agua Bajo';
    await Promise.all([
      enviarWhatsApp(mensaje),
      enviarFCM({
        titulo: tituloAgua,
        cuerpo: `Nivel del tanque: ${porcentaje}%`,
        tipo: esCritico ? 'critico' : 'info',
        datos: { pantalla: 'dashboard', nivel: String(porcentaje) }
      }).catch(e => console.error('[FCM] Error nivel agua:', e.message)),
      enviarPushATodos({
        title: tituloAgua,
        body: `Nivel del tanque: ${porcentaje}%`,
        data: { url: '/' }
      }).catch(e => console.error('[PUSH] Error nivel agua:', e.message))
    ]);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// TAREAS DIARIAS DE SALUD Y ETAPAS
// ═══════════════════════════════════════════════════════════════════════

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
 */
async function revisarTareasDiarias() {
  try {
    const lote = await Lote.findOne({ activo: true }).sort({ createdAt: -1 });
    if (!lote) return;

    const edadDias = lote.edad_dias;
    console.log(`[TAREAS] Revisando lote "${lote.nombre}" - Edad: ${edadDias} días`);

    for (const item of CALENDARIO_SALUD) {
      if (edadDias >= item.dia && edadDias <= item.dia + 1) {
        const msg = `📋 *TAREA DEL DÍA - ${lote.nombre}*\n` +
          `Edad del lote: ${edadDias} días\n\n` +
          item.tarea;
        const tareaTexto = item.tarea.replace(/\*|_|`/g, '').slice(0, 100);
        await Promise.all([
          enviarWhatsApp(msg),
          enviarFCM({
            titulo: `Tarea del día — ${lote.nombre}`,
            cuerpo: tareaTexto,
            tipo: 'info',
            datos: { pantalla: 'lotes' }
          }).catch(e => console.error('[FCM] Error tarea diaria:', e.message)),
          enviarPushATodos({
            title: `Tarea del día — ${lote.nombre}`,
            body: tareaTexto,
            data: { url: '/' }
          }).catch(e => console.error('[PUSH] Error tarea diaria:', e.message))
        ]);
        break;
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

    await Promise.all([
      enviarWhatsApp(msg),
      enviarFCM({
        titulo: 'Resumen Diario de Agua',
        cuerpo: `Consumo hoy: ${litros.toFixed(1)}L | Ayer: ${litrosAyer.toFixed(1)}L`,
        tipo: 'info',
        datos: { pantalla: 'dashboard' }
      }).catch(e => console.error('[FCM] Error resumen agua:', e.message)),
      enviarPushATodos({
        title: 'Resumen Diario de Agua',
        body: `Consumo hoy: ${litros.toFixed(1)}L | Ayer: ${litrosAyer.toFixed(1)}L`,
        data: { url: '/' }
      }).catch(e => console.error('[PUSH] Error resumen agua:', e.message))
    ]);
  } catch (error) {
    console.error('[RESUMEN] Error enviando resumen agua:', error.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ALERTA STOCK CRÍTICO DE ALIMENTO (≤ 10 kg restantes)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Envía alerta si el stock de un producto de alimento cae a 10 kg o menos.
 * Cooldown persistido en BD por producto (se resetea al registrar una entrada).
 */
async function verificarStockCriticoAlimento(inventario) {
  try {
    const kg_restantes = (inventario.cantidad_bultos || 0) * (inventario.peso_por_bulto_kg || 40);
    if (kg_restantes > 10) return;

    const clave = `alerta_stock_10kg_${inventario._id}`;
    const yaEnviada = await getEstado(clave);
    if (yaEnviada) return;

    await setEstado(clave, new Date().toISOString());

    const bultosEnteros = Math.floor(inventario.cantidad_bultos || 0);
    const kgSuelto = Math.round(((inventario.cantidad_bultos || 0) - bultosEnteros) * (inventario.peso_por_bulto_kg || 40) * 10) / 10;
    const desglose = kgSuelto > 0 ? `${bultosEnteros} bultos + ${kgSuelto} kg` : `${bultosEnteros} bultos`;

    const msg =
      `🚨 *STOCK CRÍTICO DE ALIMENTO*\n` +
      `Producto: ${inventario.nombre} (${inventario.tipo})\n` +
      `Restante: *${kg_restantes.toFixed(1)} kg* (${desglose})\n` +
      `⚠️ Reabastecer urgente para no dejar a los cerdos sin alimento.`;

    await Promise.all([
      enviarWhatsApp(msg),
      enviarFCM({
        titulo: `🚨 Stock Crítico: ${inventario.nombre}`,
        cuerpo: `Solo quedan ${kg_restantes.toFixed(1)} kg. Reabastecer urgente.`,
        tipo: 'critico',
        datos: { pantalla: 'inventario', inventario_id: String(inventario._id) }
      }).catch(e => console.error('[FCM] Error stock alimento:', e.message)),
      enviarPushATodos({
        title: `🚨 Stock Crítico: ${inventario.nombre}`,
        body: `Solo quedan ${kg_restantes.toFixed(1)} kg. Reabastecer urgente.`,
        data: { url: '/' }
      }).catch(e => console.error('[PUSH] Error stock alimento:', e.message))
    ]);

    console.log(`[STOCK] Alerta crítica enviada: ${inventario.nombre} — ${kg_restantes.toFixed(1)} kg`);
  } catch (error) {
    console.error('[STOCK] Error verificando stock crítico:', error.message);
  }
}

/**
 * Elimina el cooldown de alerta de stock cuando se registra una nueva entrada.
 */
async function resetearAlertaStockAlimento(inventarioId) {
  await eliminarEstado(`alerta_stock_10kg_${inventarioId}`);
}

// ═══════════════════════════════════════════════════════════════════════
// ALERTA PESAJE SEMANAL (avisa el día anterior al pesaje de 7 días)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Revisa todos los lotes activos y envía alerta si mañana es día de pesaje.
 * El pesaje se hace cada 7 días. Detecta el día 6 desde el último pesaje.
 */
async function verificarPesajeSemanal() {
  try {
    const lotes = await Lote.find({ activo: true });
    if (!lotes.length) return;

    for (const lote of lotes) {
      const ultimoPesaje = await Pesaje.findOne({ lote: lote._id }).sort({ fecha: -1 }).lean();
      const referencia   = ultimoPesaje ? new Date(ultimoPesaje.fecha) : new Date(lote.fecha_inicio || lote.createdAt);

      // Días transcurridos desde el último pesaje (o desde inicio del lote)
      const diasDesde = Math.floor((Date.now() - referencia.getTime()) / (24 * 60 * 60 * 1000));

      // Día 6 = mañana toca el pesaje (cada 7 días)
      if (diasDesde === 6) {
        const clave = `pesaje_alerta_${lote._id}_d${diasDesde}`;
        const yaEnviada = await getEstado(clave);
        if (yaEnviada) continue;

        await setEstado(clave, new Date().toISOString());

        const fechaUltima = referencia.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });
        const msg =
          `⚖️ *RECORDATORIO: MAÑANA ES DÍA DE PESAJE*\n` +
          `Lote: ${lote.nombre}\n` +
          `Último pesaje: ${fechaUltima} (hace ${diasDesde} días)\n` +
          `Prepara la romana y registra los pesos para llevar el control.`;

        await Promise.all([
          enviarWhatsApp(msg),
          enviarFCM({
            titulo: `⚖️ Mañana: Día de Pesaje — ${lote.nombre}`,
            cuerpo: `Hace ${diasDesde} días del último pesaje. Prepara la romana.`,
            tipo: 'info',
            datos: { pantalla: 'lotes', lote_id: String(lote._id) }
          }).catch(e => console.error('[FCM] Error pesaje:', e.message)),
          enviarPushATodos({
            title: `⚖️ Mañana: Día de Pesaje`,
            body: `Lote ${lote.nombre} — Hace ${diasDesde} días del último pesaje. Prepara la romana.`,
            data: { url: '/' }
          }).catch(e => console.error('[PUSH] Error pesaje:', e.message))
        ]);

        console.log(`[PESAJE] Alerta enviada para lote "${lote.nombre}" — ${diasDesde} días desde último pesaje`);
      }

      // Limpiar claves viejas cuando ya pasó el pesaje (día 8+)
      if (diasDesde >= 8) {
        await eliminarEstado(`pesaje_alerta_${lote._id}_d6`);
      }
    }
  } catch (error) {
    console.error('[PESAJE] Error verificando pesaje semanal:', error.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// RESET DIARIO (limpiar cooldowns en BD a medianoche)
// ═══════════════════════════════════════════════════════════════════════

async function resetearNotificacionesDiarias() {
  try {
    await eliminarEstado('ultima_alerta_calor');
    await eliminarEstado('alerta_nivel_100');
    await eliminarEstado('alerta_nivel_20');
    await eliminarEstado('alerta_nivel_10');
    console.log('[NOTIF] Cooldowns reseteados en BD para nuevo día');
  } catch (e) {
    console.error('[NOTIF] Error reseteando cooldowns:', e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// CRON HELPERS (para server.js - estado persistido en BD)
// ═══════════════════════════════════════════════════════════════════════

async function getTareaDiariaEjecutada() {
  return await getEstado('tarea_diaria_ejecutada');
}

async function setTareaDiariaEjecutada(fecha) {
  await setEstado('tarea_diaria_ejecutada', fecha);
}

async function getResumenAguaEnviado() {
  return await getEstado('resumen_agua_enviado');
}

async function setResumenAguaEnviado(fecha) {
  await setEstado('resumen_agua_enviado', fecha);
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
  verificarStockCriticoAlimento,
  resetearAlertaStockAlimento,
  verificarPesajeSemanal,
  getUmbralTemperatura,
  getTareaDiariaEjecutada,
  setTareaDiariaEjecutada,
  getResumenAguaEnviado,
  setResumenAguaEnviado
};
