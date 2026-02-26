import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { io } from 'socket.io-client'
import ReCAPTCHA from 'react-google-recaptcha'
import './App.css'
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import {
  Thermometer, Droplets, Weight, TrendingUp, TrendingDown,
  PiggyBank, Package, Bell, Activity,
  BarChart3, LineChart as LineChartIcon,
  LogOut, Eye, Plus, Edit, Trash2,
  RefreshCw, DollarSign, Wallet, Archive,
  AlertTriangle, CheckCircle, XCircle, Clock, Calendar,
  Home, ChevronRight, MoreVertical,
  Wifi, WifiOff, Power, PowerOff, Gauge
} from 'lucide-react'
// ═══════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════

const API_URL = import.meta.env.VITE_API_URL || 'https://cop-alianza-backend.onrender.com'
const socket = io(API_URL)

// reCAPTCHA v2 - Reemplazar con tu clave real de google.com/recaptcha
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6Ldn320sAAAAANB8zwnmeM-lxQ7CVAYJUAemLdV0'

// Helper: permite borrar, escribir decimales y editar inputs numéricos sin problemas
const numVal = (v, dec = false) => {
  if (v === '' || v === '-') return ''
  const clean = String(v).replace(',', '.')
  if (dec) {
    if (/^-?\d*\.?\d*$/.test(clean)) return clean
    return ''
  }
  const n = parseInt(clean)
  return isNaN(n) ? '' : n
}

// Formatea bultos decimales como "X bultos + Y kg" o "X bultos + Z g"
// Ej: 2.8 bultos × 40 kg → "2 bultos + 32 kg"
const formatBultos = (bultos, pesoPorBulto = 40) => {
  if (!bultos && bultos !== 0) return '—'
  if (bultos <= 0) return '0 bultos'
  const enteros = Math.floor(bultos)
  const fraccion = bultos - enteros
  const kgSuelto = fraccion * pesoPorBulto
  const s = enteros === 1 ? 'bulto' : 'bultos'
  if (fraccion < 0.001) return `${enteros} ${s}`
  if (kgSuelto < 1) return `${enteros} ${s} + ${Math.round(kgSuelto * 1000)} g`
  return `${enteros} ${s} + ${kgSuelto.toFixed(1)} kg`
}

// Coordenadas Lorica para clima
const LAT = 9.2397
const LON = -75.8091

// ═══════════════════════════════════════════════════════════════════════
// TABLAS DE PRODUCCIÓN PORCINA - Ciclo Completo
// ═══════════════════════════════════════════════════════════════════════

// Fase 1: Inicio (Días 43-70) - Peso: 12 → 25 kg
const TABLA_INICIO = [
  { semana: 1, edad_inicio: 43, edad_fin: 49, peso_final: 15, consumo_dia_min: 0.8, consumo_dia_max: 0.9, consumo_sem_min: 5.6, consumo_sem_max: 6.3, fase: 'inicio' },
  { semana: 2, edad_inicio: 50, edad_fin: 56, peso_final: 18, consumo_dia_min: 0.9, consumo_dia_max: 1.0, consumo_sem_min: 6.3, consumo_sem_max: 7.0, fase: 'inicio' },
  { semana: 3, edad_inicio: 57, edad_fin: 63, peso_final: 21.5, consumo_dia_min: 1.0, consumo_dia_max: 1.1, consumo_sem_min: 7.0, consumo_sem_max: 7.7, fase: 'inicio' },
  { semana: 4, edad_inicio: 64, edad_fin: 70, peso_final: 25, consumo_dia_min: 1.1, consumo_dia_max: 1.2, consumo_sem_min: 7.7, consumo_sem_max: 8.4, fase: 'inicio' }
]

// Fase 2: Crecimiento (Días 71-120) - Peso: 25 → 60 kg
const TABLA_CRECIMIENTO = [
  { semana: 1, edad_inicio: 71,  edad_fin: 77,  peso_final: 29, consumo_dia: 1.5, consumo_sem: 10.5, fase: 'crecimiento' },
  { semana: 2, edad_inicio: 78,  edad_fin: 84,  peso_final: 34, consumo_dia: 1.6, consumo_sem: 11.2, fase: 'crecimiento' },
  { semana: 3, edad_inicio: 85,  edad_fin: 91,  peso_final: 39, consumo_dia: 1.8, consumo_sem: 12.6, fase: 'crecimiento' },
  { semana: 4, edad_inicio: 92,  edad_fin: 98,  peso_final: 45, consumo_dia: 2.0, consumo_sem: 14.0, fase: 'crecimiento' },
  { semana: 5, edad_inicio: 99,  edad_fin: 105, peso_final: 51, consumo_dia: 2.1, consumo_sem: 14.7, fase: 'crecimiento' },
  { semana: 6, edad_inicio: 106, edad_fin: 112, peso_final: 56, consumo_dia: 2.2, consumo_sem: 15.4, fase: 'crecimiento' },
  { semana: 7, edad_inicio: 113, edad_fin: 120, peso_final: 60, consumo_dia: 2.3, consumo_sem: 18.4, fase: 'crecimiento' }
]

// Fase 3: Engorde/Finalización (Días 121-180) - Peso: 60 → 110 kg
const TABLA_ENGORDE = [
  { semana: 1, edad_inicio: 121, edad_fin: 127, peso_final: 66,  consumo_dia: 2.5, consumo_sem: 17.5, fase: 'engorde' },
  { semana: 2, edad_inicio: 128, edad_fin: 134, peso_final: 72,  consumo_dia: 2.6, consumo_sem: 18.2, fase: 'engorde' },
  { semana: 3, edad_inicio: 135, edad_fin: 141, peso_final: 79,  consumo_dia: 2.7, consumo_sem: 18.9, fase: 'engorde' },
  { semana: 4, edad_inicio: 142, edad_fin: 148, peso_final: 86,  consumo_dia: 2.8, consumo_sem: 19.6, fase: 'engorde' },
  { semana: 5, edad_inicio: 149, edad_fin: 155, peso_final: 93,  consumo_dia: 3.0, consumo_sem: 21.0, fase: 'engorde' },
  { semana: 6, edad_inicio: 156, edad_fin: 162, peso_final: 100, consumo_dia: 3.1, consumo_sem: 21.7, fase: 'engorde' },
  { semana: 7, edad_inicio: 163, edad_fin: 169, peso_final: 106, consumo_dia: 3.2, consumo_sem: 22.4, fase: 'engorde' },
  { semana: 8, edad_inicio: 170, edad_fin: 180, peso_final: 110, consumo_dia: 3.2, consumo_sem: 32.0, fase: 'engorde' }
]

// Resumen de fases para indicadores rápidos
const FASES_PRODUCCION = [
  { nombre: 'Inicio',       edad_min: 43,  edad_max: 70,  peso_min: 12, peso_max: 25,  ganancia_dia: '460-500 g', conversion: '1.6-1.8', tabla: TABLA_INICIO },
  { nombre: 'Crecimiento',  edad_min: 71,  edad_max: 120, peso_min: 25, peso_max: 60,  ganancia_dia: '650-750 g', conversion: '1.8-2.0', tabla: TABLA_CRECIMIENTO },
  { nombre: 'Engorde',      edad_min: 121, edad_max: 180, peso_min: 60, peso_max: 110, ganancia_dia: '800-900 g', conversion: '2.1-2.4', tabla: TABLA_ENGORDE }
]

// Determina la etapa automática del lote según su edad en días
const getEtapaAutomatica = (edadDias) => {
  if (edadDias <= 42) return 'destete'
  if (edadDias <= 70) return 'inicio'
  if (edadDias <= 120) return 'crecimiento'
  if (edadDias <= 180) return 'engorde'
  return 'finalizado'
}


// Función para encontrar la fase actual de un lote según su edad
const getFaseActual = (edadDias) => {
  return FASES_PRODUCCION.find(f => edadDias >= f.edad_min && edadDias <= f.edad_max) || null
}

// Función para encontrar la semana de referencia dentro de una fase
const getRefSemana = (edadDias) => {
  for (const fase of FASES_PRODUCCION) {
    const fila = fase.tabla.find(s => edadDias >= s.edad_inicio && edadDias <= s.edad_fin)
    if (fila) return { ...fila, nombre_fase: fase.nombre }
  }
  return null
}


// Devuelve el string de semana ISO (Colombia) para una fecha dada
// Formato: "YYYY-WNN" (e.g. "2026-W08")
const getSemanaISO = (date = new Date()) => {
  const col = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date)
  const [y, m, d] = col.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const day = dt.getUTCDay() || 7
  dt.setUTCDate(dt.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((dt - yearStart) / 86400000 + 1) / 7)
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

// Label legible para semana ISO: "2026-W08" → "Sem 8 / 2026"
const labelSemana = (iso) => {
  if (!iso) return ''
  const [year, w] = iso.split('-W')
  return `Sem ${parseInt(w)} / ${year}`
}

// Calcula el consumo diario estimado y acumulado por cerdo según la edad
const getConsumoEstimado = (edadDias, cantidadCerdos = 1) => {
  let consumoDiario = 0
  let consumoAcumulado = 0

  for (let d = 43; d <= Math.min(edadDias, 180); d++) {
    const ref = getRefSemana(d)
    if (ref) {
      consumoDiario = ref.consumo_dia || ((ref.consumo_dia_min + ref.consumo_dia_max) / 2) || 0
    }
    consumoAcumulado += consumoDiario
  }

  return {
    consumo_dia_cerdo: Math.round(consumoDiario * 100) / 100,
    consumo_acum_cerdo: Math.round(consumoAcumulado * 100) / 100,
    consumo_acum_total: Math.round(consumoAcumulado * cantidadCerdos * 100) / 100,
    consumo_dia_total: Math.round(consumoDiario * cantidadCerdos * 100) / 100
  }
}

// TABLA FINCA original (Levante/Ceba semanas 11-24) - Se mantiene para compatibilidad
const TABLA_FINCA = [
  { semana: 11, edad: 77,  peso: 35.1, ganancia_dia: 0.697, consumo_sem: 8.70,  consumo_dia: 1.243, consumo_acum: 8.70,   conversion: 1.785, etapa: 'levante' },
  { semana: 12, edad: 84,  peso: 40.6, ganancia_dia: 0.789, consumo_sem: 9.70,  consumo_dia: 1.386, consumo_acum: 18.40,  conversion: 1.770, etapa: 'levante' },
  { semana: 13, edad: 91,  peso: 46.5, ganancia_dia: 0.841, consumo_sem: 10.85, consumo_dia: 1.550, consumo_acum: 29.25,  conversion: 1.796, etapa: 'levante' },
  { semana: 14, edad: 98,  peso: 52.6, ganancia_dia: 0.881, consumo_sem: 12.08, consumo_dia: 1.725, consumo_acum: 41.33,  conversion: 1.841, etapa: 'levante' },
  { semana: 15, edad: 105, peso: 59.1, ganancia_dia: 0.920, consumo_sem: 13.48, consumo_dia: 1.925, consumo_acum: 54.81,  conversion: 1.897, etapa: 'levante' },
  { semana: 16, edad: 112, peso: 65.8, ganancia_dia: 0.959, consumo_sem: 14.72, consumo_dia: 2.102, consumo_acum: 69.52,  conversion: 1.953, etapa: 'levante' },
  { semana: 17, edad: 119, peso: 72.7, ganancia_dia: 0.986, consumo_sem: 15.74, consumo_dia: 2.248, consumo_acum: 85.26,  conversion: 2.006, etapa: 'levante' },
  { semana: 18, edad: 126, peso: 79.9, ganancia_dia: 1.025, consumo_sem: 16.47, consumo_dia: 2.353, consumo_acum: 101.73, conversion: 2.048, etapa: 'levante' },
  { semana: 19, edad: 133, peso: 87.1, ganancia_dia: 1.038, consumo_sem: 17.94, consumo_dia: 2.563, consumo_acum: 119.67, conversion: 2.101, etapa: 'engorde' },
  { semana: 20, edad: 140, peso: 94.6, ganancia_dia: 1.065, consumo_sem: 19.56, consumo_dia: 2.795, consumo_acum: 139.24, conversion: 2.162, etapa: 'engorde' },
  { semana: 21, edad: 147, peso: 102.1, ganancia_dia: 1.078, consumo_sem: 20.43, consumo_dia: 2.919, consumo_acum: 159.67, conversion: 2.219, etapa: 'engorde' },
  { semana: 22, edad: 154, peso: 109.8, ganancia_dia: 1.091, consumo_sem: 21.26, consumo_dia: 3.038, consumo_acum: 180.93, conversion: 2.274, etapa: 'engorde' },
  { semana: 23, edad: 161, peso: 117.4, ganancia_dia: 1.091, consumo_sem: 21.36, consumo_dia: 3.052, consumo_acum: 202.30, conversion: 2.319, etapa: 'engorde' },
  { semana: 24, edad: 168, peso: 125.1, ganancia_dia: 1.091, consumo_sem: 21.66, consumo_dia: 3.095, consumo_acum: 223.96, conversion: 2.360, etapa: 'engorde' }
]

// ═══════════════════════════════════════════════════════════════════════
// ICONOS SVG
// ═══════════════════════════════════════════════════════════════════════



// ═══════════════════════════════════════════════════════════════════════
// ICONOS NUEVOS
// ═══════════════════════════════════════════════════════════════════════

const IconCamara = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
)

const IconVenta = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
)

const IconContabilidad = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/>
    <line x1="2" y1="20" x2="22" y2="20"/>
  </svg>
)

const IconInventario = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
)

const IconCerdo = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <ellipse cx="12" cy="14" rx="8" ry="6"/>
    <circle cx="6" cy="12" r="3"/>
    <ellipse cx="4" cy="13" rx="1.5" ry="1" fill="#2d6a4f"/>
    <circle cx="5" cy="11.5" r="0.8" fill="#1b4332"/>
    <path d="M3 9 L2 6 L5 8" fill="currentColor"/>
    <line x1="6" y1="18" x2="6" y2="21" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="10" y1="19" x2="10" y2="22" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="14" y1="19" x2="14" y2="22" stroke="currentColor" strokeWidth="1.5"/>
    <line x1="18" y1="18" x2="18" y2="21" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M20 13 Q22 12 21 10" stroke="currentColor" strokeWidth="1.5" fill="none"/>
  </svg>
)

const IconPlay = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
)

const IconFoto = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
)

const IconPeso = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M12 3C10.34 3 9 4.34 9 6C9 6.35 9.06 6.69 9.17 7H3V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V7H14.83C14.94 6.69 15 6.35 15 6C15 4.34 13.66 3 12 3ZM12 5C12.55 5 13 5.45 13 6S12.55 7 12 7 11 6.55 11 6 11.45 5 12 5ZM5 9H19V19H5V9Z"/>
  </svg>
)

const IconBomba = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M19.5 12C19.5 11.45 19.05 11 18.5 11H17V7H15V11H9V7H7V11H5.5C4.95 11 4.5 11.45 4.5 12S4.95 13 5.5 13H7V17H9V13H15V17H17V13H18.5C19.05 13 19.5 12.55 19.5 12Z"/>
  </svg>
)

const IconAlerta = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M12 2L1 21H23L12 2ZM12 6L19.53 19H4.47L12 6ZM11 10V14H13V10H11ZM11 16V18H13V16H11Z"/>
  </svg>
)

const IconUsuario = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M12 12C14.21 12 16 10.21 16 8S14.21 4 12 4 8 5.79 8 8 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z"/>
  </svg>
)

const IconConfig = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M19.14 12.94C19.18 12.64 19.2 12.33 19.2 12S19.18 11.36 19.14 11.06L21.16 9.48C21.34 9.34 21.39 9.07 21.28 8.87L19.36 5.55C19.24 5.33 18.99 5.26 18.77 5.33L16.38 6.29C15.88 5.91 15.35 5.59 14.76 5.35L14.4 2.81C14.36 2.57 14.16 2.4 13.92 2.4H10.08C9.84 2.4 9.65 2.57 9.61 2.81L9.25 5.35C8.66 5.59 8.12 5.92 7.63 6.29L5.24 5.33C5.02 5.25 4.77 5.33 4.65 5.55L2.74 8.87C2.62 9.08 2.66 9.34 2.86 9.48L4.88 11.06C4.84 11.36 4.8 11.67 4.8 12S4.82 12.64 4.86 12.94L2.84 14.52C2.66 14.66 2.61 14.93 2.72 15.13L4.64 18.45C4.76 18.67 5.01 18.74 5.23 18.67L7.62 17.71C8.12 18.09 8.65 18.41 9.24 18.65L9.6 21.19C9.65 21.43 9.84 21.6 10.08 21.6H13.92C14.16 21.6 14.36 21.43 14.39 21.19L14.75 18.65C15.34 18.41 15.88 18.08 16.37 17.71L18.76 18.67C18.98 18.75 19.23 18.67 19.35 18.45L21.27 15.13C21.39 14.91 21.34 14.66 21.15 14.52L19.14 12.94ZM12 15.6C10.02 15.6 8.4 13.98 8.4 12S10.02 8.4 12 8.4 15.6 10.02 15.6 12 13.98 15.6 12 15.6Z"/>
  </svg>
)


const IconOjo = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M12 4.5C7 4.5 2.73 7.61 1 12C2.73 16.39 7 19.5 12 19.5S21.27 16.39 23 12C21.27 7.61 17 4.5 12 4.5ZM12 17C9.24 17 7 14.76 7 12S9.24 7 12 7 17 9.24 17 12 14.76 17 12 17ZM12 9C10.34 9 9 10.34 9 12S10.34 15 12 15 15 13.66 15 12 13.66 9 12 9Z"/>
  </svg>
)

const IconOjoCerrado = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M11.83 9L15 12.16V12C15 10.34 13.66 9 12 9H11.83ZM7.53 9.8L9.08 11.35C9.03 11.56 9 11.78 9 12C9 13.66 10.34 15 12 15C12.22 15 12.44 14.97 12.65 14.92L14.2 16.47C13.53 16.8 12.79 17 12 17C9.24 17 7 14.76 7 12C7 11.21 7.2 10.47 7.53 9.8ZM2 4.27L4.28 6.55L4.74 7C3.08 8.3 1.78 10 1 12C2.73 16.39 7 19.5 12 19.5C13.55 19.5 15.03 19.2 16.38 18.66L16.81 19.08L19.73 22L21 20.73L3.27 3L2 4.27ZM12 7C14.76 7 17 9.24 17 12C17 12.64 16.87 13.26 16.64 13.82L19.57 16.75C21.07 15.5 22.27 13.86 23 12C21.27 7.61 17 4.5 12 4.5C10.6 4.5 9.26 4.75 8 5.2L10.17 7.35C10.74 7.13 11.35 7 12 7Z"/>
  </svg>
)

const IconGrafica = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M3.5 18.49L9.5 12.48L13.5 16.48L22 6.92L20.59 5.51L13.5 13.48L9.5 9.48L2 16.99L3.5 18.49Z"/>
  </svg>
)

const IconLote = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19ZM7 7H9V9H7V7ZM7 11H9V13H7V11ZM7 15H9V17H7V15ZM11 7H17V9H11V7ZM11 11H17V13H11V11ZM11 15H17V17H11V15Z"/>
  </svg>
)

const IconDinero = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M11.8 10.9C9.53 10.31 8.8 9.7 8.8 8.75C8.8 7.66 9.81 6.9 11.5 6.9C13.28 6.9 13.94 7.75 14 9H16.21C16.14 7.28 15.09 5.7 13 5.19V3H10V5.16C8.06 5.58 6.5 6.84 6.5 8.77C6.5 11.08 8.41 12.23 11.2 12.9C13.7 13.5 14.2 14.38 14.2 15.31C14.2 16 13.71 17.1 11.5 17.1C9.44 17.1 8.63 16.18 8.5 15H6.32C6.44 17.19 8.08 18.42 10 18.83V21H13V18.85C14.95 18.48 16.5 17.35 16.5 15.3C16.5 12.46 14.07 11.49 11.8 10.9Z"/>
  </svg>
)

const IconReporte = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM9 17H7V10H9V17ZM13 17H11V7H13V17ZM17 17H15V13H17V17Z"/>
  </svg>
)

const IconMas = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
  </svg>
)

const IconEditar = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M3 17.25V21H6.75L17.81 9.94L14.06 6.19L3 17.25ZM20.71 7.04C21.1 6.65 21.1 6.02 20.71 5.63L18.37 3.29C17.98 2.9 17.35 2.9 16.96 3.29L15.13 5.12L18.88 8.87L20.71 7.04Z"/>
  </svg>
)

const IconEliminar = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V7H6V19ZM19 4H15.5L14.5 3H9.5L8.5 4H5V6H19V4Z"/>
  </svg>
)

const IconRefresh = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4C7.58 4 4.01 7.58 4.01 12S7.58 20 12 20C15.73 20 18.84 17.45 19.73 14H17.65C16.83 16.33 14.61 18 12 18C8.69 18 6 15.31 6 12S8.69 6 12 6C13.66 6 15.14 6.69 16.22 7.78L13 11H20V4L17.65 6.35Z"/>
  </svg>
)

// ═══════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
// COMPONENTE: PANEL DE CAMARAS
// ═══════════════════════════════════════════════════════════════════════

