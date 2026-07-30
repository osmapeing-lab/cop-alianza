/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - CONSUMO DE ALIMENTO AUTOMÁTICO DIARIO
 * ═══════════════════════════════════════════════════════════════════════
 *
 * En vez de esperar a que alguien registre manualmente el consumo (o a que
 * el lote termine) para saber cuánto costó alimentar un lote, esta tarea
 * corre una vez al día (ver server.js) y, para cada lote activo, registra
 * el consumo de HOY según la tabla de alimentación complementaria (misma
 * tabla que ya usan la web y la app para el costo estimado/gráfica de
 * peso), escalado por la cantidad de cerdos del lote.
 *
 * El costo por kg sale del bulto real en inventario cuando hay stock
 * suficiente (se descuenta el inventario, igual que un registro manual —
 * ver gestionLotesController.registrarAlimentacionDesdeInventario), y si
 * no hay inventario que alcance, cae al precio por etapa configurado por
 * el admin (Config.precios_alimento_por_etapa / precio_alimento_kg).
 * ═══════════════════════════════════════════════════════════════════════
 */

const Lote = require('../models/lote');
const InventarioAlimento = require('../models/InventarioAlimento');
const AlimentacionLote = require('../models/AlimentacionLote');
const Config = require('../models/Config');

// Mismos 22 renglones que PLAN_ALIMENTACION_COMPLEMENTARIO en
// frontend/src/App.jsx y plan_alimentacion_complementario.dart en la app —
// si se actualiza la tabla de referencia, hay que actualizar los tres.
const PLAN_ALIMENTACION_COMPLEMENTARIO = [
  { semana: 1,  dia_inicio: 0,   dia_fin: 6,   etapa: 'Calostro y leche materna', consumo_dia_cerdo_kg: null },
  { semana: 2,  dia_inicio: 7,   dia_fin: 13,  etapa: 'Leche materna',            consumo_dia_cerdo_kg: null },
  { semana: 3,  dia_inicio: 14,  dia_fin: 20,  etapa: 'Preiniciador + leche',     consumo_dia_cerdo_kg: 0.075 },
  { semana: 4,  dia_inicio: 21,  dia_fin: 27,  etapa: 'Preiniciador + leche',     consumo_dia_cerdo_kg: 0.125 },
  { semana: 5,  dia_inicio: 28,  dia_fin: 34,  etapa: 'Preiniciador + leche',     consumo_dia_cerdo_kg: 0.200 },
  { semana: 6,  dia_inicio: 35,  dia_fin: 41,  etapa: 'Preiniciador',             consumo_dia_cerdo_kg: 0.325 },
  { semana: 7,  dia_inicio: 42,  dia_fin: 48,  etapa: 'Preiniciador',             consumo_dia_cerdo_kg: 0.500 },
  { semana: 8,  dia_inicio: 49,  dia_fin: 55,  etapa: 'Iniciador',                consumo_dia_cerdo_kg: 0.700 },
  { semana: 9,  dia_inicio: 56,  dia_fin: 62,  etapa: 'Iniciador',                consumo_dia_cerdo_kg: 0.900 },
  { semana: 10, dia_inicio: 63,  dia_fin: 69,  etapa: 'Iniciador',                consumo_dia_cerdo_kg: 1.100 },
  { semana: 11, dia_inicio: 70,  dia_fin: 76,  etapa: 'Levante',                  consumo_dia_cerdo_kg: 1.350 },
  { semana: 12, dia_inicio: 77,  dia_fin: 83,  etapa: 'Levante',                  consumo_dia_cerdo_kg: 1.600 },
  { semana: 13, dia_inicio: 84,  dia_fin: 90,  etapa: 'Levante',                  consumo_dia_cerdo_kg: 1.800 },
  { semana: 14, dia_inicio: 91,  dia_fin: 97,  etapa: 'Levante',                  consumo_dia_cerdo_kg: 2.000 },
  { semana: 15, dia_inicio: 98,  dia_fin: 104, etapa: 'Levante',                  consumo_dia_cerdo_kg: 2.200 },
  { semana: 16, dia_inicio: 105, dia_fin: 111, etapa: 'Levante',                  consumo_dia_cerdo_kg: 2.400 },
  { semana: 17, dia_inicio: 112, dia_fin: 118, etapa: 'Engorde',                  consumo_dia_cerdo_kg: 2.650 },
  { semana: 18, dia_inicio: 119, dia_fin: 125, etapa: 'Engorde',                  consumo_dia_cerdo_kg: 2.900 },
  { semana: 19, dia_inicio: 126, dia_fin: 132, etapa: 'Engorde',                  consumo_dia_cerdo_kg: 3.100 },
  { semana: 20, dia_inicio: 133, dia_fin: 139, etapa: 'Engorde',                  consumo_dia_cerdo_kg: 3.200 },
  { semana: 21, dia_inicio: 140, dia_fin: 146, etapa: 'Finalización',             consumo_dia_cerdo_kg: 3.300 },
  { semana: 22, dia_inicio: 147, dia_fin: 153, etapa: 'Finalización',             consumo_dia_cerdo_kg: 3.400 }
];

function getEtapaAlimentacion(edadDias) {
  return PLAN_ALIMENTACION_COMPLEMENTARIO.find(s => edadDias >= s.dia_inicio && edadDias <= s.dia_fin) || null;
}

// Etapa de la tabla de referencia → tipo de InventarioAlimento (el enum de
// inventario es más genérico que las 8 etapas de la tabla).
function mapEtapaATipoInventario(etapa) {
  if (etapa.startsWith('Preiniciador') || etapa === 'Iniciador') return 'inicio';
  if (etapa === 'Levante') return 'crecimiento';
  if (etapa === 'Engorde' || etapa === 'Finalización') return 'engorde';
  return null; // Calostro/leche materna — sin alimento sólido atribuible
}

