/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - FRONTEND v4.0 PROFESIONAL
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Color: AMARILLO PROFESIONAL
 * Funcionalidades:
 * - Login con autenticación JWT
 * - Dashboard SuperAdmin
 * - Dashboard Cliente
 * - Panel Contable lateral
 * - Conexión ESP32 temperatura
 * - API clima Lorica
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
  // Estados de autenticación
  const [usuario, setUsuario] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [rol, setRol] = useState(localStorage.getItem('rol'))
  
  // Estados de login
  const [loginUsuario, setLoginUsuario] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [cargando, setCargando] = useState(false)
  
  // Estados de datos
  const [datosAmbiente, setDatosAmbiente] = useState({
    temp_exterior: null,
    humedad_exterior: null,
    temp_porqueriza: null,
    humedad_porqueriza: null
  })
  
  const [tanques, setTanques] = useState({
    tanque1: 75,
    tanque2: 60
  })
  
  const [consumoAgua, setConsumoAgua] = useState({
    diario: 0,
    mensual: 0
  })
  
  const [bombas, setBombas] = useState([])
  const [alertas, setAlertas] = useState([])
  
  // Estados admin
  const [farms, setFarms] = useState([])
  const [users, setUsers] = useState([])
  const [sessions, setSessions] = useState([])
  
  // Estados de conexión
  const [conexiones, setConexiones] = useState({
    backend: false,
    clima: false,
    sensor: false
  })
  
  // Panel contable
  const [mostrarPanel, setMostrarPanel] = useState(true)
  
  // Modal crear usuario/granja
  const [modalUsuario, setModalUsuario] = useState(false)
  const [modalGranja, setModalGranja] = useState(false)
  const [nuevoUsuario, setNuevoUsuario] = useState({ usuario: '', correo: '', password: '', rol: 'cliente' })
  const [nuevaGranja, setNuevaGranja] = useState({ nombre: '', ubicacion: '', contacto: '' })

  // ═══════════════════════════════════════════════════════════════════════
  // EFECTOS
  // ═══════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (token) {
      verificarSesion()
    }
  }, [])

  useEffect(() => {
    if (usuario) {
      // Conectar WebSocket
      socket = io(API_URL)
      
      socket.on('connect', () => {
        console.log('WebSocket conectado')
        setConexiones(prev => ({ ...prev, backend: true }))
      })
      
      socket.on('disconnect', () => {
        setConexiones(prev => ({ ...prev, backend: false }))
      })
      
      socket.on('lectura_actualizada', (data) => {
        if (data.temperatura !== undefined) {
          setDatosAmbiente(prev => ({
            ...prev,
            temp_porqueriza: data.temperatura,
            humedad_porqueriza: data.humedad
          }))
          setConexiones(prev => ({ ...prev, sensor: true }))
        }
      })
      
      socket.on('bomba_actualizada', () => {
        cargarBombas()
      })
      
      // Cargar datos iniciales
      cargarTodosDatos()
      cargarClimaLorica()
      
      // Intervalo de actualización
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
  // FUNCIONES DE AUTENTICACIÓN
  // ═══════════════════════════════════════════════════════════════════════

  const verificarSesion = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUsuario(res.data.usuario || res.data.nombre)
      setRol(res.data.rol)
      setConexiones(prev => ({ ...prev, backend: true }))
    } catch (error) {
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
      
      const { token: nuevoToken, usuario: nombreUsuario, rol: rolUsuario, session_id } = res.data
      
      localStorage.setItem('token', nuevoToken)
      localStorage.setItem('rol', rolUsuario)
      localStorage.setItem('session_id', session_id)
      
      setToken(nuevoToken)
      setRol(rolUsuario)
      setUsuario(nombreUsuario)
      setConexiones(prev => ({ ...prev, backend: true }))
      
    } catch (error) {
      const mensaje = error.response?.data?.mensaje || 'Error de conexión al servidor'
      setLoginError(mensaje)
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
    } catch (e) {
      console.log('Error cerrando sesión')
    }
    
    localStorage.removeItem('token')
    localStorage.removeItem('rol')
    localStorage.removeItem('session_id')
    setToken(null)
    setRol(null)
    setUsuario(null)
    if (socket) socket.disconnect()
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FUNCIONES DE CARGA DE DATOS
  // ═══════════════════════════════════════════════════════════════════════

  const cargarTodosDatos = async () => {
    await Promise.all([
      cargarDatosSensor(),
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
      const lat = 9.2367
      const lon = -75.8167
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m&timezone=America/Bogota`
      
      const res = await axios.get(url)
      const { temperature_2m, relative_humidity_2m } = res.data.current
      
      setDatosAmbiente(prev => ({
        ...prev,
        temp_exterior: temperature_2m,
        humedad_exterior: relative_humidity_2m
      }))
      setConexiones(prev => ({ ...prev, clima: true }))
    } catch (error) {
      console.error('Error cargando clima:', error)
      setConexiones(prev => ({ ...prev, clima: false }))
    }
  }

  const cargarDatosSensor = async () => {
    try {
      // Intentar endpoint específico ESP
      const res = await axios.get(`${API_URL}/api/esp/porqueriza`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (res.data && res.data.temperatura !== null) {
        setDatosAmbiente(prev => ({
          ...prev,
          temp_porqueriza: res.data.temperatura,
          humedad_porqueriza: res.data.humedad
        }))
        setConexiones(prev => ({ ...prev, sensor: res.data.conectado }))
      }
    } catch (error) {
      // Intentar endpoint alternativo de readings
      try {
        const res = await axios.get(`${API_URL}/api/sensors/readings?limit=1`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        if (res.data && res.data.length > 0) {
          const ultima = res.data[0]
          if (ultima.tipo === 'temp_porqueriza' || ultima.tipo === 'temperatura') {
            setDatosAmbiente(prev => ({
              ...prev,
              temp_porqueriza: ultima.valor
            }))
          }
        }
      } catch (e) {
        console.log('Sin datos de sensor')
      }
    }
  }

  const cargarBombas = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/motorbombs`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setBombas(res.data)
    } catch (error) {
      console.error('Error cargando bombas')
    }
  }

  const cargarAlertas = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/alerts`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setAlertas(res.data.slice(0, 5))
    } catch (error) {
      console.error('Error cargando alertas')
    }
  }

  const cargarGranjas = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/farms`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setFarms(res.data)
    } catch (error) {
      console.error('Error cargando granjas')
    }
  }

  const cargarUsuarios = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUsers(res.data)
    } catch (error) {
      console.error('Error cargando usuarios')
    }
  }

  const cargarSesiones = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/sessions`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setSessions(res.data.slice(0, 10))
    } catch (error) {
      console.error('Error cargando sesiones')
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FUNCIONES DE ACCIONES
  // ═══════════════════════════════════════════════════════════════════════

  const toggleBomba = async (id) => {
    try {
      await axios.put(`${API_URL}/api/motorbombs/${id}/toggle`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (socket) socket.emit('toggle_bomba', { id })
      cargarBombas()
    } catch (error) {
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
      alert('Usuario creado exitosamente')
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
    } catch (error) {
      alert('Error al cambiar estado de usuario')
    }
  }

  const eliminarUsuario = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return
    try {
      await axios.delete(`${API_URL}/api/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      cargarUsuarios()
    } catch (error) {
      alert('Error al eliminar usuario')
    }
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
      alert('Granja creada exitosamente')
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
    } catch (error) {
      alert('Error al cambiar estado de granja')
    }
  }

  const eliminarGranja = async (id) => {
    if (!confirm('¿Estás seguro de eliminar esta granja?')) return
    try {
      await axios.delete(`${API_URL}/api/farms/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      cargarGranjas()
    } catch (error) {
      alert('Error al eliminar granja')
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FUNCIONES AUXILIARES
  // ═══════════════════════════════════════════════════════════════════════

  const getEstadoTemp = (temp) => {
    if (temp === null) return { clase: '', texto: 'Sin datos', icono: '❓' }
    if (temp >= 40) return { clase: 'critico', texto: 'CRÍTICO', icono: '🔴' }
    if (temp >= 35) return { clase: 'alerta', texto: 'Alerta', icono: '🟠' }
    return { clase: 'normal', texto: 'Normal', icono: '🟢' }
  }

  const getColorTanque = (nivel) => {
    if (nivel < 25) return '#dc2626'
    if (nivel < 50) return '#f59e0b'
    return '#d4a006'
  }

  // ═══════════════════════════════════════════════════════════════════════
  // COMPONENTE: PANEL CONTABLE
  // ═══════════════════════════════════════════════════════════════════════

  const PanelContable = () => {
    const { comparativo, eficiencia } = DATOS_CONTABLES
    const tempActual = datosAmbiente.temp_porqueriza
    const humActual = datosAmbiente.humedad_porqueriza
    
    const desvTemp = tempActual !== null 
      ? tempActual - comparativo.temperatura_ideal.max 
      : null

    return (
      <aside className={`panel-contable ${mostrarPanel ? 'visible' : 'oculto'}`}>
        <div className="panel-header">
          <h3>📊 Panel Contable</h3>
          <button onClick={() => setMostrarPanel(!mostrarPanel)}>
            {mostrarPanel ? '◀' : '▶'}
          </button>
        </div>
        
        {mostrarPanel && (
          <div className="panel-content">
            {/* Inversión */}
            <div className="metrica-card">
              <h4>💰 Inversión Total</h4>
              <div className="metrica-valor">${DATOS_CONTABLES.inversion_hardware.toLocaleString()}</div>
              <div className="metrica-sub">Costo operativo: $0/mes</div>
              <div className="barra-progreso">
                <div className="progreso" style={{ 
                  width: `${(DATOS_CONTABLES.ejecutado / DATOS_CONTABLES.presupuesto_total) * 100}%` 
                }}></div>
              </div>
              <small>{Math.round((DATOS_CONTABLES.ejecutado / DATOS_CONTABLES.presupuesto_total) * 100)}% ejecutado</small>
            </div>

            {/* Comparativo Temperatura */}
            <div className="metrica-card comparativo">
              <h4>🌡️ Temperatura</h4>
              <div className="comparativo-grid">
                <div className="comp-item ideal">
                  <span>Ideal</span>
                  <strong>{comparativo.temperatura_ideal.min}-{comparativo.temperatura_ideal.max}°C</strong>
                </div>
                <div className={`comp-item actual ${desvTemp > 0 ? 'alerta' : ''}`}>
                  <span>Actual</span>
                  <strong>{tempActual !== null ? `${tempActual}°C` : '--'}</strong>
                </div>
              </div>
              {desvTemp !== null && desvTemp > 0 && (
                <div className="desviacion negativa">⚠️ +{desvTemp.toFixed(1)}°C sobre lo ideal</div>
              )}
              {desvTemp !== null && desvTemp <= 0 && (
                <div className="desviacion positiva">✓ Dentro del rango</div>
              )}
            </div>

            {/* Eficiencia */}
            <div className="metrica-card">
              <h4>📈 Eficiencia Esperada</h4>
              <div className="eficiencia-row">
                <span>Mortalidad antes:</span>
                <span className="valor-negativo">{eficiencia.mortalidad_antes}%</span>
              </div>
              <div className="eficiencia-row">
                <span>Mortalidad esperada:</span>
                <span className="valor-positivo">{eficiencia.mortalidad_despues}%</span>
              </div>
              <div className="ahorro-box">
                Reducción: <strong>{eficiencia.mortalidad_antes - eficiencia.mortalidad_despues}%</strong>
              </div>
            </div>

            {/* ROI */}
            <div className="metrica-card roi">
              <h4>📊 Retorno de Inversión</h4>
              <div className="metrica-valor">{DATOS_CONTABLES.roi_esperado_meses} meses</div>
              <div className="metrica-sub">Ahorro: ${DATOS_CONTABLES.ahorro_mensual_estimado.toLocaleString()}/mes</div>
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
          <div className="login-logo">
            <img src="/logo-alianzas.png" alt="COO Alianzas" onError={(e) => e.target.style.display = 'none'} />
            <span className="logo-emoji">🐷</span>
          </div>
          <h1>COO ALIANZAS</h1>
          <p className="login-subtitle">Sistema de Monitoreo IoT - Porqueriza Tecnificada</p>
          
          {loginError && (
            <div className="error-message">{loginError}</div>
          )}
          
          <form onSubmit={iniciarSesion}>
            <div className="input-group">
              <label>Usuario</label>
              <input
                type="text"
                value={loginUsuario}
                onChange={(e) => setLoginUsuario(e.target.value)}
                placeholder="Ingresa tu usuario"
                required
                autoFocus
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
            
            <button type="submit" className="btn-login" disabled={cargando}>
              {cargando ? 'Ingresando...' : 'Iniciar Sesión'}
            </button>
          </form>
          
          <div className="login-footer">
            <p>INGENIEROS OMP © 2026</p>
            <small>Lorica, Córdoba - Colombia</small>
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
          {/* Header */}
          <header className="header">
            <div className="header-left">
              <img src="/logo-alianzas.png" alt="" className="header-logo" onError={(e) => e.target.style.display = 'none'} />
              <h1>🐷 COO ALIANZAS</h1>
              <span className="user-badge">👤 {usuario}</span>
            </div>
            <div className="header-right">
              <div className="conexiones-status">
                <span className={conexiones.backend ? 'ok' : 'error'}>
                  Backend {conexiones.backend ? '✓' : '✗'}
                </span>
                <span className={conexiones.clima ? 'ok' : 'error'}>
                  Clima {conexiones.clima ? '✓' : '✗'}
                </span>
                <span className={conexiones.sensor ? 'ok' : 'error'}>
                  Sensor {conexiones.sensor ? '✓' : '✗'}
                </span>
              </div>
              <button onClick={cerrarSesion} className="btn-logout">Cerrar Sesión</button>
            </div>
          </header>

          {/* Alerta de temperatura */}
          {estadoTemp.clase && estadoTemp.clase !== 'normal' && (
            <div className={`alerta-banner ${estadoTemp.clase}`}>
              {estadoTemp.icono} {estadoTemp.texto}: Temperatura Porqueriza Tecnificada {datosAmbiente.temp_porqueriza}°C
            </div>
          )}

          {/* Dashboard */}
          <main className="dashboard">
            <div className="cards-grid">
              {/* Clima Exterior */}
              <div className="card">
                <h3>🌤️ Clima Exterior (Lorica)</h3>
                <div className="clima-datos">
                  <div className="clima-item">
                    <span className="valor-grande">
                      {datosAmbiente.temp_exterior !== null ? `${datosAmbiente.temp_exterior}°C` : '--'}
                    </span>
                    <span className="etiqueta">Temperatura</span>
                  </div>
                  <div className="clima-item">
                    <span className="valor-grande">
                      {datosAmbiente.humedad_exterior !== null ? `${datosAmbiente.humedad_exterior}%` : '--'}
                    </span>
                    <span className="etiqueta">Humedad</span>
                  </div>
                </div>
              </div>

              {/* Temperatura Porqueriza */}
              <div className={`card sensor-card ${estadoTemp.clase}`}>
                <h3>🌡️ Temperatura Porqueriza Tecnificada</h3>
                <div className="sensor-datos">
                  <div className="sensor-principal">
                    <span className="valor-gigante">
                      {datosAmbiente.temp_porqueriza !== null ? datosAmbiente.temp_porqueriza : '--'}
                    </span>
                    <span className="unidad">°C</span>
                  </div>
                  <div className="sensor-secundario">
                    <span>Humedad: {datosAmbiente.humedad_porqueriza !== null ? `${datosAmbiente.humedad_porqueriza}%` : '--'}</span>
                  </div>
                  <div className={`estado-badge ${estadoTemp.clase}`}>
                    {estadoTemp.icono} {estadoTemp.texto}
                  </div>
                </div>
              </div>

              {/* Tanques */}
              <div className="card">
                <h3>🛢️ Nivel de Tanques</h3>
                <div className="tanques-grid">
                  <div className="tanque">
                    <div className="tanque-visual">
                      <div 
                        className="tanque-nivel" 
                        style={{ 
                          height: `${tanques.tanque1}%`,
                          backgroundColor: getColorTanque(tanques.tanque1)
                        }}
                      ></div>
                    </div>
                    <span className="tanque-nombre">Tanque 1</span>
                    <span className="tanque-valor">{tanques.tanque1}%</span>
                  </div>
                  <div className="tanque">
                    <div className="tanque-visual">
                      <div 
                        className="tanque-nivel" 
                        style={{ 
                          height: `${tanques.tanque2}%`,
                          backgroundColor: getColorTanque(tanques.tanque2)
                        }}
                      ></div>
                    </div>
                    <span className="tanque-nombre">Tanque 2</span>
                    <span className="tanque-valor">{tanques.tanque2}%</span>
                  </div>
                </div>
              </div>

              {/* Bombas */}
              <div className="card">
                <h3>🔧 Control de Bombas</h3>
                <div className="bombas-lista">
                  {bombas.length > 0 ? bombas.map(bomba => (
                    <div key={bomba._id} className={`bomba-item ${bomba.estado ? 'encendida' : ''} ${!bomba.conectada ? 'desconectada' : ''}`}>
                      <div className="bomba-info">
                        <span className="bomba-nombre">{bomba.nombre}</span>
                        <span className="bomba-estado">
                          {!bomba.conectada ? '⚫ Desconectada' : bomba.estado ? '🟢 Encendida' : '🔴 Apagada'}
                        </span>
                      </div>
                      <button 
                        onClick={() => toggleBomba(bomba._id)}
                        className={`btn-bomba ${bomba.estado ? 'apagar' : 'encender'}`}
                        disabled={!bomba.conectada}
                      >
                        {bomba.estado ? 'Apagar' : 'Encender'}
                      </button>
                    </div>
                  )) : (
                    <p className="sin-datos">No hay bombas configuradas</p>
                  )}
                </div>
              </div>

              {/* Alertas */}
              <div className="card alertas-card">
                <h3>🔔 Alertas Recientes</h3>
                <div className="alertas-lista">
                  {alertas.length > 0 ? alertas.map((alerta, i) => (
                    <div key={i} className={`alerta-item ${alerta.tipo}`}>
                      <span className="alerta-mensaje">{alerta.mensaje}</span>
                      <span className="alerta-fecha">{new Date(alerta.createdAt || alerta.fecha).toLocaleString()}</span>
                    </div>
                  )) : (
                    <p className="sin-alertas">✓ Sin alertas recientes</p>
                  )}
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
        {/* Header */}
        <header className="header">
          <div className="header-left">
            <img src="/logo-alianzas.png" alt="" className="header-logo" onError={(e) => e.target.style.display = 'none'} />
            <h1>🐷 COO ALIANZAS - Panel Administrativo</h1>
            <span className="user-badge admin">👑 {usuario}</span>
          </div>
          <div className="header-right">
            <button onClick={cerrarSesion} className="btn-logout">Cerrar Sesión</button>
          </div>
        </header>

        {/* Stats */}
        <div className="admin-stats">
          <div className="stat-card">
            <span className="stat-icono">🏠</span>
            <span className="stat-valor">{farms.length}</span>
            <span className="stat-label">Granjas</span>
          </div>
          <div className="stat-card">
            <span className="stat-icono">👥</span>
            <span className="stat-valor">{users.length}</span>
            <span className="stat-label">Usuarios</span>
          </div>
          <div className="stat-card">
            <span className="stat-icono">📊</span>
            <span className="stat-valor">{sessions.filter(s => !s.fecha_salida).length}</span>
            <span className="stat-label">Sesiones Activas</span>
          </div>
          <div className="stat-card alerta">
            <span className="stat-icono">⚠️</span>
            <span className="stat-valor">{alertas.filter(a => a.tipo === 'critica' || a.tipo === 'critico').length}</span>
            <span className="stat-label">Alertas Críticas</span>
          </div>
        </div>

        {/* Admin Grid */}
        <main className="admin-grid">
          {/* Granjas */}
          <div className="card">
            <div className="card-header">
              <h3>🏠 Granjas</h3>
              <button onClick={() => setModalGranja(true)} className="btn-agregar">+ Nueva</button>
            </div>
            <table className="tabla-admin">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Ubicación</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {farms.map(farm => (
                  <tr key={farm._id}>
                    <td>{farm.nombre}</td>
                    <td>{farm.ubicacion}</td>
                    <td>
                      <span className={`badge ${farm.activo !== false ? 'activo' : 'inactivo'}`}>
                        {farm.activo !== false ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="acciones">
                      <button onClick={() => toggleGranja(farm._id)} className="btn-accion">
                        {farm.activo !== false ? '⏸️' : '▶️'}
                      </button>
                      <button onClick={() => eliminarGranja(farm._id)} className="btn-accion eliminar">🗑️</button>
                    </td>
                  </tr>
                ))}
                {farms.length === 0 && (
                  <tr><td colSpan="4" className="sin-datos">No hay granjas registradas</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Usuarios */}
          <div className="card">
            <div className="card-header">
              <h3>👥 Usuarios</h3>
              <button onClick={() => setModalUsuario(true)} className="btn-agregar">+ Nuevo</button>
            </div>
            <table className="tabla-admin">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Último Acceso</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user._id}>
                    <td>{user.usuario}</td>
                    <td><span className={`rol-badge ${user.rol}`}>{user.rol}</span></td>
                    <td>
                      <span className={`badge ${user.activo ? 'activo' : 'inactivo'}`}>
                        {user.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>{user.ultimo_acceso ? new Date(user.ultimo_acceso).toLocaleString() : 'Nunca'}</td>
                    <td className="acciones">
                      <button onClick={() => toggleUsuario(user._id)} className="btn-accion">
                        {user.activo ? '⏸️' : '▶️'}
                      </button>
                      <button onClick={() => eliminarUsuario(user._id)} className="btn-accion eliminar">🗑️</button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan="5" className="sin-datos">No hay usuarios registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Sesiones */}
          <div className="card">
            <h3>📋 Historial de Sesiones</h3>
            <table className="tabla-admin">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(session => (
                  <tr key={session._id}>
                    <td>{session.usuario}</td>
                    <td>{new Date(session.fecha_entrada).toLocaleString()}</td>
                    <td>{session.fecha_salida ? new Date(session.fecha_salida).toLocaleString() : '-'}</td>
                    <td>
                      <span className={`badge ${!session.fecha_salida ? 'activo' : 'inactivo'}`}>
                        {!session.fecha_salida ? 'Activa' : 'Cerrada'}
                      </span>
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr><td colSpan="4" className="sin-datos">No hay sesiones registradas</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Sensor en tiempo real */}
          <div className="card sensor-card">
            <h3>🌡️ Temperatura Porqueriza Tecnificada (Tiempo Real)</h3>
            <div className="sensor-datos">
              <div className="sensor-principal">
                <span className="valor-gigante">
                  {datosAmbiente.temp_porqueriza !== null ? datosAmbiente.temp_porqueriza : '--'}
                </span>
                <span className="unidad">°C</span>
              </div>
              <div className="sensor-secundario">
                <span>Humedad: {datosAmbiente.humedad_porqueriza !== null ? `${datosAmbiente.humedad_porqueriza}%` : '--'}</span>
              </div>
              <div className={`estado-badge ${getEstadoTemp(datosAmbiente.temp_porqueriza).clase}`}>
                {getEstadoTemp(datosAmbiente.temp_porqueriza).icono} {getEstadoTemp(datosAmbiente.temp_porqueriza).texto}
              </div>
              <div className="sensor-conexion">
                Sensor: {conexiones.sensor ? '🟢 Conectado' : '🔴 Desconectado'}
              </div>
            </div>
          </div>
        </main>

        {/* Modal Crear Usuario */}
        {modalUsuario && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Crear Nuevo Usuario</h3>
              <form onSubmit={crearUsuario}>
                <div className="form-group">
                  <label>Usuario</label>
                  <input
                    type="text"
                    value={nuevoUsuario.usuario}
                    onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, usuario: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Correo</label>
                  <input
                    type="email"
                    value={nuevoUsuario.correo}
                    onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, correo: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Contraseña</label>
                  <input
                    type="password"
                    value={nuevoUsuario.password}
                    onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, password: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Rol</label>
                  <select
                    value={nuevoUsuario.rol}
                    onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, rol: e.target.value })}
                  >
                    <option value="cliente">Cliente</option>
                    <option value="superadmin">SuperAdmin</option>
                  </select>
                </div>
                <div className="modal-actions">
                  <button type="button" onClick={() => setModalUsuario(false)} className="btn-cancelar">Cancelar</button>
                  <button type="submit" className="btn-guardar">Crear Usuario</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Crear Granja */}
        {modalGranja && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Crear Nueva Granja</h3>
              <form onSubmit={crearGranja}>
                <div className="form-group">
                  <label>Nombre</label>
                  <input
                    type="text"
                    value={nuevaGranja.nombre}
                    onChange={(e) => setNuevaGranja({ ...nuevaGranja, nombre: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Ubicación</label>
                  <input
                    type="text"
                    value={nuevaGranja.ubicacion}
                    onChange={(e) => setNuevaGranja({ ...nuevaGranja, ubicacion: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Contacto</label>
                  <input
                    type="text"
                    value={nuevaGranja.contacto}
                    onChange={(e) => setNuevaGranja({ ...nuevaGranja, contacto: e.target.value })}
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" onClick={() => setModalGranja(false)} className="btn-cancelar">Cancelar</button>
                  <button type="submit" className="btn-guardar">Crear Granja</button>
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