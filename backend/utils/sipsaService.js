/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - PRECIOS DE MERCADO PORCÍCOLA (DANE SIPSA)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Consume el web service público (SOAP 1.2, sin autenticación) del DANE:
 * "Sistema de Información de Precios y Abastecimiento del Sector
 * Agropecuario" — componente de precios mayoristas por artículo/semana.
 * No expone parámetros de consulta: cada llamada devuelve el período
 * vigente completo (~20-25 MB, todos los artículos agropecuarios), así que
 * aquí se filtra únicamente lo relacionado a "cerdo" antes de devolverlo.
 * WSDL: http://appweb.dane.gov.co/sipsaWS/SrvSipsaUpraBeanService?WSDL
 */

const axios = require('axios');
const xml2js = require('xml2js');

const SIPSA_URL = 'https://appweb.dane.gov.co/sipsaWS/SrvSipsaUpraBeanService';

function construirSobreSoap(operacion) {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" ` +
    `xmlns:ser="http://servicios.sipsa.co.gov.dane/">` +
    `<soap12:Body><ser:${operacion}/></soap12:Body></soap12:Envelope>`
  );
}

async function llamarSipsa(operacion) {
  const respuesta = await axios.post(SIPSA_URL, construirSobreSoap(operacion), {
    headers: { 'Content-Type': 'application/soap+xml;charset=UTF-8' },
    timeout: 120000, // El WS del DANE puede tardar >60s en responder ~20MB de XML.
    maxContentLength: 100 * 1024 * 1024,
    maxBodyLength: 100 * 1024 * 1024
  });

  const parser = new xml2js.Parser({
    explicitArray: false,
    tagNameProcessors: [xml2js.processors.stripPrefix]
  });
  const json = await parser.parseStringPromise(respuesta.data);
  const cuerpo = json.Envelope.Body[`${operacion}Response`];
  if (!cuerpo || !cuerpo.return) return [];
  return Array.isArray(cuerpo.return) ? cuerpo.return : [cuerpo.return];
}

/**
 * Precios mayoristas semanales de cortes de cerdo, promediados a nivel
 * nacional. La respuesta cruda del DANE trae un registro por cada central
 * de abasto/plaza (~30 ciudades) por corte por semana — casi 10.000 filas
 * para 13 cortes, demasiado para guardar/enviar tal cual a un teléfono. Se
 * promedia aquí mismo por (producto, semana) antes de devolver, dejando una
 * sola serie nacional por corte. Cada elemento:
 * { producto, fuente, periodoInicio, promedioKg, minimoKg, maximoKg }.
 */
exports.obtenerPreciosCerdoSemanal = async () => {
  const items = await llamarSipsa('promediosSipsaSemanaMadr');
  const deCerdo = items.filter((it) => (it.artiNombre || '').toLowerCase().includes('cerdo'));

  const porGrupo = new Map();
  for (const it of deCerdo) {
    const clave = `${it.artiNombre}|${it.fechaIni}`;
    if (!porGrupo.has(clave)) {
      porGrupo.set(clave, {
        producto: it.artiNombre,
        periodoInicio: new Date(it.fechaIni),
        promedios: [],
        minimoKg: Infinity,
        maximoKg: -Infinity
      });
    }
    const grupo = porGrupo.get(clave);
    grupo.promedios.push(Number(it.promedioKg));
    if (it.minimoKg != null) grupo.minimoKg = Math.min(grupo.minimoKg, Number(it.minimoKg));
    if (it.maximoKg != null) grupo.maximoKg = Math.max(grupo.maximoKg, Number(it.maximoKg));
  }

  return Array.from(porGrupo.values()).map((g) => ({
    producto: g.producto,
    fuente: `Promedio nacional (${g.promedios.length} centrales de abasto)`,
    periodoInicio: g.periodoInicio,
    promedioKg: Math.round(g.promedios.reduce((a, b) => a + b, 0) / g.promedios.length),
    minimoKg: Number.isFinite(g.minimoKg) ? g.minimoKg : undefined,
    maximoKg: Number.isFinite(g.maximoKg) ? g.maximoKg : undefined
  }));
};
