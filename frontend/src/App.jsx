import { useState, useEffect } from 'react'
import axios from 'axios'
import { io } from 'socket.io-client'
import './App.css'
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { 
  Thermometer, Droplets, Weight, TrendingUp, TrendingDown, 
  PiggyBank, Package, Zap, Bell, BellOff, Activity, 
  BarChart3, PieChart as PieChartIcon, LineChart as LineChartIcon,
  Users, Settings, LogOut, Eye, EyeOff, Plus, Edit, Trash2,
  RefreshCw, Camera, DollarSign, Wallet, Calculator, Archive,
  AlertTriangle, CheckCircle, XCircle, Clock, Calendar,
  Home, ChevronRight, MoreVertical, Download, Send, Mail,
  Smartphone, Wifi, WifiOff, Power, PowerOff, Gauge
} from 'lucide-react'
// ═══════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════

const API_URL = import.meta.env.VITE_API_URL || 'https://cop-alianza-backend.onrender.com'
const socket = io(API_URL)

// Coordenadas Lorica para clima
const LAT = 9.2397
const LON = -75.8091

// ═══════════════════════════════════════════════════════════════════════
// ICONOS SVG
// ═══════════════════════════════════════════════════════════════════════



const IconTemp = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M15 13V5A3 3 0 0 0 9 5V13A5 5 0 1 0 15 13M12 4A1 1 0 0 1 13 5V8H11V5A1 1 0 0 1 12 4Z"/>
  </svg>
)

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
const IconHumedad = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M12 2C6.5 8 4 12 4 15.5C4 19.64 7.58 23 12 23S20 19.64 20 15.5C20 12 17.5 8 12 2ZM12 21C8.69 21 6 18.54 6 15.5C6 13.06 7.81 9.98 12 5.34C16.19 9.98 18 13.06 18 15.5C18 18.54 15.31 21 12 21Z"/>
  </svg>
)

const IconAgua = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M12 20C8.69 20 6 17.31 6 14C6 10 12 3.25 12 3.25S18 10 18 14C18 17.31 15.31 20 12 20ZM12 18C14.21 18 16 16.21 16 14C16 11.79 12 6.25 12 6.25S8 11.79 8 14C8 16.21 9.79 18 12 18Z"/>
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

