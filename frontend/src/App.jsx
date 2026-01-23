/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - FRONTEND PROFESIONAL v5.0
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Estilo: Profesional Coop-Alianzas (Amarillo + Blanco)
 * Sin emojis - Iconos SVG profesionales
 * Tipografía elegante
 * 
 * ═══════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react'
import axios from 'axios'
import { io } from 'socket.io-client'
import './App.css'

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════

const API_URL = import.meta.env.VITE_API_URL || 'https://cop-alianza-backend.onrender.com'
let socket = null

// ═══════════════════════════════════════════════════════════════════════
// ICONOS SVG PROFESIONALES
// ═══════════════════════════════════════════════════════════════════════

const Icons = {
  thermometer: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
    </svg>
  ),
  droplet: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
    </svg>
  ),
  sun: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  ),
  tank: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>
    </svg>
  ),
  pump: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/><path d="M18.36 5.64l-4.24 4.24m-4.24 4.24L5.64 18.36m12.72 0l-4.24-4.24m-4.24-4.24L5.64 5.64"/>
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  activity: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  ),
  pause: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
    </svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  ),
  flow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2v6m0 4v6m0 4v0M5 12h14"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// DATOS CONTABLES
// ═══════════════════════════════════════════════════════════════════════

const DATOS_CONTABLES = {
  inversion_hardware: 497367,
  costo_operativo_mensual: 0,
  ahorro_mensual_estimado: 150000,
  roi_esperado_meses: 4,
  presupuesto_total: 500000,
  ejecutado: 497367,
  comparativo: {
    temperatura_ideal: { min: 22, max: 28 },
    humedad_ideal: { min: 60, max: 70 },
  },
  eficiencia: {
    mortalidad_antes: 8,
    mortalidad_despues: 2,
  }
}

// ═══════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════