const PanelCamaras = ({ camaras, grabaciones, onCapturar, onVerStream }) => {
  return (
    <div className="panel-camaras">
      <div className="section-header">
        <h2><IconCamara size={20} /> Cámaras de Seguridad</h2>
        <span className="badge-count">{camaras.length} cámaras</span>
      </div>
      
      <div className="camaras-grid">
        {camaras.map(cam => (
          <div key={cam._id} className={`camara-card ${cam.estado}`}>
            <div className="camara-preview">
              {cam.estado === 'activa' ? (
                <div className="stream-placeholder" onClick={() => onVerStream(cam)}>
                  <IconPlay size={32} />
                  <span>Ver stream</span>
                </div>
              ) : (
                <div className="stream-offline">
                  <span>Sin conexión</span>
                </div>
              )}
            </div>
            <div className="camara-info">
              <h4>{cam.nombre}</h4>
              <p>{cam.ubicacion}</p>
              <div className="camara-actions">
                <button onClick={() => onCapturar(cam.codigo)} className="btn-sm btn-capturar">
                  <IconFoto size={14} /> Capturar
                </button>
                <span className={`status-dot ${cam.estado}`}></span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {grabaciones.length > 0 && (
        <div className="grabaciones-recientes">
          <h3>Últimas capturas</h3>
          <div className="grabaciones-lista">
            {grabaciones.slice(0, 6).map(g => (
              <div key={g._id} className="grabacion-item">
                <IconFoto size={16} />
                <span>{g.archivo_nombre}</span>
                <small>{new Date(g.fecha_inicio).toLocaleString()}</small>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// COMPONENTE: PANEL DE VENTAS
// ═══════════════════════════════════════════════════════════════════════

const PanelVentas = ({ ventas, estadisticas, onNuevaVenta, onRegistrarPago }) => {
  const [modalVenta, setModalVenta] = useState(false)
  const [nuevaVenta, setNuevaVenta] = useState({
    tipo_venta: 'en_pie',
    comprador: { nombre: '', telefono: '' },
    cantidad: 1,
    peso_total_kg: 0,
    precio_kg: 8000
  })
  
  const tiposVenta = [
    { value: 'en_pie', label: 'Cerdos en Pie', precio: 8000 },
    { value: 'carne', label: 'Carne de Cerdo', precio: 14000 },
    { value: 'lechon', label: 'Lechones', precio: 180000 }
  ]
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    await onNuevaVenta(nuevaVenta)
    setModalVenta(false)
    setNuevaVenta({
      tipo_venta: 'en_pie',
      comprador: { nombre: '', telefono: '' },
      cantidad: 1,
      peso_total_kg: 0,
      precio_kg: 8000
    })
  }
  
  return (
    <div className="panel-ventas">
      <div className="section-header">
        <h2><IconVenta size={20} /> Sistema de Ventas</h2>
        <button onClick={() => setModalVenta(true)} className="btn-primary btn-sm">
          + Nueva Venta
        </button>
      </div>
      
      {/* Resumen de estadísticas */}
      <div className="ventas-stats">
        <div className="stat-card ingresos">
          <span className="stat-label">Ingresos del Mes</span>
          <span className="stat-value">${(estadisticas?.totales?.ingresos_totales || 0).toLocaleString()}</span>
        </div>
        <div className="stat-card cobrado">
          <span className="stat-label">Cobrado</span>
          <span className="stat-value">${(estadisticas?.totales?.cobrado || 0).toLocaleString()}</span>
        </div>
        <div className="stat-card pendiente">
          <span className="stat-label">Por Cobrar</span>
          <span className="stat-value">${(estadisticas?.totales?.pendiente || 0).toLocaleString()}</span>
        </div>
        <div className="stat-card ventas">
          <span className="stat-label">Total Ventas</span>
          <span className="stat-value">{estadisticas?.totales?.total_ventas || 0}</span>
        </div>
      </div>
      
      {/* Tabla de ventas recientes */}
      <div className="tabla-container">
        <table className="tabla-ventas">
          <thead>
            <tr>
              <th>Factura</th>
              <th>Comprador</th>
              <th>Tipo</th>
              <th>Cant.</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {ventas.length === 0 ? (
              <tr><td colSpan="7" className="empty-row">No hay ventas registradas</td></tr>
            ) : (
              ventas.slice(0, 10).map(v => (
                <tr key={v._id}>
                  <td><strong>{v.numero_factura}</strong></td>
                  <td>{v.comprador?.nombre}</td>
                  <td>
                    <span className={`tipo-badge ${v.tipo_venta}`}>
                      {v.tipo_venta === 'en_pie' ? 'En Pie' : v.tipo_venta === 'carne' ? 'Carne' : 'Lechón'}
                    </span>
                  </td>
                  <td>{v.cantidad}</td>
                  <td>${v.total?.toLocaleString()}</td>
                  <td>
                    <span className={`estado-pago ${v.estado_pago}`}>
                      {v.estado_pago === 'pagado' ? '✓ Pagado' : v.estado_pago === 'parcial' ? 'Parcial' : 'Pendiente'}
                    </span>
                  </td>
                  <td>
                    {v.estado_pago !== 'pagado' && (
                      <button onClick={() => onRegistrarPago(v._id)} className="btn-xs">
                        Pago
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Modal Nueva Venta */}
      {modalVenta && (
        <div className="modal-overlay">
          <div className="modal-content modal-venta">
            <div className="modal-header">
              <h3>Nueva Venta</h3>
              <button onClick={() => setModalVenta(false)} className="btn-close">×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Tipo de Venta</label>
                <select 
                  value={nuevaVenta.tipo_venta}
                  onChange={(e) => {
                    const tipo = tiposVenta.find(t => t.value === e.target.value)
                    setNuevaVenta({
                      ...nuevaVenta, 
                      tipo_venta: e.target.value,
                      precio_kg: tipo.precio
                    })
                  }}
                >
                  {tiposVenta.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>Nombre del Comprador</label>
                <input 
                  type="text"
                  value={nuevaVenta.comprador.nombre}
                  onChange={(e) => setNuevaVenta({
                    ...nuevaVenta,
                    comprador: { ...nuevaVenta.comprador, nombre: e.target.value }
                  })}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Teléfono</label>
                <input 
                  type="tel"
                  value={nuevaVenta.comprador.telefono}
                  onChange={(e) => setNuevaVenta({
                    ...nuevaVenta,
                    comprador: { ...nuevaVenta.comprador, telefono: e.target.value }
                  })}
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Cantidad</label>
                  <input 
                    type="number"
                    min="1"
                    value={nuevaVenta.cantidad}
                    onChange={(e) => setNuevaVenta({...nuevaVenta, cantidad: numVal(e.target.value)})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Peso Total (kg)</label>
                  <input 
                    type="number"
                    step="0.1"
                    value={nuevaVenta.peso_total_kg}
                    onChange={(e) => setNuevaVenta({...nuevaVenta, peso_total_kg: numVal(e.target.value, true)})}
                    required
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Precio por Kg</label>
                  <input 
                    type="number"
                    value={nuevaVenta.precio_kg}
                    onChange={(e) => setNuevaVenta({...nuevaVenta, precio_kg: numVal(e.target.value)})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Total Estimado</label>
                  <input 
                    type="text"
                    value={`$${(nuevaVenta.peso_total_kg * nuevaVenta.precio_kg).toLocaleString()}`}
                    disabled
                  />
                </div>
              </div>
              
              <div className="modal-actions">
                <button type="button" onClick={() => setModalVenta(false)} className="btn-cancelar">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Registrar Venta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// COMPONENTE: PANEL DE CONTABILIDAD
// ═══════════════════════════════════════════════════════════════════════

const PanelContabilidad = ({ resumen, comparativo, onNuevoCosto }) => {
  const [modalCosto, setModalCosto] = useState(false)
  const [nuevoCosto, setNuevoCosto] = useState({
    tipo_costo: 'directo',
    categoria: 'alimento_concentrado',
    descripcion: '',
    cantidad: 1,
    unidad: 'kg',
    precio_unitario: 0
  })
  
  const categorias = {
    directo: [
      { value: 'alimento_concentrado', label: 'Alimento Concentrado' },
      { value: 'medicamentos', label: 'Medicamentos' },
      { value: 'vacunas', label: 'Vacunas' },
      { value: 'vitaminas', label: 'Vitaminas' }
    ],
    indirecto: [
      { value: 'agua', label: 'Agua' },
      { value: 'electricidad', label: 'Electricidad' },
      { value: 'transporte', label: 'Transporte' },
      { value: 'mantenimiento_equipos', label: 'Mantenimiento' }
    ],
    fijo: [
      { value: 'arriendo', label: 'Arriendo' },
      { value: 'administracion', label: 'Administración' },
      { value: 'seguros', label: 'Seguros' }
    ]
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    await onNuevoCosto(nuevoCosto)
    setModalCosto(false)
  }
  
  return (
    <div className="panel-contabilidad">
      <div className="section-header">
        <h2><IconContabilidad size={20} /> Contabilidad</h2>
        <button onClick={() => setModalCosto(true)} className="btn-primary btn-sm">
          + Registrar Costo
        </button>
      </div>
      
      {/* Estado de Resultados */}
      <div className="contabilidad-resumen">
        <div className="resumen-card ingresos">
          <div className="resumen-icon">📈</div>
          <div className="resumen-info">
            <span className="resumen-label">Ingresos</span>
            <span className="resumen-valor">${(resumen?.ingresos?.total || 0).toLocaleString()}</span>
          </div>
        </div>
        
        <div className="resumen-card costos">
          <div className="resumen-icon">📉</div>
          <div className="resumen-info">
            <span className="resumen-label">Costos</span>
            <span className="resumen-valor">${(resumen?.costos?.total || 0).toLocaleString()}</span>
          </div>
        </div>
        
        <div className={`resumen-card utilidad ${resumen?.resultado?.estado || 'ganancia'}`}>
          <div className="resumen-icon">{resumen?.resultado?.estado === 'ganancia' ? '✓' : '!'}</div>
          <div className="resumen-info">
            <span className="resumen-label">Utilidad</span>
            <span className="resumen-valor">${(resumen?.resultado?.utilidad_bruta || 0).toLocaleString()}</span>
            <span className="resumen-porcentaje">{resumen?.resultado?.margen_porcentaje || 0}%</span>
          </div>
        </div>
      </div>
      
      {/* Desglose de Costos */}
      <div className="costos-desglose">
        <h3>Desglose de Costos - {resumen?.periodo?.nombre_mes}</h3>
        <div className="costos-categorias">
          {resumen?.costos?.por_categoria?.map(cat => (
            <div key={cat._id} className="categoria-item">
              <span className="cat-nombre">{cat._id.replace('_', ' ')}</span>
              <span className="cat-valor">${cat.total.toLocaleString()}</span>
              <div className="cat-barra">
                <div 
                  className="cat-progreso"
                  style={{ width: `${Math.min((cat.total / (resumen?.costos?.total || 1)) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Gráfico Comparativo */}
      {comparativo && comparativo.length > 0 && (
        <div className="comparativo-mensual">
          <h3>Comparativo Últimos Meses</h3>
          <div className="grafico-barras">
            {comparativo.map(mes => (
              <div key={`${mes.mes}-${mes.año}`} className="barra-grupo">
                <div className="barras">
                  <div 
                    className="barra ingresos" 
                    style={{ height: `${Math.min((mes.ingresos / Math.max(...comparativo.map(m => m.ingresos || 1))) * 100, 100)}%` }}
                    title={`Ingresos: $${mes.ingresos.toLocaleString()}`}
                  ></div>
                  <div 
                    className="barra costos"
                    style={{ height: `${Math.min((mes.costos / Math.max(...comparativo.map(m => m.ingresos || 1))) * 100, 100)}%` }}
                    title={`Costos: $${mes.costos.toLocaleString()}`}
                  ></div>
                </div>
                <span className="mes-label">{mes.nombre}</span>
              </div>
            ))}
          </div>
          <div className="grafico-leyenda">
            <span><span className="dot ingresos"></span> Ingresos</span>
            <span><span className="dot costos"></span> Costos</span>
          </div>
        </div>
      )}
      
      {/* Modal Nuevo Costo */}
      {modalCosto && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Registrar Costo</h3>
              <button onClick={() => setModalCosto(false)} className="btn-close">×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Tipo de Costo</label>
                <select 
                  value={nuevoCosto.tipo_costo}
                  onChange={(e) => setNuevoCosto({
                    ...nuevoCosto, 
                    tipo_costo: e.target.value,
                    categoria: categorias[e.target.value][0].value
                  })}
                >
                  <option value="directo">Costo Directo</option>
                  <option value="indirecto">Costo Indirecto</option>
                  <option value="fijo">Costo Fijo</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Categoría</label>
                <select 
                  value={nuevoCosto.categoria}
                  onChange={(e) => setNuevoCosto({...nuevoCosto, categoria: e.target.value})}
                >
                  {categorias[nuevoCosto.tipo_costo].map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label>Descripción</label>
                <input 
                  type="text"
                  value={nuevoCosto.descripcion}
                  onChange={(e) => setNuevoCosto({...nuevoCosto, descripcion: e.target.value})}
                  placeholder="Ej: Bulto concentrado 40kg"
                  required
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Cantidad</label>
                  <input 
                    type="number"
                    min="1"
                    value={nuevoCosto.cantidad}
                    onChange={(e) => setNuevoCosto({...nuevoCosto, cantidad: numVal(e.target.value)})}
                  />
                </div>
                <div className="form-group">
                  <label>Precio Unitario</label>
                  <input 
                    type="number"
                    value={nuevoCosto.precio_unitario}
                    onChange={(e) => setNuevoCosto({...nuevoCosto, precio_unitario: numVal(e.target.value)})}
                    required
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Total</label>
                <input 
                  type="text"
                  value={`$${(nuevoCosto.cantidad * nuevoCosto.precio_unitario).toLocaleString()}`}
                  disabled
                />
              </div>
              
              <div className="modal-actions">
                <button type="button" onClick={() => setModalCosto(false)} className="btn-cancelar">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// COMPONENTE: PANEL DE INVENTARIO
// ═══════════════════════════════════════════════════════════════════════

const PanelInventario = ({ inventario, estadisticas, onNuevoCerdo, onEliminarCerdo, lotes = [], onActualizarLote }) => {
  const [modalCerdo, setModalCerdo] = useState(false)
  const [nuevoCerdo, setNuevoCerdo] = useState({
    tipo: 'engorde',
    sexo: 'macho',
    peso_actual: 0,
    corral: '',
    origen: 'nacido_granja'
  })
  const [editandoCerdos, setEditandoCerdos] = useState(null)
  const [cantidadEdit, setCantidadEdit] = useState('')

  const guardarCantidadCerdos = async (loteId) => {
    const n = parseInt(cantidadEdit)
    if (isNaN(n) || n < 0) return
    if (onActualizarLote) await onActualizarLote(loteId, { cantidad_cerdos: n })
    setEditandoCerdos(null)
  }
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    await onNuevoCerdo(nuevoCerdo)
    setModalCerdo(false)
  }
  
  return (
    <div className="panel-inventario">
      <div className="section-header">
        <h2><IconInventario size={20} /> Inventario de Cerdos</h2>
        <button onClick={() => setModalCerdo(true)} className="btn-primary btn-sm">
          + Nuevo Cerdo
        </button>
      </div>
      
      {/* Estadísticas */}
      <div className="inventario-stats">
        <div className="stat-box">
          <IconCerdo size={24} />
          <div>
            <span className="stat-numero">{estadisticas?.total_activos || 0}</span>
            <span className="stat-label">Total Activos</span>
          </div>
        </div>
        <div className="stat-box">
          <span className="stat-numero">{estadisticas?.peso_total_kg?.toLocaleString() || 0}</span>
          <span className="stat-label">Kg Totales</span>
        </div>
      </div>
      
      {/* Tabla por Lote */}
      <div className="tabla-container" style={{marginBottom: '24px'}}>
        <h3 style={{margin: '16px 0 10px', fontSize: '15px', fontWeight: '600'}}>Cerdos por Lote</h3>
        <table className="tabla-inventario">
          <thead>
            <tr>
              <th>Lote / Grupo</th>
              <th>Cerdos</th>
              <th>Peso Prom.</th>
              <th>Peso Total</th>
              <th>Edad</th>
              <th>Fase</th>
              <th>Corral</th>
              <th>Ingresó</th>
            </tr>
          </thead>
          <tbody>
            {lotes.length === 0 ? (
              <tr><td colSpan="8" className="empty-row">No hay lotes activos</td></tr>
            ) : (
              lotes.map(lote => {
                const pesoTotal = (lote.cantidad_cerdos || 0) * (lote.peso_promedio_actual || 0)
                const edadDias = lote.edad_dias || Math.floor((Date.now() - new Date(lote.fecha_inicio)) / (1000*60*60*24))
                const fase = getEtapaAutomatica(edadDias)
                const fechaIngreso = lote.fecha_inicio ? new Date(lote.fecha_inicio).toLocaleDateString('es-CO') : '-'
                const faseColor = fase === 'inicio' ? '#3b82f6' : fase === 'crecimiento' ? '#f59e0b' : '#16a34a'
                return (
                  <tr key={lote._id}>
                    <td><strong>{lote.nombre}</strong></td>
                    <td>
                      {editandoCerdos === lote._id ? (
                        <span style={{display:'flex', alignItems:'center', gap:'4px'}}>
                          <input type="number" value={cantidadEdit}
                            onChange={e => setCantidadEdit(e.target.value)}
                            style={{width:'60px', padding:'2px 6px', borderRadius:'4px', border:'1px solid #3b82f6', fontSize:'13px'}}
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') guardarCantidadCerdos(lote._id); if (e.key === 'Escape') setEditandoCerdos(null) }}
                          />
                          <button onClick={() => guardarCantidadCerdos(lote._id)} style={{background:'#16a34a', color:'#fff', border:'none', borderRadius:'4px', padding:'2px 6px', cursor:'pointer', fontSize:'12px'}}>✓</button>
                          <button onClick={() => setEditandoCerdos(null)} style={{background:'#94a3b8', color:'#fff', border:'none', borderRadius:'4px', padding:'2px 6px', cursor:'pointer', fontSize:'12px'}}>✕</button>
                        </span>
                      ) : (
                        <span style={{display:'flex', alignItems:'center', gap:'6px'}}>
                          <strong style={{color:'#1d4ed8'}}>{lote.cantidad_cerdos}</strong>
                          <button title="Corregir cantidad" onClick={() => { setEditandoCerdos(lote._id); setCantidadEdit(lote.cantidad_cerdos || '') }}
                            style={{background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:'1px', lineHeight:1, fontSize:'11px'}}>✎</button>
                        </span>
                      )}
                    </td>
                    <td>{(lote.peso_promedio_actual || 0).toFixed(1)} kg</td>
                    <td><strong>{pesoTotal.toFixed(0)} kg</strong></td>
                    <td>{edadDias} días</td>
                    <td><span style={{background: faseColor, color:'#fff', padding:'2px 8px', borderRadius:'8px', fontSize:'12px', fontWeight:'700'}}>{fase}</span></td>
                    <td>{lote.corral || '-'}</td>
                    <td style={{fontSize:'12px', color:'#64748b'}}>{fechaIngreso}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Registros individuales (si los hay) */}
      {inventario.length > 0 && (
        <div className="tabla-container">
          <h3 style={{margin: '0 0 10px', fontSize: '15px', fontWeight: '600'}}>Registros Individuales</h3>
          <table className="tabla-inventario">
            <thead>
              <tr>
                <th>Código</th>
                <th>Tipo</th>
                <th>Sexo</th>
                <th>Peso</th>
                <th>Corral</th>
                <th>Salud</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {inventario.slice(0, 15).map(c => (
                <tr key={c._id}>
                  <td><strong>{c.codigo}</strong></td>
                  <td>{c.tipo}</td>
                  <td>{c.sexo === 'macho' ? '♂' : '♀'}</td>
                  <td>{c.peso_actual} kg</td>
                  <td>{c.corral || '-'}</td>
                  <td>
                    <span className={`salud-badge ${c.estado_salud}`}>
                      {c.estado_salud}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn-icon btn-danger"
                      title="Eliminar cerdo"
                      onClick={() => onEliminarCerdo && onEliminarCerdo(c._id, c.codigo)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Modal Nuevo Cerdo */}
      {modalCerdo && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Registrar Cerdo</h3>
              <button onClick={() => setModalCerdo(false)} className="btn-close">×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Tipo</label>
                  <select 
                    value={nuevoCerdo.tipo}
                    onChange={(e) => setNuevoCerdo({...nuevoCerdo, tipo: e.target.value})}
                  >
                    <option value="lechon">Lechón</option>
                    <option value="levante">Levante</option>
                    <option value="engorde">Engorde</option>
                    <option value="cerda_gestante">Cerda Gestante</option>
                    <option value="cerda_lactante">Cerda Lactante</option>
                    <option value="reproductor">Reproductor</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Sexo</label>
                  <select 
                    value={nuevoCerdo.sexo}
                    onChange={(e) => setNuevoCerdo({...nuevoCerdo, sexo: e.target.value})}
                  >
                    <option value="macho">Macho ♂</option>
                    <option value="hembra">Hembra ♀</option>
                  </select>
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Peso Actual (kg)</label>
                  <input 
                    type="number"
                    step="0.1"
                    value={nuevoCerdo.peso_actual}
                    onChange={(e) => setNuevoCerdo({...nuevoCerdo, peso_actual: numVal(e.target.value, true)})}
                  />
                </div>
                <div className="form-group">
                  <label>Corral</label>
                  <input 
                    type="text"
                    value={nuevoCerdo.corral}
                    onChange={(e) => setNuevoCerdo({...nuevoCerdo, corral: e.target.value})}
                    placeholder="Ej: Corral 1"
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Origen</label>
                <select 
                  value={nuevoCerdo.origen}
                  onChange={(e) => setNuevoCerdo({...nuevoCerdo, origen: e.target.value})}
                >
                  <option value="nacido_granja">Nacido en Granja</option>
                  <option value="comprado">Comprado</option>
                </select>
              </div>
              
              <div className="modal-actions">
                <button type="button" onClick={() => setModalCerdo(false)} className="btn-cancelar">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
function App() {

  // ... (tus imports de arriba se mantienen igual)

// 1. CREAMOS EL COMPONENTE DE MANTENIMIENTO (Ponlo fuera de la función App)
const PantallaMantenimiento = () => (
  <div style={{
    height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#f4f7f6', fontFamily: 'sans-serif', textAlign: 'center', padding: '20px'
  }}>
    <div style={{
      background: 'white', padding: '40px', borderRadius: '15px', 
      boxShadow: '0 10px 25px rgba(0,0,0,0.1)', maxWidth: '450px'
    }}>
      <div style={{ fontSize: '60px', marginBottom: '20px' }}>🛠️</div>
      <h1 style={{ color: '#2c3e50', margin: '0 0 15px' }}>¡Volvemos pronto!</h1>
      <p style={{ color: '#7f8c8d', lineHeight: '1.6' }}>
        Estamos realizando mejoras técnicas en el <strong>Sistema de Automatización IOT</strong>. 
        Disculpa las molestias, regresaremos en unos minutos.
      </p>
      <div className="loader-mantenimiento"></div>
      <p style={{ fontSize: '12px', color: '#bdc3c7', marginTop: '20px' }}>EQUIPO COO ALIANZAS</p>
    </div>
    <style>{`
      .loader-mantenimiento {
        border: 4px solid #f3f3f3; border-top: 4px solid #3498db;
        border-radius: 50%; width: 30px; height: 30px;
        animation: spin 1s linear infinite; margin: 20px auto;
      }
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `}</style>
  </div>
);

  // ═══════════════════════════════════════════════════════════════════════
  // INTERRUPTOR DE MANTENIMIENTO
  // ═══════════════════════════════════════════════════════════════════════
  const [enMantenimiento, setEnMantenimiento] = useState(false); // <--- CAMBIA A false PARA ACTIVAR LA WEB

  // Si el mantenimiento está activo, mostramos la pantalla y cortamos la ejecución aquí
  if (enMantenimiento) {
    return <PantallaMantenimiento />;
  }


 
  // Estados de autenticación
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('token') || null)
  
  // Estados de login
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [errorLogin, setErrorLogin] = useState('')
  const [cargando, setCargando] = useState(false)
  const [conflictoSesion, setConflictoSesion] = useState(null)
  const [captchaToken, setCaptchaToken] = useState(null)
  const [recordarSesion, setRecordarSesion] = useState(false)
  const captchaRef = useRef(null)
  
  // Estados de navegación
  const [pagina, setPagina] = useState('dashboard')
  const [menuAbierto, setMenuAbierto] = useState(window.innerWidth > 1024)
  
  // Estados de datos
  const [clima, setClima] = useState({ temp: null, humedad: null })
  const [porqueriza, setPorqueriza] = useState({ temp: null, humedad: null, conectado: false })
  const [flujo, setFlujo] = useState({ caudal: 0, volumen_diario: 0, conectado: false })
  const [alertas, setAlertas] = useState([])
  const [ultimoPeso, setUltimoPeso] = useState(null)
  
  // Estados de lotes
  const [lotes, setLotes] = useState([])
  const [loteSeleccionado, setLoteSeleccionado] = useState(null)
  const [mostrarModalLote, setMostrarModalLote] = useState(false)
  const [nuevoLote, setNuevoLote] = useState({
    nombre: '',
    cantidad_cerdos: 0,
    peso_inicial_promedio: 0,
    notas: ''
  })
const [loteDetalle, setLoteDetalle] = useState(null)
const [editandoCerdosDetalle, setEditandoCerdosDetalle] = useState(false)
const [cantidadCerdosEdit, setCantidadCerdosEdit] = useState('')
const [alimentacionLote, setAlimentacionLote] = useState([])
const [graficaEvolucionLote, setGraficaEvolucionLote] = useState([])
const [mostrarTablaFinca, setMostrarTablaFinca] = useState(false)
  
  // Estados de pesajes
  const [pesajes, setPesajes] = useState([])
  const [mostrarModalPesaje, setMostrarModalPesaje] = useState(false)
  const [nuevoPesaje, setNuevoPesaje] = useState({ lote: '', notas: '' })
  const [pesosIngresados, setPesosIngresados] = useState([])   // array de números (pesos individuales del pesaje)
  const [pesoInputTmp, setPesoInputTmp]   = useState('')        // campo texto del último peso escrito
  // Para lote creation
  const [pesosLoteInicial, setPesosLoteInicial]  = useState([])
  const [pesoLoteInputTmp, setPesoLoteInputTmp]  = useState('')
  // Estados de báscula en tiempo real
const [pesoLive, setPesoLive] = useState({ peso: 0, estable: false, conectado: false })
const [pesajeLive, setPesajeLive] = useState({ lote: '', cantidad: 1, notas: '' })
  // Estados de contabilidad
  const [contabilidad, setContabilidad] = useState([])
  const [resumenContable, setResumenContable] = useState({
    total_gastos: 0,
    total_ingresos: 0,
    ganancia: 0
  })
  const [mostrarModalContabilidad, setMostrarModalContabilidad] = useState(false)
  const [nuevoRegistro, setNuevoRegistro] = useState({
    lote: '',
    tipo: 'gasto',
    categoria: 'alimento',
    descripcion: '',
    cantidad: 1,
    unidad: 'kg',
    precio_unitario: 0
  })
  
  // Estados de configuración
  const [config, setConfig] = useState({
    precio_agua_litro: 5,
    precio_alimento_kg: 2500,
    precio_venta_kg: 8000,
    umbral_temp_max: 37,
    umbral_temp_critico: 40
  })
  //Estado camaras 
  // Estados de cámaras
const [camaras, setCamaras] = useState([])
const [grabaciones, setGrabaciones] = useState([])

// Estados de ventas
const [ventas, setVentas] = useState([])
const [estadisticasVentas, setEstadisticasVentas] = useState({})

// Estados de costos
const [costos, setCostos] = useState([])
const [resumenCostos, setResumenCostos] = useState({})
const [comparativoCostos, setComparativoCostos] = useState([])

// Estado del panel unificado de finanzas
const [tabFinanzas, setTabFinanzas] = useState('resumen')

// Estados de bombas (CRUD)
const [bombas, setBombas] = useState([])
const [mostrarModalBomba, setMostrarModalBomba] = useState(false)
const [nuevaBomba, setNuevaBomba] = useState({
  nombre: '',
  codigo_bomba: '',
  ubicacion: '',
  descripcion: ''
})
const [bombaEditando, setBombaEditando] = useState(null)
// Estados de inventario
const [inventario, setInventario] = useState([])
const [estadisticasInventario, setEstadisticasInventario] = useState({})

// Estado para tabs de inventario
const [tabInventario, setTabInventario] = useState('cerdos')

// Estados de inventario de alimento (concentrado)
const [inventarioAlimento, setInventarioAlimento] = useState([])
const [resumenInventarioAlimento, setResumenInventarioAlimento] = useState({})
const [mostrarModalAlimento, setMostrarModalAlimento] = useState(false)
const [nuevaMovimientoAlimento, setNuevaMovimientoAlimento] = useState({
  tipo: 'entrada',
  inventario_id: '',
  cantidad_bultos: 0,
  precio_bulto: 0,
  descripcion: ''
})

// Estados para gastos semanales por lote
const [gastosSemanales, setGastosSemanales] = useState([])
const [totalGastosLote, setTotalGastosLote] = useState(0)
const [mostrarFormGasto, setMostrarFormGasto] = useState(false)
const [nuevoGasto, setNuevoGasto] = useState({ descripcion: '', monto: '', categoria: 'otro' })

// Estados para gráficas
const [historicoTemperatura, setHistoricoTemperatura] = useState([])
const [historicoAgua, setHistoricoAgua] = useState([])
const [periodoAgua, setPeriodoAgua] = useState('semanal')
const periodoAguaRef = useRef('semanal')
const [historicoContable, setHistoricoContable] = useState([])
const [historicoPesos, setHistoricoPesos] = useState([])

  // Estados de usuarios (SuperAdmin)
  const [usuarios, setUsuarios] = useState([])
  const [mostrarModalUsuario, setMostrarModalUsuario] = useState(false)
  const [nuevoUsuario, setNuevoUsuario] = useState({
    usuario: '',
    correo: '',
    password: '',
    rol: 'cliente'
  })


// Estados alimentación desde inventario (modal en lote detalle)
const [mostrarModalAlimInv, setMostrarModalAlimInv] = useState(false)
const [nuevaAlimInv, setNuevaAlimInv] = useState({ inventario_id: '', cantidad_kg: '', notas: '' })
const [cargandoAlimInv, setCargandoAlimInv] = useState(false)

// Estados consumo histórico semanal (superadmin)
const [mostrarModalHistorico, setMostrarModalHistorico] = useState(false)
const [nuevoHistorico, setNuevoHistorico] = useState({ semana_iso: '', cantidad_kg: '', precio_kg: '', notas: '', tipo_alimento: 'iniciador' })
const [cargandoHistorico, setCargandoHistorico] = useState(false)

// Estados para crear nuevo producto de inventario alimento
const [mostrarModalNuevoProducto, setMostrarModalNuevoProducto] = useState(false)
const [nuevoProductoAlimento, setNuevoProductoAlimento] = useState({
  nombre: '',
  tipo: 'universa',
  precio_bulto: '',
  peso_por_bulto_kg: 40,
  stock_minimo_bultos: 1
})

// Refs para cerrar paneles al click fuera
const userPanelRef = useRef(null)
const notifPanelRef = useRef(null)

// Estados para notificaciones y config usuario
const [mostrarNotificaciones, setMostrarNotificaciones] = useState(false)
const [alertasLeidas, setAlertasLeidas] = useState(0)
// Recordatorios locales (guardados en localStorage)
const [recordatorios, setRecordatorios] = useState(() => {
  try { return JSON.parse(localStorage.getItem('coo_recordatorios') || '[]') } catch { return [] }
})
const [mostrarFormRecordatorio, setMostrarFormRecordatorio] = useState(false)
const [nuevoRecordatorio, setNuevoRecordatorio] = useState({ titulo: '', fecha: '', hora: '', descripcion: '' })
const [alertasCumplidas, setAlertasCumplidas] = useState(() => {
  try { return JSON.parse(localStorage.getItem('coo_alertas_cumplidas') || '{}') } catch { return {} }
})
const toggleAlertaCumplida = (key) => {
  setAlertasCumplidas(prev => {
    const next = { ...prev, [key]: !prev[key] }
    try { localStorage.setItem('coo_alertas_cumplidas', JSON.stringify(next)) } catch {}
    return next
  })
}
const _getAlertasLeidasTs = () => { try { return localStorage.getItem('coo_alertas_ts') || null } catch { return null } }
const _setAlertasLeidasTs = () => { try { localStorage.setItem('coo_alertas_ts', new Date().toISOString()) } catch {} }
const [mostrarConfigUsuario, setMostrarConfigUsuario] = useState(false)
const [configUsuarioForm, setConfigUsuarioForm] = useState({ usuario: '', correo: '', password_actual: '', password_nuevo: '' })

  // ═══════════════════════════════════════════════════════════════════════
  // EFECTOS
  // ═══════════════════════════════════════════════════════════════════════

  // Cerrar paneles flotantes al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userPanelRef.current && !userPanelRef.current.contains(e.target)) {
        setMostrarConfigUsuario(false)
      }
      if (notifPanelRef.current && !notifPanelRef.current.contains(e.target)) {
        setMostrarNotificaciones(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Verificar token al cargar
  useEffect(() => {
    if (token) {
      verificarToken()
    }
  }, [])

  // Cargar datos cuando hay usuario
  useEffect(() => {
    if (user) {
      cargarDatos()
      const interval = setInterval(cargarDatos, 30000)
      return () => clearInterval(interval)
    }
  }, [user])

  // Suscripción a Web Push (VAPID) cuando el usuario inicia sesión
  useEffect(() => {
    if (!user || !token) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    const suscribirPush = async () => {
      try {
        // Registrar el Service Worker
        const reg = await navigator.serviceWorker.register('/sw.js')

        // Pedir permiso de notificaciones
        const permiso = await Notification.requestPermission()
        if (permiso !== 'granted') return

        // Obtener clave VAPID pública del backend
        const { data } = await axios.get(`${API_URL}/api/push/vapid-public-key`)
        if (!data.publicKey) return

        // Convertir la clave pública a Uint8Array
        const vapidKey = Uint8Array.from(
          atob(data.publicKey.replace(/-/g, '+').replace(/_/g, '/')),
          c => c.charCodeAt(0)
        )

        // Suscribirse al push manager
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKey
        })

        // Enviar suscripción al backend
        await axios.post(
          `${API_URL}/api/push/subscribe`,
          { subscription: sub.toJSON(), usuario: user.username || user.email || '', dispositivo: 'web' },
          { headers: { Authorization: `Bearer ${token}` } }
        )
        console.log('[PUSH] Suscripción registrada correctamente')
      } catch (err) {
        console.log('[PUSH] No se pudo suscribir:', err.message)
      }
    }

    suscribirPush()
  }, [user])

  // Recalcular gráfica de pesos cuando pesajes cambian
  useEffect(() => {
    if (pesajes.length > 0) cargarHistoricoPesos()
  }, [pesajes])

// WebSocket
  useEffect(() => {
    // 1. Escuchar actualizaciones generales (Sensores de Porqueriza y Agua)
    socket.on('lectura_actualizada', (data) => {
      // Manejo de Temperatura/Humedad
      if (data.temperatura) {
        setPorqueriza(prev => ({ 
          ...prev, 
          temp: data.temperatura, 
          humedad: data.humedad, 
          conectado: true 
        }));
      }
      
      // Manejo de Flujo de Agua (CORREGIDO: volumen_diario sin la "L")
      if (data.volumen_diario !== undefined || data.caudal_l_min !== undefined) {
        setFlujo(prev => ({ 
          ...prev, 
          caudal: data.caudal_l_min, 
          volumen_diario: data.volumen_diario, 
          conectado: true 
        }));
      }
    });

    // 2. Otros eventos del sistema
    socket.on('flujo_actualizado', (data) => {
      setFlujo({
        caudal: data.caudal,
        volumen_diario: data.volumen_diario,
        conectado: true
      });
    });

    socket.on('nuevo_peso', (data) => {
      setUltimoPeso(data);
      cargarPesajes();
    });

    socket.on('peso_live', (data) => {
      setPesoLive({
        peso: data.peso,
        estable: data.estable,
        conectado: true
      });
    });

    socket.on('bomba_actualizada', (data) => {
      cargarBombas();
    });

    // Limpieza de todos los eventos al cerrar el componente
    return () => {
      socket.off('lectura_actualizada');
      socket.off('nuevo_peso');
      socket.off('bomba_actualizada');
      socket.off('peso_live');
      socket.off('flujo_actualizado');
    };
  }, []); // El array vacío asegura que esto solo se ejecute una vez
  // ═══════════════════════════════════════════════════════════════════════
  // FUNCIONES DE AUTENTICACIÓN
  // ═══════════════════════════════════════════════════════════════════════

  const verificarToken = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUser(res.data)
    } catch (error) {
      localStorage.removeItem('token')
      setToken(null)
      setUser(null)
    }
  }

  const handleLogin = async (e, forzar = false) => {
    if (e) e.preventDefault()
    setErrorLogin('')
    setCargando(true)

    try {
      const res = await axios.post(`${API_URL}/api/users/login`, {
        usuario,
        password,
        forzar,
        captchaToken,
        recordar: recordarSesion
      })

      const { token: nuevoToken, usuario: userData } = res.data
      localStorage.setItem('token', nuevoToken)
      setToken(nuevoToken)
      setUser(userData)
      setUsuario('')
      setPassword('')
      setConflictoSesion(null)
      setCaptchaToken(null)
    } catch (error) {
      if (error.response?.status === 409) {
        setConflictoSesion(error.response.data.sesion_existente)
      } else {
        setErrorLogin(error.response?.data?.mensaje || 'Error al iniciar sesión')
        // Reset captcha on error
        if (captchaRef.current) captchaRef.current.reset()
        setCaptchaToken(null)
      }
    } finally {
      setCargando(false)
    }
  }

  const handleLogout = async () => {
    try {
      await axios.post(`${API_URL}/api/sessions/logout`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
    } catch (error) {
      console.error('Error cerrando sesión:', error)
    }
    
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
    setPagina('dashboard')
  }

  const cambiarPasswordUsuario = async () => {
    if (!configUsuarioForm.password_actual || !configUsuarioForm.password_nuevo) {
      alert('Completa ambos campos de contraseña')
      return
    }
    if (configUsuarioForm.password_nuevo.length < 6) {
      alert('La nueva contraseña debe tener al menos 6 caracteres')
      return
    }
    try {
      const res = await axios.put(`${API_URL}/api/users/me/password`, {
        password_actual: configUsuarioForm.password_actual,
        password_nuevo: configUsuarioForm.password_nuevo
      }, { headers: { Authorization: `Bearer ${token}` } })
      alert(res.data.mensaje)
      setConfigUsuarioForm({ ...configUsuarioForm, password_actual: '', password_nuevo: '' })
      handleLogout()
    } catch (error) {
      alert(error.response?.data?.mensaje || 'Error cambiando contraseña')
    }
  }

  const actualizarPerfilUsuario = async () => {
    try {
      const datos = {}
      if (configUsuarioForm.usuario && configUsuarioForm.usuario !== user.usuario) datos.usuario = configUsuarioForm.usuario
      if (configUsuarioForm.correo && configUsuarioForm.correo !== user.correo) datos.correo = configUsuarioForm.correo
      if (Object.keys(datos).length === 0) { alert('No hay cambios'); return }

      const res = await axios.put(`${API_URL}/api/users/me/perfil`, datos, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUser({ ...user, ...res.data.user })
      alert('Perfil actualizado')
    } catch (error) {
      alert(error.response?.data?.mensaje || 'Error actualizando perfil')
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FUNCIONES DE CARGA DE DATOS
  // ═══════════════════════════════════════════════════════════════════════

  const cargarDatos = async () => {
  await Promise.all([
    cargarClima(),
    cargarPorqueriza(),
    cargarFlujo(),
    cargarBombas(),
    cargarAlertas(),
    cargarLotes(),
    cargarPesajes(),
    cargarContabilidad(),
    cargarConfig(),
    cargarCamaras(),
    cargarVentas(),
    cargarCostos(),
    cargarInventario(),
    cargarInventarioAlimento()
  ])
  
  // Cargar datos para gráficas después de tener los datos base
  cargarHistoricoTemperatura()
  cargarHistoricoAgua()
  cargarHistoricoContable()
  // cargarHistoricoPesos se llama desde useEffect cuando pesajes cambia
  
  if (user?.rol === 'superadmin' || user?.rol === 'ingeniero') {
    cargarUsuarios()
  }
}
const cargarCamaras = async () => {
  try {
    const res = await axios.get(`${API_URL}/api/camaras`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    setCamaras(res.data)
    
    const grabRes = await axios.get(`${API_URL}/api/grabaciones?limite=10`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    setGrabaciones(grabRes.data)
  } catch (error) {
    console.error('Error cargando cámaras:', error)
  }
}

const cargarVentas = async () => {
  try {
    const res = await axios.get(`${API_URL}/api/ventas`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    setVentas(res.data)
    
    const statsRes = await axios.get(`${API_URL}/api/ventas/estadisticas`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    setEstadisticasVentas(statsRes.data)
  } catch (error) {
    console.error('Error cargando ventas:', error)
  }
}

const cargarCostos = async () => {
  try {
    const res = await axios.get(`${API_URL}/api/costos`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    setCostos(res.data)
    
    const resumenRes = await axios.get(`${API_URL}/api/costos/resumen`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    setResumenCostos(resumenRes.data)
    
    const compRes = await axios.get(`${API_URL}/api/costos/comparativo`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    setComparativoCostos(compRes.data)
  } catch (error) {
    console.error('Error cargando costos:', error)
  }
}

const cargarInventario = async () => {
  try {
    const res = await axios.get(`${API_URL}/api/inventario`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    setInventario(res.data)
    
    const statsRes = await axios.get(`${API_URL}/api/inventario/estadisticas`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    setEstadisticasInventario(statsRes.data)
  } catch (error) {
    console.error('Error cargando inventario:', error)
  }
}

const cargarInventarioAlimento = async () => {
  try {
    const res = await axios.get(`${API_URL}/api/inventario-alimento`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    setInventarioAlimento(res.data)
    
    const resumenRes = await axios.get(`${API_URL}/api/inventario-alimento/resumen`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    setResumenInventarioAlimento(resumenRes.data)
  } catch (error) {
    console.error('Error cargando inventario de alimento:', error)
  }
}

const registrarMovimientoAlimento = async () => {
  if (!nuevaMovimientoAlimento.inventario_id) {
    alert('Selecciona un producto de alimento')
    return
  }
  if (!nuevaMovimientoAlimento.cantidad_bultos || nuevaMovimientoAlimento.cantidad_bultos <= 0) {
    alert('La cantidad de bultos debe ser mayor a 0')
    return
  }

  try {
    await axios.post(
      `${API_URL}/api/inventario-alimento/${nuevaMovimientoAlimento.inventario_id}/entrada`,
      {
        cantidad_bultos: nuevaMovimientoAlimento.cantidad_bultos,
        precio_bulto: nuevaMovimientoAlimento.precio_bulto,
        descripcion: nuevaMovimientoAlimento.descripcion
      },
      { headers: { Authorization: `Bearer ${token}` } }
    )
    setMostrarModalAlimento(false)
    setNuevaMovimientoAlimento({ tipo: 'entrada', inventario_id: '', cantidad_bultos: 0, precio_bulto: 0, descripcion: '' })
    await cargarInventarioAlimento()
    alert('✓ Entrada registrada correctamente')
  } catch (error) {
    alert('Error: ' + (error.response?.data?.mensaje || error.message))
  }
}

const crearNuevoProductoAlimento = async () => {
  if (!nuevoProductoAlimento.nombre.trim()) {
    alert('El nombre del producto es requerido')
    return
  }
  if (!nuevoProductoAlimento.precio_bulto || nuevoProductoAlimento.precio_bulto <= 0) {
    alert('El precio por bulto debe ser mayor a 0')
    return
  }
  try {
    await axios.post(`${API_URL}/api/inventario-alimento`, {
      nombre: nuevoProductoAlimento.nombre.trim(),
      tipo: nuevoProductoAlimento.tipo,
      precio_bulto: Number(nuevoProductoAlimento.precio_bulto),
      peso_por_bulto_kg: Number(nuevoProductoAlimento.peso_por_bulto_kg) || 40,
      stock_minimo_bultos: Number(nuevoProductoAlimento.stock_minimo_bultos) || 5,
      cantidad_bultos: 0
    }, {
      headers: { Authorization: `Bearer ${token}` }
    })
    setMostrarModalNuevoProducto(false)
    setNuevoProductoAlimento({ nombre: '', tipo: 'universa', precio_bulto: '', peso_por_bulto_kg: 40, stock_minimo_bultos: 1 })
    await cargarInventarioAlimento()
    alert('✓ Producto creado correctamente. Ahora registra una Entrada para agregar stock.')
  } catch (error) {
    alert('Error: ' + (error.response?.data?.mensaje || error.message))
  }
}

// Funciones para acciones
const crearVenta = async (datos) => {
  try {
    // Validar campos requeridos
    if (!datos.comprador?.nombre) {
      alert('El nombre del comprador es requerido')
      return
    }
    if (!datos.peso_total_kg || datos.peso_total_kg <= 0) {
      alert('El peso total debe ser mayor a 0')
      return
    }
    if (!datos.precio_kg || datos.precio_kg <= 0) {
      alert('El precio por kg debe ser mayor a 0')
      return
    }
    
    await axios.post(`${API_URL}/api/ventas`, datos, {
      headers: { Authorization: `Bearer ${token}` }
    })
    cargarVentas()
    alert('Venta registrada correctamente')
  } catch (error) {
    alert('Error creando venta: ' + (error.response?.data?.mensaje || error.message))
  }
}

const registrarPagoVenta = async (id) => {
  const monto = prompt('Monto del pago:')
  if (!monto) return
  try {
    await axios.post(`${API_URL}/api/ventas/${id}/pago`, { monto: parseFloat(monto) }, {
      headers: { Authorization: `Bearer ${token}` }
    })
    cargarVentas()
  } catch (error) {
    alert('Error registrando pago: ' + (error.response?.data?.mensaje || error.message))
  }
}

const crearCosto = async (datos) => {
  try {
    // Validar campos requeridos
    if (!datos.descripcion || datos.descripcion.trim() === '') {
      alert('La descripción es requerida')
      return
    }
    if (!datos.precio_unitario || datos.precio_unitario <= 0) {
      alert('El precio unitario debe ser mayor a 0')
      return
    }
    
    await axios.post(`${API_URL}/api/costos`, datos, {
      headers: { Authorization: `Bearer ${token}` }
    })
    cargarCostos()
    alert('Costo registrado correctamente')
  } catch (error) {
    alert('Error creando costo: ' + (error.response?.data?.mensaje || error.message))
  }
}

const crearCerdo = async (datos) => {
  try {
    // Si hay un lote activo seleccionado, vincular el cerdo automáticamente
    const payload = { ...datos }
    if (loteDetalle?._id) payload.lote = loteDetalle._id
    await axios.post(`${API_URL}/api/inventario`, payload, {
      headers: { Authorization: `Bearer ${token}` }
    })
    cargarInventario()
    // Refrescar el lote para reflejar el nuevo cantidad_cerdos
    if (loteDetalle?._id) verDetalleLote(loteDetalle._id)
  } catch (error) {
    alert('Error registrando cerdo: ' + (error.response?.data?.mensaje || error.message))
  }
}

const eliminarCerdo = async (id, codigo) => {
  if (!confirm(`¿Eliminar el cerdo ${codigo}? Esta acción no se puede deshacer.`)) return
  try {
    await axios.delete(`${API_URL}/api/inventario/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    cargarInventario()
    // Refrescar lote si hay uno seleccionado
    if (loteDetalle?._id) verDetalleLote(loteDetalle._id)
  } catch (error) {
    alert('Error eliminando cerdo: ' + (error.response?.data?.mensaje || error.message))
  }
}

const capturarFotoCamara = async (codigo) => {
  try {
    await axios.post(`${API_URL}/api/grabaciones/foto`, { camara_codigo: codigo }, {
      headers: { Authorization: `Bearer ${token}` }
    })
    cargarCamaras()
    alert('Foto capturada')
  } catch (error) {
    alert('Error capturando foto: ' + (error.response?.data?.mensaje || error.message))
  }
}

const verStreamCamara = (camara) => {
  if (camara.url_stream) {
    window.open(camara.url_stream, '_blank')
  } else {
    alert('Cámara sin URL de stream configurada')
  }
}
  const cargarClima = async () => {
    try {
      const res = await axios.get(
        `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m,weather_code&hourly=temperature_2m,precipitation_probability,weather_code&forecast_days=1&timezone=America/Bogota`
      )
      const hourly = res.data.hourly || {}
      const pronosticos = []
      if (hourly.time) {
        const ahora = new Date()
        hourly.time.forEach((t, i) => {
          const h = new Date(t)
          if (h > ahora && pronosticos.length < 6) {
            pronosticos.push({
              hora: h.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
              temp: hourly.temperature_2m[i],
              lluvia: hourly.precipitation_probability[i],
              code: hourly.weather_code[i]
            })
          }
        })
      }
      const wc = res.data.current.weather_code
      let climaTexto = 'Despejado'
      if (wc >= 61) climaTexto = 'Lluvia'
      else if (wc >= 51) climaTexto = 'Llovizna'
      else if (wc >= 3) climaTexto = 'Nublado'
      else if (wc >= 1) climaTexto = 'Parcialmente nublado'

      setClima({
        temp: res.data.current.temperature_2m,
        humedad: res.data.current.relative_humidity_2m,
        descripcion: climaTexto,
        pronosticos
      })
    } catch (error) {
      console.error('Error cargando clima:', error)
    }
  }

  const cargarPorqueriza = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/esp/porqueriza`)
      setPorqueriza({
        temp: res.data.temperatura,
        humedad: res.data.humedad,
        conectado: res.data.conectado
      })
    } catch (error) {
      console.error('Error cargando porqueriza:', error)
    }
  }

  const cargarFlujo = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/esp/flujo`)
      setFlujo({
        caudal: res.data.caudal || 0,
        volumen_diario: res.data.volumen_diario || 0,
        conectado: res.data.conectado
      })
    } catch (error) {
      console.error('Error cargando flujo:', error)
    }
  }

  const cargarBombas = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/motorbombs`)
      setBombas(res.data)
    } catch (error) {
      console.error('Error cargando bombas:', error)
    }
  }

  const cargarAlertas = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/alerts`)
      const data = res.data.slice(0, 10)
      setAlertas(data)
      // Calcular no-leídas desde el último timestamp guardado en localStorage
      const ts = _getAlertasLeidasTs()
      if (ts) {
        const leidas = data.filter(a => new Date(a.createdAt || a.fecha) <= new Date(ts)).length
        setAlertasLeidas(leidas)
      } else {
        setAlertasLeidas(0) // primera vez: todas son "nuevas"
      }
    } catch (error) {
      console.error('Error cargando alertas:', error)
    }
  }

  const guardarRecordatorio = () => {
    if (!nuevoRecordatorio.titulo || !nuevoRecordatorio.fecha) return
    const nuevo = { ...nuevoRecordatorio, id: Date.now(), creado: new Date().toISOString() }
    const actualizados = [...recordatorios, nuevo]
    setRecordatorios(actualizados)
    try { localStorage.setItem('coo_recordatorios', JSON.stringify(actualizados)) } catch {}
    setNuevoRecordatorio({ titulo: '', fecha: '', hora: '', descripcion: '' })
    setMostrarFormRecordatorio(false)
  }

  const eliminarRecordatorio = (id) => {
    const actualizados = recordatorios.filter(r => r.id !== id)
    setRecordatorios(actualizados)
    try { localStorage.setItem('coo_recordatorios', JSON.stringify(actualizados)) } catch {}
  }

  const cargarLotes = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/lotes`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setLotes(res.data)
    } catch (error) {
      console.error('Error cargando lotes:', error)
    }
  }

  const cargarPesajes = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/pesajes`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setPesajes(res.data)
      if (res.data.length > 0) {
        setUltimoPeso(res.data[0])
      }
    } catch (error) {
      console.error('Error cargando pesajes:', error)
    }
  }

  const cargarContabilidad = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/contabilidad`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setContabilidad(res.data)
      
      const resumen = await axios.get(`${API_URL}/api/contabilidad/resumen`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setResumenContable(resumen.data)
    } catch (error) {
      console.error('Error cargando contabilidad:', error)
    }
  }

  const cargarConfig = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/config`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data) {
        setConfig(res.data)
      }
    } catch (error) {
      console.error('Error cargando config:', error)
    }
  }

  const cargarUsuarios = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUsuarios(res.data)
    } catch (error) {
      console.error('Error cargando usuarios:', error)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FUNCIONES DE LOTES
  // ═══════════════════════════════════════════════════════════════════════

  const crearLote = async () => {
    try {
      // Incluir cualquier peso pendiente en el campo de texto
      const extraLote = pesoLoteInputTmp.split(/[,\s]+/).map(v => parseFloat(v.replace(',','.'))).filter(v => !isNaN(v) && v > 0)
      const todosLosPesosLote = [...pesosLoteInicial, ...extraLote]
      // Si se ingresaron pesos individuales, derivar promedios y totales del array
      let payload = { ...nuevoLote }
      if (todosLosPesosLote.length > 0) {
        const totalPesos = todosLosPesosLote.reduce((s, v) => s + v, 0)
        const promedio = Math.round((totalPesos / todosLosPesosLote.length) * 100) / 100
        payload = {
          ...payload,
          cantidad_cerdos: todosLosPesosLote.length,
          peso_inicial_promedio: promedio,
          peso_promedio_actual: promedio
        }
      } else {
        // Fallback: usar peso_inicial_promedio como peso_promedio_actual
        payload.peso_promedio_actual = nuevoLote.peso_inicial_promedio || 0
      }
      await axios.post(`${API_URL}/api/lotes`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setMostrarModalLote(false)
      setNuevoLote({ nombre: '', cantidad_cerdos: 0, peso_inicial_promedio: 0, notas: '' })
      setPesosLoteInicial([])
      setPesoLoteInputTmp('')
      cargarLotes()
    } catch (error) {
      alert('Error creando lote: ' + (error.response?.data?.mensaje || error.message))
    }
  }

  const actualizarLote = async (id, datos) => {
    try {
      await axios.put(`${API_URL}/api/lotes/${id}`, datos, {
        headers: { Authorization: `Bearer ${token}` }
      })
      cargarLotes()
    } catch (error) {
      alert('Error actualizando lote: ' + (error.response?.data?.mensaje || error.message))
    }
  }

  const eliminarLote = async (id) => {
    if (!confirm('¿Eliminar este lote?')) return
    try {
      await axios.delete(`${API_URL}/api/lotes/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      cargarLotes()
    } catch (error) {
      alert('Error eliminando lote: ' + (error.response?.data?.mensaje || error.message))
    }
  }

  const finalizarLote = async (id) => {
    if (!confirm('¿Finalizar este lote?')) return
    try {
      await axios.put(`${API_URL}/api/lotes/${id}/finalizar`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      cargarLotes()
    } catch (error) {
      alert('Error finalizando lote: ' + (error.response?.data?.mensaje || error.message))
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
// FUNCIONES DE LOTES - DETALLE Y ALIMENTACIÓN
// ═══════════════════════════════════════════════════════════════════════

const verDetalleLote = async (id) => {
  try {
    const res = await axios.get(`${API_URL}/api/lotes/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    setLoteDetalle(res.data)
    setMostrarFormGasto(false)

    // Cargar alimentación, gráfica y gastos semanales del lote
    await Promise.all([
      cargarAlimentacionLote(id),
      cargarGraficaEvolucion(id),
      cargarGastosSemanales(id)
    ])
  } catch (error) {
    alert('Error cargando detalle del lote: ' + (error.response?.data?.mensaje || error.message))
  }
}

const cargarAlimentacionLote = async (id) => {
  try {
    const res = await axios.get(`${API_URL}/api/lotes/${id}/alimentacion`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    setAlimentacionLote(res.data)
  } catch (error) {
    console.error('Error cargando alimentación:', error)
    setAlimentacionLote([])
  }
}

const cargarGraficaEvolucion = async (id) => {
  try {
    const res = await axios.get(`${API_URL}/api/lotes/${id}/grafica/evolucion`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    setGraficaEvolucionLote(res.data)
  } catch (error) {
    console.error('Error cargando gráfica evolución:', error)
    setGraficaEvolucionLote([])
  }
}

const eliminarAlimentacion = async (id) => {
  if (!confirm('¿Eliminar este registro de alimentación? También se eliminará el costo asociado.')) return
  try {
    await axios.delete(`${API_URL}/api/lotes/alimentacion/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    // Recargar datos del lote
    await verDetalleLote(loteDetalle._id)
  } catch (error) {
    alert('Error eliminando alimentación: ' + (error.response?.data?.mensaje || error.message))
  }
}

const registrarAlimentacionDesdeInventario = async () => {
  if (!nuevaAlimInv.inventario_id) { alert('Selecciona un producto de alimento'); return }
  if (!nuevaAlimInv.cantidad_kg || Number(nuevaAlimInv.cantidad_kg) <= 0) { alert('Ingresa la cantidad de kg'); return }
  setCargandoAlimInv(true)
  try {
    const res = await axios.post(`${API_URL}/api/lotes/alimentacion-inventario`, {
      lote_id:       loteDetalle._id,
      inventario_id: nuevaAlimInv.inventario_id,
      cantidad_kg:   Number(nuevaAlimInv.cantidad_kg),
      notas:         nuevaAlimInv.notas
    }, { headers: { Authorization: `Bearer ${token}` } })

    setMostrarModalAlimInv(false)
    setNuevaAlimInv({ inventario_id: '', cantidad_kg: '', notas: '' })
    // Recargar datos relacionados (incluyendo loteDetalle para actualizar alimento_total_kg e ICA)
    const [, , , resLote] = await Promise.all([
      cargarAlimentacionLote(loteDetalle._id),
      cargarInventarioAlimento(),
      cargarCostos(),
      axios.get(`${API_URL}/api/lotes/${loteDetalle._id}`, { headers: { Authorization: `Bearer ${token}` } })
    ])
    setLoteDetalle(resLote.data)
    alert(res.data.mensaje)
  } catch (error) {
    alert('Error: ' + (error.response?.data?.mensaje || error.message))
  } finally {
    setCargandoAlimInv(false)
  }
}

// Registra consumo histórico de semanas pasadas (superadmin, sin descontar inventario)
const registrarConsumoHistoricoFn = async () => {
  if (!nuevoHistorico.semana_iso) { alert('Selecciona la semana'); return }
  if (!nuevoHistorico.cantidad_kg || Number(nuevoHistorico.cantidad_kg) <= 0) { alert('Ingresa la cantidad de kg'); return }
  setCargandoHistorico(true)
  try {
    const res = await axios.post(`${API_URL}/api/lotes/consumo-historico`, {
      lote_id:       loteDetalle._id,
      semana_iso:    nuevoHistorico.semana_iso,
      cantidad_kg:   Number(nuevoHistorico.cantidad_kg),
      precio_kg:     nuevoHistorico.precio_kg ? Number(nuevoHistorico.precio_kg) : 0,
      notas:         nuevoHistorico.notas,
      tipo_alimento: nuevoHistorico.tipo_alimento
    }, { headers: { Authorization: `Bearer ${token}` } })
    setMostrarModalHistorico(false)
    setNuevoHistorico({ semana_iso: '', cantidad_kg: '', precio_kg: '', notas: '', tipo_alimento: 'iniciador' })
    const [, resLote] = await Promise.all([
      cargarAlimentacionLote(loteDetalle._id),
      axios.get(`${API_URL}/api/lotes/${loteDetalle._id}`, { headers: { Authorization: `Bearer ${token}` } })
    ])
    setLoteDetalle(resLote.data)
    alert(res.data.mensaje)
  } catch (error) {
    alert('Error: ' + (error.response?.data?.mensaje || error.message))
  } finally {
    setCargandoHistorico(false)
  }
}

// ═══════════════════════════════════════════════════════════════════════
// FUNCIONES GASTOS SEMANALES POR LOTE
// ═══════════════════════════════════════════════════════════════════════

const cargarGastosSemanales = async (loteId) => {
  try {
    const res = await axios.get(`${API_URL}/api/lotes/${loteId}/gastos-semanales`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    setGastosSemanales(res.data.gastos || [])
    setTotalGastosLote(res.data.total_gastos || 0)
  } catch (error) {
    console.error('Error cargando gastos semanales:', error)
    setGastosSemanales([])
    setTotalGastosLote(0)
  }
}

const registrarGastoSemanal = async (loteId) => {
  if (!nuevoGasto.monto || parseFloat(nuevoGasto.monto) <= 0) {
    alert('El monto debe ser mayor a 0')
    return
  }
  try {
    await axios.post(`${API_URL}/api/lotes/${loteId}/gasto-semanal`, {
      descripcion: nuevoGasto.descripcion || 'Gasto semanal',
      monto: parseFloat(nuevoGasto.monto),
      categoria: nuevoGasto.categoria
    }, { headers: { Authorization: `Bearer ${token}` } })
    setNuevoGasto({ descripcion: '', monto: '', categoria: 'otro' })
    setMostrarFormGasto(false)
    await cargarGastosSemanales(loteId)
    await cargarLotes()
    // Sincronizar finanzas
    await cargarCostos()
    alert('✓ Gasto registrado y sincronizado con finanzas')
  } catch (error) {
    alert('Error registrando gasto: ' + (error.response?.data?.mensaje || error.message))
  }
}

const eliminarGastoSemanal = async (loteId, gastoId) => {
  if (!confirm('¿Eliminar este gasto?')) return
  try {
    await axios.delete(`${API_URL}/api/lotes/${loteId}/gasto-semanal/${gastoId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    await cargarGastosSemanales(loteId)
    await cargarLotes()
  } catch (error) {
    alert('Error eliminando gasto: ' + (error.response?.data?.mensaje || error.message))
  }
}

  // ═══════════════════════════════════════════════════════════════════════
  // FUNCIONES DE PESAJES
  // ═══════════════════════════════════════════════════════════════════════

  const crearPesaje = async () => {
    // Incluir cualquier peso pendiente en el campo de texto
    const extra = pesoInputTmp.split(/[,\s]+/).map(v => parseFloat(v.replace(',','.'))).filter(v => !isNaN(v) && v > 0)
    const todosLosPesos = [...pesosIngresados, ...extra]
    if (todosLosPesos.length === 0) { alert('Ingresa al menos un peso antes de registrar.'); return }
    try {
      const total = todosLosPesos.reduce((s, v) => s + v, 0)
      const payload = {
        ...nuevoPesaje,
        peso: Math.round(total * 100) / 100,
        cantidad_cerdos_pesados: todosLosPesos.length,
        peso_min: Math.min(...todosLosPesos),
        peso_max: Math.max(...todosLosPesos)
      }
      await axios.post(`${API_URL}/api/pesajes`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setMostrarModalPesaje(false)
      setNuevoPesaje({ lote: '', notas: '' })
      setPesosIngresados([])
      setPesoInputTmp('')
      cargarPesajes()
      cargarLotes()
    } catch (error) {
      alert('Error creando pesaje: ' + (error.response?.data?.mensaje || error.message))
    }
  }

  const eliminarPesaje = async (id) => {
    if (!confirm('¿Eliminar este pesaje?')) return
    try {
      await axios.delete(`${API_URL}/api/pesajes/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      cargarPesajes()
    } catch (error) {
      alert('Error eliminando pesaje: ' + (error.response?.data?.mensaje || error.message))
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FUNCIONES DE CONTABILIDAD
  // ═══════════════════════════════════════════════════════════════════════
const crearRegistroContable = async () => {
  try {
    // Limpiar lote vacío antes de enviar
    const datosEnviar = {
      ...nuevoRegistro,
      lote: nuevoRegistro.lote || null
    }
    
    await axios.post(`${API_URL}/api/contabilidad`, datosEnviar, {
      headers: { Authorization: `Bearer ${token}` }
    })

    // Éxito: Limpiar formulario, cerrar modal y refrescar
    setMostrarModalContabilidad(false)
    setNuevoRegistro({ lote: '', tipo: 'gasto', categoria: 'alimento', descripcion: '', cantidad: 1, unidad: 'kg', precio_unitario: 0 })
    cargarContabilidad()
    
  } catch (error) {
    console.error("Error al crear:", error)
    alert('Error guardando registro: ' + (error.response?.data?.mensaje || error.message))
  }
};

const eliminarRegistroContable = async (id) => {
  if (!confirm('¿Eliminar este registro contable?')) return
  try {
    await axios.delete(`${API_URL}/api/contabilidad/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    cargarContabilidad()
  } catch (error) {
    alert('Error eliminando registro: ' + (error.response?.data?.mensaje || error.message))
  }
}

const eliminarProductoAlimento = async (id, nombre) => {
  if (!confirm(`¿Eliminar el producto "${nombre}" y todo su historial? Esta acción no se puede deshacer.`)) return
  try {
    await axios.delete(`${API_URL}/api/inventario-alimento/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    await cargarInventarioAlimento()
    alert(`✓ Producto "${nombre}" eliminado.`)
  } catch (error) {
    alert('Error eliminando producto: ' + (error.response?.data?.mensaje || error.message))
  }
}

const eliminarCosto = async (id) => {
  if (!confirm('¿Eliminar este costo?')) return
  try {
    await axios.delete(`${API_URL}/api/costos/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    cargarCostos()
  } catch (error) {
    alert('Error eliminando costo: ' + (error.response?.data?.mensaje || error.message))
  }
}

const anularVenta = async (id) => {
  if (!confirm('¿Anular esta venta?')) return
  try {
    await axios.put(`${API_URL}/api/ventas/${id}/anular`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    })
    cargarVentas()
  } catch (error) {
    alert('Error anulando venta: ' + (error.response?.data?.mensaje || error.message))
  }
}
  // ═══════════════════════════════════════════════════════════════════════
  // FUNCIONES DE BOMBAS
  // ═══════════════════════════════════════════════════════════════════════

  const toggleBomba = async (id) => {
  try {
    // Buscar la bomba para saber su estado actual y nombre
    const bomba = bombas.find(b => b._id === id)
    if (!bomba) {
      alert('Bomba no encontrada')
      return
    }
    
    // Determinar acción (recordar: estado invertido - false = encendida, true = apagada)
    const accion = bomba.estado ? 'ENCENDER' : 'APAGAR'
    const nombreBomba = bomba.nombre || bomba.codigo_bomba || 'la motobomba'
    
    // Confirmar acción
    const confirmado = confirm(
      `¿Estás seguro de ${accion} ${nombreBomba}?\n\n` +
      `Sistema: ${bomba.ubicacion || 'Sistema de riego/distribución'}\n` +
      `Estado actual: ${bomba.estado ? 'Apagada' : 'Encendida'}`
    )
    
    if (!confirmado) return
    
    await axios.put(`${API_URL}/api/motorbombs/${id}/toggle`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    })
    cargarBombas()
    alert(`✓ ${nombreBomba} ${accion === 'ENCENDER' ? 'encendida' : 'apagada'} correctamente`)
  } catch (error) {
    const data = error.response?.data
    if (data?.codigo === 'HORARIO_NO_PERMITIDO') {
      alert(`HORARIO NO PERMITIDO\n\nHora actual: ${data.hora_actual}\n\nHorarios permitidos:\n• ${data.horarios_permitidos?.join('\n• ')}\n\nSolo se puede encender en esos horarios.`)
    } else if (data?.codigo === 'LIMITE_AGUA') {
      const msg = `LÍMITE DIARIO ALCANZADO\n\nConsumo: ${data.consumo_actual?.toFixed(1)} L / ${data.limite} L\n\nLa bomba se bloqueó automáticamente.`
      if ((user.rol === 'ingeniero' || user.rol === 'superadmin') &&
          confirm(msg + '\n\n¿Forzar encendido? (solo para ingeniero/admin)')) {
        try {
          await axios.put(`${API_URL}/api/motorbombs/${id}/toggle`, { forzar: true }, {
            headers: { Authorization: `Bearer ${token}` }
          })
          cargarBombas()
          alert('Bomba encendida por forzado de ingeniero')
        } catch (e2) {
          alert('Error forzando bomba: ' + (e2.response?.data?.mensaje || e2.message))
        }
      } else if (user.rol !== 'ingeniero' && user.rol !== 'superadmin') {
        alert(msg)
      }
    } else {
      alert('Error controlando bomba: ' + (data?.mensaje || error.message))
    }
  }
}
const crearBomba = async () => {
  try {
    await axios.post(`${API_URL}/api/motorbombs`, nuevaBomba, {
      headers: { Authorization: `Bearer ${token}` }
    })
    setMostrarModalBomba(false)
    setNuevaBomba({ nombre: '', codigo_bomba: '', ubicacion: '', descripcion: '' })
    cargarBombas()
  } catch (error) {
    alert('Error creando bomba: ' + (error.response?.data?.mensaje || error.message))
  }
}

const actualizarBomba = async (id, datos) => {
  try {
    await axios.put(`${API_URL}/api/motorbombs/${id}`, datos, {
      headers: { Authorization: `Bearer ${token}` }
    })
    setBombaEditando(null)
    setMostrarModalBomba(false)
    setNuevaBomba({ nombre: '', codigo_bomba: '', ubicacion: '', descripcion: '' })
    cargarBombas()
  } catch (error) {
    alert('Error actualizando bomba: ' + (error.response?.data?.mensaje || error.message))
  }
}

const eliminarBomba = async (id) => {
  if (!confirm('¿Eliminar esta bomba?')) return
  try {
    await axios.delete(`${API_URL}/api/motorbombs/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    cargarBombas()
  } catch (error) {
    alert('Error eliminando bomba: ' + (error.response?.data?.mensaje || error.message))
  }
}
  // ═══════════════════════════════════════════════════════════════════════
  // FUNCIONES DE CONFIGURACIÓN
  // ═══════════════════════════════════════════════════════════════════════

  const guardarConfig = async () => {
    try {
      await axios.put(`${API_URL}/api/config`, config, {
        headers: { Authorization: `Bearer ${token}` }
      })
      alert('Configuración guardada')
    } catch (error) {
      alert('Error guardando configuración: ' + (error.response?.data?.mensaje || error.message))
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FUNCIONES DE USUARIOS (SUPERADMIN)
  // ═══════════════════════════════════════════════════════════════════════

  const crearUsuario = async () => {
    try {
      await axios.post(`${API_URL}/api/users/register`, nuevoUsuario, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setMostrarModalUsuario(false)
      setNuevoUsuario({ usuario: '', correo: '', password: '', rol: 'cliente' })
      cargarUsuarios()
    } catch (error) {
      alert('Error creando usuario: ' + (error.response?.data?.mensaje || error.message))
    }
  }

  const toggleUsuario = async (id) => {
    try {
      await axios.put(`${API_URL}/api/users/${id}/toggle`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      cargarUsuarios()
    } catch (error) {
      alert('Error: ' + (error.response?.data?.mensaje || error.message))
    }
  }

  const eliminarUsuario = async (id) => {
    if (!confirm('¿Eliminar este usuario?')) return
    try {
      await axios.delete(`${API_URL}/api/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      cargarUsuarios()
    } catch (error) {
      alert('Error: ' + (error.response?.data?.mensaje || error.message))
    }
  }
// ═══════════════════════════════════════════════════════════════════════
// FUNCIONES DE CARGA PARA GRÁFICAS
// ═══════════════════════════════════════════════════════════════════════

const cargarHistoricoTemperatura = async () => {
  try {
    const res = await axios.get(`${API_URL}/api/esp/porqueriza/historico?horas=24`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    if (res.data && res.data.length > 0) {
      setHistoricoTemperatura(res.data.map(d => ({
        hora: new Date(d.fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        temperatura: d.temperatura,
        humedad: d.humedad
      })))
    } else {
      // Sin datos reales - mostrar vacío
      setHistoricoTemperatura([])
    }
  } catch (error) {
    console.error('Error cargando histórico temperatura:', error)
    setHistoricoTemperatura([])
  }
}
const cargarHistoricoAgua = async (periodo) => {
  try {
    const periodoActual = periodo || periodoAguaRef.current
    let dias = 7
    if (periodoActual === 'diario') dias = 1
    if (periodoActual === 'mensual') dias = 30
    
    const res = await axios.get(`${API_URL}/api/esp/flujo/historico?dias=${dias}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    if (res.data && res.data.length > 0) {
      const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
      
      const datosFormateados = res.data.map(d => {
        const partes = d.fecha.split('-')
        const año = parseInt(partes[0])
        const mes = parseInt(partes[1]) - 1
        const dia = parseInt(partes[2])
        const fecha = new Date(año, mes, dia)

        return {
          dia: `${meses[fecha.getMonth()]} ${fecha.getDate()}`,
          litros: d.litros,  // ✅ Ya coincide con el backend
          fechaOrden: fecha.getTime()
        }
      })
      
      // Ordenar por fecha
      datosFormateados.sort((a, b) => a.fechaOrden - b.fechaOrden)
      
      // ✅ SIMPLIFICADO: El backend ya filtra por días
      setHistoricoAgua(datosFormateados)
    } else {
      setHistoricoAgua([])
    }
  } catch (error) {
    console.error('Error cargando histórico agua:', error)
    setHistoricoAgua([])
  }
}

const cargarHistoricoContable = async () => {
  try {
    const res = await axios.get(`${API_URL}/api/costos/comparativo?meses=6`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    if (res.data && res.data.length > 0) {
      setHistoricoContable(res.data.map(m => ({
        mes: m.nombre,
        ingresos: m.ingresos,
        gastos: m.costos
      })))
    } else {
      setHistoricoContable([])
    }
  } catch (error) {
    console.error('Error cargando histórico contable:', error)
    setHistoricoContable([])
  }
}

const cargarHistoricoPesos = async () => {
  try {
    // Usar pesajes ya cargados
    if (pesajes.length > 0) {
      const pesajesPorFecha = {}
      
      pesajes.forEach(p => {
        const fecha = new Date(p.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
        const loteNombre = p.lote?.nombre || 'Sin lote'
        
        if (!pesajesPorFecha[fecha]) {
          pesajesPorFecha[fecha] = { fecha }
        }
        pesajesPorFecha[fecha][loteNombre] = p.peso_promedio || p.peso
      })
      
      const datos = Object.values(pesajesPorFecha).slice(-10)
      setHistoricoPesos(datos)
    } else {
      setHistoricoPesos([])
    }
  } catch (error) {
    console.error('Error cargando histórico pesos:', error)
    setHistoricoPesos([])
  }
}

  // ═══════════════════════════════════════════════════════════════════════
  // FUNCIONES DE REPORTES
  // ═══════════════════════════════════════════════════════════════════════

  const [emailReporte, setEmailReporte] = useState('')
  const [enviandoReporte, setEnviandoReporte] = useState(false)
  const [testEmailResult, setTestEmailResult] = useState(null)
  const [testandoEmail, setTestandoEmail] = useState(false)

  const getSugerenciasEmail = () => {
    try { return JSON.parse(localStorage.getItem('coo_emails_reporte') || '[]') } catch { return [] }
  }
  const guardarEmailUsado = (email) => {
    try {
      const prev = getSugerenciasEmail()
      const updated = [email, ...prev.filter(e => e !== email)].slice(0, 5)
      localStorage.setItem('coo_emails_reporte', JSON.stringify(updated))
    } catch {}
  }

  const descargarReporte = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/reporte/excel`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `Reporte_COO_Alianzas_${new Date().toISOString().split('T')[0]}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      alert('Error descargando reporte: ' + (error.response?.data?.mensaje || error.message))
    }
  }

  const enviarReportePorEmail = async () => {
    if (!emailReporte || !emailReporte.includes('@')) {
      alert('Ingresa un correo electrónico válido')
      return
    }
    setEnviandoReporte(true)
    try {
      const res = await axios.post(
        `${API_URL}/api/reporte/email`,
        { correo: emailReporte },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      guardarEmailUsado(emailReporte)
      alert(`✅ ${res.data.mensaje}`)
    } catch (error) {
      alert('Error enviando reporte: ' + (error.response?.data?.mensaje || error.message))
    } finally {
      setEnviandoReporte(false)
    }
  }

  const verificarConfigEmail = async () => {
    setTestandoEmail(true)
    setTestEmailResult(null)
    try {
      const res = await axios.get(`${API_URL}/api/reporte/test-email`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setTestEmailResult({ ok: true, mensaje: res.data.mensaje })
    } catch (error) {
      const data = error.response?.data || {}
      setTestEmailResult({
        ok: false,
        problema: data.problema || 'ERROR',
        mensaje: data.solucion || data.mensaje || error.message,
        error_tecnico: data.error_tecnico || ''
      })
    } finally {
      setTestandoEmail(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FUNCIONES AUXILIARES
  // ═══════════════════════════════════════════════════════════════════════

  const getEstadoTemp = (temp) => {
    if (temp === null) return { clase: 'sin-datos', texto: 'Sin datos' }
    if (temp >= config.umbral_temp_critico) return { clase: 'critico', texto: 'CRITICO' }
    if (temp >= config.umbral_temp_max) return { clase: 'alerta', texto: 'Alerta' }
    return { clase: 'normal', texto: 'Normal' }
  }

  const formatearFecha = (fecha) => {
    if (!fecha) return '-'
    return new Date(fecha).toLocaleString()
  }

  const formatearDinero = (valor) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor || 0)
  }
// ═══════════════════════════════════════════════════════════════════════
  // RENDER: LOGIN
  // ═══════════════════════════════════════════════════════════════════════

  if (!user) {
    return (
      <div className="login-container">
        <div className="login-box">
          <div className="login-logo">
            <img src="/coo-alianzas logo.png" alt="COO Alianzas" style={{width: '120px', height: 'auto'}} />
            <h1>Sistema de Automatizacion IOT</h1>
          </div>
          
          <form onSubmit={handleLogin} style={{padding: '30px 45px'}}>
            {errorLogin && <div className="error-msg">{errorLogin}</div>}

            {conflictoSesion && (
              <div className="sesion-conflicto">
                <div className="conflicto-icono">
                  <AlertTriangle size={32} />
                </div>
                <h3>Sesión activa detectada</h3>
                <p>Tu cuenta está abierta en otro dispositivo:</p>
                <div className="conflicto-info">
                  <div className="conflicto-dispositivo">
                    <strong>{conflictoSesion.dispositivo}</strong>
                    <span>IP: {conflictoSesion.ip}</span>
                    <small>Desde: {new Date(conflictoSesion.desde).toLocaleString('es-CO')}</small>
                  </div>
                </div>
                <div className="conflicto-acciones">
                  <button className="btn-cerrar-sesion" onClick={() => handleLogin(null, true)}>
                    <LogOut size={16} /> Cerrar otra sesión e ingresar
                  </button>
                  <button className="btn-cancelar" onClick={() => setConflictoSesion(null)}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {!conflictoSesion && (<>
            <div className="input-group">
              <label>Usuario</label>
              <input
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="Ingrese su usuario"
                required
              />
            </div>

            <div className="input-group">
              <label>Contraseña</label>
              <div className="password-input">
                <input
                  type={mostrarPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingrese su contraseña"
                  required
                />
                <button
                  type="button"
                  className="btn-ver-password"
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                >
                  {mostrarPassword ? <IconOjoCerrado /> : <IconOjo />}
                </button>
              </div>
            </div>

            <div className="captcha-wrapper">
              <ReCAPTCHA
                ref={captchaRef}
                sitekey={RECAPTCHA_SITE_KEY}
                onChange={(token) => setCaptchaToken(token)}
                onExpired={() => setCaptchaToken(null)}
              />
            </div>

            <label style={{display:'flex', alignItems:'center', gap:'8px', fontSize:'13px', color:'#64748b', cursor:'pointer', margin:'4px 0 12px'}}>
              <input type="checkbox" checked={recordarSesion} onChange={e => setRecordarSesion(e.target.checked)}
                style={{width:'16px', height:'16px', accentColor:'#16a34a', cursor:'pointer'}} />
              Mantener sesión iniciada (30 días)
            </label>

            <button type="submit" className="btn-login" disabled={cargando || !captchaToken}>
              {cargando ? 'Ingresando...' : 'Ingresar'}
            </button>
            </>)}
          </form>
          
          <div className="login-footer">
            <p>Granja Porcina - Lorica, Córdoba</p>
          </div>
        </div>
      </div>
    )
  }
  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: DASHBOARD PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="app">
     {/* Header */}
<header className="header">
  <div className="header-left">
    <button className="btn-menu" onClick={() => setMenuAbierto(!menuAbierto)}>
      <span></span>
      <span></span>
      <span></span>
    </button>
    <div className="logo">
      <img src="/coo-alianzas logo.png" alt="COO Alianzas" style={{height: '40px', width: 'auto'}} />
      <span>COO Alianzas</span>
    </div>
  </div>
  
  <div className="header-right">
    {/* Notificaciones */}
    <div className="notif-wrapper" ref={notifPanelRef}>
      <button className="btn-notif" onClick={() => {
        if (!mostrarNotificaciones) {
          setAlertasLeidas(alertas.length)
          _setAlertasLeidasTs()
        }
        setMostrarNotificaciones(!mostrarNotificaciones)
        setMostrarConfigUsuario(false)
      }}>
        <Bell size={20} />
        {alertas.length > alertasLeidas && <span className="notif-dot">{alertas.length - alertasLeidas > 9 ? '9+' : alertas.length - alertasLeidas}</span>}
      </button>
      {mostrarNotificaciones && (
        <div className="notif-panel">
          <div className="notif-header">
            <h4>Notificaciones</h4>
            <button onClick={() => setMostrarNotificaciones(false)}>&times;</button>
          </div>
          {/* Pronóstico */}
          {clima.descripcion && (
            <div className="notif-clima">
              <strong>{clima.descripcion} - {clima.temp}°C</strong>
              {clima.pronosticos?.slice(0, 4).map((p, i) => (
                <div key={i} className="pronostico-item">
                  <span>{p.hora}</span>
                  <span>{p.temp}°C</span>
                  <span>{p.lluvia > 30 ? `🌧 ${p.lluvia}%` : '☀'}</span>
                </div>
              ))}
            </div>
          )}
          {/* Alertas */}
          <div className="notif-alertas">
            {alertas.length === 0 ? (
              <p className="notif-vacio">Sin alertas</p>
            ) : (
              alertas.slice(0, 8).map((a, i) => (
                <div key={i} className={`notif-alerta ${a.tipo}`}>
                  <span>{a.mensaje}</span>
                  <small>{new Date(a.createdAt).toLocaleString('es-CO', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</small>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>

    {/* Usuario */}
    <div className="user-wrapper" ref={userPanelRef}>
      <button className="btn-user" onClick={() => { setMostrarConfigUsuario(!mostrarConfigUsuario); setMostrarNotificaciones(false); setConfigUsuarioForm({ usuario: user.usuario, correo: user.correo || '', password_actual: '', password_nuevo: '' }) }}>
        <IconUsuario />
        <span className="user-name">{user.usuario}</span>
        <ChevronRight size={14} className={mostrarConfigUsuario ? 'rotado-90' : ''} />
      </button>
      {mostrarConfigUsuario && (
        <div className="user-panel">
          <div className="user-panel-header">
            <IconUsuario />
            <div>
              <strong>{user.usuario}</strong>
              <span className="rol-badge-sm">{user.rol}</span>
            </div>
          </div>
          <div className="user-panel-section">
            <h5>Datos de Perfil</h5>
            <input type="text" placeholder="Nombre de usuario" value={configUsuarioForm.usuario} onChange={e => setConfigUsuarioForm({ ...configUsuarioForm, usuario: e.target.value })} />
            <input type="email" placeholder="Correo electrónico" value={configUsuarioForm.correo} onChange={e => setConfigUsuarioForm({ ...configUsuarioForm, correo: e.target.value })} />
            <button className="btn-sm btn-primary" onClick={actualizarPerfilUsuario}>Guardar Cambios</button>
          </div>
          <div className="user-panel-section">
            <h5>Cambiar Contraseña</h5>
            <input type="password" placeholder="Contraseña actual" value={configUsuarioForm.password_actual} onChange={e => setConfigUsuarioForm({ ...configUsuarioForm, password_actual: e.target.value })} />
            <input type="password" placeholder="Nueva contraseña" value={configUsuarioForm.password_nuevo} onChange={e => setConfigUsuarioForm({ ...configUsuarioForm, password_nuevo: e.target.value })} />
            <button className="btn-sm btn-warning" onClick={cambiarPasswordUsuario}>Cambiar Contraseña</button>
          </div>
          <div className="user-panel-section">
            <a href="mailto:soporte@cooalianzas.com?subject=Solicitud de Soporte" className="btn-sm btn-outline">Solicitar Soporte</a>
          </div>
          <button className="btn-logout-full" onClick={handleLogout}>
            <LogOut size={16} /> Cerrar Sesión
          </button>
        </div>
      )}
    </div>
  </div>
</header>

      <div className="main-container">
        {/* Overlay para cerrar sidebar en móvil */}
        {menuAbierto && <div className="sidebar-overlay" onClick={() => setMenuAbierto(false)} />}
        {/* Sidebar */}
        <aside className={`sidebar ${menuAbierto ? 'abierto' : 'colapsado'}`}>
          <nav>
            <button 
              className={`nav-item ${pagina === 'dashboard' ? 'activo' : ''}`}
              onClick={() => { setPagina('dashboard'); setMenuAbierto(false) }}
            >
              <IconGrafica />
              <span>Dashboard</span>
            </button>
            
            <button 
              className={`nav-item ${pagina === 'lotes' ? 'activo' : ''}`}
              onClick={() => { setPagina('lotes'); setMenuAbierto(false) }}
            >
              <IconLote />
              <span>Lotes</span>
            </button>
            
            <button 
              className={`nav-item ${pagina === 'pesajes' ? 'activo' : ''}`}
              onClick={() => { setPagina('pesajes'); setMenuAbierto(false) }}
            >
              <IconPeso />
              <span>Pesajes</span>
            </button>
            
            <button
              className={`nav-item ${pagina === 'finanzas' ? 'activo' : ''}`}
              onClick={() => { setPagina('finanzas'); setMenuAbierto(false) }}
            >
              <IconDinero />
              <span>Finanzas</span>
            </button>
            
            <button 
              className={`nav-item ${pagina === 'bombas' ? 'activo' : ''}`}
              onClick={() => { setPagina('bombas'); setMenuAbierto(false) }}
            >
              <IconBomba />
              <span>Bombas</span>
            </button>
            
            <button 
              className={`nav-item ${pagina === 'alertas' ? 'activo' : ''}`}
              onClick={() => { setPagina('alertas'); setMenuAbierto(false) }}
            >
              <IconAlerta />
              <span>Alertas</span>
            </button>
{/* Cámaras - temporalmente oculto
            <button
  className={`nav-item ${pagina === 'camaras' ? 'activo' : ''}`}
  onClick={() => { setPagina('camaras'); setMenuAbierto(false) }}
>
  <IconCamara />
  <span>Cámaras</span>
</button>
*/}


<button
  className={`nav-item ${pagina === 'inventario' ? 'activo' : ''}`}
  onClick={() => { setPagina('inventario'); setMenuAbierto(false); cargarInventario(); cargarInventarioAlimento() }}
>
  <IconInventario />
  <span>Inventario</span>
</button>
            <button 
              className={`nav-item ${pagina === 'reportes' ? 'activo' : ''}`}
              onClick={() => { setPagina('reportes'); setMenuAbierto(false) }}
            >
              <IconReporte />
              <span>Reportes</span>
            </button>
            
            {(user.rol === 'superadmin' || user.rol === 'ingeniero') && (
              <button 
                className={`nav-item ${pagina === 'usuarios' ? 'activo' : ''}`}
                onClick={() => { setPagina('usuarios'); setMenuAbierto(false) }}
              >
                <IconUsuario />
                <span>Usuarios</span>
              </button>
            )}
            
            <button 
              className={`nav-item ${pagina === 'config' ? 'activo' : ''}`}
              onClick={() => { setPagina('config'); setMenuAbierto(false) }}
            >
              <IconConfig />
              <span>Configuración</span>
            </button>
          </nav>
          
          {/* Mini gráfica financiera en sidebar */}
          {comparativoCostos?.length > 0 && (
            <div className="sidebar-mini-grafica">
              <h4><BarChart3 size={14} /> Finanzas</h4>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={comparativoCostos.slice(-4)}>
                  <Bar dataKey="ingresos" fill="#22c55e" radius={[3,3,0,0]} />
                  <Bar dataKey="costos" fill="#ef4444" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="sidebar-mini-leyenda">
                <span className="dot-verde"></span> Ingresos
                <span className="dot-rojo"></span> Costos
              </div>
            </div>
          )}
        </aside>

        {/* Contenido principal */}
        <main className={`content ${!menuAbierto ? 'sidebar-colapsado' : ''}`}>
         {/* ════════════════════════════════════════════════════════════════ */}
{/* PÁGINA: DASHBOARD */}
{/* ════════════════════════════════════════════════════════════════ */}
{pagina === 'dashboard' && (
  <div className="page-dashboard">
    <div className="page-header">
      <h2><Home size={24} /> Dashboard - Estado de la Granja</h2>
      <button className="btn-refresh" onClick={cargarDatos}>
        <RefreshCw size={18} />
      </button>
    </div>

    {/* Tarjetas de monitoreo en tiempo real */}
    <div className="cards-grid">
      {/* Clima Lorica */}
      <div className="card">
        <div className="card-header">
          <Thermometer size={20} />
          <h3>Clima Lorica</h3>
        </div>
        <div className="card-body">
          <div className="dato-principal">{clima.temp !== null ? `${clima.temp}°C` : '--'}</div>
          <div className="dato-secundario">
            <Droplets size={14} /> Humedad: {clima.humedad !== null ? `${clima.humedad}%` : '--'}
          </div>
        </div>
      </div>

      {/* Granja Porcina */}
      <div className={`card ${getEstadoTemp(porqueriza.temp).clase}`}>
        <div className="card-header">
          <Thermometer size={20} />
          <h3>Granja Porcina</h3>
          <span className={`estado-badge ${porqueriza.conectado ? 'conectado' : 'desconectado'}`}>
            {porqueriza.conectado ? <><Wifi size={12} /> Conectado</> : <><WifiOff size={12} /> Desconectado</>}
          </span>
        </div>
        <div className="card-body">
          <div className="dato-principal">{porqueriza.temp !== null ? `${porqueriza.temp}°C` : '--'}</div>
          <div className="dato-secundario">
            <Droplets size={14} /> Humedad: {porqueriza.humedad !== null ? `${porqueriza.humedad}%` : '--'}
          </div>
          <div className={`estado-texto ${getEstadoTemp(porqueriza.temp).clase}`}>
            {getEstadoTemp(porqueriza.temp).texto}
          </div>
        </div>
      </div>

      {/* Flujo de agua */}
      <div className="card">
        <div className="card-header">
          <Droplets size={20} />
          <h3>Consumo Agua</h3>
          <span className={`estado-badge ${flujo.conectado ? 'conectado' : 'desconectado'}`}>
            {flujo.conectado ? <><Wifi size={12} /> Conectado</> : <><WifiOff size={12} /> Desconectado</>}
          </span>
        </div>
        <div className="card-body">
          <div className="dato-principal">{flujo.volumen_diario ? `${flujo.volumen_diario.toFixed(1)} L` : '0 L'}</div>
          <div className="dato-secundario">Consumo Hoy</div>
          <div className="dato-secundario">
            <Gauge size={14} /> Caudal: {flujo.caudal || 0} L/min
          </div>
        </div>
      </div>

      {/* Peso Total Lotes */}
      <div className="card">
        <div className="card-header">
          <Weight size={20} />
          <h3>Peso Total Granja</h3>
        </div>
        <div className="card-body">
          <div className="dato-principal">
            {lotes.filter(l => l.activo).reduce((sum, l) => sum + ((l.peso_promedio_actual || 0) * (l.cantidad_cerdos || 0)), 0).toFixed(1)} kg
          </div>
          <div className="dato-secundario">
            {lotes.filter(l => l.activo).length} lotes activos — {lotes.filter(l => l.activo).reduce((sum, l) => sum + (l.cantidad_cerdos || 0), 0)} cerdos
          </div>
        </div>
      </div>
    </div>

    {/* Estado General de la Granja */}
    <div className="dashboard-section estado-granja">
      <h3><Activity size={20} /> Estado General de la Granja</h3>
      <div className="estado-granja-grid">
        <div className="estado-item">
          <div className="estado-icono">
            <PiggyBank size={32} className="icono-verde" />
          </div>
          <div className="estado-info">
            <span className="estado-numero">{lotes.filter(l => l.activo).reduce((sum, l) => sum + l.cantidad_cerdos, 0)}</span>
            <span className="estado-label">Cerdos Activos</span>
          </div>
        </div>
        <div className="estado-item">
          <div className="estado-icono">
            <Package size={32} className="icono-verde" />
          </div>
          <div className="estado-info">
            <span className="estado-numero">{lotes.filter(l => l.activo).length}</span>
            <span className="estado-label">Lotes Activos</span>
          </div>
        </div>
        <div className="estado-item">
          <div className="estado-icono">
            <Weight size={32} className="icono-verde" />
          </div>
          <div className="estado-info">
            <span className="estado-numero">
              {lotes.filter(l => l.activo).length > 0
                ? (lotes.filter(l => l.activo).reduce((sum, l) => sum + (l.peso_promedio_actual || 0), 0) / lotes.filter(l => l.activo).length).toFixed(1)
                : 0} kg
            </span>
            <span className="estado-label">Promedio entre Lotes</span>
          </div>
        </div>
        <div className="estado-item">
          <div className="estado-icono">
            {bombas.filter(b => !b.estado).length > 0 ? <Power size={32} className="icono-verde" /> : <PowerOff size={32} className="icono-gris" />}
          </div>
          <div className="estado-info">
            <span className="estado-numero">{bombas.filter(b => !b.estado).length}/{bombas.length}</span>
            <span className="estado-label">Bombas Activas</span>
          </div>
        </div>
      </div>
    </div>

    {/* GRÁFICAS PRINCIPALES */}
    <div className="graficas-grid">
      {/* Gráfica de Temperatura 24h */}
      <div className="dashboard-section grafica-section">
        <h3><Thermometer size={20} /> Temperatura Granja Porcina - Últimas 24h</h3>
        <div className="grafica-container">
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={historicoTemperatura}>
              <defs>
                <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="colorHum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="hora" tick={{ fontSize: 11 }} stroke="#666" />
              <YAxis tick={{ fontSize: 11 }} stroke="#666" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
              />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="temperatura" 
                stroke="#ef4444" 
                fillOpacity={1} 
                fill="url(#colorTemp)" 
                name="Temperatura °C"
              />
              <Area 
                type="monotone" 
                dataKey="humedad" 
                stroke="#3b82f6" 
                fillOpacity={1} 
                fill="url(#colorHum)" 
                name="Humedad %"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      
     {/* Gráfica de Consumo de Agua */}
<div className="dashboard-section grafica-section">
  <div className="grafica-header-agua">
    <h3><Droplets size={20} /> Consumo de Agua</h3>
    <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
    {(user?.rol === 'superadmin' || user?.rol === 'ingeniero') && (
      <button
        title="Corregir consumo de hoy"
        style={{background:'none',border:'1px solid #e2e8f0',borderRadius:'8px',padding:'4px 10px',fontSize:'12px',color:'#64748b',cursor:'pointer'}}
        onClick={async () => {
          const val = window.prompt('Ingresa el consumo real de hoy en litros (0 para resetear):')
          if (val === null) return
          const litros = parseFloat(val)
          if (isNaN(litros) || litros < 0) { alert('Valor inválido'); return }
          try {
            await axios.put(`${API_URL}/api/esp/flujo/corregir`, { litros }, { headers: { Authorization: `Bearer ${token}` } })
            await cargarHistoricoAgua(periodoAgua)
            alert(`Consumo de hoy corregido a ${litros} L`)
          } catch(e) { alert('Error al corregir: ' + (e.response?.data?.mensaje || e.message)) }
        }}
      >Corregir hoy</button>
    )}
    <div className="periodo-selector">
      <button 
        className={`periodo-btn ${periodoAgua === 'diario' ? 'activo' : ''}`}
        onClick={() => {
          setPeriodoAgua('diario')
          periodoAguaRef.current = 'diario'
          cargarHistoricoAgua('diario')
        }}
      >
        Hoy
      </button>
      <button
        className={`periodo-btn ${periodoAgua === 'semanal' ? 'activo' : ''}`}
        onClick={() => {
          setPeriodoAgua('semanal')
          periodoAguaRef.current = 'semanal'
          cargarHistoricoAgua('semanal')
        }}
      >
        Semanal
      </button>
      <button
        className={`periodo-btn ${periodoAgua === 'mensual' ? 'activo' : ''}`}
        onClick={() => {
          setPeriodoAgua('mensual')
          periodoAguaRef.current = 'mensual'
          cargarHistoricoAgua('mensual')
        }}
      >
        Mensual
      </button>
    </div>
    </div>
  </div>
  <div className="grafica-container">
    {historicoAgua.length === 0 ? (
      <p className="sin-datos">No hay datos de consumo</p>
    ) : (
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={historicoAgua}>
          <defs>
            <linearGradient id="gradAgua" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="dia" tick={{ fontSize: 10, fill: '#94a3b8' }} stroke="#e2e8f0" />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} stroke="#e2e8f0" unit=" L" />
          <Tooltip
            contentStyle={{ backgroundColor: 'rgba(255,255,255,0.96)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}
            formatter={(value) => [`${Number(value).toFixed(1)} L`, 'Consumo']}
          />
          <Area
            type="monotone"
            dataKey="litros"
            stroke="#3b82f6"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#gradAgua)"
            dot={{ r: 3, fill: '#fff', stroke: '#3b82f6', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
            name="Litros"
          />
        </AreaChart>
      </ResponsiveContainer>
    )}
    {historicoAgua.length > 0 && (
      <div className="agua-total-periodo">
        <Droplets size={18} />
        <span>Total {periodoAgua === 'diario' ? 'Hoy' : periodoAgua === 'semanal' ? 'Semanal' : 'Mensual'}:</span>
        <strong>{historicoAgua.reduce((sum, d) => sum + (d.litros || 0), 0).toFixed(1)} L</strong>
        <span className="agua-promedio">| Promedio: {(historicoAgua.reduce((sum, d) => sum + (d.litros || 0), 0) / historicoAgua.length).toFixed(1)} L/día</span>
      </div>
    )}
  </div>
</div>
    </div>

    {/* Gráfica Peso Real vs Plan de Producción - Dashboard */}
    <div className="dashboard-section grafica-section grafica-full">
      <h3><TrendingUp size={20} /> Peso Real vs Plan de Producción</h3>
      <div className="grafica-container">
        {(() => {
          // Edad máxima de lotes activos
          const edadMax = Math.max(...lotes.filter(l => l.activo).map(l => l.edad_dias || 0), 50)

          // Mapear pesajes de todos los lotes activos a su edad, agrupando por día
          const pesajesPorDia = {}
          lotes.filter(l => l.activo).forEach(lote => {
            const fechaInicio = lote.fecha_inicio ? new Date(lote.fecha_inicio) : null
            if (!fechaInicio) return
            const edadManual = lote.edad_dias_manual || 0
            pesajes.filter(p => {
              const loteId = p.lote?._id || p.lote
              return String(loteId) === String(lote._id) && p.peso_promedio
            }).forEach(p => {
              const fechaPesaje = new Date(p.createdAt)
              const diasDesdeInicio = Math.round((fechaPesaje - fechaInicio) / (1000 * 60 * 60 * 24))
              const dia = edadManual + diasDesdeInicio
              if (!pesajesPorDia[dia]) pesajesPorDia[dia] = []
              pesajesPorDia[dia].push(p.peso_promedio)
            })
          })
          // Promediar pesajes del mismo día
          const puntosPesaje = Object.entries(pesajesPorDia).map(([dia, pesos]) => ({
            dia: parseInt(dia),
            peso: Math.round((pesos.reduce((a, b) => a + b, 0) / pesos.length) * 100) / 100
          })).sort((a, b) => a.dia - b.dia)

          // Curva esperada recortada hasta edad actual + 4 semanas
          const limDia = Math.min(edadMax + 28, 180)
          const curva = [{ semana: 6, dia: 43, peso_esperado: 12, fase: 'Inicio' }]
          TABLA_INICIO.forEach(s => curva.push({ semana: 6 + s.semana, dia: s.edad_fin, peso_esperado: s.peso_final, fase: 'Inicio' }))
          TABLA_CRECIMIENTO.forEach(s => curva.push({ semana: 10 + s.semana, dia: s.edad_fin, peso_esperado: s.peso_final, fase: 'Crecimiento' }))
          TABLA_ENGORDE.forEach(s => curva.push({ semana: 17 + s.semana, dia: s.edad_fin, peso_esperado: s.peso_final, fase: 'Engorde' }))
          const curvaRecortada = curva.filter(p => p.dia <= limDia)

          // Construir datos con carry-forward (iniciar con peso inicial)
          const pesoInicial = Math.max(...lotes.filter(l => l.activo).map(l => l.peso_inicial_promedio || 0), 0)
          let lastReal = pesoInicial > 0 ? pesoInicial : null
          const datosGrafica = curvaRecortada.map(punto => {
            const pesajeEnDia = puntosPesaje.find(p => p.dia <= punto.dia && p.dia > (punto.dia - 7))
            puntosPesaje.forEach(p => { if (p.dia <= punto.dia) lastReal = p.peso })
            return {
              dia: punto.dia,
              semana: `Sem ${punto.semana}`,
              peso_esperado: punto.peso_esperado,
              peso_real: (punto.dia <= edadMax && lastReal !== null) ? lastReal : null,
              tienePesaje: !!puntosPesaje.find(p => Math.abs(p.dia - punto.dia) <= 3),
              fase: punto.fase
            }
          })

          const yMax = Math.max(...datosGrafica.map(d => d.peso_esperado || 0)) + 10

          return (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={datosGrafica}>
                <defs>
                  <linearGradient id="gradMetaDash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradReal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="semana" tick={{ fontSize: 10, fill: '#94a3b8' }} stroke="#e2e8f0" />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} stroke="#e2e8f0" unit=" kg" domain={[0, yMax]} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(255,255,255,0.97)', border: 'none', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}
                  formatter={(value, name) => {
                    if (name === 'peso_esperado') return [`${value} kg`, 'Meta Plan']
                    if (name === 'peso_real') return [`${value} kg`, 'Peso Real']
                    return [value, name]
                  }}
                  labelFormatter={(label) => {
                    const p = datosGrafica.find(d => d.semana === label)
                    return p ? `${label} — Día ${p.dia} (${p.fase})` : label
                  }}
                />
                <Legend />
                <Area type="monotone" dataKey="peso_esperado" stroke="#3b82f6" strokeWidth={2} strokeDasharray="6 3" fill="url(#gradMetaDash)" dot={false} name="Meta Plan" />
                <Area type="monotone" dataKey="peso_real" stroke="#22c55e" strokeWidth={3} fill="url(#gradReal)" dot={(props) => {
                  const { cx, cy, payload } = props
                  if (!payload.peso_real || !payload.tienePesaje) return null
                  return <circle cx={cx} cy={cy} r={5} fill="#22c55e" stroke="#fff" strokeWidth={2} />
                }} name="Peso Real" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          )
        })()}
      </div>
    </div>

    {/* Resumen Financiero - una sola gráfica limpia */}
    {historicoContable.length > 0 && (
      <div className="dashboard-section grafica-section grafica-full">
        <h3><DollarSign size={20} /> Resumen Financiero</h3>
        <div className="grafica-container">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={historicoContable}>
              <defs>
                <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.02}/>
                </linearGradient>
                <linearGradient id="gradGastos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94a3b8' }} stroke="#e2e8f0" />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} stroke="#e2e8f0" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: 'rgba(255,255,255,0.96)', border: 'none', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}
                formatter={(value) => [formatearDinero(value), '']}
              />
              <Legend />
              <Area type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#gradIngresos)" name="Ingresos" dot={{ r: 3, fill: '#fff', stroke: '#10b981', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }} />
              <Area type="monotone" dataKey="gastos" stroke="#ef4444" strokeWidth={2.5} fillOpacity={1} fill="url(#gradGastos)" name="Gastos" dot={{ r: 3, fill: '#fff', stroke: '#ef4444', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    )}

    {/* Lotes y Alertas */}
    <div className="dashboard-columns">
      {/* Lotes Activos */}
      <div className="dashboard-section">
        <h3><Package size={20} /> Lotes Activos</h3>
        <div className="lotes-resumen">
          {lotes.filter(l => l.activo).length === 0 ? (
            <p className="sin-datos">No hay lotes activos</p>
          ) : (
            lotes.filter(l => l.activo).map(lote => (
              <div key={lote._id} className="lote-card-mini">
                <div className="lote-mini-header">
                  <h4>{lote.nombre}</h4>
                  <span className={`estado-lote ${getEtapaAutomatica(lote.edad_dias || 0)}`}>{getEtapaAutomatica(lote.edad_dias || 0)}</span>
                </div>
                <div className="lote-info">
                  <span><PiggyBank size={14} /> {lote.cantidad_cerdos} cerdos</span>
                  <span><Weight size={14} /> {(lote.peso_promedio_actual || 0).toFixed(1)} kg/cerdo</span>
                  <span><TrendingUp size={14} /> {((lote.cantidad_cerdos || 0) * (lote.peso_promedio_actual || 0)).toFixed(1)} kg total</span>
                </div>
                <div className="lote-progreso">
                  <div className="progreso-label">Ganancia de peso</div>
                  <div className="progreso-barra">
                    <div 
                      className="progreso-fill"
                      style={{ width: `${Math.min(((lote.peso_promedio_actual || 0) / 100) * 100, 100)}%` }}
                    ></div>
                  </div>
                  <div className="progreso-valores">
                    <span>{(lote.peso_inicial_promedio || 0).toFixed(1)} kg</span>
                    <span>{(lote.peso_promedio_actual || 0).toFixed(1)} kg</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Alertas */}
      <div className="dashboard-section">
        <h3><Bell size={20} /> Últimas Alertas</h3>
        {alertas.length === 0 ? (
          <div className="sin-alertas">
            <CheckCircle size={48} className="icono-verde" />
            <p>No hay alertas recientes</p>
            <small>El sistema está funcionando correctamente</small>
          </div>
        ) : (
          <div className="alertas-lista">
            {alertas.slice(0, 5).map((alerta, i) => (
              <div key={i} className={`alerta-item ${alerta.tipo}`}>
                {alerta.tipo === 'critico' ? <XCircle size={20} className="alerta-icono" /> : 
                 alerta.tipo === 'alerta' ? <AlertTriangle size={20} className="alerta-icono" /> : 
                 <Bell size={20} className="alerta-icono" />}
                <div className="alerta-contenido">
                  <p>{alerta.mensaje}</p>
                  <small><Clock size={12} /> {formatearFecha(alerta.createdAt)}</small>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    {/* Actividad Reciente */}
    <div className="dashboard-section actividad-reciente">
      <h3><Activity size={20} /> Actividad Reciente</h3>
      <div className="actividad-lista">
        {pesajes.slice(0, 3).map((p, i) => (
          <div key={`pesaje-${i}`} className="actividad-item">
            <Weight size={18} className="actividad-icono" />
            <div className="actividad-info">
              <span>Pesaje registrado: <strong>{p.peso} kg</strong></span>
              <small>{p.lote?.nombre || 'Sin lote'} - {formatearFecha(p.createdAt)}</small>
            </div>
          </div>
        ))}
        {contabilidad.slice(0, 3).map((c, i) => (
          <div key={`conta-${i}`} className="actividad-item">
            {c.tipo === 'ingreso' ? <TrendingUp size={18} className="actividad-icono ingreso" /> : <TrendingDown size={18} className="actividad-icono gasto" />}
            <div className="actividad-info">
              <span>{c.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}: <strong>{formatearDinero(c.total)}</strong></span>
              <small>{c.categoria} - {formatearFecha(c.fecha)}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
)}{/* ════════════════════════════════════════════════════════════════ */}
{/* PÁGINA: LOTES (MEJORADA) */}
{/* ════════════════════════════════════════════════════════════════ */}
{pagina === 'lotes' && (
  <div className="page-lotes">
    <div className="page-header">
      <h2>Gestión de Lotes</h2>
      <div className="header-actions">
        <button className="btn-refresh" onClick={cargarLotes}>
          <RefreshCw size={18} />
        </button>
        <button className="btn-primary" onClick={() => {
          setLoteSeleccionado(null)
          setNuevoLote({
            nombre: '',
            cantidad_cerdos: 0,
            peso_inicial_promedio: 0,
            fecha_nacimiento: '',
            edad_dias_manual: '',
            corral: '',
            notas: ''
          })
          setMostrarModalLote(true)
        }}>
          <Plus size={18} />
          Nuevo Lote
        </button>
      </div>
    </div>

    {/* Vista de detalle de lote seleccionado */}
    {loteDetalle ? (
      <div className="lote-detalle-view">
        <button className="btn-volver" onClick={() => setLoteDetalle(null)}>
          ← Volver a lotes
        </button>
        
        {/* Info principal del lote */}
        <div className="lote-detalle-header">
          <div className="lote-detalle-titulo">
            <h3>{loteDetalle.nombre}</h3>
            <span className={`estado-lote ${getEtapaAutomatica(loteDetalle.edad_dias || 0)}`}>{getEtapaAutomatica(loteDetalle.edad_dias || 0)}</span>
          </div>
        </div>

        {/* Tarjetas de datos calculados */}
        <div className="lote-stats-grid">
          <div className="lote-stat-card">
            <Calendar size={24} />
            <div className="stat-info">
              <span className="stat-valor">{loteDetalle.edad_dias || 0} días</span>
              <span className="stat-label">Edad del Lote</span>
            </div>
          </div>
          <div className="lote-stat-card" style={{cursor: editandoCerdosDetalle ? 'default' : 'pointer'}}
            onClick={() => { if (!editandoCerdosDetalle) { setEditandoCerdosDetalle(true); setCantidadCerdosEdit(String(loteDetalle.cantidad_cerdos)) } }}>
            <PiggyBank size={24} />
            <div className="stat-info">
              {editandoCerdosDetalle ? (
                <div style={{display:'flex', gap:'4px', alignItems:'center'}} onClick={e => e.stopPropagation()}>
                  <input type="number" min="0" value={cantidadCerdosEdit}
                    onChange={e => setCantidadCerdosEdit(e.target.value)}
                    onKeyDown={async e => {
                      if (e.key === 'Enter') {
                        const n = parseInt(cantidadCerdosEdit)
                        if (!isNaN(n) && n >= 0) { await actualizarLote(loteDetalle._id, { cantidad_cerdos: n }); verDetalleLote(loteDetalle._id) }
                        setEditandoCerdosDetalle(false)
                      } else if (e.key === 'Escape') setEditandoCerdosDetalle(false)
                    }}
                    style={{width:'60px', fontSize:'18px', fontWeight:'800', border:'1px solid #3b82f6', borderRadius:'6px', padding:'2px 4px'}}
                    autoFocus />
                  <button onClick={async () => {
                    const n = parseInt(cantidadCerdosEdit)
                    if (!isNaN(n) && n >= 0) { await actualizarLote(loteDetalle._id, { cantidad_cerdos: n }); verDetalleLote(loteDetalle._id) }
                    setEditandoCerdosDetalle(false)
                  }} style={{background:'#22c55e', color:'white', border:'none', borderRadius:'4px', padding:'2px 6px', cursor:'pointer', fontSize:'12px'}}>✓</button>
                  <button onClick={() => setEditandoCerdosDetalle(false)}
                    style={{background:'none', border:'none', color:'#94a3b8', cursor:'pointer', fontSize:'14px'}}>✕</button>
                </div>
              ) : (
                <span className="stat-valor" title="Clic para editar">{loteDetalle.cantidad_cerdos} <span style={{fontSize:'12px', color:'#94a3b8'}}>✎</span></span>
              )}
              <span className="stat-label">Cerdos</span>
            </div>
          </div>
          <div className="lote-stat-card">
            <Weight size={24} />
            <div className="stat-info">
              <span className="stat-valor">{loteDetalle.peso_promedio_actual?.toFixed(1) || 0} kg</span>
              <span className="stat-label">Peso Prom. por Cerdo</span>
              {(() => {
                // Agrupar pesajes del lote por fecha (día), tomar el día más reciente
                const lotePs = pesajes.filter(p => String(p.lote?._id || p.lote) === String(loteDetalle._id) && p.peso_promedio)
                if (lotePs.length === 0) return null
                // Hallar la fecha del pesaje más reciente (por timestamp real, no por string de día)
                const masRecientePs = lotePs.reduce((a, b) => new Date(a.createdAt) > new Date(b.createdAt) ? a : b)
                const ultimaFecha = new Date(masRecientePs.createdAt).toDateString()
                const delDia = lotePs.filter(p => new Date(p.createdAt).toDateString() === ultimaFecha)
                // Calcular min/max: usar peso_min/peso_max si existen, o derivar de los pesos individuales
                const todosMin = delDia.map(p => p.peso_min ?? p.peso_promedio)
                const todosMax = delDia.map(p => p.peso_max ?? p.peso_promedio)
                const mn = Math.min(...todosMin), mx = Math.max(...todosMax)
                if (mn === mx) return null  // un solo valor, no hay rango
                return <span style={{fontSize:'11px', color:'#64748b', marginTop:'2px'}}>rango: {mn.toFixed(1)}–{mx.toFixed(1)} kg</span>
              })()}
            </div>
          </div>
          <div className="lote-stat-card destacado">
            <Package size={24} />
            <div className="stat-info">
              <span className="stat-valor">{loteDetalle.peso_total?.toFixed(1) || 0} kg</span>
              <span className="stat-label">Peso Total Lote</span>
            </div>
          </div>
          <div className="lote-stat-card">
            <TrendingUp size={24} />
            <div className="stat-info">
              <span className="stat-valor">{loteDetalle.ganancia_peso?.toFixed(1) || 0} kg</span>
              <span className="stat-label">Ganancia Promedio</span>
            </div>
          </div>
          {(() => {
            const edadDias    = loteDetalle.edad_dias || 0
            const gananciaCerdo = loteDetalle.ganancia_peso || 0
            const refFinca    = TABLA_FINCA.find(s => edadDias <= s.edad)
            const icaRef      = refFinca ? refFinca.conversion : null
            const faseActual  = getFaseActual(edadDias)
            const icaRefStr   = icaRef != null ? icaRef.toFixed(3) : (faseActual ? faseActual.conversion : null)

            // ICA Plan/Ganancia: alimento del plan ÷ ganancia real por cerdo
            const consumoPlan = getConsumoEstimado(edadDias, 1).consumo_acum_cerdo
            const icaEst  = gananciaCerdo > 0 && consumoPlan > 0 ? consumoPlan / gananciaCerdo : null
            const estBueno = icaEst != null && icaRef != null ? icaEst <= icaRef : null

            // ICA Real: alimento total registrado ÷ ganancia real por cerdo
            // (preciso porque se registra una carga semanal por lote)
            const alimCerdo1 = (loteDetalle.alimento_total_kg || 0) / (loteDetalle.cantidad_cerdos || 1)
            const icaReal   = gananciaCerdo > 0 && alimCerdo1 > 0 ? alimCerdo1 / gananciaCerdo : null
            const realBueno = icaReal != null && icaRef != null ? icaReal <= icaRef : null

            return (
              <>
                <div className="lote-stat-card">
                  <Activity size={24} />
                  <div className="stat-info">
                    <span className="stat-valor" style={icaEst != null ? {color: estBueno === true ? '#16a34a' : estBueno === false ? '#ef4444' : undefined} : {}}>
                      {icaEst != null ? icaEst.toFixed(2) : '—'}
                    </span>
                    <span className="stat-label">I.C.A. Plan/Ganancia</span>
                    {icaRefStr && <span style={{fontSize:'11px', color:'#64748b', marginTop:'2px'}}>ref: {icaRefStr}</span>}
                  </div>
                </div>
                <div className="lote-stat-card">
                  <Activity size={24} />
                  <div className="stat-info">
                    <span className="stat-valor" style={icaReal != null ? {color: realBueno === true ? '#16a34a' : realBueno === false ? '#ef4444' : undefined} : {}}>
                      {icaReal != null ? icaReal.toFixed(2) : '—'}
                    </span>
                    <span className="stat-label">I.C.A. Plan/Peso Actual</span>
                    {icaRefStr && <span style={{fontSize:'11px', color:'#64748b', marginTop:'2px'}}>ref: {icaRefStr}</span>}
                  </div>
                </div>
              </>
            )
          })()}
          {(() => {
            const consumo = getConsumoEstimado(loteDetalle.edad_dias || 0, loteDetalle.cantidad_cerdos || 1)
            return (
              <>
                <div className="lote-stat-card">
                  <BarChart3 size={24} />
                  <div className="stat-info">
                    <span className="stat-valor">{consumo.consumo_dia_total} kg/día</span>
                    <span className="stat-label">Alimento Diario (plan)</span>
                  </div>
                </div>
                <div className="lote-stat-card">
                  <Activity size={24} />
                  <div className="stat-info">
                    <span className="stat-valor" style={{textTransform:'capitalize'}}>{loteDetalle.etapa_automatica || 'destete'}</span>
                    <span className="stat-label">Etapa Actual</span>
                  </div>
                </div>
              </>
            )
          })()}
        </div>

        {/* Info adicional */}
        <div className="lote-info-adicional">
          <div className="info-item">
            <span className="info-label">Corral:</span>
            <span className="info-valor">{loteDetalle.corral || 'No asignado'}</span>
          </div>
          {(() => {
            const consumo = getConsumoEstimado(loteDetalle.edad_dias || 0, loteDetalle.cantidad_cerdos || 1)
            return consumo.consumo_acum_total > 0 ? (
              <>
                <div className="info-item">
                  <span className="info-label">Alimento Acumulado (plan):</span>
                  <span className="info-valor">{consumo.consumo_acum_total.toFixed(1)} kg total ({consumo.consumo_acum_cerdo.toFixed(1)} kg/cerdo)</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Consumo Diario (plan):</span>
                  <span className="info-valor">{consumo.consumo_dia_cerdo} kg/cerdo × {loteDetalle.cantidad_cerdos} = {consumo.consumo_dia_total} kg/día</span>
                </div>
              </>
            ) : null
          })()}
          <div className="info-item">
            <span className="info-label">Fecha Inicio:</span>
            <span className="info-valor">{new Date(loteDetalle.fecha_inicio).toLocaleDateString()}</span>
          </div>
          {loteDetalle.notas && (
            <div className="info-item full">
              <span className="info-label">Notas:</span>
              <span className="info-valor">{loteDetalle.notas}</span>
            </div>
          )}
        </div>

        {/* ═══ ALIMENTACIÓN DEL LOTE (desde inventario) ═══ */}
        <div className="dashboard-section" style={{marginBottom:'24px'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px', flexWrap:'wrap', gap:'10px'}}>
            <h3 style={{margin:0}}><Package size={20} /> Alimentación del Lote — <span style={{color:'#1d4ed8'}}>{loteDetalle.alimento_total_kg?.toFixed(1) || 0} kg registrados</span></h3>
            {(() => {
              const semActual = getSemanaISO()
              const yaReg = alimentacionLote.some(a => a.semana_iso === semActual && !a.es_historico)
              return (
                <div style={{display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap'}}>
                  {yaReg ? (
                    <span style={{fontSize:'13px', fontWeight:'600', color:'#16a34a', background:'#f0fdf4', border:'1px solid #86efac', padding:'5px 12px', borderRadius:'20px'}}>
                      ✓ {labelSemana(semActual)} registrada
                    </span>
                  ) : (
                    <button className="btn-primary btn-sm" onClick={async () => { await cargarInventarioAlimento(); setMostrarModalAlimInv(true) }}>
                      <Plus size={16} /> Registrar consumo de esta semana
                    </button>
                  )}
                  {(user?.rol === 'superadmin' || user?.rol === 'ingeniero') && (
                    <button className="btn-secondary btn-sm" style={{fontSize:'12px'}} onClick={() => setMostrarModalHistorico(true)}>
                      + Semana anterior
                    </button>
                  )}
                </div>
              )
            })()}
          </div>

          {/* Totales de alimento */}
          <div style={{display:'flex', gap:'12px', marginBottom:'16px', flexWrap:'wrap'}}>
            <div style={{padding:'10px 16px', background:'#eff6ff', borderRadius:'8px', flex:'1', minWidth:'140px'}}>
              <div style={{fontSize:'11px', color:'#64748b'}}>Total alimento</div>
              <div style={{fontWeight:'700', fontSize:'18px', color:'#1d4ed8'}}>{loteDetalle.alimento_total_kg?.toFixed(1) || 0} kg</div>
            </div>
            <div style={{padding:'10px 16px', background:'#fef2f2', borderRadius:'8px', flex:'1', minWidth:'140px'}}>
              <div style={{fontSize:'11px', color:'#64748b'}}>Costo alimento</div>
              <div style={{fontWeight:'700', fontSize:'18px', color:'#ef4444'}}>${(loteDetalle.costo_alimento_total || 0).toLocaleString()}</div>
            </div>
            {loteDetalle.cantidad_cerdos > 0 && (
              <div style={{padding:'10px 16px', background:'#f0fdf4', borderRadius:'8px', flex:'1', minWidth:'140px'}}>
                <div style={{fontSize:'11px', color:'#64748b'}}>Kg/cerdo</div>
                <div style={{fontWeight:'700', fontSize:'18px', color:'#16a34a'}}>{((loteDetalle.alimento_total_kg || 0) / loteDetalle.cantidad_cerdos).toFixed(1)} kg</div>
              </div>
            )}
            {(() => {
              const edadDias     = loteDetalle.edad_dias || 0
              const gananciaCerdo = loteDetalle.ganancia_peso || 0
              const refFinca     = TABLA_FINCA.find(s => edadDias <= s.edad)
              const icaRef       = refFinca ? refFinca.conversion : null
              const faseActual   = getFaseActual(edadDias)
              const icaRefStr    = icaRef != null ? icaRef.toFixed(3) : (faseActual ? faseActual.conversion : null)
              if (gananciaCerdo <= 0) return null

              // ICA Plan/Ganancia: alimento del plan ÷ ganancia real por cerdo
              const consumoPlan  = getConsumoEstimado(edadDias, 1).consumo_acum_cerdo
              const icaEst       = consumoPlan > 0 && gananciaCerdo > 0 ? consumoPlan / gananciaCerdo : null
              const estBueno     = icaEst != null && icaRef != null ? icaEst <= icaRef : null

              // ICA Real: alimento total registrado ÷ ganancia real por cerdo
              const alimCerdo2   = (loteDetalle.alimento_total_kg || 0) / (loteDetalle.cantidad_cerdos || 1)
              const icaReal      = gananciaCerdo > 0 && alimCerdo2 > 0 ? alimCerdo2 / gananciaCerdo : null
              const realBueno    = icaReal != null && icaRef != null ? icaReal <= icaRef : null

              const cardStyle = (ok) => ({
                padding:'10px 16px', borderRadius:'8px', flex:'1', minWidth:'140px',
                background: ok === true ? '#f0fdf4' : ok === false ? '#fef2f2' : '#f8fafc',
                border: ok === false ? '1px solid #fca5a5' : ok === true ? '1px solid #86efac' : '1px solid #e2e8f0'
              })
              const valColor = (ok) => ok === true ? '#16a34a' : ok === false ? '#ef4444' : '#374151'

              return (
                <>
                  {icaEst != null && (
                    <div style={cardStyle(estBueno)}>
                      <div style={{fontSize:'11px', color:'#64748b'}}>I.C.A. Plan/Ganancia</div>
                      <div style={{fontWeight:'700', fontSize:'18px', color: valColor(estBueno)}}>{icaEst.toFixed(2)}</div>
                      {icaRefStr && <div style={{fontSize:'11px', color:'#94a3b8', marginTop:'2px'}}>ref: {icaRefStr}</div>}
                    </div>
                  )}
                  {icaReal != null && (
                    <div style={cardStyle(realBueno)}>
                      <div style={{fontSize:'11px', color:'#64748b'}}>I.C.A. Real</div>
                      <div style={{fontWeight:'700', fontSize:'18px', color: valColor(realBueno)}}>{icaReal.toFixed(2)}</div>
                      {icaRefStr && <div style={{fontSize:'11px', color:'#94a3b8', marginTop:'2px'}}>ref: {icaRefStr}</div>}
                    </div>
                  )}
                </>
              )
            })()}
          </div>

          {/* Historial de alimentación */}
          {alimentacionLote.length === 0 ? (
            <p className="sin-datos">No hay registros de alimentación. Usa el botón "Registrar Consumo".</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Semana</th>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Precio/kg</th>
                    <th>Total</th>
                    <th>Notas</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {alimentacionLote.slice(0, 10).map(a => (
                    <tr key={a._id}>
                      <td>{a.semana_iso ? labelSemana(a.semana_iso) : new Date(a.fecha).toLocaleDateString('es-CO')}{a.es_historico && <span style={{fontSize:'10px', color:'#94a3b8', marginLeft:'4px'}}>(hist.)</span>}</td>
                      <td><span className="tipo-badge">{a.tipo_alimento}</span></td>
                      <td><strong>{a.cantidad_kg?.toFixed(1)} kg</strong></td>
                      <td>${(a.precio_kg || 0).toLocaleString()}/kg</td>
                      <td style={{color:'#ef4444', fontWeight:'600'}}>${(a.total || 0).toLocaleString()}</td>
                      <td style={{fontSize:'12px', color:'#64748b'}}>{a.notas || '-'}</td>
                      <td>
                        <button className="btn-icon btn-danger" onClick={() => eliminarAlimentacion(a._id)} title="Eliminar">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Modal registrar consumo desde inventario */}
          {mostrarModalAlimInv && (
            <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setMostrarModalAlimInv(false) }}>
              <div className="modal-content" style={{maxWidth:'500px'}}>
                <div className="modal-header">
                  <h3><Package size={18} /> Registrar Carga Semanal de Tolva
                    <span style={{fontSize:'12px', fontWeight:'normal', color:'#64748b', marginLeft:'10px'}}>({labelSemana(getSemanaISO())})</span>
                  </h3>
                  <button className="btn-close" onClick={() => setMostrarModalAlimInv(false)}>×</button>
                </div>
                <div style={{padding:'16px'}}>

                  {/* Selector de producto */}
                  <div className="form-group" style={{marginBottom:'12px'}}>
                    <label>Producto de Inventario</label>
                    <select
                      value={nuevaAlimInv.inventario_id}
                      onChange={e => setNuevaAlimInv({...nuevaAlimInv, inventario_id: e.target.value, cantidad_kg: ''})}
                    >
                      <option value="">— Selecciona producto —</option>
                      {inventarioAlimento.map(inv => {
                        const kg_disp = inv.cantidad_bultos * (inv.peso_por_bulto_kg || 40)
                        return (
                          <option key={inv._id} value={inv._id} disabled={inv.cantidad_bultos <= 0}>
                            {inv.nombre} ({inv.tipo}) — {inv.cantidad_bultos > 0
                              ? `${kg_disp.toFixed(1)} kg disponibles`
                              : 'SIN STOCK'}
                          </option>
                        )
                      })}
                    </select>
                    {inventarioAlimento.length === 0 && (
                      <small style={{color:'#ef4444'}}>No hay productos registrados. Ve a Inventario &gt; Alimento.</small>
                    )}
                    {inventarioAlimento.length > 0 && inventarioAlimento.every(i => i.cantidad_bultos <= 0) && (
                      <small style={{color:'#ef4444'}}>Todos los productos tienen stock 0. Registra una entrada primero.</small>
                    )}
                  </div>

                  {/* Preview disponible + cálculo en tiempo real */}
                  {nuevaAlimInv.inventario_id && (() => {
                    const inv = inventarioAlimento.find(i => i._id === nuevaAlimInv.inventario_id)
                    if (!inv) return null
                    const pesoPorBulto     = inv.peso_por_bulto_kg || 40
                    const disponible_kg    = inv.cantidad_bultos * pesoPorBulto
                    const kg_ingresado     = Number(nuevaAlimInv.cantidad_kg) || 0
                    const bultos_consume   = kg_ingresado / pesoPorBulto
                    const restante_bultos  = inv.cantidad_bultos - bultos_consume
                    const restante_enteros = Math.floor(restante_bultos)
                    const restante_kg_suelto = Math.round((restante_bultos - restante_enteros) * pesoPorBulto * 10) / 10
                    const costo_consume    = bultos_consume * inv.precio_bulto
                    const excede           = kg_ingresado > disponible_kg

                    return (
                      <>
                        {/* Stock actual */}
                        <div style={{padding:'10px 14px', background:'#eff6ff', borderRadius:'8px', marginBottom:'12px', fontSize:'13px', border:'1px solid #bfdbfe'}}>
                          <div style={{fontWeight:'700', marginBottom:'4px', color:'#1d4ed8'}}>{inv.nombre}</div>
                          <div style={{display:'flex', gap:'16px', flexWrap:'wrap', color:'#374151'}}>
                            <span>Stock: <strong>{inv.cantidad_bultos} bultos</strong> = <strong>{disponible_kg.toFixed(1)} kg</strong></span>
                            <span style={{color:'#6b7280'}}>{pesoPorBulto} kg/bulto · ${inv.precio_bulto?.toLocaleString()}/bulto</span>
                          </div>
                        </div>

                        {/* Input kg */}
                        <div className="form-row" style={{marginBottom:'8px'}}>
                          <div className="form-group">
                            <label>Kg cargados en tolva esta semana *</label>
                            <input
                              type="number" min="0.1" step="0.1"
                              value={nuevaAlimInv.cantidad_kg}
                              onChange={e => setNuevaAlimInv({...nuevaAlimInv, cantidad_kg: e.target.value})}
                              placeholder="Ej: 56"
                              style={excede ? {borderColor:'#ef4444'} : {}}
                              autoFocus
                            />
                            {excede && <small style={{color:'#ef4444'}}>Supera el stock disponible ({disponible_kg.toFixed(1)} kg)</small>}
                          </div>
                          <div className="form-group">
                            <label>Notas (opcional)</label>
                            <input
                              type="text"
                              value={nuevaAlimInv.notas}
                              onChange={e => setNuevaAlimInv({...nuevaAlimInv, notas: e.target.value})}
                              placeholder="Ej: Mañana, tarde..."
                            />
                          </div>
                        </div>

                        {/* Resultado en tiempo real */}
                        {kg_ingresado > 0 && !excede && (
                          <div style={{padding:'12px 14px', background:'#f0fdf4', borderRadius:'8px', border:'1px solid #bbf7d0', fontSize:'13px'}}>
                            {/* Cálculo por cerdo */}
                            {loteDetalle?.cantidad_cerdos > 0 && (
                              <div style={{background:'#ecfdf5', border:'1px solid #6ee7b7', borderRadius:'6px', padding:'8px 12px', marginBottom:'10px', display:'flex', gap:'20px', flexWrap:'wrap'}}>
                                <div style={{textAlign:'center'}}>
                                  <div style={{fontSize:'11px', color:'#065f46', fontWeight:'600'}}>KG/CERDO SEMANA</div>
                                  <div style={{fontSize:'18px', fontWeight:'800', color:'#064e3b'}}>{(kg_ingresado / loteDetalle.cantidad_cerdos).toFixed(2)} kg</div>
                                </div>
                                <div style={{textAlign:'center'}}>
                                  <div style={{fontSize:'11px', color:'#065f46', fontWeight:'600'}}>KG/CERDO/DÍA</div>
                                  <div style={{fontSize:'18px', fontWeight:'800', color:'#064e3b'}}>{(kg_ingresado / loteDetalle.cantidad_cerdos / 7).toFixed(3)} kg</div>
                                </div>
                                <div style={{textAlign:'center'}}>
                                  <div style={{fontSize:'11px', color:'#065f46', fontWeight:'600'}}>CERDOS</div>
                                  <div style={{fontSize:'18px', fontWeight:'800', color:'#064e3b'}}>{loteDetalle.cantidad_cerdos}</div>
                                </div>
                              </div>
                            )}
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px'}}>
                              <div>
                                <div style={{color:'#6b7280', fontSize:'11px', marginBottom:'2px'}}>TOTAL TOLVA</div>
                                <div style={{fontWeight:'700', color:'#15803d'}}>{kg_ingresado.toFixed(1)} kg</div>
                                <div style={{color:'#374151'}}>= {bultos_consume.toFixed(3)} bultos</div>
                                <div style={{color:'#374151'}}>Costo: <strong>${Math.round(costo_consume).toLocaleString()}</strong></div>
                              </div>
                              <div>
                                <div style={{color:'#6b7280', fontSize:'11px', marginBottom:'2px'}}>QUEDARÁ EN INVENTARIO</div>
                                <div style={{fontWeight:'700', color: restante_bultos <= (inv.stock_minimo_bultos || 5) ? '#dc2626' : '#1e293b'}}>
                                  {restante_enteros} bultos + {restante_kg_suelto} kg
                                </div>
                                <div style={{color:'#374151'}}>= {(restante_bultos * pesoPorBulto).toFixed(1)} kg total</div>
                                {restante_bultos <= (inv.stock_minimo_bultos || 5) && (
                                  <div style={{color:'#dc2626', fontWeight:'600', fontSize:'11px', marginTop:'2px'}}>Stock bajo el mínimo</div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()}

                  <div className="modal-actions" style={{marginTop:'16px'}}>
                    <button className="btn-cancelar" onClick={() => setMostrarModalAlimInv(false)}>Cancelar</button>
                    <button className="btn-primary" onClick={registrarAlimentacionDesdeInventario} disabled={cargandoAlimInv}>
                      {cargandoAlimInv ? 'Registrando...' : 'Registrar y Descontar Inventario'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ Modal: Semanas anteriores (superadmin/ingeniero) ══ */}
          {mostrarModalHistorico && (
            <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setMostrarModalHistorico(false) }}>
              <div className="modal-content" style={{maxWidth:'460px'}}>
                <div className="modal-header">
                  <h3><Package size={18} /> Ingresar semana anterior</h3>
                  <button className="btn-close" onClick={() => setMostrarModalHistorico(false)}>×</button>
                </div>
                <div style={{padding:'16px'}}>
                  <div style={{background:'#fef3c7', border:'1px solid #fcd34d', borderRadius:'8px', padding:'10px 14px', marginBottom:'16px', fontSize:'13px', color:'#92400e'}}>
                    Este registro <strong>no descuenta inventario</strong>. Úsalo para ingresar datos históricos de semanas pasadas y mejorar el cálculo del ICA.
                  </div>

                  <div className="form-row" style={{marginBottom:'12px'}}>
                    <div className="form-group">
                      <label>Semana (formato YYYY-WNN) *</label>
                      <input
                        type="text"
                        value={nuevoHistorico.semana_iso}
                        onChange={e => setNuevoHistorico({...nuevoHistorico, semana_iso: e.target.value})}
                        placeholder="ej: 2026-W07"
                      />
                      <small style={{color:'#64748b'}}>
                        Semana actual: <strong>{getSemanaISO()}</strong> — para semanas anteriores resta 1, 2, etc. al número
                      </small>
                    </div>
                    <div className="form-group">
                      <label>Tipo de alimento</label>
                      <select value={nuevoHistorico.tipo_alimento} onChange={e => setNuevoHistorico({...nuevoHistorico, tipo_alimento: e.target.value})}>
                        <option value="iniciador">Iniciador</option>
                        <option value="levante">Levante</option>
                        <option value="engorde">Engorde</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row" style={{marginBottom:'12px'}}>
                    <div className="form-group">
                      <label>Kg cargados en tolva esa semana *</label>
                      <input
                        type="number" min="0.1" step="0.1"
                        value={nuevoHistorico.cantidad_kg}
                        onChange={e => setNuevoHistorico({...nuevoHistorico, cantidad_kg: e.target.value})}
                        placeholder="ej: 56"
                        autoFocus
                      />
                      {nuevoHistorico.cantidad_kg > 0 && loteDetalle.cantidad_cerdos > 0 && (
                        <small style={{color:'#16a34a', fontWeight:'600'}}>
                          = {(Number(nuevoHistorico.cantidad_kg) / loteDetalle.cantidad_cerdos).toFixed(2)} kg/cerdo · {(Number(nuevoHistorico.cantidad_kg) / loteDetalle.cantidad_cerdos / 7).toFixed(3)} kg/cerdo/día
                        </small>
                      )}
                    </div>
                    <div className="form-group">
                      <label>Precio/kg (opcional)</label>
                      <input
                        type="number" min="0" step="1"
                        value={nuevoHistorico.precio_kg}
                        onChange={e => setNuevoHistorico({...nuevoHistorico, precio_kg: e.target.value})}
                        placeholder="ej: 2807"
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{marginBottom:'16px'}}>
                    <label>Notas (opcional)</label>
                    <input
                      type="text"
                      value={nuevoHistorico.notas}
                      onChange={e => setNuevoHistorico({...nuevoHistorico, notas: e.target.value})}
                      placeholder="ej: Registro retroactivo"
                    />
                  </div>

                  <div className="modal-actions">
                    <button className="btn-cancelar" onClick={() => setMostrarModalHistorico(false)}>Cancelar</button>
                    <button className="btn-primary" onClick={registrarConsumoHistoricoFn} disabled={cargandoHistorico}>
                      {cargandoHistorico ? 'Registrando...' : 'Guardar semana anterior'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══ GASTOS SEMANALES DEL LOTE ═══ */}
        <div className="dashboard-section" style={{marginBottom:'24px'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px'}}>
            <h3><DollarSign size={20} /> Gastos del Lote — Total: <span style={{color:'#ef4444'}}>{formatearDinero(totalGastosLote)}</span></h3>
            <button className="btn-primary btn-sm" onClick={() => setMostrarFormGasto(!mostrarFormGasto)}>
              <Plus size={16} /> {mostrarFormGasto ? 'Cancelar' : 'Agregar Gasto'}
            </button>
          </div>

          {/* Formulario nuevo gasto */}
          {mostrarFormGasto && (
            <div style={{background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'12px', padding:'16px', marginBottom:'16px'}}>
              <div className="form-row">
                <div className="form-group">
                  <label>Descripción</label>
                  <input type="text" value={nuevoGasto.descripcion} onChange={e => setNuevoGasto({...nuevoGasto, descripcion: e.target.value})} placeholder="Ej: Medicamento semanal, Mano de obra..." />
                </div>
                <div className="form-group">
                  <label>Categoría</label>
                  <select value={nuevoGasto.categoria} onChange={e => setNuevoGasto({...nuevoGasto, categoria: e.target.value})}>
                    <option value="alimento">Alimento</option>
                    <option value="medicamento">Medicamento</option>
                    <option value="mantenimiento">Mantenimiento</option>
                    <option value="servicio">Servicio</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Monto ($)</label>
                  <input type="number" value={nuevoGasto.monto} onChange={e => setNuevoGasto({...nuevoGasto, monto: e.target.value})} placeholder="0" min="1" />
                </div>
              </div>
              <button className="btn-primary" onClick={() => registrarGastoSemanal(loteDetalle._id)}>
                Registrar Gasto y Sincronizar Finanzas
              </button>
            </div>
          )}

          {/* Lista de gastos */}
          {gastosSemanales.length === 0 ? (
            <p className="sin-datos">No hay gastos registrados para este lote</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Semana</th>
                    <th>Fecha</th>
                    <th>Categoría</th>
                    <th>Descripción</th>
                    <th>Monto</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {gastosSemanales.map(g => (
                    <tr key={g._id}>
                      <td>Sem {g.semana}/{g.ano}</td>
                      <td>{new Date(g.fecha).toLocaleDateString('es-CO')}</td>
                      <td><span className="tipo-badge">{g.categoria}</span></td>
                      <td>{g.descripcion || '-'}</td>
                      <td><strong style={{color:'#ef4444'}}>{formatearDinero(g.monto)}</strong></td>
                      <td>
                        <button className="btn-icon btn-danger" onClick={() => eliminarGastoSemanal(loteDetalle._id, g._id)}>
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  <tr style={{background:'#fef2f2', fontWeight:'bold'}}>
                    <td colSpan="4" style={{textAlign:'right'}}>Total Gastos del Lote:</td>
                    <td style={{color:'#ef4444'}}>{formatearDinero(totalGastosLote)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Gráfica Comparativa: Peso Real vs Esperado */}
        <div className="dashboard-section grafica-section">
          <div style={{display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap', marginBottom:'4px'}}>
            <h3 style={{margin:0}}><LineChartIcon size={20} /> Peso Real vs Plan de Producción</h3>
            {(loteDetalle.edad_dias || 0) >= 43 && (
              <span style={{fontSize:'12px', fontWeight:'600', color:'#d97706', background:'#fef3c7', border:'1px solid #fcd34d', padding:'3px 10px', borderRadius:'20px'}}>
                Estamos en la Semana {Math.floor((loteDetalle.edad_dias || 0) / 7)} — Día {loteDetalle.edad_dias}
              </span>
            )}
          </div>
          <div className="grafica-container">
            {(() => {
              const edadLote = loteDetalle.edad_dias || 0
              const fechaInicio = loteDetalle.fecha_inicio ? new Date(loteDetalle.fecha_inicio) : null
              const edadManual = loteDetalle.edad_dias_manual || 0

              // Mapear pesajes a edad del cerdo, agrupando por día
              const pesajesLote = pesajes.filter(p => {
                const loteId = p.lote?._id || p.lote
                return String(loteId) === String(loteDetalle._id) && p.peso_promedio
              })
              const pesajesPorDia = {}
              if (fechaInicio) {
                pesajesLote.forEach(p => {
                  const fechaPesaje = new Date(p.createdAt)
                  const diasDesdeInicio = Math.round((fechaPesaje - fechaInicio) / (1000 * 60 * 60 * 24))
                  const dia = edadManual + diasDesdeInicio
                  if (!pesajesPorDia[dia]) pesajesPorDia[dia] = { pesos: [], mins: [], maxs: [] }
                  pesajesPorDia[dia].pesos.push(p.peso_promedio)
                  if (p.peso_min != null) pesajesPorDia[dia].mins.push(p.peso_min)
                  if (p.peso_max != null) pesajesPorDia[dia].maxs.push(p.peso_max)
                })
              }
              const puntosPesaje = Object.entries(pesajesPorDia).map(([dia, data]) => ({
                dia: parseInt(dia),
                peso: Math.round((data.pesos.reduce((a, b) => a + b, 0) / data.pesos.length) * 100) / 100,
                // Si hay min/max explícito úsalos; si no, derivar del rango de pesos individuales del día
                peso_min: data.mins.length > 0 ? Math.min(...data.mins) : (data.pesos.length > 1 ? Math.min(...data.pesos) : null),
                peso_max: data.maxs.length > 0 ? Math.max(...data.maxs) : (data.pesos.length > 1 ? Math.max(...data.pesos) : null)
              })).sort((a, b) => a.dia - b.dia)

              // Curva esperada recortada hasta edad actual + 4 semanas
              const limDia = Math.min(edadLote + 28, 180)
              const curvaEsperada = [{ semana: 6, dia: 43, peso_esperado: 12, fase: 'Inicio' }]
              TABLA_INICIO.forEach(s => curvaEsperada.push({ semana: 6 + s.semana, dia: s.edad_fin, peso_esperado: s.peso_final, fase: 'Inicio' }))
              TABLA_CRECIMIENTO.forEach(s => curvaEsperada.push({ semana: 10 + s.semana, dia: s.edad_fin, peso_esperado: s.peso_final, fase: 'Crecimiento' }))
              TABLA_ENGORDE.forEach(s => curvaEsperada.push({ semana: 17 + s.semana, dia: s.edad_fin, peso_esperado: s.peso_final, fase: 'Engorde' }))
              const curvaRecortada = curvaEsperada.filter(p => p.dia <= limDia)

              // Añadir peso actual como punto de hoy si no hay pesaje reciente
              const pesoActualHoy = loteDetalle.peso_promedio_actual || 0
              if (pesoActualHoy > 0) {
                const hayPesajeHoy = puntosPesaje.some(p => Math.abs(p.dia - edadLote) <= 4)
                if (!hayPesajeHoy) {
                  puntosPesaje.push({ dia: edadLote, peso: pesoActualHoy, peso_min: null, peso_max: null })
                  puntosPesaje.sort((a, b) => a.dia - b.dia)
                }
              }

              // Construir datos con carry-forward
              // limReal = semana actual (mismo punto que la línea "Hoy"), sin avanzar más
              const semanaHoyDia = Math.floor(edadLote / 7) * 7
              const limReal = Math.max(edadLote, semanaHoyDia)
              let lastReal = (loteDetalle.peso_inicial_promedio || 0) > 0 ? loteDetalle.peso_inicial_promedio : null
              let lastRealMin = null, lastRealMax = null
              const datosGrafica = curvaRecortada.map(punto => {
                puntosPesaje.forEach(p => {
                  if (p.dia <= punto.dia) {
                    lastReal = p.peso
                    if (p.peso_min != null) lastRealMin = p.peso_min
                    if (p.peso_max != null) lastRealMax = p.peso_max
                  }
                })
                const enRango = punto.dia <= limReal && lastReal !== null
                return {
                  dia: punto.dia,
                  semana: `Sem ${punto.semana}`,
                  peso_esperado: punto.peso_esperado,
                  peso_real: enRango ? lastReal : null,
                  peso_rango_min: (enRango && lastRealMin !== null) ? lastRealMin : null,
                  peso_rango_max: (enRango && lastRealMax !== null) ? lastRealMax : null,
                  tienePesaje: !!puntosPesaje.find(p => Math.abs(p.dia - punto.dia) <= 3),
                  fase: punto.fase
                }
              })

              const yMax = Math.max(...datosGrafica.map(d => Math.max(d.peso_esperado || 0, d.peso_real || 0, d.peso_rango_max || 0))) + 10
              const hayRango = datosGrafica.some(d => d.peso_rango_min !== null)

              return (
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={datosGrafica}>
                    <defs>
                      <linearGradient id="gradMetaLote" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradRealLote" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradRangoLote" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="semana" tick={{ fontSize: 10, fill: '#94a3b8' }} stroke="#e2e8f0" />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} stroke="#e2e8f0" unit=" kg" domain={[0, yMax]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(255,255,255,0.97)', border: 'none', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}
                      formatter={(value, name) => {
                        if (name === 'peso_esperado') return [`${value} kg`, 'Meta Plan']
                        if (name === 'peso_real') return [`${value} kg`, 'Peso Prom. Real']
                        if (name === 'peso_rango_max') return [`${value} kg`, 'Peso máx (rango)']
                        if (name === 'peso_rango_min') return [`${value} kg`, 'Peso mín (rango)']
                        return [value, name]
                      }}
                      labelFormatter={(label) => {
                        const punto = datosGrafica.find(d => d.semana === label)
                        if (!punto) return label
                        const pesaje = puntosPesaje.find(p => p.dia === punto.dia)
                        let texto = `Día ${punto.dia} (${punto.fase})`
                        if (pesaje) texto += ' — Pesaje registrado'
                        return texto
                      }}
                    />
                    <Legend formatter={name => ({
                      'peso_esperado': 'Meta Plan',
                      'peso_real': 'Peso Real',
                      'peso_rango_max': 'Rango máx',
                      'peso_rango_min': 'Rango mín'
                    }[name] || name)} />
                    {/* Línea vertical: posición actual */}
                    {(() => {
                      const semHoy = `Sem ${Math.floor(edadLote / 7)}`
                      const existe = datosGrafica.some(d => d.semana === semHoy)
                      if (!existe) return null
                      return <ReferenceLine x={semHoy} stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 3" label={{ value: 'Hoy', position: 'top', fontSize: 10, fill: '#d97706', fontWeight: '700' }} />
                    })()}
                    <Area type="monotone" dataKey="peso_esperado" stroke="#3b82f6" strokeWidth={2} strokeDasharray="6 3" fill="url(#gradMetaLote)" dot={false} name="peso_esperado" />
                    {hayRango && <Area type="monotone" dataKey="peso_rango_max" stroke="#22c55e" strokeWidth={1} strokeDasharray="3 3" fill="url(#gradRangoLote)" dot={false} name="peso_rango_max" connectNulls />}
                    {hayRango && <Area type="monotone" dataKey="peso_rango_min" stroke="#22c55e" strokeWidth={1} strokeDasharray="3 3" fill="white" dot={false} name="peso_rango_min" connectNulls />}
                    <Area type="monotone" dataKey="peso_real" stroke="#22c55e" strokeWidth={3} fill="url(#gradRealLote)" dot={(props) => {
                      const { cx, cy, payload } = props
                      if (!payload.peso_real || !payload.tienePesaje) return null
                      return <circle cx={cx} cy={cy} r={5} fill="#22c55e" stroke="#fff" strokeWidth={2} />
                    }} name="peso_real" connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              )
            })()}
          </div>
        </div>

        {/* ═══ TABLA COMPARATIVA FINCA - Programa Alimentación ═══ */}
        <div className="dashboard-section finca-section">
          <div className="finca-header-row">
            <h3><BarChart3 size={20} /> Plan de Producción Porcina</h3>
            <button
              className="btn-toggle-finca"
              onClick={() => setMostrarTablaFinca(!mostrarTablaFinca)}
            >
              {mostrarTablaFinca ? 'Ocultar' : 'Ver Plan Completo'}
              <ChevronRight size={16} className={mostrarTablaFinca ? 'rotado' : ''} />
            </button>
          </div>

          {/* Indicadores rápidos - Ciclo completo */}
          {(() => {
            const edadLote = loteDetalle.edad_dias || 0
            const faseActual = getFaseActual(edadLote)
            const refSemana = getRefSemana(edadLote)

            if (!faseActual) return <p className="sin-datos">El lote no está en rango de producción (días 43-180)</p>

            const pesoReal = loteDetalle.peso_promedio_actual || 0
            const pesoMeta = refSemana ? refSemana.peso_final : faseActual.peso_max
            const diffPeso = pesoReal - pesoMeta
            const semanaEnFase = refSemana ? refSemana.semana : '—'
            const consumoRef = refSemana ? (refSemana.consumo_dia || `${refSemana.consumo_dia_min}-${refSemana.consumo_dia_max}`) : '—'
            // Rango de pesos: derivar del último día de pesajes (min/max explícito o de pesos individuales)
            const lotePs = pesajes.filter(p => String(p.lote?._id || p.lote) === String(loteDetalle._id) && p.peso_promedio)
            const masRecienteFinca = lotePs.length > 0 ? lotePs.reduce((a, b) => new Date(a.createdAt) > new Date(b.createdAt) ? a : b) : null
            const ultimaFechaFinca = masRecienteFinca ? new Date(masRecienteFinca.createdAt).toDateString() : null
            const delDiaFinca = ultimaFechaFinca ? lotePs.filter(p => new Date(p.createdAt).toDateString() === ultimaFechaFinca) : []
            const fincaMn = delDiaFinca.length > 0 ? Math.min(...delDiaFinca.map(p => p.peso_min ?? p.peso_promedio)) : null
            const fincaMx = delDiaFinca.length > 0 ? Math.max(...delDiaFinca.map(p => p.peso_max ?? p.peso_promedio)) : null
            const hayRangoFinca = fincaMn !== null && fincaMx !== null && fincaMn !== fincaMx

            return (
              <div className="finca-indicadores">
                <div className={`finca-indicador ${diffPeso >= 0 ? 'positivo' : 'negativo'}`}>
                  <span className="finca-label">Peso vs Meta</span>
                  <span className="finca-valor">{pesoReal.toFixed(1)} / {pesoMeta} kg</span>
                  <span className="finca-diff">{diffPeso >= 0 ? '+' : ''}{diffPeso.toFixed(1)} kg</span>
                  {hayRangoFinca && (
                    <span style={{fontSize:'11px', color:'#64748b', marginTop:'2px'}}>
                      rango: {fincaMn.toFixed(1)}–{fincaMx.toFixed(1)} kg
                    </span>
                  )}
                </div>
                <div className="finca-indicador info">
                  <span className="finca-label">Fase Actual</span>
                  <span className="finca-valor">{faseActual.nombre}</span>
                  <span className="finca-diff">Sem {semanaEnFase} de fase</span>
                </div>
                <div className="finca-indicador info">
                  <span className="finca-label">Edad</span>
                  <span className="finca-valor">{edadLote} días</span>
                  <span className="finca-diff">Ganancia ref: {faseActual.ganancia_dia}</span>
                </div>
                <div className="finca-indicador info">
                  <span className="finca-label">Consumo/día ref</span>
                  <span className="finca-valor">{consumoRef} kg</span>
                  <span className="finca-diff">Conv. ref: {faseActual.conversion}</span>
                </div>
              </div>
            )
          })()}

          {mostrarTablaFinca && (
            <div className="table-container tabla-finca-scroll">
              {/* Resumen de fases */}
              <div className="fases-resumen">
                {FASES_PRODUCCION.map((fase, i) => {
                  const edadLote = loteDetalle.edad_dias || 0
                  const esActual = edadLote >= fase.edad_min && edadLote <= fase.edad_max
                  return (
                    <div key={i} className={`fase-card ${fase.nombre.toLowerCase()} ${esActual ? 'fase-activa' : ''}`}>
                      <h4>{i + 1}. {fase.nombre}</h4>
                      <p>Edad: {fase.edad_min}-{fase.edad_max} días</p>
                      <p>Peso: {fase.peso_min} → {fase.peso_max} kg</p>
                      <p>Ganancia: {fase.ganancia_dia}/día</p>
                      <p>Conversión: {fase.conversion}</p>
                    </div>
                  )
                })}
              </div>

              {/* Tabla Fase Inicio */}
              <h4 className="tabla-fase-titulo inicio">Fase Inicio (Días 43-70) — 12 → 25 kg</h4>
              <table className="tabla-finca">
                <thead>
                  <tr>
                    <th>Sem</th>
                    <th>Días</th>
                    <th>Peso Final (kg)</th>
                    <th>Consumo/día (kg)</th>
                    <th>Consumo/sem por cerdo (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {TABLA_INICIO.map(f => {
                    const edadLote = loteDetalle.edad_dias || 0
                    const esActual = edadLote >= f.edad_inicio && edadLote <= f.edad_fin
                    return (
                      <tr key={f.semana} className={`inicio ${esActual ? 'semana-actual' : ''}`}>
                        <td>{f.semana}</td>
                        <td>{f.edad_inicio}-{f.edad_fin}</td>
                        <td><strong>{f.peso_final}</strong></td>
                        <td>{f.consumo_dia_min}-{f.consumo_dia_max}</td>
                        <td>{f.consumo_sem_min}-{f.consumo_sem_max}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Tabla Fase Crecimiento */}
              <h4 className="tabla-fase-titulo crecimiento">Fase Crecimiento (Días 71-120) — 25 → 60 kg</h4>
              <table className="tabla-finca">
                <thead>
                  <tr>
                    <th>Sem</th>
                    <th>Días</th>
                    <th>Peso Final (kg)</th>
                    <th>Consumo/día (kg)</th>
                    <th>Consumo/sem (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {TABLA_CRECIMIENTO.map(f => {
                    const edadLote = loteDetalle.edad_dias || 0
                    const esActual = edadLote >= f.edad_inicio && edadLote <= f.edad_fin
                    return (
                      <tr key={f.semana} className={`crecimiento ${esActual ? 'semana-actual' : ''}`}>
                        <td>{f.semana}</td>
                        <td>{f.edad_inicio}-{f.edad_fin}</td>
                        <td><strong>{f.peso_final}</strong></td>
                        <td>{f.consumo_dia}</td>
                        <td>{f.consumo_sem}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Tabla Fase Engorde */}
              <h4 className="tabla-fase-titulo engorde">Fase Engorde (Días 121-180) — 60 → 110 kg</h4>
              <table className="tabla-finca">
                <thead>
                  <tr>
                    <th>Sem</th>
                    <th>Días</th>
                    <th>Peso Final (kg)</th>
                    <th>Consumo/día (kg)</th>
                    <th>Consumo/sem (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {TABLA_ENGORDE.map(f => {
                    const edadLote = loteDetalle.edad_dias || 0
                    const esActual = edadLote >= f.edad_inicio && edadLote <= f.edad_fin
                    return (
                      <tr key={f.semana} className={`engorde ${esActual ? 'semana-actual' : ''}`}>
                        <td>{f.semana}</td>
                        <td>{f.edad_inicio}-{f.edad_fin}</td>
                        <td><strong>{f.peso_final}</strong></td>
                        <td>{f.consumo_dia}</td>
                        <td>{f.consumo_sem}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Tabla Finca original */}
              <h4 className="tabla-fase-titulo levante">Tabla Finca Referencia — Levante/Ceba (Sem 11-24)</h4>
              <table className="tabla-finca">
                <thead>
                  <tr>
                    <th>Etapa</th>
                    <th>Sem</th>
                    <th>Edad (días)</th>
                    <th>Peso Meta (kg)</th>
                    <th>Ganancia/día (kg)</th>
                    <th>Consumo/sem (kg)</th>
                    <th>Consumo/día (kg)</th>
                    <th>Consumo Acum (kg)</th>
                    <th>Conversión</th>
                  </tr>
                </thead>
                <tbody>
                  {TABLA_FINCA.map(f => {
                    const edadLote = loteDetalle.edad_dias || 0
                    const esActual = f.edad <= edadLote && edadLote < f.edad + 7
                    return (
                      <tr key={f.semana} className={`${f.etapa} ${esActual ? 'semana-actual' : ''}`}>
                        <td><span className={`etapa-badge ${f.etapa}`}>{f.etapa}</span></td>
                        <td>{f.semana}</td>
                        <td>{f.edad}</td>
                        <td><strong>{f.peso}</strong></td>
                        <td>{f.ganancia_dia}</td>
                        <td>{f.consumo_sem}</td>
                        <td>{f.consumo_dia}</td>
                        <td>{f.consumo_acum}</td>
                        <td>{f.conversion}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div className="finca-notas">
                <p><strong>Ciclo total:</strong> 43-180 días | Peso: 12 → 110 kg</p>
                <p><strong>Fases:</strong> Inicio (28d) → Crecimiento (50d) → Engorde (60d)</p>
              </div>
            </div>
          )}
        </div>

      </div>
    ) : (
      /* Vista de tarjetas de lotes */
      <div className="lotes-grid">
        {lotes.length === 0 ? (
          <p className="sin-datos">No hay lotes registrados</p>
        ) : (
          lotes.map(lote => (
            <div key={lote._id} className={`lote-card ${!lote.activo ? 'inactivo' : ''}`}>
              <div className="lote-header">
                <h3>{lote.nombre}</h3>
                <span className={`estado-lote ${getEtapaAutomatica(lote.edad_dias || 0)}`}>{getEtapaAutomatica(lote.edad_dias || 0)}</span>
              </div>
              <div className="lote-body">
                <div className="lote-dato">
                  <span>Edad</span>
                  <strong>{lote.edad_dias || Math.floor((Date.now() - new Date(lote.fecha_inicio)) / (1000*60*60*24))} días</strong>
                </div>
                <div className="lote-dato">
                  <span>Cantidad</span>
                  <strong>{lote.cantidad_cerdos} cerdos</strong>
                </div>
                <div className="lote-dato">
                  <span>Prom. por Cerdo</span>
                  <strong>{(lote.peso_promedio_actual || 0).toFixed(1)} kg</strong>
                </div>
                <div className="lote-dato destacado">
                  <span>Peso Total Lote</span>
                  <strong>{((lote.cantidad_cerdos || 0) * (lote.peso_promedio_actual || 0)).toFixed(0)} kg</strong>
                </div>
                <div className="lote-dato">
                  <span>Ganancia/cerdo</span>
                  <strong>{((lote.peso_promedio_actual || 0) - (lote.peso_inicial_promedio || 0)).toFixed(1)} kg</strong>
                </div>
                <div className="lote-dato">
                  <span>Corral</span>
                  <strong>{lote.corral || '-'}</strong>
                </div>
                <div className="lote-dato">
                  <span>Total Gastos</span>
                  <strong style={{color:'#ef4444'}}>{formatearDinero(lote.total_gastos || 0)}</strong>
                </div>
              </div>
              <div className="lote-actions">
                <button className="btn-ver-detalle" onClick={() => verDetalleLote(lote._id)}>
                  <Eye size={16} /> Ver Detalle
                </button>
                {lote.activo && (
                  <>
                    <button className="btn-icon" onClick={() => {
                      setLoteSeleccionado(lote)
                      setNuevoLote({
                        nombre: lote.nombre,
                        cantidad_cerdos: lote.cantidad_cerdos,
                        peso_inicial_promedio: lote.peso_inicial_promedio,
                        fecha_nacimiento: lote.fecha_nacimiento ? lote.fecha_nacimiento.split('T')[0] : '',
                        edad_dias_manual: lote.edad_dias_manual || '',
                        corral: lote.corral || '',
                        notas: lote.notas || ''
                      })
                      setMostrarModalLote(true)
                    }}>
                      <Edit size={16} />
                    </button>
                    <button className="btn-icon btn-warning" onClick={() => finalizarLote(lote._id)}>
                      Fin
                    </button>
                  </>
                )}
                <button className="btn-icon btn-danger" onClick={() => eliminarLote(lote._id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    )}

    {/* Modal Crear/Editar Lote */}
    {mostrarModalLote && (
      <div className="modal-overlay" onClick={() => { setMostrarModalLote(false); setLoteSeleccionado(null) }}>
        <div className="modal modal-grande" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>{loteSeleccionado ? 'Editar Lote' : 'Nuevo Lote'}</h3>
            <button className="btn-cerrar" onClick={() => { setMostrarModalLote(false); setLoteSeleccionado(null) }}>&times;</button>
          </div>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label>Nombre del Lote *</label>
                <input
                  type="text"
                  value={nuevoLote.nombre}
                  onChange={e => setNuevoLote({ ...nuevoLote, nombre: e.target.value })}
                  placeholder="Ej: Lote A - Febrero 2026"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Corral</label>
                <input
                  type="text"
                  value={nuevoLote.corral}
                  onChange={e => setNuevoLote({ ...nuevoLote, corral: e.target.value })}
                  placeholder="Ej: Corral 1, Chiquero Norte"
                />
              </div>
            </div>

            <div className="form-section-title">Edad del Lote</div>
            <div className="form-row">
              <div className="form-group">
                <label>Fecha de Nacimiento</label>
                <input
                  type="date"
                  value={nuevoLote.fecha_nacimiento}
                  onChange={e => setNuevoLote({ ...nuevoLote, fecha_nacimiento: e.target.value, edad_dias_manual: '' })}
                />
                <small>O ingresa la edad manualmente →</small>
              </div>
              <div className="form-group">
                <label>Edad Manual (días)</label>
                <input
                  type="number"
                  value={nuevoLote.edad_dias_manual}
                  onChange={e => setNuevoLote({ ...nuevoLote, edad_dias_manual: numVal(e.target.value), fecha_nacimiento: '' })}
                  placeholder="Ej: 45"
                />
                <small>Días de vida al ingresar el lote</small>
              </div>
            </div>

            <div className="form-section-title">Peso Inicial</div>
            <div className="form-group">
              <label>
                Ingresa los pesos de cada cerdo
                <span style={{fontSize:'11px', color:'#94a3b8', fontWeight:'400', marginLeft:'8px'}}>
                  Escribe un peso + Enter, o pega todos separados por coma. La cantidad de cerdos se deriva automáticamente.
                </span>
              </label>
              <div style={{display:'flex', gap:'6px'}}>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Ej: 10.5"
                  value={pesoLoteInputTmp}
                  onChange={e => setPesoLoteInputTmp(e.target.value.replace(/[^0-9.,\s]/g,''))}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault()
                      const vals = pesoLoteInputTmp.split(/[,\s]+/).map(v => parseFloat(v.replace(',','.'))).filter(v => !isNaN(v) && v > 0)
                      if (vals.length) { setPesosLoteInicial(prev => [...prev, ...vals]); setPesoLoteInputTmp('') }
                    }
                  }}
                  onBlur={() => {
                    const vals = pesoLoteInputTmp.split(/[,\s]+/).map(v => parseFloat(v.replace(',','.'))).filter(v => !isNaN(v) && v > 0)
                    if (vals.length) { setPesosLoteInicial(prev => [...prev, ...vals]); setPesoLoteInputTmp('') }
                  }}
                  style={{flex:1}}
                />
                <button type="button" className="btn-primary btn-sm" onClick={() => {
                  const vals = pesoLoteInputTmp.split(/[,\s]+/).map(v => parseFloat(v.replace(',','.'))).filter(v => !isNaN(v) && v > 0)
                  if (vals.length) { setPesosLoteInicial(prev => [...prev, ...vals]); setPesoLoteInputTmp('') }
                }}>+ Agregar</button>
              </div>

              {pesosLoteInicial.length > 0 && (
                <div style={{display:'flex', flexWrap:'wrap', gap:'6px', marginTop:'10px'}}>
                  {pesosLoteInicial.map((p, i) => (
                    <span key={i} style={{background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'20px', padding:'3px 10px', fontSize:'13px', display:'flex', alignItems:'center', gap:'4px'}}>
                      {p.toFixed(1)} kg
                      <button type="button" onClick={() => setPesosLoteInicial(prev => prev.filter((_,j) => j !== i))}
                        style={{background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:'0', lineHeight:1, fontSize:'14px'}}>&times;</button>
                    </span>
                  ))}
                  <button type="button" onClick={() => setPesosLoteInicial([])}
                    style={{background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontSize:'12px', padding:'3px 6px'}}>Limpiar</button>
                </div>
              )}

              {pesosLoteInicial.length > 0 && (() => {
                const total = pesosLoteInicial.reduce((s,v) => s+v, 0)
                const avg   = total / pesosLoteInicial.length
                const mn    = Math.min(...pesosLoteInicial)
                const mx    = Math.max(...pesosLoteInicial)
                return (
                  <div style={{marginTop:'12px', padding:'12px', background:'#f0fdf4', borderRadius:'10px', border:'1px solid #86efac', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px', textAlign:'center'}}>
                    <div><div style={{fontSize:'20px', fontWeight:'800', color:'#1e293b'}}>{pesosLoteInicial.length}</div><div style={{fontSize:'11px', color:'#64748b'}}>cerdos</div></div>
                    <div><div style={{fontSize:'18px', fontWeight:'800', color:'#1e293b'}}>{total.toFixed(1)} kg</div><div style={{fontSize:'11px', color:'#64748b'}}>Total</div></div>
                    <div><div style={{fontSize:'18px', fontWeight:'800', color:'#16a34a'}}>{avg.toFixed(1)} kg</div><div style={{fontSize:'11px', color:'#64748b'}}>Promedio</div></div>
                    <div><div style={{fontSize:'14px', fontWeight:'700', color:'#0369a1'}}>{mn.toFixed(1)}–{mx.toFixed(1)}</div><div style={{fontSize:'11px', color:'#64748b'}}>Intervalo</div></div>
                  </div>
                )
              })()}

              {pesosLoteInicial.length === 0 && (
                <div style={{marginTop:'10px'}}>
                  <div style={{borderTop:'1px solid #e2e8f0', paddingTop:'10px', marginBottom:'8px', fontSize:'12px', color:'#94a3b8'}}>
                    O ingresa solo el promedio manualmente:
                  </div>
                  <div style={{display:'flex', gap:'12px'}}>
                    <div className="form-group" style={{flex:1, marginBottom:0}}>
                      <label style={{fontSize:'12px'}}>Cantidad de cerdos</label>
                      <input type="number" value={nuevoLote.cantidad_cerdos}
                        onChange={e => setNuevoLote({ ...nuevoLote, cantidad_cerdos: numVal(e.target.value) })} />
                    </div>
                    <div className="form-group" style={{flex:1, marginBottom:0}}>
                      <label style={{fontSize:'12px'}}>Peso prom. inicial (kg)</label>
                      <input type="number" step="0.1" value={nuevoLote.peso_inicial_promedio}
                        onChange={e => setNuevoLote({ ...nuevoLote, peso_inicial_promedio: numVal(e.target.value, true) })} />
                    </div>
                    <div className="form-group" style={{flex:1, marginBottom:0}}>
                      <label style={{fontSize:'12px'}}>Total estimado</label>
                      <input type="text" disabled
                        value={`${((nuevoLote.cantidad_cerdos||0)*(nuevoLote.peso_inicial_promedio||0)).toFixed(1)} kg`} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Notas</label>
              <textarea
                value={nuevoLote.notas}
                onChange={e => setNuevoLote({ ...nuevoLote, notas: e.target.value })}
                placeholder="Observaciones del lote..."
                rows={2}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn-secondary" onClick={() => { setMostrarModalLote(false); setLoteSeleccionado(null) }}>Cancelar</button>
            <button className="btn-primary" onClick={() => {
              if (loteSeleccionado) {
                actualizarLote(loteSeleccionado._id, nuevoLote)
                setMostrarModalLote(false)
                setLoteSeleccionado(null)
              } else {
                crearLote()
              }
            }}>
              {loteSeleccionado ? 'Guardar Cambios' : 'Crear Lote'}
            </button>
          </div>
        </div>
      </div>
    )}

  </div>
)}
{/* ════════════════════════════════════════════════════════════════ */}
          {/* PÁGINA: PESAJES */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {pagina === 'pesajes' && (
            <div className="page-pesajes">
              <div className="page-header">
                <h2>Registro de Pesajes</h2>
                <button className="btn-primary" onClick={() => setMostrarModalPesaje(true)}>
                  <IconMas />
                  Pesaje Manual
                </button>
              </div>

              {/* ══════════════════════════════════════════════════════════════ */}
              {/* BÁSCULA EN TIEMPO REAL */}
              {/* ══════════════════════════════════════════════════════════════ */}
              <div className="bascula-tiempo-real">
                <div className="bascula-card">
                  <div className="bascula-header-section">
                    <h3><IconPeso /> Báscula en Tiempo Real</h3>
                    <span className={`conexion-badge ${pesoLive.conectado ? 'conectado' : 'desconectado'}`}>
                      {pesoLive.conectado ? '● Conectada' : '○ Desconectada'}
                    </span>
                  </div>
                  
                  <div className={`bascula-display ${pesoLive.estable ? 'estable' : 'inestable'}`}>
                    <div className="peso-grande">
                      {pesoLive.peso.toFixed(1)}
                      <span className="peso-unidad">kg</span>
                    </div>
                    <div className={`estado-peso ${pesoLive.estable ? 'estable' : ''}`}>
                      {pesoLive.estable ? '✓ Peso Estable' : '~ Estabilizando...'}
                    </div>
                  </div>

                  <div className="bascula-controles">
                    <button 
                      className="btn-tarar" 
                      onClick={async () => {
                        try {
                          await axios.post(`${API_URL}/api/esp/peso/tarar`, {}, {
                            headers: { Authorization: `Bearer ${token}` }
                          })
                          alert('Báscula tarada correctamente')
                        } catch (error) {
                          alert('Error al tarar')
                        }
                      }}
                      disabled={!pesoLive.conectado}
                    >
                      <IconRefresh /> Tarar
                    </button>
                  </div>

                  <div className="bascula-guardar">
                    <div className="form-row">
                      <div className="form-group">
                        <label>Lote</label>
                        <select
                          value={pesajeLive.lote}
                          onChange={e => setPesajeLive({...pesajeLive, lote: e.target.value})}
                        >
                          <option value="">Seleccionar lote...</option>
                          {lotes.filter(l => l.activo).map(lote => (
                            <option key={lote._id} value={lote._id}>{lote.nombre}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Cerdos pesados</label>
                        <input
                          type="number"
                          min="1"
                          value={pesajeLive.cantidad}
                          onChange={e => setPesajeLive({...pesajeLive, cantidad: numVal(e.target.value)})}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Peso promedio: <strong>{(pesoLive.peso / (pesajeLive.cantidad || 1)).toFixed(2)} kg</strong></label>
                    </div>
                    <div className="form-group">
                      <label>Notas (opcional)</label>
                      <input
                        type="text"
                        value={pesajeLive.notas}
                        onChange={e => setPesajeLive({...pesajeLive, notas: e.target.value})}
                        placeholder="Observaciones..."
                      />
                    </div>
                    <button 
                      className={`btn-guardar-peso ${pesoLive.estable ? 'listo' : ''}`}
                      onClick={async () => {
                        if (pesoLive.peso <= 0) {
                          alert('El peso debe ser mayor a 0')
                          return
                        }
                        if (!pesajeLive.lote) {
                          alert('Selecciona un lote')
                          return
                        }
                        try {
                          await axios.post(`${API_URL}/api/esp/peso`, {
                            peso: pesoLive.peso,
                            unidad: 'kg',
                            lote_id: pesajeLive.lote,
                            cantidad_cerdos: pesajeLive.cantidad,
                            notas: pesajeLive.notas,
                            sensor_id: 'bascula_hx711'
                          }, {
                            headers: { Authorization: `Bearer ${token}` }
                          })
                          alert(`✓ Pesaje guardado: ${pesoLive.peso} kg`)
                          setPesajeLive({lote: '', cantidad: 1, notas: ''})
                          cargarPesajes()
                        } catch (error) {
                          alert('Error al guardar: ' + (error.response?.data?.mensaje || error.message))
                        }
                      }}
                      disabled={pesoLive.peso <= 0}
                    >
                      ✓ GUARDAR PESAJE
                    </button>
                    {/* Botón Guardar Forzado cuando no estabiliza */}
{!pesoLive.estable && pesoLive.peso > 0 && (
  <button 
    className="btn-guardar-forzado"
    onClick={async () => {
      if (!pesajeLive.lote) {
        alert('Selecciona un lote')
        return
      }
      if (!confirm(`¿Guardar peso inestable de ${pesoLive.peso.toFixed(1)} kg?`)) return
      try {
        await axios.post(`${API_URL}/api/esp/peso`, {
          peso: pesoLive.peso,
          unidad: 'kg',
          lote_id: pesajeLive.lote,
          cantidad_cerdos: pesajeLive.cantidad,
          notas: `[FORZADO] ${pesajeLive.notas}`,
          sensor_id: 'bascula_hx711'
        }, {
          headers: { Authorization: `Bearer ${token}` }
        })
        alert(`✓ Pesaje FORZADO guardado: ${pesoLive.peso} kg`)
        setPesajeLive({lote: '', cantidad: 1, notas: ''})
        cargarPesajes()
      } catch (error) {
        alert('Error: ' + (error.response?.data?.mensaje || error.message))
      }
    }}
    style={{
      width: '100%',
      padding: '12px',
      marginTop: '8px',
      background: '#f59e0b',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      fontWeight: 'bold',
      cursor: 'pointer'
    }}
  >
    <AlertTriangle size={14} style={{marginRight:4, verticalAlign:'middle'}} /> GUARDAR FORZADO
  </button>
)}
                  </div>
                </div>
              </div>

              {/* Estadísticas */}
              <div className="stats-grid">
                <div className="stat-card">
                  <span>Total Pesajes</span>
                  <strong>{pesajes.length}</strong>
                </div>
                <div className="stat-card">
                  <span>Último Peso</span>
                  <strong>{ultimoPeso ? `${ultimoPeso.peso} kg` : '--'}</strong>
                </div>
                <div className="stat-card">
                  <span>Prom. por Pesaje</span>
                  <strong>
                    {pesajes.length > 0 
                      ? (pesajes.reduce((sum, p) => sum + (p.peso_promedio || p.peso), 0) / pesajes.length).toFixed(1) 
                      : 0} kg
                  </strong>
                </div>
              </div>

              {/* Tabla de pesajes */}
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Lote</th>
                      <th>Peso Total</th>
                      <th>Cerdos Pesados</th>
                      <th>Prom./Cerdo</th>
                      <th>Notas</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pesajes.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="sin-datos">No hay pesajes registrados</td>
                      </tr>
                    ) : (
                      pesajes.map(pesaje => (
                        <tr key={pesaje._id}>
                          <td>{formatearFecha(pesaje.createdAt)}</td>
                          <td>{pesaje.lote?.nombre || 'Sin lote'}</td>
                          <td><strong>{pesaje.peso} kg</strong></td>
                          <td>{pesaje.cantidad_cerdos_pesados || 1}</td>
                          <td>{pesaje.peso_promedio ? `${pesaje.peso_promedio.toFixed(1)} kg` : '-'}</td>
                          <td>{pesaje.notas || '-'}</td>
                          <td>
                            <button className="btn-icon btn-danger" onClick={() => eliminarPesaje(pesaje._id)}>
                              <IconEliminar />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Modal Pesaje Manual */}
              {mostrarModalPesaje && (
                <div className="modal-overlay" onClick={() => setMostrarModalPesaje(false)}>
                  <div className="modal" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                      <h3>Pesaje Manual</h3>
                      <button className="btn-cerrar" onClick={() => setMostrarModalPesaje(false)}>&times;</button>
                    </div>
                    <div className="modal-body">
                      <div className="form-group">
                        <label>Lote</label>
                        <select
                          value={nuevoPesaje.lote}
                          onChange={e => setNuevoPesaje({ ...nuevoPesaje, lote: e.target.value })}
                        >
                          <option value="">Seleccionar lote...</option>
                          {lotes.filter(l => l.activo).map(lote => (
                            <option key={lote._id} value={lote._id}>
                              {lote.nombre} ({lote.cantidad_cerdos} cerdos)
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Entrada de pesos individuales */}
                      <div className="form-group">
                        <label>
                          Pesos individuales
                          <span style={{fontSize:'11px', color:'#94a3b8', fontWeight:'400', marginLeft:'8px'}}>
                            Escribe un peso y presiona Enter o coma — o pega todos separados por coma
                          </span>
                        </label>
                        <div style={{display:'flex', gap:'6px'}}>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Ej: 12.5"
                            value={pesoInputTmp}
                            onChange={e => setPesoInputTmp(e.target.value.replace(/[^0-9.,]/g,''))}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ',') {
                                e.preventDefault()
                                // soporte para pegar varios separados por coma
                                const vals = pesoInputTmp.split(/[,\s]+/).map(v => parseFloat(v.replace(',','.'))).filter(v => !isNaN(v) && v > 0)
                                if (vals.length) { setPesosIngresados(prev => [...prev, ...vals]); setPesoInputTmp('') }
                              }
                            }}
                            onBlur={() => {
                              const vals = pesoInputTmp.split(/[,\s]+/).map(v => parseFloat(v.replace(',','.'))).filter(v => !isNaN(v) && v > 0)
                              if (vals.length) { setPesosIngresados(prev => [...prev, ...vals]); setPesoInputTmp('') }
                            }}
                            style={{flex:1}}
                          />
                          <button type="button" className="btn-primary btn-sm" onClick={() => {
                            const vals = pesoInputTmp.split(/[,\s]+/).map(v => parseFloat(v.replace(',','.'))).filter(v => !isNaN(v) && v > 0)
                            if (vals.length) { setPesosIngresados(prev => [...prev, ...vals]); setPesoInputTmp('') }
                          }}>+ Agregar</button>
                        </div>

                        {/* Chips de pesos ingresados */}
                        {pesosIngresados.length > 0 && (
                          <div style={{display:'flex', flexWrap:'wrap', gap:'6px', marginTop:'10px'}}>
                            {pesosIngresados.map((p, i) => (
                              <span key={i} style={{background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'20px', padding:'3px 10px', fontSize:'13px', display:'flex', alignItems:'center', gap:'4px'}}>
                                {p.toFixed(1)} kg
                                <button type="button" onClick={() => setPesosIngresados(prev => prev.filter((_,j) => j !== i))}
                                  style={{background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:'0', lineHeight:1, fontSize:'14px'}}>&times;</button>
                              </span>
                            ))}
                            <button type="button" onClick={() => setPesosIngresados([])}
                              style={{background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontSize:'12px', padding:'3px 6px'}}>Limpiar todo</button>
                          </div>
                        )}

                        {/* Resumen calculado */}
                        {pesosIngresados.length > 0 && (() => {
                          const total = pesosIngresados.reduce((s,v) => s+v, 0)
                          const avg   = total / pesosIngresados.length
                          const mn    = Math.min(...pesosIngresados)
                          const mx    = Math.max(...pesosIngresados)
                          return (
                            <div style={{marginTop:'12px', padding:'12px', background:'#f0fdf4', borderRadius:'10px', border:'1px solid #86efac', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px', textAlign:'center'}}>
                              <div><div style={{fontSize:'18px', fontWeight:'800', color:'#1e293b'}}>{pesosIngresados.length}</div><div style={{fontSize:'11px', color:'#64748b'}}>cerdos</div></div>
                              <div><div style={{fontSize:'18px', fontWeight:'800', color:'#1e293b'}}>{total.toFixed(1)} kg</div><div style={{fontSize:'11px', color:'#64748b'}}>Total</div></div>
                              <div><div style={{fontSize:'18px', fontWeight:'800', color:'#16a34a'}}>{avg.toFixed(1)} kg</div><div style={{fontSize:'11px', color:'#64748b'}}>Promedio</div></div>
                              <div><div style={{fontSize:'14px', fontWeight:'700', color:'#0369a1'}}>{mn.toFixed(1)}–{mx.toFixed(1)}</div><div style={{fontSize:'11px', color:'#64748b'}}>Intervalo</div></div>
                            </div>
                          )
                        })()}
                      </div>

                      <div className="form-group">
                        <label>Notas</label>
                        <textarea
                          value={nuevoPesaje.notas}
                          onChange={e => setNuevoPesaje({ ...nuevoPesaje, notas: e.target.value })}
                          placeholder="Observaciones..."
                          rows={2}
                        />
                      </div>
                    </div>
                    <div className="modal-footer">
                      <button className="btn-secondary" onClick={() => { setMostrarModalPesaje(false); setPesosIngresados([]); setPesoInputTmp('') }}>Cancelar</button>
                      <button className="btn-primary" onClick={crearPesaje} disabled={pesosIngresados.length === 0}>
                        Registrar Pesaje {pesosIngresados.length > 0 ? `(${pesosIngresados.length} cerdos)` : ''}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* ════════════════════════════════════════════════════════════════ */}
          {/* PÁGINA: FINANZAS (Panel Unificado) */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {pagina === 'finanzas' && (
            <div className="page-finanzas">
              <div className="page-header">
                <h2><DollarSign size={24} /> Panel Financiero</h2>
              </div>

              {/* Tabs de navegación */}
              <div className="finanzas-tabs">
                <button className={`tab-btn ${tabFinanzas === 'resumen' ? 'activo' : ''}`} onClick={() => setTabFinanzas('resumen')}>Resumen</button>
                <button className={`tab-btn ${tabFinanzas === 'costos' ? 'activo' : ''}`} onClick={() => setTabFinanzas('costos')}>Costos</button>
                <button className={`tab-btn ${tabFinanzas === 'ventas' ? 'activo' : ''}`} onClick={() => setTabFinanzas('ventas')}>Ventas</button>
{/* Tab Registros legado oculto */}
                <button className={`tab-btn ${tabFinanzas === 'gastos-lote' ? 'activo' : ''}`} onClick={() => setTabFinanzas('gastos-lote')}>Gastos por Lote</button>
              </div>

              {/* ── TAB: RESUMEN ── */}
              {tabFinanzas === 'resumen' && (
                <div className="finanzas-resumen">
                  {/* Tarjetas principales */}
                  <div className="finanzas-cards">
                    <div className="finanza-card ingresos">
                      <TrendingUp size={28} />
                      <div>
                        <span className="fc-label">Ingresos</span>
                        <span className="fc-valor">{formatearDinero(resumenCostos?.ingresos?.total || resumenContable.total_ingresos || 0)}</span>
                      </div>
                    </div>
                    <div className="finanza-card gastos">
                      <TrendingDown size={28} />
                      <div>
                        <span className="fc-label">Gastos</span>
                        <span className="fc-valor">{formatearDinero(resumenCostos?.costos?.total || resumenContable.total_gastos || 0)}</span>
                      </div>
                    </div>
                    <div className={`finanza-card balance ${(resumenCostos?.resultado?.utilidad_bruta || resumenContable.ganancia || 0) >= 0 ? 'positivo' : 'negativo'}`}>
                      <Wallet size={28} />
                      <div>
                        <span className="fc-label">Balance</span>
                        <span className="fc-valor">{formatearDinero(resumenCostos?.resultado?.utilidad_bruta || resumenContable.ganancia || 0)}</span>
                        {resumenCostos?.resultado?.margen_porcentaje && (
                          <span className="fc-pct">{resumenCostos.resultado.margen_porcentaje}%</span>
                        )}
                      </div>
                    </div>
                    <div className="finanza-card ventas-count">
                      <Package size={28} />
                      <div>
                        <span className="fc-label">Ventas del Mes</span>
                        <span className="fc-valor">{estadisticasVentas?.totales?.total_ventas || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Desglose por categoría */}
                  {resumenCostos?.costos?.por_categoria?.length > 0 && (
                    <div className="finanzas-desglose">
                      <h3><BarChart3 size={18} /> Desglose de Costos - {resumenCostos?.periodo?.nombre_mes}</h3>
                      <div className="costos-categorias">
                        {resumenCostos.costos.por_categoria.map(cat => (
                          <div key={cat._id} className="categoria-item">
                            <span className="cat-nombre">{cat._id.replace(/_/g, ' ')}</span>
                            <span className="cat-valor">{formatearDinero(cat.total)}</span>
                            <div className="cat-barra">
                              <div className="cat-progreso" style={{ width: `${Math.min((cat.total / (resumenCostos.costos.total || 1)) * 100, 100)}%` }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Comparativo mensual */}
                  {comparativoCostos?.length > 0 && (
                    <div className="finanzas-comparativo">
                      <h3><LineChartIcon size={18} /> Comparativo Mensual</h3>
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={comparativoCostos}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                          <XAxis dataKey="nombre" tick={{ fontSize: 11 }} stroke="#666" />
                          <YAxis tick={{ fontSize: 11 }} stroke="#666" tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                          <Tooltip formatter={(value) => [formatearDinero(value)]} />
                          <Legend />
                          <Bar dataKey="ingresos" fill="#22c55e" name="Ingresos" radius={[4,4,0,0]} />
                          <Bar dataKey="costos" fill="#ef4444" name="Costos" radius={[4,4,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: COSTOS ── */}
              {tabFinanzas === 'costos' && (
                <div className="finanzas-costos">
                  <PanelContabilidad resumen={resumenCostos} comparativo={[]} onNuevoCosto={crearCosto} />
                  <div className="tab-header-actions" style={{marginTop:'1.5rem'}}>
                    <h3>Costos Registrados</h3>
                  </div>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Categoría</th>
                          <th>Descripción</th>
                          <th>Cantidad</th>
                          <th>Total</th>
                          <th>Estado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {costos.length === 0 ? (
                          <tr><td colSpan="7" className="sin-datos">No hay costos registrados</td></tr>
                        ) : (
                          costos.map(c => (
                            <tr key={c._id} className={c.estado === 'anulado' ? 'anulado' : ''}>
                              <td>{new Date(c.fecha).toLocaleDateString()}</td>
                              <td><span className="tipo-badge">{(c.categoria || '').replace(/_/g, ' ')}</span></td>
                              <td>{c.descripcion || '-'}</td>
                              <td>{c.cantidad} {c.unidad}</td>
                              <td><strong>{formatearDinero(c.total)}</strong></td>
                              <td><span className={`estado-badge ${c.estado}`}>{c.estado}</span></td>
                              <td>
                                {c.estado !== 'anulado' && (
                                  <button className="btn-icon btn-danger" onClick={() => eliminarCosto(c._id)} title="Anular">
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── TAB: VENTAS ── */}
              {tabFinanzas === 'ventas' && (
                <div className="finanzas-ventas">
                  <PanelVentas
                    ventas={ventas}
                    estadisticas={estadisticasVentas}
                    onNuevaVenta={crearVenta}
                    onRegistrarPago={registrarPagoVenta}
                  />
                  {/* Tabla con opción anular */}
                  {ventas.length > 0 && (
                    <div className="table-container" style={{ marginTop: '16px' }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Factura</th>
                            <th>Comprador</th>
                            <th>Tipo</th>
                            <th>Total</th>
                            <th>Estado Pago</th>
                            <th>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ventas.map(v => (
                            <tr key={v._id} className={!v.activa ? 'anulado' : ''}>
                              <td><strong>{v.numero_factura}</strong></td>
                              <td>{v.comprador?.nombre}</td>
                              <td>{v.tipo_venta === 'en_pie' ? 'En Pie' : v.tipo_venta === 'carne' ? 'Carne' : 'Lechón'}</td>
                              <td><strong>{formatearDinero(v.total)}</strong></td>
                              <td><span className={`estado-pago ${v.estado_pago}`}>{v.estado_pago}</span></td>
                              <td>
                                {v.activa !== false && (
                                  <div className="acciones-grupo">
                                    {v.estado_pago !== 'pagado' && (
                                      <button className="btn-xs btn-primary" onClick={() => registrarPagoVenta(v._id)}>Pago</button>
                                    )}
                                    <button className="btn-icon btn-danger" onClick={() => anularVenta(v._id)} title="Anular">
                                      <Trash2 size={15} />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB: REGISTROS (legado - oculto) ── */}
              {false && tabFinanzas === 'registros' && (
                <div className="finanzas-registros">
                  <div className="tab-header-actions">
                    <h3>Registros Contables</h3>
                    <button className="btn-primary" onClick={() => setMostrarModalContabilidad(true)}>
                      <Plus size={16} /> Nuevo Registro
                    </button>
                  </div>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Tipo</th>
                          <th>Categoría</th>
                          <th>Descripción</th>
                          <th>Total</th>
                          <th>Lote</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contabilidad.length === 0 ? (
                          <tr><td colSpan="7" className="sin-datos">No hay registros</td></tr>
                        ) : (
                          contabilidad.map(reg => (
                            <tr key={reg._id} className={reg.tipo}>
                              <td>{new Date(reg.fecha).toLocaleDateString()}</td>
                              <td><span className={`tipo-badge ${reg.tipo}`}>{reg.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}</span></td>
                              <td>{reg.categoria}</td>
                              <td>{reg.descripcion || '-'}</td>
                              <td><strong>{formatearDinero(reg.total)}</strong></td>
                              <td>{reg.lote?.nombre || '-'}</td>
                              <td>
                                <button className="btn-icon btn-danger" onClick={() => eliminarRegistroContable(reg._id)}>
                                  <Trash2 size={15} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Modal Contabilidad */}
                  {mostrarModalContabilidad && (
                    <div className="modal-overlay" onClick={() => setMostrarModalContabilidad(false)}>
                      <div className="modal modal-grande" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                          <h3>Nuevo Registro Contable</h3>
                          <button className="btn-cerrar" onClick={() => setMostrarModalContabilidad(false)}>&times;</button>
                        </div>
                        <div className="modal-body">
                          <div className="form-row">
                            <div className="form-group">
                              <label>Tipo</label>
                              <select value={nuevoRegistro.tipo} onChange={e => setNuevoRegistro({ ...nuevoRegistro, tipo: e.target.value })}>
                                <option value="gasto">Gasto</option>
                                <option value="ingreso">Ingreso</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label>Categoría</label>
                              <select value={nuevoRegistro.categoria} onChange={e => setNuevoRegistro({ ...nuevoRegistro, categoria: e.target.value })}>
                                <option value="alimento">Alimento</option>
                                <option value="agua">Agua</option>
                                <option value="medicamento">Medicamento</option>
                                <option value="vacuna">Vacuna</option>
                                <option value="compra_cerdos">Compra de Cerdos</option>
                                <option value="venta_cerdos">Venta de Cerdos</option>
                                <option value="mano_obra">Mano de Obra</option>
                                <option value="transporte">Transporte</option>
                                <option value="otro">Otro</option>
                              </select>
                            </div>
                          </div>
                          <div className="form-group">
                            <label>Lote (opcional)</label>
                            <select value={nuevoRegistro.lote} onChange={e => setNuevoRegistro({ ...nuevoRegistro, lote: e.target.value })}>
                              <option value="">Sin lote específico</option>
                              {lotes.map(lote => (
                                <option key={lote._id} value={lote._id}>{lote.nombre}</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label>Descripción</label>
                            <input type="text" value={nuevoRegistro.descripcion} onChange={e => setNuevoRegistro({ ...nuevoRegistro, descripcion: e.target.value })} placeholder="Descripción del registro..." />
                          </div>
                          <div className="form-row">
                            <div className="form-group">
                              <label>Cantidad</label>
                              <input type="number" step="0.1" value={nuevoRegistro.cantidad} onChange={e => setNuevoRegistro({ ...nuevoRegistro, cantidad: numVal(e.target.value, true) })} />
                            </div>
                            <div className="form-group">
                              <label>Unidad</label>
                              <select value={nuevoRegistro.unidad} onChange={e => setNuevoRegistro({ ...nuevoRegistro, unidad: e.target.value })}>
                                <option value="kg">kg</option>
                                <option value="L">Litros</option>
                                <option value="unidad">Unidad</option>
                                <option value="dosis">Dosis</option>
                                <option value="hora">Hora</option>
                                <option value="dia">Día</option>
                                <option value="viaje">Viaje</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label>Precio Unitario</label>
                              <input type="number" value={nuevoRegistro.precio_unitario} onChange={e => setNuevoRegistro({ ...nuevoRegistro, precio_unitario: numVal(e.target.value, true) })} />
                            </div>
                          </div>
                          <div className="form-group">
                            <label>Total (calculado)</label>
                            <input type="text" value={formatearDinero(nuevoRegistro.cantidad * nuevoRegistro.precio_unitario)} disabled />
                          </div>
                        </div>
                        <div className="modal-footer">
                          <button className="btn-secondary" onClick={() => setMostrarModalContabilidad(false)}>Cancelar</button>
                          <button className="btn-primary" onClick={crearRegistroContable}>Guardar Registro</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* ── TAB: GASTOS POR LOTE (Registros contables separados) ── */}
              {tabFinanzas === 'gastos-lote' && (
                <div className="finanzas-gastos-lote">
                  <h3 style={{marginBottom:'8px'}}>Gastos por Lote</h3>
                  <p style={{fontSize:'13px', color:'#64748b', marginBottom:'20px'}}>
                    El costo de alimento se muestra como referencia — ya está contabilizado en la pestaña <strong>Costos</strong> al momento de la compra.
                  </p>

                  {/* Resumen general — balance solo incluye gastos semanales, NO alimento */}
                  <div style={{display:'flex', gap:'16px', marginBottom:'24px', flexWrap:'wrap'}}>
                    <div style={{flex:'1', minWidth:'180px', padding:'16px', background:'#fef2f2', borderRadius:'12px', border:'1px solid #fca5a5'}}>
                      <div style={{fontSize:'13px', color:'#64748b'}}>Otros Gastos (sin alimento)</div>
                      <div style={{fontSize:'24px', fontWeight:'800', color:'#dc2626'}}>
                        {formatearDinero(lotes.reduce((s, l) => s + (l.total_gastos || 0), 0))}
                      </div>
                    </div>
                    <div style={{flex:'1', minWidth:'180px', padding:'16px', background:'#fff7ed', borderRadius:'12px', border:'1px solid #fdba74'}}>
                      <div style={{fontSize:'13px', color:'#64748b'}}>Alimento Consumido (referencia)</div>
                      <div style={{fontSize:'24px', fontWeight:'800', color:'#ea580c'}}>
                        {formatearDinero(lotes.reduce((s, l) => s + (l.costo_alimento_total || 0), 0))}
                      </div>
                      <div style={{fontSize:'11px', color:'#9ca3af', marginTop:'4px'}}>Ya registrado en Costos</div>
                    </div>
                    <div style={{flex:'1', minWidth:'180px', padding:'16px', background:'#f0fdf4', borderRadius:'12px', border:'1px solid #86efac'}}>
                      <div style={{fontSize:'13px', color:'#64748b'}}>Ingresos (Ventas)</div>
                      <div style={{fontSize:'24px', fontWeight:'800', color:'#16a34a'}}>
                        {formatearDinero(resumenCostos?.ingresos?.total || resumenContable.total_ingresos || 0)}
                      </div>
                    </div>
                  </div>

                  {/* Tabla por lote */}
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Lote</th>
                          <th>Estado</th>
                          <th>Cerdos</th>
                          <th>Alimento (info)</th>
                          <th>Otros Gastos</th>
                          <th>Costo/Cerdo</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lotes.length === 0 ? (
                          <tr><td colSpan="7" className="sin-datos">No hay lotes registrados</td></tr>
                        ) : (
                          lotes.map(lote => (
                            <tr key={lote._id}>
                              <td><strong>{lote.nombre}</strong></td>
                              <td><span className={`estado-lote ${lote.activo ? 'activo' : 'inactivo'}`}>{lote.activo ? 'Activo' : 'Finalizado'}</span></td>
                              <td>{lote.cantidad_cerdos}</td>
                              <td style={{color:'#ea580c', fontStyle:'italic'}}>{formatearDinero(lote.costo_alimento_total || 0)}</td>
                              <td><strong style={{color:'#ef4444'}}>{formatearDinero(lote.total_gastos || 0)}</strong></td>
                              <td>{lote.cantidad_cerdos > 0 ? formatearDinero((lote.total_gastos || 0) / lote.cantidad_cerdos) : '-'}</td>
                              <td>
                                <button className="btn-sm btn-primary" onClick={() => {
                                  setPagina('lotes')
                                  verDetalleLote(lote._id)
                                }}>
                                  Ver Detalle
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                        {lotes.length > 0 && (
                          <tr style={{background:'#fef2f2', fontWeight:'bold'}}>
                            <td colSpan="4" style={{textAlign:'right'}}>TOTAL otros gastos:</td>
                            <td style={{color:'#dc2626'}}>{formatearDinero(lotes.reduce((s, l) => s + (l.total_gastos || 0), 0))}</td>
                            <td></td>
                            <td></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Detalle gastos semanales por lote (expandible) */}
                  <h3 style={{marginTop:'32px', marginBottom:'16px'}}>Detalle Gastos Semanales por Lote</h3>
                  {costos.filter(c => c.descripcion?.includes('semanal') || c.tipo_costo === 'directo').slice(0, 30).length === 0 ? (
                    <p className="sin-datos">No hay gastos semanales registrados en finanzas</p>
                  ) : (
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Lote</th>
                            <th>Categoría</th>
                            <th>Descripción</th>
                            <th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {costos.filter(c => c.lote).slice(0, 30).map(c => (
                            <tr key={c._id}>
                              <td>{new Date(c.fecha).toLocaleDateString('es-CO')}</td>
                              <td>{typeof c.lote === 'object' ? c.lote?.nombre : (lotes.find(l => l._id === c.lote)?.nombre || '-')}</td>
                              <td><span className="tipo-badge">{(c.categoria || '').replace(/_/g,' ')}</span></td>
                              <td>{c.descripcion || '-'}</td>
                              <td><strong style={{color:'#ef4444'}}>{formatearDinero(c.total)}</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}{/* ════════════════════════════════════════════════════════════════ */}
{/* PÁGINA: BOMBAS */}
{/* ════════════════════════════════════════════════════════════════ */}
{pagina === 'bombas' && (
  <div className="page-bombas">
    <div className="page-header">
      <h2>Control de Bombas / Relés</h2>
      <div className="header-actions">
        <button className="btn-refresh" onClick={cargarBombas}>
          <IconRefresh />
        </button>
        <button className="btn-primary" onClick={() => {
          setBombaEditando(null)
          setNuevaBomba({ nombre: '', codigo_bomba: '', ubicacion: '', descripcion: '' })
          setMostrarModalBomba(true)
        }}>
          <IconMas />
          Nueva Bomba
        </button>
      </div>
    </div>

    {/* Información de restricciones */}
    <div style={{marginBottom:'20px', padding:'14px 18px', background:'#eff6ff', border:'1px solid #93c5fd', borderRadius:'12px', display:'flex', gap:'24px', flexWrap:'wrap'}}>
      <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
        <Clock size={18} style={{color:'#3b82f6'}} />
        <div>
          <strong style={{color:'#1d4ed8', fontSize:'14px'}}>Horarios permitidos (Bomba 1)</strong>
          <div style={{fontSize:'13px', color:'#64748b'}}>🌅 6:00–12:00 AM &nbsp;|&nbsp; 🌞 12:00–3:00 PM</div>
        </div>
      </div>
      <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
        <Droplets size={18} style={{color:'#3b82f6'}} />
        <div>
          <strong style={{color:'#1d4ed8', fontSize:'14px'}}>Límite diario (Bomba 1)</strong>
          <div style={{fontSize:'13px', color:'#64748b'}}>🔒 Se bloquea automáticamente al llegar a 600 L</div>
        </div>
      </div>
      <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
        <Gauge size={18} style={{color:'#3b82f6'}} />
        <div>
          <strong style={{color:'#1d4ed8', fontSize:'14px'}}>Consumo hoy</strong>
          <div style={{fontSize:'13px', color:'#64748b'}}>{flujo.volumen_diario ? `${flujo.volumen_diario.toFixed(1)} L de 600 L` : '-- L de 600 L'}</div>
        </div>
      </div>
    </div>

    <div className="bombas-grid">
      {bombas.length === 0 ? (
        <p className="sin-datos">No hay bombas configuradas. Crea una nueva bomba para comenzar.</p>
      ) : (
        bombas.map(bomba => (
          <div key={bomba._id} className={`bomba-card ${!bomba.estado ? 'encendida' : 'apagada'}`}>
            <div className="bomba-header-card">
              <div className="bomba-icon">
                <IconBomba />
              </div>
              <span className={`status-indicator ${bomba.conectado ? 'conectado' : 'desconectado'}`}>
                {bomba.conectado ? '● Conectado' : '○ Desconectado'}
              </span>
            </div>
            
            <h3>{bomba.nombre}</h3>
            <p className="bomba-codigo">{bomba.codigo_bomba}</p>
            {bomba.ubicacion && <p className="bomba-ubicacion">📍 {bomba.ubicacion}</p>}
            {bomba.descripcion && <p className="bomba-descripcion">{bomba.descripcion}</p>}
            
           {/* ✅ INVERSIÓN VISUAL: false = ENCENDIDA, true = APAGADA */}
           <div className={`bomba-estado ${!bomba.estado ? 'on' : 'off'}`}>
             {!bomba.estado ? '🟢 ENCENDIDA' : '🔴 APAGADA'}
           </div>
            
            <div className="bomba-actions">
              {/* ✅ INVERSIÓN VISUAL: Si está "apagada" (true) mostrar "Encender" */}
              <button
                className={`btn-bomba ${!bomba.estado ? 'btn-apagar' : 'btn-encender'}`}
                onClick={() => toggleBomba(bomba._id)}
                disabled={false}
              >
                {!bomba.estado ? 'Apagar' : 'Encender'}
              </button>
              
              <div className="bomba-edit-actions">
                <button 
                  className="btn-icon"
                  onClick={() => {
                    setBombaEditando(bomba)
                    setNuevaBomba({
                      nombre: bomba.nombre,
                      codigo_bomba: bomba.codigo_bomba,
                      ubicacion: bomba.ubicacion || '',
                      descripcion: bomba.descripcion || ''
                    })
                    setMostrarModalBomba(true)
                  }}
                  title="Editar"
                >
                  <IconEditar />
                </button>
                <button 
                  className="btn-icon btn-danger"
                  onClick={() => eliminarBomba(bomba._id)}
                  title="Eliminar"
                >
                  <IconEliminar />
                </button>
              </div>
            </div>
            
            {bomba.fecha_cambio && (
              <small className="bomba-fecha">Último cambio: {formatearFecha(bomba.fecha_cambio)}</small>
            )}
          </div>
        ))
      )}
    </div>

    {/* Modal Bomba */}
    {mostrarModalBomba && (
      <div className="modal-overlay" onClick={() => setMostrarModalBomba(false)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>{bombaEditando ? 'Editar Bomba' : 'Nueva Bomba / Relé'}</h3>
            <button className="btn-cerrar" onClick={() => setMostrarModalBomba(false)}>&times;</button>
          </div>
          <div className="modal-body">
            <div className="form-group">
              <label>Nombre</label>
              <input
                type="text"
                value={nuevaBomba.nombre}
                onChange={e => setNuevaBomba({ ...nuevaBomba, nombre: e.target.value })}
                placeholder="Ej: Bomba Principal, Ventilador 1"
              />
            </div>
            <div className="form-group">
              <label>Código del Dispositivo</label>
              <input
                type="text"
                value={nuevaBomba.codigo_bomba}
                onChange={e => setNuevaBomba({ ...nuevaBomba, codigo_bomba: e.target.value })}
                placeholder="Ej: BOMBA_001, RELE_VENT_01"
                disabled={bombaEditando}
              />
              <small>Este código debe coincidir con el configurado en el ESP32</small>
            </div>
            <div className="form-group">
              <label>Ubicación</label>
              <input
                type="text"
                value={nuevaBomba.ubicacion}
                onChange={e => setNuevaBomba({ ...nuevaBomba, ubicacion: e.target.value })}
                placeholder="Ej: Chiquero Norte, Área de Engorde"
              />
            </div>
            <div className="form-group">
              <label>Descripción</label>
              <textarea
                value={nuevaBomba.descripcion}
                onChange={e => setNuevaBomba({ ...nuevaBomba, descripcion: e.target.value })}
                placeholder="Descripción del dispositivo..."
                rows={2}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn-secondary" onClick={() => setMostrarModalBomba(false)}>Cancelar</button>
            <button className="btn-primary" onClick={() => {
              if (bombaEditando) {
                actualizarBomba(bombaEditando._id, nuevaBomba)
              } else {
                crearBomba()
              }
            }}>
              {bombaEditando ? 'Guardar Cambios' : 'Crear Bomba'}
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
)}
          {/* ════════════════════════════════════════════════════════════════ */}
          {/* PÁGINA: ALERTAS */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {pagina === 'alertas' && (() => {
            const ahora = new Date()
            const hace48h = new Date(ahora - 48 * 3600000)
            const hace7d  = new Date(ahora - 7  * 24 * 3600000)

            // Separar alertas del sistema por urgencia
            const urgentes  = alertas.filter(a => new Date(a.createdAt) >= hace48h)
            const historial = alertas.filter(a => new Date(a.createdAt) < hace48h)

            // Calcular eventos próximos desde los lotes activos
            const eventosProximos = []
            lotes.filter(l => l.activo).forEach(lote => {
              const edadDias = lote.edad_dias || Math.floor((Date.now() - new Date(lote.fecha_inicio)) / (1000*60*60*24))

              // Pesaje pendiente (>6 días sin pesar)
              const pesajesLote = pesajes.filter(p => String(p.lote?._id || p.lote) === String(lote._id))
              const ultimoPesaje = pesajesLote.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
              const diasSinPesar = (() => {
                if (!ultimoPesaje) return edadDias
                const ts = new Date(ultimoPesaje.createdAt)
                if (isNaN(ts.getTime())) return edadDias
                return Math.floor((ahora - ts) / (1000*60*60*24))
              })()
              if (diasSinPesar >= 6) {
                const esHoy = diasSinPesar >= 7
                eventosProximos.push({
                  prioridad: esHoy ? 'urgente' : 'proximo',
                  tipo: 'pesaje',
                  emoji: '⚖️',
                  titulo: esHoy ? 'Pesaje VENCIDO' : 'Pesaje esta semana',
                  mensaje: `${lote.nombre}: ${diasSinPesar} días sin pesar (pesaje semanal)`,
                  lote: lote.nombre,
                  dias: diasSinPesar
                })
              }

              // Cambio de etapa próximo (±5 días de umbral)
              const umbrales = [{ dia: 70, de: 'Inicio', a: 'Crecimiento' }, { dia: 120, de: 'Crecimiento', a: 'Engorde' }]
              umbrales.forEach(u => {
                const diff = u.dia - edadDias
                if (diff >= 0 && diff <= 7) {
                  eventosProximos.push({
                    prioridad: diff <= 2 ? 'urgente' : 'proximo',
                    tipo: 'etapa',
                    emoji: '🔄',
                    titulo: diff <= 2 ? 'Cambio de etapa HOY/MAÑANA' : `Cambio de etapa en ${diff} días`,
                    mensaje: `${lote.nombre}: Pasa de ${u.de} → ${u.a} (día ${u.dia})`,
                    lote: lote.nombre,
                    dias: diff
                  })
                }
              })

              // Castración recomendada (lechones 7-14 días)
              if (edadDias >= 7 && edadDias <= 16) {
                eventosProximos.push({
                  prioridad: 'urgente',
                  tipo: 'castracion',
                  emoji: '🏥',
                  titulo: 'Castración recomendada',
                  mensaje: `${lote.nombre}: lechones con ${edadDias} días (castración óptima 7-14 días)`,
                  lote: lote.nombre,
                  dias: 0
                })
              }

              // Vacunas: Peste Porcina Clásica (21 días), Circovirus (14-21 días)
              if (edadDias >= 12 && edadDias <= 23) {
                eventosProximos.push({
                  prioridad: edadDias >= 19 ? 'urgente' : 'proximo',
                  tipo: 'vacuna',
                  emoji: '💉',
                  titulo: edadDias >= 19 ? 'Vacunación — REVISAR HOY' : `Vacunación próxima (día 21)`,
                  mensaje: `${lote.nombre}: Circovirus / PPC recomendada a los 21 días (lote tiene ${edadDias} días)`,
                  lote: lote.nombre,
                  dias: 21 - edadDias
                })
              }
            })

            // Ordenar: urgentes primero, luego por días
            eventosProximos.sort((a,b) => {
              if (a.prioridad === 'urgente' && b.prioridad !== 'urgente') return -1
              if (b.prioridad === 'urgente' && a.prioridad !== 'urgente') return 1
              return a.dias - b.dias
            })

            const seccionStyles = {
              urgente: { border: '#fca5a5', bg: '#fef2f2', titulo: '#dc2626', badge: '#dc2626' },
              proximo: { border: '#fde68a', bg: '#fffbeb', titulo: '#d97706', badge: '#d97706' },
              info:    { border: '#93c5fd', bg: '#eff6ff', titulo: '#1d4ed8', badge: '#2563eb' }
            }

            const AlertCard = ({ alerta, esEvento = false }) => {
              const tipo = esEvento ? alerta.prioridad : (alerta.tipo === 'critico' ? 'urgente' : 'proximo')
              const s = seccionStyles[tipo] || seccionStyles.info
              const key = esEvento
                ? `ev_${alerta.tipo}_${alerta.lote || ''}_${alerta.titulo || ''}`
                : `al_${alerta._id || alerta.createdAt}`
              const cumplido = !!alertasCumplidas[key]
              return (
                <div style={{ display:'flex', gap:'12px', padding:'12px 14px', borderRadius:'10px', border:`1px solid ${cumplido ? '#86efac' : s.border}`, background: cumplido ? '#f0fdf4' : s.bg, marginBottom:'8px', opacity: cumplido ? 0.75 : 1 }}>
                  <div style={{ fontSize:'22px', lineHeight:1 }}>{cumplido ? '✅' : (esEvento ? alerta.emoji : (alerta.tipo === 'critico' ? '🔴' : '⚠️'))}</div>
                  <div style={{ flex:1 }}>
                    {esEvento
                      ? <div style={{ fontWeight:'700', fontSize:'14px', color: cumplido ? '#16a34a' : s.titulo, textDecoration: cumplido ? 'line-through' : 'none' }}>{alerta.titulo}</div>
                      : <div style={{ display:'flex', gap:'8px', alignItems:'center', marginBottom:'2px' }}>
                          <span style={{ fontSize:'11px', fontWeight:'700', background: cumplido ? '#22c55e' : s.badge, color:'#fff', padding:'2px 7px', borderRadius:'20px', textTransform:'uppercase' }}>{cumplido ? 'cumplido' : alerta.tipo}</span>
                        </div>
                    }
                    <p style={{ margin:'2px 0', fontSize:'13px', color: cumplido ? '#6b7280' : '#374151', textDecoration: cumplido ? 'line-through' : 'none' }}>{alerta.mensaje}</p>
                    {!esEvento && <small style={{ color:'#9ca3af', fontSize:'11px' }}>{formatearFecha(alerta.createdAt)}</small>}
                    {esEvento && alerta.lote && <small style={{ color:'#9ca3af', fontSize:'11px' }}>Lote: {alerta.lote}</small>}
                  </div>
                  <button
                    onClick={() => toggleAlertaCumplida(key)}
                    style={{
                      alignSelf: 'center', flexShrink:0,
                      padding:'5px 12px', borderRadius:'20px', fontSize:'12px', fontWeight:'600', cursor:'pointer', border:'none',
                      background: cumplido ? '#dcfce7' : '#f1f5f9',
                      color: cumplido ? '#16a34a' : '#64748b',
                      transition:'all .2s'
                    }}
                  >{cumplido ? '✓ Cumplido' : 'Marcar cumplido'}</button>
                </div>
              )
            }

            // Recordatorios próximos (hoy y siguientes 7 días)
            const hoy = ahora.toISOString().split('T')[0]
            const en7dias = new Date(ahora.getTime() + 7*24*3600000).toISOString().split('T')[0]
            const recordatoriosProximos = recordatorios
              .filter(r => r.fecha >= hoy && r.fecha <= en7dias)
              .sort((a,b) => (a.fecha+a.hora) > (b.fecha+b.hora) ? 1 : -1)
            const recordatoriosVencidos = recordatorios.filter(r => r.fecha < hoy)
              .sort((a,b) => b.fecha > a.fecha ? 1 : -1)

            return (
              <div className="page-alertas">
                <div className="page-header">
                  <h2><Bell size={22} /> Centro de Alertas y Notificaciones</h2>
                  <div style={{display:'flex', gap:'8px'}}>
                    <button className="btn-primary btn-sm" onClick={() => setMostrarFormRecordatorio(true)}>+ Recordatorio</button>
                    <button className="btn-refresh" onClick={cargarAlertas}><IconRefresh /></button>
                  </div>
                </div>

                {/* Modal crear recordatorio */}
                {mostrarFormRecordatorio && (
                  <div className="modal-overlay">
                    <div className="modal-content" style={{maxWidth:'420px'}}>
                      <div className="modal-header">
                        <h3>Nuevo Recordatorio</h3>
                        <button className="btn-close" onClick={() => setMostrarFormRecordatorio(false)}>×</button>
                      </div>
                      <div style={{padding:'16px', display:'flex', flexDirection:'column', gap:'12px'}}>
                        <div className="form-group">
                          <label>Título *</label>
                          <input type="text" className="form-control" value={nuevoRecordatorio.titulo}
                            onChange={e => setNuevoRecordatorio({...nuevoRecordatorio, titulo: e.target.value})}
                            placeholder="Ej: Vacunación lote A" />
                        </div>
                        <div style={{display:'flex', gap:'12px'}}>
                          <div className="form-group" style={{flex:1}}>
                            <label>Fecha *</label>
                            <input type="date" className="form-control" value={nuevoRecordatorio.fecha}
                              onChange={e => setNuevoRecordatorio({...nuevoRecordatorio, fecha: e.target.value})} />
                          </div>
                          <div className="form-group" style={{flex:1}}>
                            <label>Hora</label>
                            <input type="time" className="form-control" value={nuevoRecordatorio.hora}
                              onChange={e => setNuevoRecordatorio({...nuevoRecordatorio, hora: e.target.value})} />
                          </div>
                        </div>
                        <div className="form-group">
                          <label>Descripción</label>
                          <textarea className="form-control" rows="2" value={nuevoRecordatorio.descripcion}
                            onChange={e => setNuevoRecordatorio({...nuevoRecordatorio, descripcion: e.target.value})}
                            placeholder="Detalles adicionales..." style={{resize:'vertical'}} />
                        </div>
                        <div style={{display:'flex', gap:'8px', justifyContent:'flex-end'}}>
                          <button className="btn-secondary" onClick={() => setMostrarFormRecordatorio(false)}>Cancelar</button>
                          <button className="btn-primary" onClick={guardarRecordatorio}
                            disabled={!nuevoRecordatorio.titulo || !nuevoRecordatorio.fecha}>Guardar</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ESTADO DE LOTES ACTIVOS */}
                {lotes.filter(l => l.activo).length > 0 && (
                  <div style={{ marginBottom:'28px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px' }}>
                      <span style={{ background:'#0369a1', color:'#fff', borderRadius:'8px', padding:'4px 12px', fontWeight:'700', fontSize:'13px' }}>📊 LOTES ACTIVOS</span>
                      <span style={{ color:'#64748b', fontSize:'12px' }}>Estado actual y próximo pesaje</span>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:'12px' }}>
                      {lotes.filter(l => l.activo).map(lote => {
                        const edadDias = lote.edad_dias || Math.floor((Date.now() - new Date(lote.fecha_inicio)) / (1000*60*60*24))
                        const pesajesLote = pesajes.filter(p => String(p.lote?._id || p.lote) === String(lote._id))
                        const ultimoPesaje = pesajesLote.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
                        const diasSinPesar = (() => {
                          if (!ultimoPesaje) return edadDias
                          const ts = new Date(ultimoPesaje.createdAt)
                          if (isNaN(ts.getTime())) return edadDias
                          return Math.floor((ahora - ts) / (1000*60*60*24))
                        })()
                        const proximoPesaje = diasSinPesar >= 7 ? 0 : 7 - (diasSinPesar % 7)
                        const fase = getEtapaAutomatica(edadDias)
                        const semana = Math.ceil(edadDias / 7)
                        const pesajeVencido = diasSinPesar >= 7
                        return (
                          <div key={lote._id} style={{ padding:'14px', borderRadius:'10px', border:`1px solid ${pesajeVencido ? '#fca5a5' : '#bfdbfe'}`, background: pesajeVencido ? '#fef2f2' : '#eff6ff' }}>
                            <div style={{ fontWeight:'700', fontSize:'14px', marginBottom:'6px', color:'#1e293b' }}>{lote.nombre}</div>
                            <div style={{ fontSize:'12px', color:'#475569', display:'flex', flexDirection:'column', gap:'3px' }}>
                              <span>🐷 {lote.cantidad_cerdos} cerdos · {(lote.peso_promedio_actual||0).toFixed(1)} kg/cerdo</span>
                              <span>📅 Día {edadDias} · Semana {semana} · Fase: <strong>{fase}</strong></span>
                              <span>⚖️ {ultimoPesaje ? `Último pesaje: hace ${diasSinPesar} días` : 'Sin pesajes registrados'}</span>
                              <span style={{ color: pesajeVencido ? '#dc2626' : '#16a34a', fontWeight:'600' }}>
                                {pesajeVencido ? `⚠️ Pesaje VENCIDO (${diasSinPesar} días)` : `✓ Próximo pesaje: en ${proximoPesaje} días`}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* SECCIÓN 1: URGENTES */}
                <div style={{ marginBottom:'28px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px' }}>
                    <span style={{ background:'#dc2626', color:'#fff', borderRadius:'8px', padding:'4px 12px', fontWeight:'700', fontSize:'13px' }}>🔴 URGENTE / HOY</span>
                    <span style={{ color:'#64748b', fontSize:'12px' }}>Últimas 48 horas · requieren atención inmediata</span>
                  </div>
                  {[...eventosProximos.filter(e => e.prioridad === 'urgente'), ...urgentes].length === 0
                    ? <p style={{ color:'#64748b', fontSize:'13px', padding:'10px 14px', background:'#f8fafc', borderRadius:'8px', border:'1px solid #e2e8f0' }}>Sin alertas urgentes activas</p>
                    : <>
                        {eventosProximos.filter(e => e.prioridad === 'urgente').map((e, i) => <AlertCard key={`ev-u-${i}`} alerta={e} esEvento />)}
                        {urgentes.map((a, i) => <AlertCard key={`al-u-${i}`} alerta={a} />)}
                      </>
                  }
                </div>

                {/* SECCIÓN 2: PRÓXIMOS EVENTOS + RECORDATORIOS */}
                <div style={{ marginBottom:'28px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px' }}>
                    <span style={{ background:'#d97706', color:'#fff', borderRadius:'8px', padding:'4px 12px', fontWeight:'700', fontSize:'13px' }}>⚠️ PRÓXIMOS EVENTOS</span>
                    <span style={{ color:'#64748b', fontSize:'12px' }}>Próximos 7 días · lotes activos + recordatorios</span>
                  </div>
                  {eventosProximos.filter(e => e.prioridad === 'proximo').length === 0 && recordatoriosProximos.length === 0
                    ? <p style={{ color:'#64748b', fontSize:'13px', padding:'10px 14px', background:'#f8fafc', borderRadius:'8px', border:'1px solid #e2e8f0' }}>No hay eventos próximos en los siguientes 7 días</p>
                    : <>
                        {eventosProximos.filter(e => e.prioridad === 'proximo').map((e, i) => <AlertCard key={`ev-p-${i}`} alerta={e} esEvento />)}
                        {recordatoriosProximos.map(r => (
                          <div key={r.id} style={{ display:'flex', gap:'12px', padding:'12px 14px', borderRadius:'10px', border:'1px solid #fde68a', background:'#fffbeb', marginBottom:'8px', alignItems:'flex-start' }}>
                            <div style={{ fontSize:'22px', lineHeight:1 }}>📌</div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontWeight:'700', fontSize:'14px', color:'#92400e' }}>{r.titulo}</div>
                              <p style={{ margin:'2px 0', fontSize:'13px', color:'#374151' }}>{r.descripcion || ''}</p>
                              <small style={{ color:'#9ca3af', fontSize:'11px' }}>
                                {r.fecha}{r.hora ? ` a las ${r.hora}` : ''}
                              </small>
                            </div>
                            <button onClick={() => eliminarRecordatorio(r.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:'4px' }} title="Eliminar">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </>
                  }
                </div>

                {/* SECCIÓN 3: HISTORIAL + RECORDATORIOS VENCIDOS */}
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px' }}>
                    <span style={{ background:'#475569', color:'#fff', borderRadius:'8px', padding:'4px 12px', fontWeight:'700', fontSize:'13px' }}>📋 HISTORIAL</span>
                    <span style={{ color:'#64748b', fontSize:'12px' }}>Alertas del sistema anteriores a 48 horas</span>
                  </div>
                  {historial.length === 0 && recordatoriosVencidos.length === 0
                    ? <p style={{ color:'#64748b', fontSize:'13px', padding:'10px 14px', background:'#f8fafc', borderRadius:'8px', border:'1px solid #e2e8f0' }}>Sin historial de alertas</p>
                    : <>
                        {recordatoriosVencidos.map(r => (
                          <div key={r.id} style={{ display:'flex', gap:'12px', padding:'12px 14px', borderRadius:'10px', border:'1px solid #e2e8f0', background:'#f8fafc', marginBottom:'8px', opacity:0.7, alignItems:'flex-start' }}>
                            <div style={{ fontSize:'22px', lineHeight:1 }}>📌</div>
                            <div style={{ flex:1 }}>
                              <div style={{ fontWeight:'700', fontSize:'14px', color:'#64748b' }}>{r.titulo} <span style={{fontSize:'11px', color:'#9ca3af'}}>(vencido)</span></div>
                              {r.descripcion && <p style={{ margin:'2px 0', fontSize:'13px', color:'#94a3b8' }}>{r.descripcion}</p>}
                              <small style={{ color:'#9ca3af', fontSize:'11px' }}>{r.fecha}</small>
                            </div>
                            <button onClick={() => eliminarRecordatorio(r.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:'4px' }} title="Eliminar">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                        {historial.slice(0, 30).map((a, i) => <AlertCard key={`hist-${i}`} alerta={a} />)}
                      </>
                  }
                </div>
              </div>
            )
          })()}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* PÁGINA: REPORTES */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {pagina === 'reportes' && (
            <div className="page-reportes">
              <div className="page-header">
                <h2>Reportes</h2>
              </div>

              <div className="reportes-grid">
                <div className="reporte-card" style={{ gridColumn: 'span 2' }}>
                  <div className="reporte-icon">
                    <IconReporte />
                  </div>
                  <h3>Reporte Completo</h3>
                  <p style={{ marginBottom: '10px', color: '#64748b', fontSize: '13px' }}>
                    El Excel descargado contiene las siguientes pestañas:
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px', marginBottom: '16px' }}>
                    {[
                      { hoja: 'Resumen Ejecutivo', desc: 'Indicadores generales: lotes activos, cerdos totales, peso promedio, ingresos y costos del período.' },
                      { hoja: 'Lotes', desc: 'Detalle de cada lote: nombre, cantidad de cerdos, peso inicial y actual, días de edad, fase y corral.' },
                      { hoja: 'Pesajes', desc: 'Historial de pesajes por lote con fecha, peso promedio, peso total y ganancia registrada.' },
                      { hoja: 'Contabilidad', desc: 'Costos registrados con categoría, descripción, monto y estado (registrado/anulado).' },
                      { hoja: 'Ventas', desc: 'Registro de ventas: lote, cerdos vendidos, precio por kg, peso total y monto cobrado.' },
                      { hoja: 'Inventario Alimento', desc: 'Stock actual por producto: bultos disponibles, kg totales, precio y movimientos recientes.' },
                      { hoja: 'Gastos por Lote', desc: 'Gastos semanales manuales por lote con categoría y monto (sin incluir compras de alimento).' },
                      { hoja: 'Alertas', desc: 'Alertas activas del sistema registradas en la plataforma.' },
                      { hoja: 'Temperatura/Humedad', desc: 'Lecturas de sensores de las últimas 24 horas por hora.' },
                      { hoja: 'Consumo Agua', desc: 'Consumo de agua por hora de las últimas 24 horas.' },
                      { hoja: 'Historial Motobomba', desc: 'Registro de activaciones/desactivaciones del sistema de bombeo.' },
                    ].map(({ hoja, desc }) => (
                      <div key={hoja} style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontWeight: '700', fontSize: '12px', color: '#1d4ed8', marginBottom: '3px' }}>📄 {hoja}</div>
                        <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.4' }}>{desc}</div>
                      </div>
                    ))}
                  </div>

                  {/* Descarga directa */}
                  <button className="btn-primary" onClick={descargarReporte} style={{ marginBottom: '16px' }}>
                    Descargar Excel
                  </button>

                  {/* Envío por correo */}
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                    <p style={{ fontWeight: 600, marginBottom: '8px', color: '#374151' }}>
                      Enviar por correo electrónico
                    </p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <input
                          type="email"
                          list="sugerencias-email"
                          value={emailReporte}
                          onChange={e => setEmailReporte(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && enviarReportePorEmail()}
                          placeholder="correo@ejemplo.com"
                          style={{
                            width: '100%', padding: '8px 12px', borderRadius: '6px',
                            border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box'
                          }}
                        />
                        <datalist id="sugerencias-email">
                          {getSugerenciasEmail().map(email => (
                            <option key={email} value={email} />
                          ))}
                        </datalist>
                      </div>
                      <button
                        className="btn-primary"
                        onClick={enviarReportePorEmail}
                        disabled={enviandoReporte}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        {enviandoReporte ? 'Enviando...' : 'Enviar'}
                      </button>
                    </div>
                    {getSugerenciasEmail().length > 0 && (
                      <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
                        Últimos usados: {getSugerenciasEmail().join(' · ')}
                      </p>
                    )}

                    {/* Verificar config Gmail */}
                    <div style={{ marginTop: '14px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                          onClick={verificarConfigEmail}
                          disabled={testandoEmail}
                          style={{
                            padding: '6px 14px', fontSize: '12px', borderRadius: '6px',
                            border: '1px solid #d1d5db', background: '#f8fafc',
                            cursor: 'pointer', color: '#374151'
                          }}
                        >
                          {testandoEmail ? 'Verificando...' : 'Verificar config. Gmail'}
                        </button>
                        {testEmailResult && (
                          <span style={{
                            fontSize: '12px', fontWeight: 600,
                            color: testEmailResult.ok ? '#16a34a' : '#dc2626'
                          }}>
                            {testEmailResult.ok
                              ? <><CheckCircle size={13} style={{verticalAlign:'middle', marginRight:3}} />Gmail OK</>
                              : <><XCircle size={13} style={{verticalAlign:'middle', marginRight:3}} />{testEmailResult.problema}</>
                            }
                          </span>
                        )}
                      </div>

                      {/* Mostrar solución si hay error */}
                      {testEmailResult && !testEmailResult.ok && (
                        <div style={{
                          marginTop: '10px', padding: '12px', borderRadius: '8px',
                          background: '#fef2f2', border: '1px solid #fecaca', fontSize: '12px'
                        }}>
                          <p style={{ fontWeight: 700, color: '#dc2626', marginBottom: '6px' }}>
                            Problema: {testEmailResult.problema}
                          </p>
                          <p style={{ color: '#7f1d1d', lineHeight: 1.6 }}>{testEmailResult.mensaje}</p>
                          {testEmailResult.error_tecnico && (
                            <p style={{ color: '#9ca3af', marginTop: '6px', fontFamily: 'monospace', fontSize: '11px' }}>
                              {testEmailResult.error_tecnico}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Guía rápida App Password */}
                      <details style={{ marginTop: '10px' }}>
                        <summary style={{ fontSize: '12px', color: '#6b7280', cursor: 'pointer' }}>
                          ¿Cómo configurar Gmail App Password?
                        </summary>
                        <ol style={{ fontSize: '11px', color: '#374151', paddingLeft: '16px', marginTop: '8px', lineHeight: 1.8 }}>
                          <li>Ve a <strong>myaccount.google.com → Seguridad</strong></li>
                          <li>Activa <strong>Verificación en 2 pasos</strong> (si no está activa)</li>
                          <li>Busca <strong>"Contraseñas de aplicaciones"</strong></li>
                          <li>Selecciona "Correo" → "Otro" → nombra "COO Alianzas"</li>
                          <li>Copia los <strong>16 dígitos</strong> generados</li>
                          <li>Pega esos 16 dígitos en la variable <code>EMAIL_PASS</code> del servidor</li>
                          <li>En <code>EMAIL_USER</code> pon tu correo Gmail completo</li>
                        </ol>
                      </details>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* PÁGINA: USUARIOS (SUPERADMIN) */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {pagina === 'usuarios' && (user.rol === 'superadmin' || user.rol === 'ingeniero') && (
            <div className="page-usuarios">
              <div className="page-header">
                <h2>Gestión de Usuarios</h2>
                <button className="btn-primary" onClick={() => setMostrarModalUsuario(true)}>
                  <IconMas />
                  Nuevo Usuario
                </button>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Correo</th>
                      <th>Rol</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="sin-datos">No hay usuarios registrados</td>
                      </tr>
                    ) : (
                      usuarios.map(usr => (
                        <tr key={usr._id}>
                          <td><strong>{usr.usuario}</strong></td>
                          <td>{usr.correo}</td>
                          <td>
                            <span className={`rol-badge ${usr.rol}`}>{usr.rol}</span>
                          </td>
                          <td>
                            <span className={`estado-badge ${usr.activo ? 'activo' : 'inactivo'}`}>
                              {usr.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td>
                            <button 
                              className="btn-icon"
                              onClick={() => toggleUsuario(usr._id)}
                              title={usr.activo ? 'Desactivar' : 'Activar'}
                            >
                              {usr.activo ? <IconOjoCerrado /> : <IconOjo />}
                            </button>
                            {user.rol === 'ingeniero' && (
                              <button 
                                className="btn-icon btn-danger"
                                onClick={() => eliminarUsuario(usr._id)}
                                title="Eliminar"
                              >
                                <IconEliminar />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Modal Usuario */}
              {mostrarModalUsuario && (
                <div className="modal-overlay" onClick={() => setMostrarModalUsuario(false)}>
                  <div className="modal" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                      <h3>Nuevo Usuario</h3>
                      <button className="btn-cerrar" onClick={() => setMostrarModalUsuario(false)}>&times;</button>
                    </div>
                    <div className="modal-body">
                      <div className="form-group">
                        <label>Usuario</label>
                        <input
                          type="text"
                          value={nuevoUsuario.usuario}
                          onChange={e => setNuevoUsuario({ ...nuevoUsuario, usuario: e.target.value })}
                          placeholder="Nombre de usuario"
                        />
                      </div>
                      <div className="form-group">
                        <label>Correo</label>
                        <input
                          type="email"
                          value={nuevoUsuario.correo}
                          onChange={e => setNuevoUsuario({ ...nuevoUsuario, correo: e.target.value })}
                          placeholder="correo@ejemplo.com"
                        />
                      </div>
                      <div className="form-group">
                        <label>Contraseña</label>
                        <input
                          type="password"
                          value={nuevoUsuario.password}
                          onChange={e => setNuevoUsuario({ ...nuevoUsuario, password: e.target.value })}
                          placeholder="Contraseña segura"
                        />
                      </div>
                      <div className="form-group">
                        <label>Rol</label>
                        <select
                          value={nuevoUsuario.rol}
                          onChange={e => setNuevoUsuario({ ...nuevoUsuario, rol: e.target.value })}
                        >
                          <option value="cliente">Cliente (Granja)</option>
                          {user.rol === 'ingeniero' && (
                            <>
                              <option value="superadmin">SuperAdmin</option>
                              <option value="ingeniero">Ingeniero</option>
                            </>
                          )}
                        </select>
                      </div>
                    </div>
                    <div className="modal-footer">
                      <button className="btn-secondary" onClick={() => setMostrarModalUsuario(false)}>Cancelar</button>
                      <button className="btn-primary" onClick={crearUsuario}>Crear Usuario</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}


{/* ════════════════════════════════════════════════════════════════ */}
{/* PÁGINA: CÁMARAS */}
{/* ════════════════════════════════════════════════════════════════ */}
{/* Módulo cámaras temporalmente oculto */}

{/* ════════════════════════════════════════════════════════════════ */}
{/* PÁGINA: INVENTARIO */}
{/* ════════════════════════════════════════════════════════════════ */}
{/* ════════════════════════════════════════════════════════════════ */}
{/* PÁGINA: INVENTARIO (CON TABS) */}
{/* ════════════════════════════════════════════════════════════════ */}
{pagina === 'inventario' && (
  <div className="page-inventario">
    {/* Tabs de navegación */}
    <div className="finanzas-tabs" style={{marginBottom: '24px'}}>
      <button 
        className={`tab-btn ${tabInventario === 'cerdos' ? 'activo' : ''}`}
        onClick={() => setTabInventario('cerdos')}
      >
        <IconCerdo size={16} style={{verticalAlign:'middle', marginRight:6}} />Inventario de Cerdos
      </button>
      <button
        className={`tab-btn ${tabInventario === 'alimento' ? 'activo' : ''}`}
        onClick={() => setTabInventario('alimento')}
      >
        <Package size={16} style={{verticalAlign:'middle', marginRight:6}} />Inventario de Alimento
      </button>
    </div>

    {/* TAB: CERDOS */}
    {tabInventario === 'cerdos' && (
      <PanelInventario
        inventario={inventario}
        lotes={lotes.filter(l => l.activo)}
        estadisticas={{
          ...estadisticasInventario,
          total_activos: lotes.filter(l => l.activo).reduce((sum, l) => sum + (l.cantidad_cerdos || 0), 0),
          peso_total_kg: lotes.filter(l => l.activo).reduce((sum, l) => sum + ((l.cantidad_cerdos || 0) * (l.peso_promedio_actual || 0)), 0)
        }}
        onNuevoCerdo={crearCerdo}
        onEliminarCerdo={eliminarCerdo}
        onActualizarLote={async (id, datos) => { await actualizarLote(id, datos); await cargarLotes() }}
      />
    )}

    {/* TAB: ALIMENTO */}
    {tabInventario === 'alimento' && (
      <div className="inventario-alimento-content">
        <div className="page-header">
          <h2><Package size={24} /> Inventario de Alimento Concentrado</h2>
          <div style={{display:'flex', gap:'8px'}}>
            <button className="btn-secondary" onClick={() => setMostrarModalNuevoProducto(true)}>
              <Plus size={18} /> Nuevo Producto
            </button>
            <button className="btn-primary" onClick={() => {
              if (inventarioAlimento.length === 0) {
                alert('Primero crea un producto con el botón "Nuevo Producto"')
                return
              }
              setNuevaMovimientoAlimento(prev => ({ ...prev, tipo: 'entrada' }))
              setMostrarModalAlimento(true)
            }}>
              <Plus size={18} /> Registrar Entrada
            </button>
          </div>
        </div>

        {/* Alertas de stock bajo — PROMINENTE */}
        {resumenInventarioAlimento?.bajo_stock?.length > 0 && (
          <div style={{marginBottom:'16px', padding:'16px', background:'#fef3c7', border:'2px solid #f59e0b', borderRadius:'12px'}}>
            <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px'}}>
              <AlertTriangle size={22} style={{color:'#d97706'}} />
              <strong style={{color:'#92400e', fontSize:'16px'}}>ALERTA: Stock Bajo de Alimento</strong>
            </div>
            {resumenInventarioAlimento.bajo_stock.map((item, i) => (
              <div key={i} style={{padding:'6px 0', borderBottom: i < resumenInventarioAlimento.bajo_stock.length - 1 ? '1px solid #fbbf24' : 'none', color:'#78350f'}}>
                <strong>{item.nombre}</strong> ({item.tipo}) — Quedan <strong style={{color:'#dc2626'}}>{formatBultos(item.cantidad, 40)}</strong> (mínimo: {item.minimo} bultos)
              </div>
            ))}
          </div>
        )}

        {/* Resumen por producto (stock actual) */}
        <div style={{marginBottom:'24px'}}>
          <h3 style={{marginBottom:'12px', fontSize:'16px', fontWeight:'600'}}>Stock Actual por Producto</h3>
          <div style={{display:'flex', gap:'16px', flexWrap:'wrap'}}>
            {inventarioAlimento.length === 0 ? (
              <p className="sin-datos">No hay productos de alimento registrados</p>
            ) : (
              inventarioAlimento.map(inv => {
                const kgTotal     = (inv.cantidad_bultos || 0) * (inv.peso_por_bulto_kg || 40)
                const sinStock    = (inv.cantidad_bultos || 0) === 0
                const critico10kg = kgTotal <= 10 && kgTotal > 0
                // STOCK BAJO solo si hay algo de stock pero está por debajo del mínimo (no cuando es 0)
                const bajo        = !sinStock && !critico10kg && (inv.cantidad_bultos || 0) <= (inv.stock_minimo_bultos || 5)
                const bgColor     = sinStock ? '#f8fafc' : critico10kg ? '#fef2f2' : bajo ? '#fef3c7' : '#f8fafc'
                const borderColor = sinStock ? '#cbd5e1' : critico10kg ? '#fecaca' : bajo ? '#fde68a' : '#e2e8f0'
                return (
                  <div key={inv._id} style={{
                    flex:'1', minWidth:'220px', padding:'16px', borderRadius:'12px',
                    border:`1px solid ${borderColor}`, background: bgColor, position:'relative'
                  }}>
                    {(user?.rol === 'ingeniero' || user?.rol === 'superadmin') && (
                      <button
                        title="Eliminar producto (solo ingeniero)"
                        onClick={() => eliminarProductoAlimento(inv._id, inv.nombre)}
                        style={{ position:'absolute', top:'8px', right:'8px', background:'none', border:'none', cursor:'pointer', color:'#ef4444', padding:'2px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    <div style={{fontWeight:'700', fontSize:'15px', marginBottom:'2px'}}>{inv.nombre}</div>
                    <div style={{fontSize:'12px', color:'#64748b', marginBottom:'8px'}}>Tipo: {inv.tipo} · {inv.peso_por_bulto_kg} kg/bulto</div>

                    {/* Cantidad principal en formato legible */}
                    <div style={{fontSize:'22px', fontWeight:'800', color: critico10kg ? '#dc2626' : bajo ? '#d97706' : '#1e293b', marginBottom:'2px'}}>
                      {formatBultos(inv.cantidad_bultos, inv.peso_por_bulto_kg)}
                    </div>
                    <div style={{fontSize:'13px', color:'#64748b', marginBottom:'8px'}}>
                      = <strong>{kgTotal % 1 === 0 ? kgTotal : kgTotal.toFixed(1)} kg</strong> en total
                    </div>

                    <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px', color:'#64748b'}}>
                      <span>${(inv.precio_bulto || 0).toLocaleString()}/bulto</span>
                      <span>Mín: {inv.stock_minimo_bultos || 5} bultos</span>
                    </div>

                    {sinStock && (
                      <div style={{marginTop:'8px', padding:'4px 8px', background:'#f1f5f9', borderRadius:'6px', fontSize:'12px', color:'#64748b', fontWeight:'500', display:'flex', alignItems:'center', gap:'4px'}}>
                        Sin stock — registra una Entrada para agregar bultos
                      </div>
                    )}
                    {critico10kg && (
                      <div style={{marginTop:'8px', padding:'6px 8px', background:'#fee2e2', borderRadius:'6px', fontSize:'12px', color:'#991b1b', fontWeight:'700', display:'flex', alignItems:'center', gap:'4px'}}>
                        <AlertTriangle size={13} /> CRÍTICO: solo {kgTotal.toFixed(1)} kg — Reabastecer urgente
                      </div>
                    )}
                    {bajo && !critico10kg && (
                      <div style={{marginTop:'8px', padding:'4px 8px', background:'#fef3c7', borderRadius:'6px', fontSize:'12px', color:'#92400e', fontWeight:'600', display:'flex', alignItems:'center', gap:'4px'}}>
                        <AlertTriangle size={12} /> STOCK BAJO — quedan {inv.cantidad_bultos} bulto(s), mín. {inv.stock_minimo_bultos}
                      </div>
                    )}
                  </div>
                )
              })
            )}
            {/* Tarjeta resumen total */}
            {inventarioAlimento.length > 0 && (
              <div style={{flex:'1', minWidth:'220px', padding:'16px', borderRadius:'12px', border:'2px solid #3b82f6', background:'#eff6ff'}}>
                <div style={{fontWeight:'700', fontSize:'15px', marginBottom:'8px', color:'#1d4ed8'}}>TOTAL GENERAL</div>
                <div style={{fontSize:'28px', fontWeight:'800', color:'#1e293b'}}>
                  {(resumenInventarioAlimento?.total_kg || 0) % 1 === 0
                    ? (resumenInventarioAlimento?.total_kg || 0)
                    : (resumenInventarioAlimento?.total_kg || 0).toFixed(1)}
                  <span style={{fontSize:'14px', fontWeight:'400', color:'#64748b'}}> kg</span>
                </div>
                <div style={{fontSize:'13px', color:'#64748b'}}>{inventarioAlimento.length} producto(s) · {inventarioAlimento.reduce((s, i) => s + (i.cantidad_bultos || 0), 0).toFixed(2)} bultos totales</div>
                <div style={{fontSize:'14px', fontWeight:'600', color:'#1d4ed8', marginTop:'4px'}}>${(resumenInventarioAlimento?.valor_total || 0).toLocaleString()} en inventario</div>
              </div>
            )}
          </div>
        </div>

        {/* Resumen semanal de movimientos */}
        {(() => {
          const ahora = new Date()
          const inicioSemana = new Date(ahora)
          inicioSemana.setDate(ahora.getDate() - ahora.getDay())
          inicioSemana.setHours(0,0,0,0)

          const movsSemana = inventarioAlimento.flatMap(inv =>
            (inv.movimientos || []).filter(m => new Date(m.fecha) >= inicioSemana)
          )
          const entradas = movsSemana.filter(m => m.tipo === 'entrada')
          const salidas = movsSemana.filter(m => m.tipo === 'salida')
          const totalEntradas = entradas.reduce((s, m) => s + (m.cantidad_bultos || 0), 0)
          const totalSalidas = salidas.reduce((s, m) => s + (m.cantidad_bultos || 0), 0)
          const costoSemana = entradas.reduce((s, m) => s + (m.total || 0), 0)

          return (
            <div style={{marginBottom:'24px', padding:'16px', background:'#f0fdf4', border:'1px solid #86efac', borderRadius:'12px'}}>
              <h3 style={{marginBottom:'12px', fontSize:'15px', fontWeight:'700', color:'#166534'}}>📊 Resumen Esta Semana</h3>
              <div style={{display:'flex', gap:'24px', flexWrap:'wrap'}}>
                <div><div style={{fontSize:'12px', color:'#64748b'}}>Entradas (bultos)</div><div style={{fontSize:'22px', fontWeight:'800', color:'#166534'}}>+{totalEntradas}</div></div>
                <div><div style={{fontSize:'12px', color:'#64748b'}}>Salidas (bultos)</div><div style={{fontSize:'22px', fontWeight:'800', color:'#dc2626'}}>-{totalSalidas}</div></div>
                <div><div style={{fontSize:'12px', color:'#64748b'}}>Costo compras semana</div><div style={{fontSize:'22px', fontWeight:'800', color:'#1d4ed8'}}>${costoSemana.toLocaleString()}</div></div>
                <div><div style={{fontSize:'12px', color:'#64748b'}}>Movimientos</div><div style={{fontSize:'22px', fontWeight:'800'}}>{movsSemana.length}</div></div>
              </div>
            </div>
          )
        })()}

        {/* Tabla de movimientos (aplanada de todos los productos) */}
        <h3 style={{marginBottom:'12px', fontSize:'15px', fontWeight:'600'}}>Historial de Movimientos</h3>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Tipo</th>
                <th>Bultos</th>
                <th>Precio/Bulto</th>
                <th>Total</th>
                <th>Lote</th>
                <th>Descripción</th>
              </tr>
            </thead>
            <tbody>
              {inventarioAlimento.length === 0 ? (
                <tr><td colSpan="8" className="sin-datos">No hay movimientos registrados</td></tr>
              ) : (
                (() => {
                  const todos = inventarioAlimento.flatMap(inv =>
                    (inv.movimientos || []).map(m => ({ ...m, producto_nombre: inv.nombre }))
                  ).sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 60)

                  if (todos.length === 0) return (
                    <tr><td colSpan="8" className="sin-datos">Sin movimientos aún. Registra una entrada o salida.</td></tr>
                  )

                  return todos.map((m, i) => (
                    <tr key={i}>
                      <td>{new Date(m.fecha).toLocaleDateString('es-CO')}</td>
                      <td><strong>{m.producto_nombre}</strong></td>
                      <td>
                        <span style={{
                          padding:'4px 10px', borderRadius:'6px', fontSize:'12px', fontWeight:'600',
                          background: m.tipo === 'entrada' ? '#dcfce7' : '#fee2e2',
                          color: m.tipo === 'entrada' ? '#166534' : '#991b1b'
                        }}>
                          {m.tipo === 'entrada' ? '📥 Entrada' : '📤 Salida'}
                        </span>
                      </td>
                      <td><strong>{m.cantidad_bultos} bultos</strong><br/><small>{m.cantidad_kg || (m.cantidad_bultos * 40)} kg</small></td>
                      <td>${(m.precio_unitario || 0).toLocaleString()}</td>
                      <td><strong>${(m.total || 0).toLocaleString()}</strong></td>
                      <td>{m.lote?.nombre || '-'}</td>
                      <td>{m.descripcion || '-'}</td>
                    </tr>
                  ))
                })()
              )}
            </tbody>
          </table>
        </div>

       {/* Modal Nuevo Producto de Alimento */}
{mostrarModalNuevoProducto && (
  <div className="modal-overlay" onClick={() => setMostrarModalNuevoProducto(false)}>
    <div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <h3><Package size={18} /> Crear Nuevo Producto de Alimento</h3>
        <button className="btn-cerrar" onClick={() => setMostrarModalNuevoProducto(false)}>&times;</button>
      </div>
      <div className="modal-body">
        <p style={{color:'#64748b', fontSize:'13px', marginBottom:'12px'}}>
          Crea el producto primero (sin stock). Luego usa "Registrar Movimiento &gt; Entrada" para agregar bultos.
        </p>
        <div className="form-group">
          <label>Nombre del Producto *</label>
          <input
            type="text"
            value={nuevoProductoAlimento.nombre}
            onChange={e => setNuevoProductoAlimento({...nuevoProductoAlimento, nombre: e.target.value})}
            placeholder="Ej: Concentrado Engorde, Maíz, Soya..."
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Tipo</label>
            <select
              value={nuevoProductoAlimento.tipo}
              onChange={e => setNuevoProductoAlimento({...nuevoProductoAlimento, tipo: e.target.value})}
            >
              <option value="universa">Universal</option>
              <option value="inicio">Inicio</option>
              <option value="crecimiento">Crecimiento</option>
              <option value="engorde">Engorde</option>
              <option value="gestacion">Gestación</option>
              <option value="lactancia">Lactancia</option>
            </select>
          </div>
          <div className="form-group">
            <label>Precio por Bulto ($) *</label>
            <input
              type="number"
              min="0"
              value={nuevoProductoAlimento.precio_bulto}
              onChange={e => setNuevoProductoAlimento({...nuevoProductoAlimento, precio_bulto: e.target.value})}
              placeholder="Ej: 85000"
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Kg por Bulto</label>
            <input
              type="number"
              min="1"
              value={nuevoProductoAlimento.peso_por_bulto_kg}
              onChange={e => setNuevoProductoAlimento({...nuevoProductoAlimento, peso_por_bulto_kg: e.target.value})}
              placeholder="40"
            />
          </div>
          <div className="form-group">
            <label>Stock Mínimo (bultos)</label>
            <input
              type="number"
              min="0"
              value={nuevoProductoAlimento.stock_minimo_bultos}
              onChange={e => setNuevoProductoAlimento({...nuevoProductoAlimento, stock_minimo_bultos: e.target.value})}
              placeholder="5"
            />
          </div>
        </div>
      </div>
      <div className="modal-footer">
        <button className="btn-secondary" onClick={() => setMostrarModalNuevoProducto(false)}>Cancelar</button>
        <button className="btn-primary" onClick={crearNuevoProductoAlimento}>
          <Plus size={16} /> Crear Producto
        </button>
      </div>
    </div>
  </div>
)}

       {/* Modal Entrada de Alimento (solo compras; el consumo se registra desde el panel del lote) */}
{mostrarModalAlimento && (
  <div className="modal-overlay" onClick={() => setMostrarModalAlimento(false)}>
    <div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <h3>Registrar Entrada de Alimento (Compra)</h3>
        <button className="btn-cerrar" onClick={() => setMostrarModalAlimento(false)}>&times;</button>
      </div>
      <div className="modal-body">
        <p style={{fontSize:'12px', color:'#64748b', marginBottom:'12px', background:'#f0fdf4', padding:'8px 10px', borderRadius:'6px', borderLeft:'3px solid #22c55e'}}>
          Usa este formulario para registrar <strong>compras</strong> de alimento. Para registrar <strong>consumo por lote</strong> ve al panel del lote y usa "Registrar Consumo".
        </p>

        <div className="form-group">
          <label>Producto de Alimento *</label>
          <select
            value={nuevaMovimientoAlimento.inventario_id}
            onChange={e => {
              const inv = inventarioAlimento.find(i => i._id === e.target.value)
              setNuevaMovimientoAlimento({
                ...nuevaMovimientoAlimento,
                inventario_id: e.target.value,
                precio_bulto: inv?.precio_bulto || nuevaMovimientoAlimento.precio_bulto
              })
            }}
          >
            <option value="">— Selecciona un producto —</option>
            {inventarioAlimento.map(inv => (
              <option key={inv._id} value={inv._id}>
                {inv.nombre} ({inv.tipo}) — Stock: {inv.cantidad_bultos} bultos
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Cantidad de Bultos *</label>
            <input
              type="number"
              min="1"
              value={nuevaMovimientoAlimento.cantidad_bultos}
              onChange={e => setNuevaMovimientoAlimento({...nuevaMovimientoAlimento, cantidad_bultos: numVal(e.target.value)})}
              placeholder="Ej: 10"
            />
          </div>
          <div className="form-group">
            <label>Precio por Bulto ($)</label>
            <input
              type="number"
              value={nuevaMovimientoAlimento.precio_bulto}
              onChange={e => setNuevaMovimientoAlimento({...nuevaMovimientoAlimento, precio_bulto: numVal(e.target.value)})}
              placeholder="Ej: 85000"
            />
          </div>
        </div>

        <div className="form-group">
          <label>Descripción</label>
          <input
            type="text"
            value={nuevaMovimientoAlimento.descripcion}
            onChange={e => setNuevaMovimientoAlimento({...nuevaMovimientoAlimento, descripcion: e.target.value})}
            placeholder="Ej: Compra semanal proveedor X"
          />
        </div>

        <div className="form-group">
          <label>Total de la Compra</label>
          <input
            type="text"
            value={`$${((nuevaMovimientoAlimento.cantidad_bultos || 0) * (nuevaMovimientoAlimento.precio_bulto || 0)).toLocaleString()}`}
            disabled
            style={{background:'#f1f5f9', fontWeight:'bold', fontSize:'18px'}}
          />
        </div>
      </div>

      <div className="modal-footer">
        <button className="btn-secondary" onClick={() => setMostrarModalAlimento(false)}>Cancelar</button>
        <button className="btn-primary" onClick={registrarMovimientoAlimento}>
          Registrar Entrada
        </button>
      </div>
    </div>
  </div>
)}
      </div>
    )}
  </div>
)}
          {/* ════════════════════════════════════════════════════════════════ */}
          {/* PÁGINA: CONFIGURACIÓN */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {pagina === 'config' && (
            <div className="page-config">
              <div className="page-header">
                <h2>Configuración</h2>
              </div>

              <div className="config-sections">
                {/* Precios */}
                <div className="config-section">
                  <h3>Precios</h3>
                  <div className="config-grid">
                    <div className="form-group">
                      <label>Precio Agua (por litro)</label>
                      <input
                        type="number"
                        value={config.precio_agua_litro}
                        onChange={e => setConfig({ ...config, precio_agua_litro: numVal(e.target.value, true) })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Precio Alimento (por kg)</label>
                      <input
                        type="number"
                        value={config.precio_alimento_kg}
                        onChange={e => setConfig({ ...config, precio_alimento_kg: numVal(e.target.value, true) })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Precio Venta Cerdo (por kg en pie)</label>
                      <input
                        type="number"
                        value={config.precio_venta_kg}
                        onChange={e => setConfig({ ...config, precio_venta_kg: numVal(e.target.value, true) })}
                      />
                    </div>
                  </div>
                </div>

                {/* Umbrales */}
                <div className="config-section">
                  <h3>Umbrales de Temperatura</h3>
                  <div className="config-grid">
                    <div className="form-group">
                      <label>Temperatura Alerta (°C)</label>
                      <input
                        type="number"
                        value={config.umbral_temp_max}
                        onChange={e => setConfig({ ...config, umbral_temp_max: numVal(e.target.value, true) })}
                      />
                      <small>Se genera alerta cuando supera este valor</small>
                    </div>
                    <div className="form-group">
                      <label>Temperatura Crítica (°C)</label>
                      <input
                        type="number"
                        value={config.umbral_temp_critico}
                        onChange={e => setConfig({ ...config, umbral_temp_critico: numVal(e.target.value, true) })}
                      />
                      <small>Se activan bombas automáticamente</small>
                    </div>
                  </div>
                </div>

                {/* Botón guardar */}
                <div className="config-actions">
                  <button className="btn-primary" onClick={guardarConfig}>
                    Guardar Configuración
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )


} 

export default App