const IconLogout = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M17 7L15.59 8.41L18.17 11H8V13H18.17L15.59 15.58L17 17L22 12L17 7ZM4 5H12V3H4C2.9 3 2 3.9 2 5V19C2 20.1 2.9 21 4 21H12V19H4V5Z"/>
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
  const [camaraSeleccionada, setCamaraSeleccionada] = useState(null)
  
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
                    onChange={(e) => setNuevaVenta({...nuevaVenta, cantidad: parseInt(e.target.value)})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Peso Total (kg)</label>
                  <input 
                    type="number"
                    step="0.1"
                    value={nuevaVenta.peso_total_kg}
                    onChange={(e) => setNuevaVenta({...nuevaVenta, peso_total_kg: parseFloat(e.target.value)})}
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
                    onChange={(e) => setNuevaVenta({...nuevaVenta, precio_kg: parseInt(e.target.value)})}
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
                    onChange={(e) => setNuevoCosto({...nuevoCosto, cantidad: parseInt(e.target.value)})}
                  />
                </div>
                <div className="form-group">
                  <label>Precio Unitario</label>
                  <input 
                    type="number"
                    value={nuevoCosto.precio_unitario}
                    onChange={(e) => setNuevoCosto({...nuevoCosto, precio_unitario: parseInt(e.target.value)})}
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

const PanelInventario = ({ inventario, estadisticas, onNuevoCerdo }) => {
  const [modalCerdo, setModalCerdo] = useState(false)
  const [nuevoCerdo, setNuevoCerdo] = useState({
    tipo: 'engorde',
    sexo: 'macho',
    peso_actual: 0,
    corral: '',
    origen: 'nacido_granja'
  })
  
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
      
      {/* Por Tipo */}
      <div className="inventario-tipos">
        <h3>Por Categoría</h3>
        <div className="tipos-grid">
          {estadisticas?.por_tipo?.map(t => (
            <div key={t._id} className="tipo-card">
              <span className="tipo-nombre">{t._id}</span>
              <span className="tipo-cantidad">{t.cantidad}</span>
              <span className="tipo-peso">~{t.peso_promedio?.toFixed(1) || 0} kg</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Tabla de inventario */}
      <div className="tabla-container">
        <table className="tabla-inventario">
          <thead>
            <tr>
              <th>Código</th>
              <th>Tipo</th>
              <th>Sexo</th>
              <th>Peso</th>
              <th>Corral</th>
              <th>Salud</th>
            </tr>
          </thead>
          <tbody>
            {inventario.length === 0 ? (
              <tr><td colSpan="6" className="empty-row">No hay cerdos registrados</td></tr>
            ) : (
              inventario.slice(0, 15).map(c => (
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
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
                    onChange={(e) => setNuevoCerdo({...nuevoCerdo, peso_actual: parseFloat(e.target.value)})}
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
  
  // Estados de navegación
  const [pagina, setPagina] = useState('dashboard')
  const [menuAbierto, setMenuAbierto] = useState(false)
  
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
    estado: 'engorde',
    peso_inicial_promedio: 0,
    notas: ''
  })
  
  // Estados de pesajes
  const [pesajes, setPesajes] = useState([])
  const [mostrarModalPesaje, setMostrarModalPesaje] = useState(false)
  const [nuevoPesaje, setNuevoPesaje] = useState({
    lote: '',
    peso: 0,
    cantidad_cerdos_pesados: 1,
    notas: ''
  })
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
  const [mostrarConfig, setMostrarConfig] = useState(false)
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

// Estados para gráficas
const [historicoTemperatura, setHistoricoTemperatura] = useState([])
const [historicoAgua, setHistoricoAgua] = useState([])
const [historicoContable, setHistoricoContable] = useState([])
const [historicoPesos, setHistoricoPesos] = useState([])
const [distribucionGastos, setDistribucionGastos] = useState([])

  // Estados de usuarios (SuperAdmin)
  const [usuarios, setUsuarios] = useState([])
  const [mostrarModalUsuario, setMostrarModalUsuario] = useState(false)
  const [nuevoUsuario, setNuevoUsuario] = useState({
    usuario: '',
    correo: '',
    password: '',
    rol: 'cliente'
  })


  // ═══════════════════════════════════════════════════════════════════════
  // EFECTOS
  // ═══════════════════════════════════════════════════════════════════════

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

  // WebSocket
  useEffect(() => {
    socket.on('lectura_actualizada', (data) => {
      if (data.temperatura) {
        setPorqueriza(prev => ({ ...prev, temp: data.temperatura, humedad: data.humedad, conectado: true }))
      }
      if (data.caudal_l_min !== undefined) {
        setFlujo(prev => ({ ...prev, caudal: data.caudal_l_min, volumen_diario: data.volumen_diario_l, conectado: true }))
      }
    })

    socket.on('nuevo_peso', (data) => {
      setUltimoPeso(data)
      cargarPesajes()
    })
socket.on('peso_live', (data) => {
      setPesoLive({
        peso: data.peso,
        estable: data.estable,
        conectado: true
      })
    })
    socket.on('bomba_actualizada', (data) => {
      cargarBombas()
    })

    return () => {
      socket.off('lectura_actualizada')
      socket.off('nuevo_peso')
      socket.off('bomba_actualizada')
      socket.off('peso_live')
    }
  }, [])

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

  const handleLogin = async (e) => {
    e.preventDefault()
    setErrorLogin('')
    setCargando(true)

    try {
      const res = await axios.post(`${API_URL}/api/users/login`, {
        usuario,
        password
      })

      const { token: nuevoToken, usuario: userData } = res.data
      localStorage.setItem('token', nuevoToken)
      setToken(nuevoToken)
      setUser(userData)
      setUsuario('')
      setPassword('')
    } catch (error) {
      setErrorLogin(error.response?.data?.mensaje || 'Error al iniciar sesión')
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
    cargarInventario()
  ])
  
  // Cargar datos para gráficas después de tener los datos base
  cargarHistoricoTemperatura()
  cargarHistoricoAgua()
  cargarHistoricoContable()
  cargarHistoricoPesos()
  cargarDistribucionGastos()
  
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

// Funciones para acciones
const crearVenta = async (datos) => {
  try {
    await axios.post(`${API_URL}/api/ventas`, datos, {
      headers: { Authorization: `Bearer ${token}` }
    })
    cargarVentas()
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
    await axios.post(`${API_URL}/api/costos`, datos, {
      headers: { Authorization: `Bearer ${token}` }
    })
    cargarCostos()
  } catch (error) {
    alert('Error creando costo: ' + (error.response?.data?.mensaje || error.message))
  }
}

const crearCerdo = async (datos) => {
  try {
    await axios.post(`${API_URL}/api/inventario`, datos, {
      headers: { Authorization: `Bearer ${token}` }
    })
    cargarInventario()
  } catch (error) {
    alert('Error registrando cerdo: ' + (error.response?.data?.mensaje || error.message))
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
        `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m`
      )
      setClima({
        temp: res.data.current.temperature_2m,
        humedad: res.data.current.relative_humidity_2m
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
      setAlertas(res.data.slice(0, 10))
    } catch (error) {
      console.error('Error cargando alertas:', error)
    }
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
      await axios.post(`${API_URL}/api/lotes`, nuevoLote, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setMostrarModalLote(false)
      setNuevoLote({ nombre: '', cantidad_cerdos: 0, estado: 'engorde', peso_inicial_promedio: 0, notas: '' })
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
  // FUNCIONES DE PESAJES
  // ═══════════════════════════════════════════════════════════════════════

  const crearPesaje = async () => {
    try {
      await axios.post(`${API_URL}/api/pesajes`, nuevoPesaje, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setMostrarModalPesaje(false)
      setNuevoPesaje({ lote: '', peso: 0, cantidad_cerdos_pesados: 1, notas: '' })
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
      await axios.post(`${API_URL}/api/contabilidad`, nuevoRegistro, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setMostrarModalContabilidad(false)
      setNuevoRegistro({ lote: '', tipo: 'gasto', categoria: 'alimento', descripcion: '', cantidad: 1, unidad: 'kg', precio_unitario: 0 })
      cargarContabilidad()
    } catch (error) {
      alert('Error creando registro: ' + (error.response?.data?.mensaje || error.message))
    }
  }

  const eliminarRegistroContable = async (id) => {
    if (!confirm('¿Eliminar este registro?')) return
    try {
      await axios.delete(`${API_URL}/api/contabilidad/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      cargarContabilidad()
    } catch (error) {
      alert('Error eliminando registro: ' + (error.response?.data?.mensaje || error.message))
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FUNCIONES DE BOMBAS
  // ═══════════════════════════════════════════════════════════════════════

  const toggleBomba = async (id) => {
    try {
      await axios.put(`${API_URL}/api/motorbombs/${id}/toggle`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      cargarBombas()
    } catch (error) {
      alert('Error controlando bomba: ' + (error.response?.data?.mensaje || error.message))
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
      setMostrarConfig(false)
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
const cargarHistoricoAgua = async () => {
  try {
    const res = await axios.get(`${API_URL}/api/esp/flujo/historico?dias=7`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    if (res.data && res.data.length > 0) {
      setHistoricoAgua(res.data.map(d => ({
        dia: new Date(d.fecha).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' }),
        litros: d.volumen_total
      })))
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

const cargarDistribucionGastos = async () => {
  try {
    const res = await axios.get(`${API_URL}/api/costos/resumen`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    const colores = ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2', '#b7e4c7', '#d8f3dc']
    
    if (res.data?.costos?.por_categoria && res.data.costos.por_categoria.length > 0) {
      const datos = res.data.costos.por_categoria.map((cat, i) => ({
        nombre: cat._id.replace(/_/g, ' ').charAt(0).toUpperCase() + cat._id.slice(1).replace(/_/g, ' '),
        valor: cat.total,
        color: colores[i % colores.length]
      }))
      setDistribucionGastos(datos)
    } else {
      setDistribucionGastos([])
    }
  } catch (error) {
    console.error('Error cargando distribución gastos:', error)
    setDistribucionGastos([])
  }
}
  // ═══════════════════════════════════════════════════════════════════════
  // FUNCIONES DE REPORTES
  // ═══════════════════════════════════════════════════════════════════════

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
            
            <button type="submit" className="btn-login" disabled={cargando}>
              {cargando ? 'Ingresando...' : 'Ingresar'}
            </button>
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
    <span className="user-info">
      <IconUsuario />
      {user.usuario}
    </span>
    <span className="rol-badge">{user.rol}</span>
    <button className="btn-logout" onClick={handleLogout}>
      <IconLogout />
      Salir
    </button>
  </div>
</header>

      <div className="main-container">
        {/* Sidebar */}
        <aside className={`sidebar ${menuAbierto ? 'abierto' : ''}`}>
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
              className={`nav-item ${pagina === 'contabilidad' ? 'activo' : ''}`}
              onClick={() => { setPagina('contabilidad'); setMenuAbierto(false) }}
            >
              <IconDinero />
              <span>Contabilidad</span>
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
            <button 
  className={`nav-item ${pagina === 'camaras' ? 'activo' : ''}`}
  onClick={() => { setPagina('camaras'); setMenuAbierto(false) }}
>
  <IconCamara />
  <span>Cámaras</span>
</button>

<button 
  className={`nav-item ${pagina === 'ventas' ? 'activo' : ''}`}
  onClick={() => { setPagina('ventas'); setMenuAbierto(false) }}
>
  <IconVenta />
  <span>Ventas</span>
</button>

<button 
  className={`nav-item ${pagina === 'costos' ? 'activo' : ''}`}
  onClick={() => { setPagina('costos'); setMenuAbierto(false) }}
>
  <IconContabilidad />
  <span>Costos</span>
</button>

<button 
  className={`nav-item ${pagina === 'inventario' ? 'activo' : ''}`}
  onClick={() => { setPagina('inventario'); setMenuAbierto(false) }}
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
          
          {/* Resumen contable en sidebar */}
          <div className="sidebar-resumen">
            <h4>Resumen Contable</h4>
            <div className="resumen-item ingresos">
              <span>Ingresos</span>
              <strong>{formatearDinero(resumenContable.total_ingresos)}</strong>
            </div>
            <div className="resumen-item gastos">
              <span>Gastos</span>
              <strong>{formatearDinero(resumenContable.total_gastos)}</strong>
            </div>
            <div className={`resumen-item balance ${resumenContable.ganancia >= 0 ? 'positivo' : 'negativo'}`}>
              <span>Balance</span>
              <strong>{formatearDinero(resumenContable.ganancia)}</strong>
            </div>
          </div>
        </aside>

        {/* Contenido principal */}
        <main className="content">
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

      {/* Porqueriza */}
      <div className={`card ${getEstadoTemp(porqueriza.temp).clase}`}>
        <div className="card-header">
          <Thermometer size={20} />
          <h3>Porqueriza</h3>
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

      {/* Último peso */}
      <div className="card">
        <div className="card-header">
          <Weight size={20} />
          <h3>Último Pesaje</h3>
        </div>
        <div className="card-body">
          <div className="dato-principal">{ultimoPeso ? `${ultimoPeso.peso} kg` : '--'}</div>
          <div className="dato-secundario">
            {ultimoPeso?.lote?.nombre || 'Sin lote'}
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
            <span className="estado-label">Peso Promedio</span>
          </div>
        </div>
        <div className="estado-item">
          <div className="estado-icono">
            {bombas.filter(b => b.estado).length > 0 ? <Power size={32} className="icono-verde" /> : <PowerOff size={32} className="icono-gris" />}
          </div>
          <div className="estado-info">
            <span className="estado-numero">{bombas.filter(b => b.estado).length}/{bombas.length}</span>
            <span className="estado-label">Bombas Activas</span>
          </div>
        </div>
      </div>
    </div>

    {/* GRÁFICAS PRINCIPALES */}
    <div className="graficas-grid">
      {/* Gráfica de Temperatura 24h */}
      <div className="dashboard-section grafica-section">
        <h3><Thermometer size={20} /> Temperatura Porqueriza - Últimas 24h</h3>
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
        <h3><Droplets size={20} /> Consumo de Agua - Última Semana</h3>
        <div className="grafica-container">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={historicoAgua}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} stroke="#666" />
              <YAxis tick={{ fontSize: 11 }} stroke="#666" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px'
                }}
                formatter={(value) => [`${value} L`, 'Consumo']}
              />
              <Bar 
                dataKey="litros" 
                fill="#3b82f6" 
                radius={[4, 4, 0, 0]}
                name="Litros"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>

    {/* Gráficas Financieras */}
    <div className="graficas-grid">
      {/* Ingresos vs Gastos */}
      <div className="dashboard-section grafica-section">
        <h3><BarChart3 size={20} /> Ingresos vs Gastos - Últimos Meses</h3>
        <div className="grafica-container">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={historicoContable}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="#666" />
              <YAxis tick={{ fontSize: 11 }} stroke="#666" tickFormatter={(v) => `$${(v/1000000).toFixed(1)}M`} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px'
                }}
                formatter={(value) => [formatearDinero(value), '']}
              />
              <Legend />
              <Bar dataKey="ingresos" fill="#10b981" radius={[4, 4, 0, 0]} name="Ingresos" />
              <Bar dataKey="gastos" fill="#ef4444" radius={[4, 4, 0, 0]} name="Gastos" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Distribución de Gastos */}
      <div className="dashboard-section grafica-section">
        <h3><PieChartIcon size={20} /> Distribución de Gastos</h3>
        <div className="grafica-container grafica-pie">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={distribucionGastos}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="valor"
                label={({ nombre, percent }) => `${nombre} ${(percent * 100).toFixed(0)}%`}
                labelLine={{ stroke: '#666', strokeWidth: 1 }}
              >
                {distribucionGastos.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => [formatearDinero(value), 'Gasto']}
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pie-legend">
            {distribucionGastos.map((item, i) => (
              <div key={i} className="pie-legend-item">
                <span className="pie-color" style={{ backgroundColor: item.color }}></span>
                <span className="pie-label">{item.nombre}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* Gráfica de Evolución de Peso */}
    <div className="dashboard-section grafica-section grafica-full">
      <h3><TrendingUp size={20} /> Evolución de Peso por Lote</h3>
      <div className="grafica-container">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={historicoPesos}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis dataKey="fecha" tick={{ fontSize: 11 }} stroke="#666" />
            <YAxis tick={{ fontSize: 11 }} stroke="#666" unit=" kg" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e0e0e0',
                borderRadius: '8px'
              }}
              formatter={(value) => [`${value} kg`, '']}
            />
            <Legend />
            {lotes.filter(l => l.activo).slice(0, 5).map((lote, i) => (
              <Line 
                key={lote._id}
                type="monotone" 
                dataKey={lote.nombre}
                stroke={['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2'][i]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>

    {/* Resumen Contable */}
    <div className="dashboard-section resumen-contable-dashboard">
      <h3><Wallet size={20} /> Resumen Contable del Mes</h3>
      <div className="contable-dashboard-grid">
        <div className="contable-card ingresos">
          <TrendingUp size={28} className="contable-icon" />
          <div className="contable-info">
            <span className="contable-valor">{formatearDinero(resumenContable.total_ingresos)}</span>
            <span className="contable-label">Ingresos</span>
          </div>
        </div>
        <div className="contable-card gastos">
          <TrendingDown size={28} className="contable-icon" />
          <div className="contable-info">
            <span className="contable-valor">{formatearDinero(resumenContable.total_gastos)}</span>
            <span className="contable-label">Gastos</span>
          </div>
        </div>
        <div className={`contable-card balance ${resumenContable.ganancia >= 0 ? 'positivo' : 'negativo'}`}>
          {resumenContable.ganancia >= 0 ? <CheckCircle size={28} className="contable-icon" /> : <AlertTriangle size={28} className="contable-icon" />}
          <div className="contable-info">
            <span className="contable-valor">{formatearDinero(resumenContable.ganancia)}</span>
            <span className="contable-label">Balance</span>
          </div>
        </div>
      </div>
    </div>

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
                  <span className={`estado-lote ${lote.estado}`}>{lote.estado}</span>
                </div>
                <div className="lote-info">
                  <span><PiggyBank size={14} /> {lote.cantidad_cerdos} cerdos</span>
                  <span><Weight size={14} /> {lote.peso_promedio_actual || 0} kg prom.</span>
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
                    <span>{lote.peso_inicial_promedio || 0} kg</span>
                    <span>{lote.peso_promedio_actual || 0} kg</span>
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
)}
    {/* ════════════════════════════════════════════════════════════════ */}
          {/* PÁGINA: LOTES */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {pagina === 'lotes' && (
            <div className="page-lotes">
              <div className="page-header">
                <h2>Gestión de Lotes</h2>
                <button className="btn-primary" onClick={() => setMostrarModalLote(true)}>
                  <IconMas />
                  Nuevo Lote
                </button>
              </div>

              <div className="lotes-grid">
                {lotes.length === 0 ? (
                  <p className="sin-datos">No hay lotes registrados</p>
                ) : (
                  lotes.map(lote => (
                    <div key={lote._id} className={`lote-card ${!lote.activo ? 'inactivo' : ''}`}>
                      <div className="lote-header">
                        <h3>{lote.nombre}</h3>
                        <span className={`estado-lote ${lote.estado}`}>{lote.estado}</span>
                      </div>
                      <div className="lote-body">
                        <div className="lote-dato">
                          <span>Cantidad</span>
                          <strong>{lote.cantidad_cerdos} cerdos</strong>
                        </div>
                        <div className="lote-dato">
                          <span>Peso Promedio</span>
                          <strong>{lote.peso_promedio_actual || 0} kg</strong>
                        </div>
                        <div className="lote-dato">
                          <span>Peso Inicial</span>
                          <strong>{lote.peso_inicial_promedio || 0} kg</strong>
                        </div>
                        <div className="lote-dato">
                          <span>Ganancia</span>
                          <strong>{((lote.peso_promedio_actual || 0) - (lote.peso_inicial_promedio || 0)).toFixed(1)} kg</strong>
                        </div>
                        <div className="lote-dato">
                          <span>Fecha Inicio</span>
                          <strong>{new Date(lote.fecha_inicio).toLocaleDateString()}</strong>
                        </div>
                        <div className="lote-dato">
                          <span>Estado</span>
                          <strong>{lote.activo ? 'Activo' : 'Finalizado'}</strong>
                        </div>
                        {lote.notas && (
                          <div className="lote-notas">
                            <span>Notas:</span>
                            <p>{lote.notas}</p>
                          </div>
                        )}
                      </div>
                      <div className="lote-actions">
                        {lote.activo && (
                          <>
                            <button className="btn-icon" onClick={() => {
                              setLoteSeleccionado(lote)
                              setNuevoLote({
                                nombre: lote.nombre,
                                cantidad_cerdos: lote.cantidad_cerdos,
                                estado: lote.estado,
                                peso_inicial_promedio: lote.peso_inicial_promedio,
                                notas: lote.notas || ''
                              })
                              setMostrarModalLote(true)
                            }}>
                              <IconEditar />
                            </button>
                            <button className="btn-icon btn-warning" onClick={() => finalizarLote(lote._id)}>
                              Finalizar
                            </button>
                          </>
                        )}
                        <button className="btn-icon btn-danger" onClick={() => eliminarLote(lote._id)}>
                          <IconEliminar />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Modal Lote */}
              {mostrarModalLote && (
                <div className="modal-overlay" onClick={() => { setMostrarModalLote(false); setLoteSeleccionado(null) }}>
                  <div className="modal" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                      <h3>{loteSeleccionado ? 'Editar Lote' : 'Nuevo Lote'}</h3>
                      <button className="btn-cerrar" onClick={() => { setMostrarModalLote(false); setLoteSeleccionado(null) }}>&times;</button>
                    </div>
                    <div className="modal-body">
                      <div className="form-group">
                        <label>Nombre del Lote</label>
                        <input
                          type="text"
                          value={nuevoLote.nombre}
                          onChange={e => setNuevoLote({ ...nuevoLote, nombre: e.target.value })}
                          placeholder="Ej: Lote A - Enero 2026"
                        />
                      </div>
                      <div className="form-group">
                        <label>Cantidad de Cerdos</label>
                        <input
                          type="number"
                          value={nuevoLote.cantidad_cerdos}
                          onChange={e => setNuevoLote({ ...nuevoLote, cantidad_cerdos: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Estado</label>
                        <select
                          value={nuevoLote.estado}
                          onChange={e => setNuevoLote({ ...nuevoLote, estado: e.target.value })}
                        >
                          <option value="engorde">Engorde</option>
                          <option value="destete">Destete</option>
                          <option value="gestacion">Gestación</option>
                          <option value="lactancia">Lactancia</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Peso Inicial Promedio (kg)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={nuevoLote.peso_inicial_promedio}
                          onChange={e => setNuevoLote({ ...nuevoLote, peso_inicial_promedio: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Notas</label>
                        <textarea
                          value={nuevoLote.notas}
                          onChange={e => setNuevoLote({ ...nuevoLote, notas: e.target.value })}
                          placeholder="Observaciones del lote..."
                          rows={3}
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
                          onChange={e => setPesajeLive({...pesajeLive, cantidad: parseInt(e.target.value) || 1})}
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
    ⚠️ GUARDAR FORZADO
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
                  <span>Promedio General</span>
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
                      <th>Peso Promedio</th>
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
                            <option key={lote._id} value={lote._id}>{lote.nombre}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Peso Total (kg)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={nuevoPesaje.peso}
                          onChange={e => setNuevoPesaje({ ...nuevoPesaje, peso: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Cantidad de Cerdos Pesados</label>
                        <input
                          type="number"
                          value={nuevoPesaje.cantidad_cerdos_pesados}
                          onChange={e => setNuevoPesaje({ ...nuevoPesaje, cantidad_cerdos_pesados: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                      <div className="form-group">
                        <label>Peso Promedio (calculado)</label>
                        <input
                          type="text"
                          value={nuevoPesaje.cantidad_cerdos_pesados > 0 ? (nuevoPesaje.peso / nuevoPesaje.cantidad_cerdos_pesados).toFixed(2) + ' kg' : '0 kg'}
                          disabled
                        />
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
                      <button className="btn-secondary" onClick={() => setMostrarModalPesaje(false)}>Cancelar</button>
                      <button className="btn-primary" onClick={crearPesaje}>Registrar Pesaje</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* ════════════════════════════════════════════════════════════════ */}
          {/* PÁGINA: CONTABILIDAD */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {pagina === 'contabilidad' && (
            <div className="page-contabilidad">
              <div className="page-header">
                <h2>Contabilidad</h2>
                <button className="btn-primary" onClick={() => setMostrarModalContabilidad(true)}>
                  <IconMas />
                  Nuevo Registro
                </button>
              </div>

              {/* Resumen contable */}
              <div className="contabilidad-resumen">
                <div className="resumen-card ingresos">
                  <h4>Total Ingresos</h4>
                  <strong>{formatearDinero(resumenContable.total_ingresos)}</strong>
                </div>
                <div className="resumen-card gastos">
                  <h4>Total Gastos</h4>
                  <strong>{formatearDinero(resumenContable.total_gastos)}</strong>
                </div>
                <div className={`resumen-card balance ${resumenContable.ganancia >= 0 ? 'positivo' : 'negativo'}`}>
                  <h4>Balance</h4>
                  <strong>{formatearDinero(resumenContable.ganancia)}</strong>
                </div>
              </div>

              {/* Tabla de registros */}
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Categoría</th>
                      <th>Descripción</th>
                      <th>Cantidad</th>
                      <th>Precio Unit.</th>
                      <th>Total</th>
                      <th>Lote</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contabilidad.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="sin-datos">No hay registros contables</td>
                      </tr>
                    ) : (
                      contabilidad.map(reg => (
                        <tr key={reg._id} className={reg.tipo}>
                          <td>{new Date(reg.fecha).toLocaleDateString()}</td>
                          <td>
                            <span className={`tipo-badge ${reg.tipo}`}>
                              {reg.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}
                            </span>
                          </td>
                          <td>{reg.categoria}</td>
                          <td>{reg.descripcion || '-'}</td>
                          <td>{reg.cantidad} {reg.unidad}</td>
                          <td>{formatearDinero(reg.precio_unitario)}</td>
                          <td><strong>{formatearDinero(reg.total)}</strong></td>
                          <td>{reg.lote?.nombre || '-'}</td>
                          <td>
                            <button className="btn-icon btn-danger" onClick={() => eliminarRegistroContable(reg._id)}>
                              <IconEliminar />
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
                          <select
                            value={nuevoRegistro.tipo}
                            onChange={e => setNuevoRegistro({ ...nuevoRegistro, tipo: e.target.value })}
                          >
                            <option value="gasto">Gasto</option>
                            <option value="ingreso">Ingreso</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Categoría</label>
                          <select
                            value={nuevoRegistro.categoria}
                            onChange={e => setNuevoRegistro({ ...nuevoRegistro, categoria: e.target.value })}
                          >
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
                        <select
                          value={nuevoRegistro.lote}
                          onChange={e => setNuevoRegistro({ ...nuevoRegistro, lote: e.target.value })}
                        >
                          <option value="">Sin lote específico</option>
                          {lotes.map(lote => (
                            <option key={lote._id} value={lote._id}>{lote.nombre}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Descripción</label>
                        <input
                          type="text"
                          value={nuevoRegistro.descripcion}
                          onChange={e => setNuevoRegistro({ ...nuevoRegistro, descripcion: e.target.value })}
                          placeholder="Descripción del registro..."
                        />
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Cantidad</label>
                          <input
                            type="number"
                            step="0.1"
                            value={nuevoRegistro.cantidad}
                            onChange={e => setNuevoRegistro({ ...nuevoRegistro, cantidad: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Unidad</label>
                          <select
                            value={nuevoRegistro.unidad}
                            onChange={e => setNuevoRegistro({ ...nuevoRegistro, unidad: e.target.value })}
                          >
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
                          <input
                            type="number"
                            value={nuevoRegistro.precio_unitario}
                            onChange={e => setNuevoRegistro({ ...nuevoRegistro, precio_unitario: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Total (calculado)</label>
                        <input
                          type="text"
                          value={formatearDinero(nuevoRegistro.cantidad * nuevoRegistro.precio_unitario)}
                          disabled
                        />
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
{/* ════════════════════════════════════════════════════════════════ */}
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

    <div className="bombas-grid">
      {bombas.length === 0 ? (
        <p className="sin-datos">No hay bombas configuradas. Crea una nueva bomba para comenzar.</p>
      ) : (
        bombas.map(bomba => (
          <div key={bomba._id} className={`bomba-card ${bomba.estado ? 'encendida' : 'apagada'}`}>
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
            
           {/* ✅ CORRECCIÓN: Cambiar la lógica invertida */}
           <div className={`bomba-estado ${bomba.estado ? 'on' : 'off'}`}>
             {bomba.estado ? '🟢 ENCENDIDA' : '🔴 APAGADA'}
           </div>
            
            <div className="bomba-actions">
              {/* ✅ CORRECCIÓN: Cambiar la lógica del botón */}
              <button
                className={`btn-bomba ${bomba.estado ? 'btn-apagar' : 'btn-encender'}`}
                onClick={() => toggleBomba(bomba._id)}
                disabled={false}
              >
                {bomba.estado ? 'Apagar' : 'Encender'}
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
                placeholder="Ej: Galpón Norte, Área de Engorde"
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
          {pagina === 'alertas' && (
            <div className="page-alertas">
              <div className="page-header">
                <h2>Historial de Alertas</h2>
                <button className="btn-refresh" onClick={cargarAlertas}>
                  <IconRefresh />
                </button>
              </div>

              <div className="alertas-container">
                {alertas.length === 0 ? (
                  <p className="sin-datos">No hay alertas registradas</p>
                ) : (
                  alertas.map((alerta, i) => (
                    <div key={i} className={`alerta-card ${alerta.tipo}`}>
                      <div className="alerta-icon">
                        <IconAlerta />
                      </div>
                      <div className="alerta-content">
                        <span className={`alerta-tipo ${alerta.tipo}`}>{alerta.tipo.toUpperCase()}</span>
                        <p>{alerta.mensaje}</p>
                        <small>{formatearFecha(alerta.createdAt)}</small>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════ */}
          {/* PÁGINA: REPORTES */}
          {/* ════════════════════════════════════════════════════════════════ */}
          {pagina === 'reportes' && (
            <div className="page-reportes">
              <div className="page-header">
                <h2>Reportes</h2>
              </div>

              <div className="reportes-grid">
                <div className="reporte-card">
                  <div className="reporte-icon">
                    <IconReporte />
                  </div>
                  <h3>Reporte Completo</h3>
                  <p>Incluye resumen ejecutivo, lotes, pesajes, contabilidad y alertas</p>
                  <button className="btn-primary" onClick={descargarReporte}>
                    Descargar Excel
                  </button>
                </div>

                <div className="reporte-card">
                  <div className="reporte-icon">
                    <IconLote />
                  </div>
                  <h3>Resumen por Lote</h3>
                  <p>Selecciona un lote para ver su información detallada</p>
                  <select 
                    className="select-lote"
                    onChange={e => {
                      if (e.target.value) {
                        setLoteSeleccionado(lotes.find(l => l._id === e.target.value))
                      }
                    }}
                  >
                    <option value="">Seleccionar lote...</option>
                    {lotes.map(lote => (
                      <option key={lote._id} value={lote._id}>{lote.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="reporte-card">
                  <div className="reporte-icon">
                    <IconDinero />
                  </div>
                  <h3>Balance Contable</h3>
                  <div className="balance-preview">
                    <div className="balance-item">
                      <span>Ingresos:</span>
                      <strong className="positivo">{formatearDinero(resumenContable.total_ingresos)}</strong>
                    </div>
                    <div className="balance-item">
                      <span>Gastos:</span>
                      <strong className="negativo">{formatearDinero(resumenContable.total_gastos)}</strong>
                    </div>
                    <div className="balance-item total">
                      <span>Balance:</span>
                      <strong className={resumenContable.ganancia >= 0 ? 'positivo' : 'negativo'}>
                        {formatearDinero(resumenContable.ganancia)}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detalle del lote seleccionado */}
              {loteSeleccionado && (
                <div className="lote-detalle">
                  <h3>Detalle: {loteSeleccionado.nombre}</h3>
                  <div className="detalle-grid">
                    <div className="detalle-item">
                      <span>Cantidad Cerdos</span>
                      <strong>{loteSeleccionado.cantidad_cerdos}</strong>
                    </div>
                    <div className="detalle-item">
                      <span>Peso Promedio Actual</span>
                      <strong>{loteSeleccionado.peso_promedio_actual || 0} kg</strong>
                    </div>
                    <div className="detalle-item">
                      <span>Peso Total Estimado</span>
                      <strong>{((loteSeleccionado.peso_promedio_actual || 0) * loteSeleccionado.cantidad_cerdos).toFixed(0)} kg</strong>
                    </div>
                    <div className="detalle-item">
                      <span>Valor Estimado Venta</span>
                      <strong>{formatearDinero((loteSeleccionado.peso_promedio_actual || 0) * loteSeleccionado.cantidad_cerdos * config.precio_venta_kg)}</strong>
                    </div>
                  </div>
                </div>
              )}
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
{pagina === 'camaras' && (
  <div className="page-camaras">
    <PanelCamaras 
      camaras={camaras}
      grabaciones={grabaciones}
      onCapturar={capturarFotoCamara}
      onVerStream={verStreamCamara}
    />
  </div>
)}

{/* ════════════════════════════════════════════════════════════════ */}
{/* PÁGINA: VENTAS */}
{/* ════════════════════════════════════════════════════════════════ */}
{pagina === 'ventas' && (
  <div className="page-ventas">
    <PanelVentas 
      ventas={ventas}
      estadisticas={estadisticasVentas}
      onNuevaVenta={crearVenta}
      onRegistrarPago={registrarPagoVenta}
    />
  </div>
)}

{/* ════════════════════════════════════════════════════════════════ */}
{/* PÁGINA: COSTOS */}
{/* ════════════════════════════════════════════════════════════════ */}
{pagina === 'costos' && (
  <div className="page-costos">
    <PanelContabilidad 
      resumen={resumenCostos}
      comparativo={comparativoCostos}
      onNuevoCosto={crearCosto}
    />
  </div>
)}

{/* ════════════════════════════════════════════════════════════════ */}
{/* PÁGINA: INVENTARIO */}
{/* ════════════════════════════════════════════════════════════════ */}
{pagina === 'inventario' && (
  <div className="page-inventario">
    <PanelInventario 
      inventario={inventario}
      estadisticas={estadisticasInventario}
      onNuevoCerdo={crearCerdo}
    />
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
                        onChange={e => setConfig({ ...config, precio_agua_litro: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Precio Alimento (por kg)</label>
                      <input
                        type="number"
                        value={config.precio_alimento_kg}
                        onChange={e => setConfig({ ...config, precio_alimento_kg: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Precio Venta Cerdo (por kg en pie)</label>
                      <input
                        type="number"
                        value={config.precio_venta_kg}
                        onChange={e => setConfig({ ...config, precio_venta_kg: parseFloat(e.target.value) || 0 })}
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
                        onChange={e => setConfig({ ...config, umbral_temp_max: parseFloat(e.target.value) || 37 })}
                      />
                      <small>Se genera alerta cuando supera este valor</small>
                    </div>
                    <div className="form-group">
                      <label>Temperatura Crítica (°C)</label>
                      <input
                        type="number"
                        value={config.umbral_temp_critico}
                        onChange={e => setConfig({ ...config, umbral_temp_critico: parseFloat(e.target.value) || 40 })}
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