function App() {
  // Estados
  const [usuario, setUsuario] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [rol, setRol] = useState(localStorage.getItem('rol'))
  
  const [loginUsuario, setLoginUsuario] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [cargando, setCargando] = useState(false)
  
  const [datosAmbiente, setDatosAmbiente] = useState({
    temp_exterior: null,
    humedad_exterior: null,
    temp_porqueriza: null,
    humedad_porqueriza: null
  })
  
  const [datosFlujo, setDatosFlujo] = useState({
    caudal: 0,
    volumen_diario: 0,
    volumen_total: 0
  })
  
  const [tanques, setTanques] = useState({ tanque1: 75, tanque2: 60 })
  const [bombas, setBombas] = useState([])
  const [alertas, setAlertas] = useState([])
  
  const [farms, setFarms] = useState([])
  const [users, setUsers] = useState([])
  const [sessions, setSessions] = useState([])
  
  const [conexiones, setConexiones] = useState({
    backend: false,
    clima: false,
    sensor_temp: false,
    sensor_flujo: false
  })
  
  const [mostrarPanel, setMostrarPanel] = useState(true)
  const [modalUsuario, setModalUsuario] = useState(false)
  const [modalGranja, setModalGranja] = useState(false)
  const [nuevoUsuario, setNuevoUsuario] = useState({ usuario: '', correo: '', password: '', rol: 'cliente' })
  const [nuevaGranja, setNuevaGranja] = useState({ nombre: '', ubicacion: '', contacto: '' })

  // ═══════════════════════════════════════════════════════════════════════
  // EFECTOS
  // ═══════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (token) verificarSesion()
  }, [])

  useEffect(() => {
    if (usuario) {
      socket = io(API_URL)
      
      socket.on('connect', () => setConexiones(prev => ({ ...prev, backend: true })))
      socket.on('disconnect', () => setConexiones(prev => ({ ...prev, backend: false })))
      
      socket.on('lectura_actualizada', (data) => {
        if (data.temperatura !== undefined) {
          setDatosAmbiente(prev => ({
            ...prev,
            temp_porqueriza: data.temperatura,
            humedad_porqueriza: data.humedad
          }))
          setConexiones(prev => ({ ...prev, sensor_temp: true }))
        }
        if (data.caudal_l_min !== undefined) {
          setDatosFlujo(prev => ({
            ...prev,
            caudal: data.caudal_l_min,
            volumen_total: data.volumen_l
          }))
          setConexiones(prev => ({ ...prev, sensor_flujo: true }))
        }
      })
      
      cargarTodosDatos()
      cargarClimaLorica()
      
      const interval = setInterval(() => {
        cargarTodosDatos()
        cargarClimaLorica()
      }, 30000)
      
      return () => {
        clearInterval(interval)
        if (socket) socket.disconnect()
      }
    }
  }, [usuario])

  // ═══════════════════════════════════════════════════════════════════════
  // AUTENTICACIÓN
  // ═══════════════════════════════════════════════════════════════════════

  const verificarSesion = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUsuario(res.data.usuario || res.data.nombre)
      setRol(res.data.rol)
      setConexiones(prev => ({ ...prev, backend: true }))
    } catch {
      cerrarSesion()
    }
  }

  const iniciarSesion = async (e) => {
    e.preventDefault()
    setLoginError('')
    setCargando(true)
    
    try {
      const res = await axios.post(`${API_URL}/api/users/login`, {
        usuario: loginUsuario,
        password: loginPassword
      })
      
      const { token: nuevoToken, usuario: nombre, rol: rolUser, session_id } = res.data
      
      localStorage.setItem('token', nuevoToken)
      localStorage.setItem('rol', rolUser)
      localStorage.setItem('session_id', session_id)
      
      setToken(nuevoToken)
      setRol(rolUser)
      setUsuario(nombre)
    } catch (error) {
      setLoginError(error.response?.data?.mensaje || 'Error de conexión')
    } finally {
      setCargando(false)
    }
  }

  const cerrarSesion = async () => {
    try {
      const sessionId = localStorage.getItem('session_id')
      if (sessionId && token) {
        await axios.put(`${API_URL}/api/sessions/${sessionId}/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        })
      }
    } catch {}
    
    localStorage.clear()
    setToken(null)
    setRol(null)
    setUsuario(null)
    if (socket) socket.disconnect()
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CARGA DE DATOS
  // ═══════════════════════════════════════════════════════════════════════

  const cargarTodosDatos = async () => {
    await Promise.all([
      cargarDatosSensores(),
      cargarBombas(),
      cargarAlertas()
    ])
    
    if (rol === 'superadmin') {
      await Promise.all([
        cargarGranjas(),
        cargarUsuarios(),
        cargarSesiones()
      ])
    }
  }

  const cargarClimaLorica = async () => {
    try {
      const res = await axios.get(
        'https://api.open-meteo.com/v1/forecast?latitude=9.2367&longitude=-75.8167&current=temperature_2m,relative_humidity_2m&timezone=America/Bogota'
      )
      setDatosAmbiente(prev => ({
        ...prev,
        temp_exterior: res.data.current.temperature_2m,
        humedad_exterior: res.data.current.relative_humidity_2m
      }))
      setConexiones(prev => ({ ...prev, clima: true }))
    } catch {
      setConexiones(prev => ({ ...prev, clima: false }))
    }
  }

  const cargarDatosSensores = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/esp/porqueriza`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data?.temperatura !== null) {
        setDatosAmbiente(prev => ({
          ...prev,
          temp_porqueriza: res.data.temperatura,
          humedad_porqueriza: res.data.humedad
        }))
        setConexiones(prev => ({ ...prev, sensor_temp: res.data.conectado }))
      }
    } catch {}
    
    try {
      const res = await axios.get(`${API_URL}/api/esp/flujo`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data) {
        setDatosFlujo({
          caudal: res.data.caudal || 0,
          volumen_diario: res.data.volumen_diario || 0,
          volumen_total: res.data.volumen_total || 0
        })
        setConexiones(prev => ({ ...prev, sensor_flujo: res.data.conectado }))
      }
    } catch {}
  }

  const cargarBombas = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/motorbombs`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setBombas(res.data)
    } catch {}
  }

  const cargarAlertas = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/alerts`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setAlertas(res.data.slice(0, 5))
    } catch {}
  }

  const cargarGranjas = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/farms`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setFarms(res.data)
    } catch {}
  }

  const cargarUsuarios = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUsers(res.data)
    } catch {}
  }

  const cargarSesiones = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/sessions`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setSessions(res.data.slice(0, 10))
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ACCIONES
  // ═══════════════════════════════════════════════════════════════════════

  const toggleBomba = async (id) => {
    try {
      await axios.put(`${API_URL}/api/motorbombs/${id}/toggle`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      cargarBombas()
    } catch {
      alert('Error al cambiar estado de bomba')
    }
  }

  const crearUsuario = async (e) => {
    e.preventDefault()
    try {
      await axios.post(`${API_URL}/api/users/register`, nuevoUsuario, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setModalUsuario(false)
      setNuevoUsuario({ usuario: '', correo: '', password: '', rol: 'cliente' })
      cargarUsuarios()
    } catch (error) {
      alert(error.response?.data?.mensaje || 'Error al crear usuario')
    }
  }

  const toggleUsuario = async (id) => {
    try {
      await axios.put(`${API_URL}/api/users/${id}/toggle`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      cargarUsuarios()
    } catch {}
  }

  const eliminarUsuario = async (id) => {
    if (!confirm('¿Eliminar este usuario?')) return
    try {
      await axios.delete(`${API_URL}/api/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      cargarUsuarios()
    } catch {}
  }

  const crearGranja = async (e) => {
    e.preventDefault()
    try {
      await axios.post(`${API_URL}/api/farms`, nuevaGranja, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setModalGranja(false)
      setNuevaGranja({ nombre: '', ubicacion: '', contacto: '' })
      cargarGranjas()
    } catch (error) {
      alert(error.response?.data?.mensaje || 'Error al crear granja')
    }
  }

  const toggleGranja = async (id) => {
    try {
      await axios.put(`${API_URL}/api/farms/${id}/toggle`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      cargarGranjas()
    } catch {}
  }

  const eliminarGranja = async (id) => {
    if (!confirm('¿Eliminar esta granja?')) return
    try {
      await axios.delete(`${API_URL}/api/farms/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      cargarGranjas()
    } catch {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UTILIDADES
  // ═══════════════════════════════════════════════════════════════════════

  const getEstadoTemp = (temp) => {
    if (temp === null) return { clase: '', texto: 'Sin datos' }
    if (temp >= 40) return { clase: 'critico', texto: 'CRÍTICO' }
    if (temp >= 35) return { clase: 'alerta', texto: 'Alerta' }
    return { clase: 'normal', texto: 'Normal' }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PANEL CONTABLE
  // ═══════════════════════════════════════════════════════════════════════

  const PanelContable = () => {
    const { comparativo, eficiencia } = DATOS_CONTABLES
    const tempActual = datosAmbiente.temp_porqueriza
    const desvTemp = tempActual !== null ? tempActual - comparativo.temperatura_ideal.max : null

    return (
      <aside className={`panel-contable ${mostrarPanel ? 'visible' : 'oculto'}`}>
        <div className="panel-header">
          <h3>Panel Contable</h3>
          <button onClick={() => setMostrarPanel(!mostrarPanel)} className="btn-toggle">
            {mostrarPanel ? '‹' : '›'}
          </button>
        </div>
        
        {mostrarPanel && (
          <div className="panel-content">
            <div className="metrica-card">
              <span className="metrica-label">Inversión Total</span>
              <span className="metrica-valor">${DATOS_CONTABLES.inversion_hardware.toLocaleString()}</span>
              <span className="metrica-sub">Costo operativo: $0/mes</span>
              <div className="barra-progreso">
                <div className="progreso" style={{ width: `${(DATOS_CONTABLES.ejecutado / DATOS_CONTABLES.presupuesto_total) * 100}%` }}></div>
              </div>
            </div>

            <div className="metrica-card">
              <span className="metrica-label">Temperatura</span>
              <div className="comparativo-grid">
                <div className="comp-item">
                  <span>Ideal</span>
                  <strong>{comparativo.temperatura_ideal.min}-{comparativo.temperatura_ideal.max}°C</strong>
                </div>
                <div className={`comp-item ${desvTemp > 0 ? 'alerta' : ''}`}>
                  <span>Actual</span>
                  <strong>{tempActual !== null ? `${tempActual}°C` : '--'}</strong>
                </div>
              </div>
              {desvTemp !== null && desvTemp > 0 && (
                <span className="desviacion negativa">+{desvTemp.toFixed(1)}°C sobre lo ideal</span>
              )}
            </div>

            <div className="metrica-card">
              <span className="metrica-label">Eficiencia Esperada</span>
              <div className="eficiencia-row">
                <span>Mortalidad antes:</span>
                <span className="valor-negativo">{eficiencia.mortalidad_antes}%</span>
              </div>
              <div className="eficiencia-row">
                <span>Mortalidad esperada:</span>
                <span className="valor-positivo">{eficiencia.mortalidad_despues}%</span>
              </div>
            </div>

            <div className="metrica-card destacado">
              <span className="metrica-label">ROI Proyectado</span>
              <span className="metrica-valor">{DATOS_CONTABLES.roi_esperado_meses} meses</span>
              <span className="metrica-sub">Ahorro: ${DATOS_CONTABLES.ahorro_mensual_estimado.toLocaleString()}/mes</span>
            </div>
          </div>
        )}
      </aside>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: LOGIN
  // ═══════════════════════════════════════════════════════════════════════

  if (!usuario) {
    return (
      <div className="login-container">
        <div className="login-box">
          <div className="login-header">
            <img src="/logo-coop-alianzas.png" alt="Coop-Alianzas" className="login-logo" onError={(e) => e.target.style.display = 'none'} />
            <h1>Coop-Alianzas</h1>
            <p>Sistema de Monitoreo IoT</p>
            <span className="login-subtitle">Porqueriza Tecnificada</span>
          </div>
          
          {loginError && <div className="error-message">{loginError}</div>}
          
          <form onSubmit={iniciarSesion} className="login-form">
            <div className="input-group">
              <label>Usuario</label>
              <input
                type="text"
                value={loginUsuario}
                onChange={(e) => setLoginUsuario(e.target.value)}
                placeholder="Ingresa tu usuario"
                required
              />
            </div>
            
            <div className="input-group">
              <label>Contraseña</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Ingresa tu contraseña"
                required
              />
            </div>
            
            <button type="submit" className="btn-primary" disabled={cargando}>
              {cargando ? 'Ingresando...' : 'Iniciar Sesión'}
            </button>
          </form>
          
          <div className="login-footer">
            <p>INGENIEROS OMP © 2026</p>
            <span>Lorica, Córdoba - Colombia</span>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: DASHBOARD CLIENTE
  // ═══════════════════════════════════════════════════════════════════════

  if (rol === 'cliente') {
    const estadoTemp = getEstadoTemp(datosAmbiente.temp_porqueriza)

    return (
      <div className="app">
        <PanelContable />
        
        <div className="main-content">
          <header className="header">
            <div className="header-left">
              <img src="/logo-coop-alianzas.png" alt="" className="header-logo" onError={(e) => e.target.style.display = 'none'} />
              <div className="header-title">
                <h1>Coop-Alianzas</h1>
                <span>Sistema de Monitoreo</span>
              </div>
            </div>
            <div className="header-right">
              <div className="conexiones-status">
                <span className={conexiones.backend ? 'activo' : 'inactivo'}>Backend</span>
                <span className={conexiones.clima ? 'activo' : 'inactivo'}>Clima</span>
                <span className={conexiones.sensor_temp ? 'activo' : 'inactivo'}>Temp</span>
                <span className={conexiones.sensor_flujo ? 'activo' : 'inactivo'}>Flujo</span>
              </div>
              <div className="user-info">
                <span className="icon">{Icons.user}</span>
                <span>{usuario}</span>
              </div>
              <button onClick={cerrarSesion} className="btn-logout">
                <span className="icon">{Icons.logout}</span>
                Salir
              </button>
            </div>
          </header>

          {estadoTemp.clase && estadoTemp.clase !== 'normal' && (
            <div className={`alerta-banner ${estadoTemp.clase}`}>
              <span className="icon">{Icons.alert}</span>
              {estadoTemp.texto}: Temperatura Porqueriza Tecnificada {datosAmbiente.temp_porqueriza}°C
            </div>
          )}

          <main className="dashboard">
            <div className="cards-grid">
              {/* Clima Exterior */}
              <div className="card">
                <div className="card-header">
                  <span className="icon">{Icons.sun}</span>
                  <h3>Clima Exterior - Lorica</h3>
                </div>
                <div className="clima-datos">
                  <div className="clima-item">
                    <span className="valor">{datosAmbiente.temp_exterior !== null ? `${datosAmbiente.temp_exterior}°C` : '--'}</span>
                    <span className="label">Temperatura</span>
                  </div>
                  <div className="clima-item">
                    <span className="valor">{datosAmbiente.humedad_exterior !== null ? `${datosAmbiente.humedad_exterior}%` : '--'}</span>
                    <span className="label">Humedad</span>
                  </div>
                </div>
              </div>

              {/* Temperatura Porqueriza */}
              <div className={`card sensor-card ${estadoTemp.clase}`}>
                <div className="card-header">
                  <span className="icon">{Icons.thermometer}</span>
                  <h3>Temperatura Porqueriza Tecnificada</h3>
                </div>
                <div className="sensor-display">
                  <span className="valor-principal">{datosAmbiente.temp_porqueriza !== null ? datosAmbiente.temp_porqueriza : '--'}</span>
                  <span className="unidad">°C</span>
                </div>
                <div className="sensor-secundario">
                  <span className="icon">{Icons.droplet}</span>
                  Humedad: {datosAmbiente.humedad_porqueriza !== null ? `${datosAmbiente.humedad_porqueriza}%` : '--'}
                </div>
                <div className={`estado-badge ${estadoTemp.clase}`}>{estadoTemp.texto}</div>
              </div>

              {/* Flujo de Agua */}
              <div className="card">
                <div className="card-header">
                  <span className="icon">{Icons.flow}</span>
                  <h3>Flujo de Agua</h3>
                </div>
                <div className="flujo-datos">
                  <div className="flujo-item">
                    <span className="valor">{datosFlujo.caudal.toFixed(2)}</span>
                    <span className="label">L/min (actual)</span>
                  </div>
                  <div className="flujo-item">
                    <span className="valor">{datosFlujo.volumen_total.toFixed(1)}</span>
                    <span className="label">Litros totales</span>
                  </div>
                </div>
              </div>

              {/* Tanques */}
              <div className="card">
                <div className="card-header">
                  <span className="icon">{Icons.tank}</span>
                  <h3>Nivel de Tanques</h3>
                </div>
                <div className="tanques-grid">
                  <div className="tanque">
                    <div className="tanque-visual">
                      <div className="tanque-nivel" style={{ height: `${tanques.tanque1}%` }}></div>
                    </div>
                    <span className="tanque-nombre">Tanque 1</span>
                    <span className="tanque-valor">{tanques.tanque1}%</span>
                  </div>
                  <div className="tanque">
                    <div className="tanque-visual">
                      <div className="tanque-nivel" style={{ height: `${tanques.tanque2}%` }}></div>
                    </div>
                    <span className="tanque-nombre">Tanque 2</span>
                    <span className="tanque-valor">{tanques.tanque2}%</span>
                  </div>
                </div>
              </div>

              {/* Bombas */}
              <div className="card">
                <div className="card-header">
                  <span className="icon">{Icons.pump}</span>
                  <h3>Control de Bombas</h3>
                </div>
                <div className="bombas-lista">
                  {bombas.length > 0 ? bombas.map(bomba => (
                    <div key={bomba._id} className={`bomba-item ${bomba.estado ? 'encendida' : ''} ${!bomba.conectada ? 'desconectada' : ''}`}>
                      <div className="bomba-info">
                        <span className="bomba-nombre">{bomba.nombre}</span>
                        <span className="bomba-estado">
                          {!bomba.conectada ? 'Desconectada' : bomba.estado ? 'Encendida' : 'Apagada'}
                        </span>
                      </div>
                      <button onClick={() => toggleBomba(bomba._id)} className={`btn-bomba ${bomba.estado ? 'apagar' : 'encender'}`} disabled={!bomba.conectada}>
                        {bomba.estado ? 'Apagar' : 'Encender'}
                      </button>
                    </div>
                  )) : <p className="sin-datos">No hay bombas configuradas</p>}
                </div>
              </div>

              {/* Alertas */}
              <div className="card">
                <div className="card-header">
                  <span className="icon">{Icons.alert}</span>
                  <h3>Alertas Recientes</h3>
                </div>
                <div className="alertas-lista">
                  {alertas.length > 0 ? alertas.map((alerta, i) => (
                    <div key={i} className={`alerta-item ${alerta.tipo}`}>
                      <span className="alerta-mensaje">{alerta.mensaje}</span>
                      <span className="alerta-fecha">{new Date(alerta.createdAt || alerta.fecha).toLocaleString()}</span>
                    </div>
                  )) : <p className="sin-alertas">Sin alertas recientes</p>}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: DASHBOARD SUPERADMIN
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="app">
      <PanelContable />
      
      <div className="main-content">
        <header className="header">
          <div className="header-left">
            <img src="/logo-coop-alianzas.png" alt="" className="header-logo" onError={(e) => e.target.style.display = 'none'} />
            <div className="header-title">
              <h1>Coop-Alianzas</h1>
              <span>Panel Administrativo</span>
            </div>
          </div>
          <div className="header-right">
            <div className="user-info admin">
              <span className="icon">{Icons.user}</span>
              <span>{usuario}</span>
            </div>
            <button onClick={cerrarSesion} className="btn-logout">
              <span className="icon">{Icons.logout}</span>
              Salir
            </button>
          </div>
        </header>

        <div className="admin-stats">
          <div className="stat-card">
            <span className="icon">{Icons.home}</span>
            <span className="stat-valor">{farms.length}</span>
            <span className="stat-label">Granjas</span>
          </div>
          <div className="stat-card">
            <span className="icon">{Icons.users}</span>
            <span className="stat-valor">{users.length}</span>
            <span className="stat-label">Usuarios</span>
          </div>
          <div className="stat-card">
            <span className="icon">{Icons.activity}</span>
            <span className="stat-valor">{sessions.filter(s => !s.fecha_salida).length}</span>
            <span className="stat-label">Sesiones Activas</span>
          </div>
          <div className="stat-card alerta">
            <span className="icon">{Icons.alert}</span>
            <span className="stat-valor">{alertas.filter(a => a.tipo === 'critica' || a.tipo === 'critico').length}</span>
            <span className="stat-label">Alertas Críticas</span>
          </div>
        </div>

        <main className="admin-grid">
          {/* Granjas */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <span className="icon">{Icons.home}</span>
                <h3>Granjas</h3>
              </div>
              <button onClick={() => setModalGranja(true)} className="btn-agregar">
                <span className="icon">{Icons.plus}</span>
                Nueva
              </button>
            </div>
            <table className="tabla-admin">
              <thead>
                <tr><th>Nombre</th><th>Ubicación</th><th>Estado</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {farms.map(farm => (
                  <tr key={farm._id}>
                    <td>{farm.nombre}</td>
                    <td>{farm.ubicacion}</td>
                    <td><span className={`badge ${farm.activo !== false ? 'activo' : 'inactivo'}`}>{farm.activo !== false ? 'Activa' : 'Inactiva'}</span></td>
                    <td className="acciones">
                      <button onClick={() => toggleGranja(farm._id)} className="btn-accion">{farm.activo !== false ? Icons.pause : Icons.play}</button>
                      <button onClick={() => eliminarGranja(farm._id)} className="btn-accion eliminar">{Icons.trash}</button>
                    </td>
                  </tr>
                ))}
                {farms.length === 0 && <tr><td colSpan="4" className="sin-datos">No hay granjas</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Usuarios */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <span className="icon">{Icons.users}</span>
                <h3>Usuarios</h3>
              </div>
              <button onClick={() => setModalUsuario(true)} className="btn-agregar">
                <span className="icon">{Icons.plus}</span>
                Nuevo
              </button>
            </div>
            <table className="tabla-admin">
              <thead>
                <tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Último Acceso</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user._id}>
                    <td>{user.usuario}</td>
                    <td><span className={`rol-badge ${user.rol}`}>{user.rol}</span></td>
                    <td><span className={`badge ${user.activo ? 'activo' : 'inactivo'}`}>{user.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td>{user.ultimo_acceso ? new Date(user.ultimo_acceso).toLocaleString() : 'Nunca'}</td>
                    <td className="acciones">
                      <button onClick={() => toggleUsuario(user._id)} className="btn-accion">{user.activo ? Icons.pause : Icons.play}</button>
                      <button onClick={() => eliminarUsuario(user._id)} className="btn-accion eliminar">{Icons.trash}</button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan="5" className="sin-datos">No hay usuarios</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Sesiones */}
          <div className="card">
            <div className="card-header">
              <span className="icon">{Icons.activity}</span>
              <h3>Historial de Sesiones</h3>
            </div>
            <table className="tabla-admin">
              <thead>
                <tr><th>Usuario</th><th>Entrada</th><th>Salida</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {sessions.map(session => (
                  <tr key={session._id}>
                    <td>{session.usuario}</td>
                    <td>{new Date(session.fecha_entrada).toLocaleString()}</td>
                    <td>{session.fecha_salida ? new Date(session.fecha_salida).toLocaleString() : '-'}</td>
                    <td><span className={`badge ${!session.fecha_salida ? 'activo' : 'inactivo'}`}>{!session.fecha_salida ? 'Activa' : 'Cerrada'}</span></td>
                  </tr>
                ))}
                {sessions.length === 0 && <tr><td colSpan="4" className="sin-datos">No hay sesiones</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Sensor Tiempo Real */}
          <div className={`card sensor-card ${getEstadoTemp(datosAmbiente.temp_porqueriza).clase}`}>
            <div className="card-header">
              <span className="icon">{Icons.thermometer}</span>
              <h3>Temperatura Porqueriza (Tiempo Real)</h3>
            </div>
            <div className="sensor-display">
              <span className="valor-principal">{datosAmbiente.temp_porqueriza !== null ? datosAmbiente.temp_porqueriza : '--'}</span>
              <span className="unidad">°C</span>
            </div>
            <div className="sensor-secundario">
              Humedad: {datosAmbiente.humedad_porqueriza !== null ? `${datosAmbiente.humedad_porqueriza}%` : '--'}
            </div>
            <div className="sensor-conexion">
              Sensor: {conexiones.sensor_temp ? 'Conectado' : 'Desconectado'}
            </div>
          </div>
        </main>

        {/* Modal Usuario */}
        {modalUsuario && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Crear Nuevo Usuario</h3>
              <form onSubmit={crearUsuario}>
                <div className="form-group">
                  <label>Usuario</label>
                  <input type="text" value={nuevoUsuario.usuario} onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, usuario: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Correo</label>
                  <input type="email" value={nuevoUsuario.correo} onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, correo: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Contraseña</label>
                  <input type="password" value={nuevoUsuario.password} onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, password: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Rol</label>
                  <select value={nuevoUsuario.rol} onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, rol: e.target.value })}>
                    <option value="cliente">Cliente</option>
                    <option value="superadmin">SuperAdmin</option>
                  </select>
                </div>
                <div className="modal-actions">
                  <button type="button" onClick={() => setModalUsuario(false)} className="btn-cancelar">Cancelar</button>
                  <button type="submit" className="btn-primary">Crear</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Granja */}
        {modalGranja && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Crear Nueva Granja</h3>
              <form onSubmit={crearGranja}>
                <div className="form-group">
                  <label>Nombre</label>
                  <input type="text" value={nuevaGranja.nombre} onChange={(e) => setNuevaGranja({ ...nuevaGranja, nombre: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Ubicación</label>
                  <input type="text" value={nuevaGranja.ubicacion} onChange={(e) => setNuevaGranja({ ...nuevaGranja, ubicacion: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Contacto</label>
                  <input type="text" value={nuevaGranja.contacto} onChange={(e) => setNuevaGranja({ ...nuevaGranja, contacto: e.target.value })} />
                </div>
                <div className="modal-actions">
                  <button type="button" onClick={() => setModalGranja(false)} className="btn-cancelar">Cancelar</button>
                  <button type="submit" className="btn-primary">Crear</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App