function mapEtapaATipoAlimentacionLote(tipoInventario) {
  if (tipoInventario === 'inicio') return 'iniciador';
  if (tipoInventario === 'crecimiento') return 'levante';
  if (tipoInventario === 'engorde') return 'engorde';
  return 'otro';
}

// Kg + costo acumulado que un lote DEBERÍA llevar comido hasta hoy, según
// la tabla de referencia — suma semana por semana (solo los días ya
// vividos de la semana en curso), usando el precio por etapa configurado.
async function calcularAcumuladoEsperado(edadDias, cantidadCerdos, precios, precioFallback) {
  let kg = 0;
  let costo = 0;
  for (const fila of PLAN_ALIMENTACION_COMPLEMENTARIO) {
    if (fila.dia_inicio > edadDias) break;
    if (fila.consumo_dia_cerdo_kg == null) continue;
    const diasVividosEnSemana = Math.min(fila.dia_fin, edadDias) - fila.dia_inicio + 1;
    const kgSemana = fila.consumo_dia_cerdo_kg * cantidadCerdos * diasVividosEnSemana;
    const match = precios.find(p => p.etapa === fila.etapa);
    const precioEtapa = match ? match.precio_por_kg : precioFallback;
    kg += kgSemana;
    costo += kgSemana * precioEtapa;
  }
  return { kg, costo };
}

/**
 * "Pone al día" el consumo de alimento de cada lote activo: calcula cuánto
 * debería llevar comido hasta HOY según la tabla de referencia y registra
 * solo la diferencia contra lo que ya tiene acumulado
 * (`lote.alimento_total_kg`/`costo_alimento_total`). Al ser una diferencia
 * contra el estado actual (no "el consumo de hoy" a secas), es
 * auto-sanadora: si el cron no corrió un día, si el servidor estuvo caído,
 * o si es la primera vez que corre para un lote que ya llevaba semanas
 * activo, el faltante completo se pone al día de una sola vez. Pensada
 * para llamarse una vez al día (ver server.js), pero es seguro llamarla
 * más veces — si ya está al día no genera un nuevo registro.
 */
async function registrarConsumoDiarioAutomatico() {
  const lotes = await Lote.find({ activo: true });
  const config = await Config.findOne();
  const precios = config?.precios_alimento_por_etapa || [];
  const precioFallback = config?.precio_alimento_kg || 0;
  let registrados = 0;

  for (const lote of lotes) {
    try {
      const edadDias = lote.edad_dias;
      if (edadDias == null || edadDias < 0) continue;

      const { kg: kgEsperado, costo: costoEsperado } = await calcularAcumuladoEsperado(
        edadDias,
        lote.cantidad_cerdos || 0,
        precios,
        precioFallback
      );

      const kgFaltante = kgEsperado - (lote.alimento_total_kg || 0);
      // Menos de 50 g de diferencia no vale la pena registrarlo — evita
      // crear un registro nuevo cada vez que corre por redondeos mínimos.
      if (kgFaltante <= 0.05) continue;

      const etapaActual = getEtapaAlimentacion(edadDias);
      const tipoInv = etapaActual ? mapEtapaATipoInventario(etapaActual.etapa) : null;
      const inventario = tipoInv
        ? await InventarioAlimento.findOne({
            granja: lote.granja,
            tipo: tipoInv,
            activo: true,
            cantidad_bultos: { $gt: 0 }
          }).sort({ cantidad_bultos: -1 })
        : null;

      let precio_kg = 0;
      let inventario_ref = null;
      let bultos_consumidos = 0;

      if (inventario) {
        const pesoPorBulto = inventario.peso_por_bulto_kg || 40;
        const bultosNecesarios = kgFaltante / pesoPorBulto;
        if (bultosNecesarios <= inventario.cantidad_bultos) {
          precio_kg = inventario.precio_bulto > 0 ? inventario.precio_bulto / pesoPorBulto : 0;
          await inventario.registrarSalida(
            bultosNecesarios,
            lote._id,
            `Consumo automático — ${etapaActual?.etapa || ''} (${lote.cantidad_cerdos} cerdos)`,
            null
          );
          inventario_ref = inventario._id;
          bultos_consumidos = bultosNecesarios;
        }
      }

      if (!inventario_ref) {
        // Sin bultos suficientes en inventario — usa el costo esperado
        // (ya calculado con el precio por etapa correcto de cada semana),
        // convertido a un precio/kg promedio para este registro.
        precio_kg = kgFaltante > 0 ? (costoEsperado - (lote.costo_alimento_total || 0)) / kgFaltante : 0;
        if (precio_kg < 0) precio_kg = precioFallback;
      }

      const registro = new AlimentacionLote({
        lote: lote._id,
        tipo_alimento: mapEtapaATipoAlimentacionLote(tipoInv),
        cantidad_kg: kgFaltante,
        precio_kg,
        notas: `Consumo automático — al día ${edadDias} (${lote.cantidad_cerdos} cerdos)`,
        inventario_ref: inventario_ref || undefined,
        bultos_consumidos,
        automatico: true
      });
      await registro.save();
      registrados++;
    } catch (error) {
      console.error(`[ALIMENTACION-AUTO] Error en lote ${lote._id} (${lote.nombre}):`, error.message);
    }
  }

  console.log(`[ALIMENTACION-AUTO] Consumo puesto al día para ${registrados}/${lotes.length} lotes activos.`);
  return registrados;
}

module.exports = {
  registrarConsumoDiarioAutomatico,
  getEtapaAlimentacion,
  PLAN_ALIMENTACION_COMPLEMENTARIO
};
