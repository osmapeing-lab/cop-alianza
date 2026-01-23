/*
 * ═══════════════════════════════════════════════════════════════════════
 * COO ALIANZAS - FRONTEND v3.0 CON PANEL CONTABLE
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Nuevas funcionalidades:
 * - Panel lateral con métricas contables
 * - Gráficas comparativas (lo que debería ser vs lo que es)
 * - Conexión real con ESP32 vía backend
 * - Indicadores financieros del proyecto
 * 
 * ═══════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import axios from 'axios'
import './App.css'

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════

const API_URL = import.meta.env.VITE_API_URL || 'https://cop-alianza-backend.onrender.com'
const socket = io(API_URL)

// ═══════════════════════════════════════════════════════════════════════
// DATOS CONTABLES DEL PROYECTO (Basados en presentación)
// ═══════════════════════════════════════════════════════════════════════

const DATOS_CONTABLES = {
  inversion_hardware: 497367,
  costo_operativo_mensual: 0,
  ahorro_mensual_estimado: 150000,    // Por reducción mortalidad
  roi_esperado_meses: 4,
  presupuesto_total: 500000,
  ejecutado: 497367,
  
  // Comparativo: Lo que debería ser vs Lo que es
  comparativo: {
    temperatura_ideal: { min: 22, max: 28, unidad: '°C' },
    humedad_ideal: { min: 60, max: 70, unidad: '%' },
    consumo_agua_diario_ideal: 150,  // Litros por cerdo
    peso_promedio_esperado: 100,     // kg a los 6 meses
  },
  
  // Métricas de eficiencia
  eficiencia: {
    mortalidad_antes: 8,      // % antes del sistema
    mortalidad_despues: 2,    // % esperado con sistema
    kg_alimento_por_kg: 3.2,  // Conversión alimenticia
  }
}

// ═══════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════

function App() {
  // Estados de autenticación
  const [usuario, setUsuario] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [loginData, setLoginData] = useState({ usuario: '', password: '' })
  const [loginError, setLoginError] = useState('')
  
  // Estados de conexión
  const [conexiones, setConexiones] = useState({
    backend: false,
    api_clima: false,
    sensor_porqueriza: false,
    bascula: false
  })
  
  // Estados de datos
  const [datosAmbiente, setDatosAmbiente] = useState({
    temp_exterior: null,
    humedad_exterior: null,
    temp_porqueriza: null,
    humedad_porqueriza: null,
    sensacion_termica: null
  })
  
  const [tanques, setTanques] = useState({
    tanque1: null,
    tanque2: null
  })
  
  const [consumoAgua, setConsumoAgua] = useState({
    diario: 0,
    mensual: 0,
    flujo: 0
  })
  
  const [bombas, setBombas] = useState([])
  const [alertas, setAlertas] = useState([])
  const [pesajes, setPesajes] = useState({ ultimo: null, historial: [] })
  
  // Estados para admin
  const [farms, setFarms] = useState([])
  const [users, setUsers] = useState([])
  const [sessions, setSessions] = useState([])
  
  // Estado para panel contable
  const [mostrarPanelContable, setMostrarPanelContable] = useState(true)

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
    if (usuario) {
      cargarDatos()
      cargarClimaLorica()
      
      const interval = setInterval(() => {
        cargarDatos()
        cargarClimaLorica()
      }, 30000) // Actualizar cada 30 segundos
      
      return () => clearInterval(interval)
    }
  }, [usuario])

  // WebSocket listeners
  useEffect(() => {
    socket.on('connect', () => {
      console.log('WebSocket conectado')
      setConexiones(prev => ({ ...prev, backend: true }))
    })
    
    socket.on('disconnect', () => {
      console.log('WebSocket desconectado')
      setConexiones(prev => ({ ...prev, backend: false }))
    })
    
    socket.on('lectura_actualizada', (data) => {
      console.log('Lectura recibida:', data)
      if (data.temp_porqueriza !== undefined) {
        setDatosAmbiente(prev => ({
          ...prev,
          temp_porqueriza: data.temp_porqueriza,
          humedad_porqueriza: data.humedad_porqueriza
        }))
        setConexiones(prev => ({ ...prev, sensor_porqueriza: true }))
      }
    })
    
    socket.on('bomba_actualizada', (data) => {
      cargarBombas()
    })
    
    socket.on('nuevo_peso', (data) => {
      setPesajes(prev => ({
        ultimo: data,
        historial: [data, ...prev.historial].slice(0, 10)
      }))
      setConexiones(prev => ({ ...prev, bascula: true }))
    })
    
    socket.on('nueva_alerta', (data) => {
      setAlertas(prev => [data, ...prev].slice(0, 5))
    })
    
    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('lectura_actualizada')
      socket.off('bomba_actualizada')
      socket.off('nuevo_peso')
      socket.off('nueva_alerta')
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
      setUsuario(res.data)
      setConexiones(prev => ({ ...prev, backend: true }))
    } catch (error) {
      localStorage.removeItem('token')
      setToken(null)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginError('')
    
    try {
      const res = await axios.post(`${API_URL}/api/users/login`, loginData)
      const { token: nuevoToken, usuario: user, session_id } = res.data
      
      localStorage.setItem('token', nuevoToken)
      localStorage.setItem('session_id', session_id)
      setToken(nuevoToken)
      setUsuario(user)
      setConexiones(prev => ({ ...prev, backend: true }))
      
    } catch (error) {
      setLoginError(error.response?.data?.mensaje || 'Error de conexión')
    }
  }

  const handleLogout = async () => {
    try {
      const sessionId = localStorage.getItem('session_id')
      if (sessionId) {
        await axios.put(`${API_URL}/api/sessions/${sessionId}/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        })
      }
    } catch (error) {
      console.log('Error cerrando sesión:', error)
    }
    
    localStorage.removeItem('token')
    localStorage.removeItem('session_id')
    setToken(null)
    setUsuario(null)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FUNCIONES DE CARGA DE DATOS
  // ═══════════════════════════════════════════════════════════════════════

  const cargarDatos = async () => {
    try {
      await Promise.all([
        cargarDatosPorqueriza(),
        cargarBombas(),
        cargarAlertas(),
        cargarPesajes(),
        cargarConsumoAgua()
      ])
      
      if (usuario?.rol === 'superadmin') {
        await Promise.all([
          cargarFarms(),
          cargarUsers(),
          cargarSessions()
        ])
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
    }
  }

  const cargarClimaLorica = async () => {
    try {
      // Coordenadas de Lorica, Córdoba
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
      setConexiones(prev => ({ ...prev, api_clima: true }))
      
    } catch (error) {
      console.error('Error obteniendo clima:', error)
      setConexiones(prev => ({ ...prev, api_clima: false }))
    }
  }

  const cargarDatosPorqueriza = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/esp/porqueriza`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (res.data.temperatura !== null) {
        setDatosAmbiente(prev => ({
          ...prev,
          temp_porqueriza: res.data.temperatura,
          humedad_porqueriza: res.data.humedad
        }))
        setConexiones(prev => ({ ...prev, sensor_porqueriza: res.data.conectado }))
      }
    } catch (error) {
      // Intentar endpoint alternativo
      try {
        const res = await axios.get(`${API_URL}/api/sensors/readings?tipo=temp_porqueriza&limit=1`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.data.length > 0) {
          setDatosAmbiente(prev => ({
            ...prev,
            temp_porqueriza: res.data[0].valor
          }))
        }
      } catch (e) {
        console.log('Sin datos de porqueriza')
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
      console.error('Error cargando bombas:', error)
    }
  }

  const cargarAlertas = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/alerts`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setAlertas(res.data.slice(0, 5))
    } catch (error) {
      console.error('Error cargando alertas:', error)
    }
  }

  const cargarPesajes = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/esp/pesos`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data.length > 0) {
        setPesajes({
          ultimo: res.data[0],
          historial: res.data.slice(0, 10)
        })
        setConexiones(prev => ({ ...prev, bascula: true }))
      }
    } catch (error) {
      console.log('Sin datos de pesajes')
    }
  }

  const cargarConsumoAgua = async () => {
    try {
      const [diario, mensual] = await Promise.all([
        axios.get(`${API_URL}/api/water/diario`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/api/water/mensual`, { headers: { Authorization: `Bearer ${token}` } })
      ])
      setConsumoAgua({
        diario: diario.data.total || 0,
        mensual: mensual.data.total || 0,
        flujo: 0
      })
    } catch (error) {
      console.log('Sin datos de agua')
    }
  }

  const cargarFarms = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/farms`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setFarms(res.data)
    } catch (error) {
      console.error('Error cargando granjas:', error)
    }
  }

  const cargarUsers = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUsers(res.data)
    } catch (error) {
      console.error('Error cargando usuarios:', error)
    }
  }

  const cargarSessions = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/sessions`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setSessions(res.data)
    } catch (error) {
      console.error('Error cargando sesiones:', error)
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
      socket.emit('toggle_bomba', { id })
      cargarBombas()
    } catch (error) {
      console.error('Error toggling bomba:', error)
    }
  }

  const descargarReporte = async (tipo) => {
    try {
      const res = await axios.get(`${API_URL}/api/reporte/excel?tipo=${tipo}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `reporte_${tipo}_${new Date().toISOString().split('T')[0]}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error('Error descargando reporte:', error)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FUNCIONES AUXILIARES
  // ═══════════════════════════════════════════════════════════════════════

  const calcularSensacionTermica = (temp, hum) => {
    if (temp === null || hum === null) return null
    if (temp >= 27 && hum >= 40) {
      const sensacion = -8.784695 + 1.61139411 * temp + 2.338549 * hum 
        - 0.14611605 * temp * hum - 0.012308094 * temp * temp 
        - 0.016424828 * hum * hum + 0.002211732 * temp * temp * hum 
        + 0.00072546 * temp * hum * hum - 0.000003582 * temp * temp * hum * hum
      return Math.round(sensacion * 10) / 10
    }
    return temp
  }

  const getEstadoTemperatura = (temp) => {
    if (temp === null) return { estado: 'sin-datos', texto: 'Sin datos', color: '#666' }
    if (temp >= 40) return { estado: 'critico', texto: 'CRÍTICO', color: '#dc2626' }
    if (temp >= 37) return { estado: 'alerta', texto: 'Alerta', color: '#f59e0b' }
    return { estado: 'normal', texto: 'Normal', color: '#10b981' }
  }

  const getColorTanque = (nivel) => {
    if (nivel === null) return '#666'
    if (nivel < 30) return '#dc2626'
    if (nivel < 50) return '#f59e0b'
    return '#10b981'
  }

  // ═══════════════════════════════════════════════════════════════════════
  // COMPONENTE: PANEL CONTABLE LATERAL
  // ═══════════════════════════════════════════════════════════════════════

  const PanelContable = () => {
    const { comparativo, eficiencia } = DATOS_CONTABLES
    const tempActual = datosAmbiente.temp_porqueriza
    const humActual = datosAmbiente.humedad_porqueriza
    
    // Calcular desviaciones
    const desvTemp = tempActual !== null 
      ? tempActual - comparativo.temperatura_ideal.max 
      : null
    
    const desvHum = humActual !== null
      ? humActual < comparativo.humedad_ideal.min 
        ? humActual - comparativo.humedad_ideal.min
        : humActual > comparativo.humedad_ideal.max
          ? humActual - comparativo.humedad_ideal.max
          : 0
      : null

    return (
      <div className="panel-contable">
        <div className="panel-header">
          <h3>📊 Métricas Contables</h3>
          <button 
            className="btn-toggle-panel"
            onClick={() => setMostrarPanelContable(!mostrarPanelContable)}
          >
            {mostrarPanelContable ? '◀' : '▶'}
          </button>
        </div>
        
        {mostrarPanelContable && (
          <div className="panel-content">
            {/* Inversión */}
            <div className="metrica-card">
              <h4>💰 Inversión</h4>
              <div className="metrica-valor grande">
                ${DATOS_CONTABLES.inversion_hardware.toLocaleString()}
              </div>
              <div className="metrica-sub">
                Costo operativo: <strong>${DATOS_CONTABLES.costo_operativo_mensual}/mes</strong>
              </div>
              <div className="barra-progreso">
                <div 
                  className="progreso" 
                  style={{ width: `${(DATOS_CONTABLES.ejecutado / DATOS_CONTABLES.presupuesto_total) * 100}%` }}
                />
              </div>
              <div className="metrica-sub">
                {Math.round((DATOS_CONTABLES.ejecutado / DATOS_CONTABLES.presupuesto_total) * 100)}% del presupuesto
              </div>
            </div>

            {/* Comparativo Temperatura */}
            <div className="metrica-card comparativo">
              <h4>🌡️ Temperatura</h4>
              <div className="comparativo-row">
                <div className="comparativo-item ideal">
                  <span className="label">Ideal</span>
                  <span className="valor">{comparativo.temperatura_ideal.min}-{comparativo.temperatura_ideal.max}°C</span>
                </div>
                <div className={`comparativo-item actual ${desvTemp !== null && desvTemp > 0 ? 'alerta' : ''}`}>
                  <span className="label">Actual</span>
                  <span className="valor">{tempActual !== null ? `${tempActual}°C` : '--'}</span>
                </div>
              </div>
              {desvTemp !== null && desvTemp > 0 && (
                <div className="desviacion negativa">
                  ⚠️ +{desvTemp.toFixed(1)}°C sobre lo ideal
                </div>
              )}
              {desvTemp !== null && desvTemp <= 0 && (
                <div className="desviacion positiva">
                  ✓ Dentro del rango ideal
                </div>
              )}
            </div>

            {/* Comparativo Humedad */}
            <div className="metrica-card comparativo">
              <h4>💧 Humedad</h4>
              <div className="comparativo-row">
                <div className="comparativo-item ideal">
                  <span className="label">Ideal</span>
                  <span className="valor">{comparativo.humedad_ideal.min}-{comparativo.humedad_ideal.max}%</span>
                </div>
                <div className={`comparativo-item actual ${desvHum !== null && desvHum !== 0 ? 'alerta' : ''}`}>
                  <span className="label">Actual</span>
                  <span className="valor">{humActual !== null ? `${humActual}%` : '--'}</span>
                </div>
              </div>
            </div>

            {/* Eficiencia */}
            <div className="metrica-card">
              <h4>📈 Eficiencia Esperada</h4>
              <div className="eficiencia-item">
                <span>Mortalidad antes:</span>
                <span className="valor negativo">{eficiencia.mortalidad_antes}%</span>
              </div>
              <div className="eficiencia-item">
                <span>Mortalidad esperada:</span>
                <span className="valor positivo">{eficiencia.mortalidad_despues}%</span>
              </div>
              <div className="ahorro">
                Reducción: <strong>{eficiencia.mortalidad_antes - eficiencia.mortalidad_despues}%</strong>
              </div>
            </div>

            {/* ROI */}
            <div className="metrica-card roi">
              <h4>📊 ROI Proyectado</h4>
              <div className="metrica-valor">
                {DATOS_CONTABLES.roi_esperado_meses} meses
              </div>
              <div className="metrica-sub">
                Ahorro mensual: ${DATOS_CONTABLES.ahorro_mensual_estimado.toLocaleString()}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: LOGIN
  // ═══════════════════════════════════════════════════════════════════════

  if (!usuario) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <img src="/logo.png" alt="COO ALIANZAS" className="login-logo" />
            <h1>COO ALIANZAS</h1>
            <p>Sistema de Monitoreo IoT</p>
          </div>
          
          <form onSubmit={handleLogin} className="login-form">
            {loginError && (
              <div className="login-error">{loginError}</div>
            )}
            
            <div className="form-group">
              <label>Usuario</label>
              <input
                type="text"
                value={loginData.usuario}
                onChange={(e) => setLoginData({ ...loginData, usuario: e.target.value })}
                placeholder="Ingresa tu usuario"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Contraseña</label>
              <input
                type="password"
                value={loginData.password}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                placeholder="Ingresa tu contraseña"
                required
              />
            </div>
            
            <button type="submit" className="btn-login">
              Iniciar Sesión
            </button>
          </form>
          
          <div className="login-footer">
            <p>INGENIEROS OMP © 2026</p>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: DASHBOARD CLIENTE
  // ═══════════════════════════════════════════════════════════════════════

  if (usuario.rol === 'cliente') {
    const estadoTemp = getEstadoTemperatura(datosAmbiente.temp_porqueriza)
    const sensacion = calcularSensacionTermica(
      datosAmbiente.temp_porqueriza,
      datosAmbiente.humedad_porqueriza
    )

    return (
      <div className="app">
        {/* Sidebar izquierdo - Panel Contable */}
        <PanelContable />
        
        <div className="main-content">
          {/* Header */}
          <header className="header">
            <div className="header-left">
              <h1>🐷 COO ALIANZAS</h1>
              <span className="user-badge">👤 {usuario.nombre || usuario.usuario}</span>
            </div>
            <div className="header-right">
              <div className="conexiones">
                <span className={`conexion ${conexiones.backend ? 'ok' : 'error'}`}>
                  Backend {conexiones.backend ? '✓' : '✗'}
                </span>
                <span className={`conexion ${conexiones.api_clima ? 'ok' : 'error'}`}>
                  Clima {conexiones.api_clima ? '✓' : '✗'}
                </span>
                <span className={`conexion ${conexiones.sensor_porqueriza ? 'ok' : 'error'}`}>
                  Sensor {conexiones.sensor_porqueriza ? '✓' : '✗'}
                </span>
              </div>
              <button onClick={handleLogout} className="btn-logout">
                Cerrar Sesión
              </button>
            </div>
          </header>

          {/* Alerta de temperatura */}
          {estadoTemp.estado !== 'normal' && estadoTemp.estado !== 'sin-datos' && (
            <div className={`alerta-banner ${estadoTemp.estado}`}>
              ⚠️ {estadoTemp.texto}: Temperatura en porqueriza {datosAmbiente.temp_porqueriza}°C
              {estadoTemp.estado === 'critico' && ' - Bombas activadas automáticamente'}
            </div>
          )}

          {/* Grid principal */}
          <div className="dashboard-grid">
            {/* Clima y Porqueriza */}
            <div className="card clima-card">
              <h3>🌤️ Condiciones Ambientales</h3>
              <div className="clima-grid">
                <div className="clima-item">
                  <span className="clima-label">Exterior (Lorica)</span>
                  <span className="clima-valor">
                    {datosAmbiente.temp_exterior !== null 
                      ? `${datosAmbiente.temp_exterior}°C` 
                      : '--'}
                  </span>
                  <span className="clima-sub">
                    {datosAmbiente.humedad_exterior !== null 
                      ? `${datosAmbiente.humedad_exterior}% hum` 
                      : ''}
                  </span>
                </div>
                <div className={`clima-item porqueriza ${estadoTemp.estado}`}>
                  <span className="clima-label">Porqueriza (Sensor)</span>
                  <span className="clima-valor" style={{ color: estadoTemp.color }}>
                    {datosAmbiente.temp_porqueriza !== null 
                      ? `${datosAmbiente.temp_porqueriza}°C` 
                      : '--'}
                  </span>
                  <span className="clima-sub">
                    {datosAmbiente.humedad_porqueriza !== null 
                      ? `${datosAmbiente.humedad_porqueriza}% hum` 
                      : ''}
                    {sensacion !== null && sensacion !== datosAmbiente.temp_porqueriza && (
                      <> | ST: {sensacion}°C</>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Tanques */}
            <div className="card tanques-card">
              <h3>🛢️ Tanques de Agua</h3>
              <div className="tanques-grid">
                <div className="tanque">
                  <div className="tanque-visual">
                    <div 
                      className="tanque-nivel"
                      style={{ 
                        height: `${tanques.tanque1 || 0}%`,
                        backgroundColor: getColorTanque(tanques.tanque1)
                      }}
                    />
                  </div>
                  <span className="tanque-label">Tanque 1</span>
                  <span className="tanque-valor">
                    {tanques.tanque1 !== null ? `${tanques.tanque1}%` : '--'}
                  </span>
                </div>
                <div className="tanque">
                  <div className="tanque-visual">
                    <div 
                      className="tanque-nivel"
                      style={{ 
                        height: `${tanques.tanque2 || 0}%`,
                        backgroundColor: getColorTanque(tanques.tanque2)
                      }}
                    />
                  </div>
                  <span className="tanque-label">Tanque 2</span>
                  <span className="tanque-valor">
                    {tanques.tanque2 !== null ? `${tanques.tanque2}%` : '--'}
                  </span>
                </div>
              </div>
            </div>

            {/* Consumo de Agua */}
            <div className="card consumo-card">
              <h3>💧 Consumo de Agua</h3>
              <div className="consumo-stats">
                <div className="consumo-item">
                  <span className="consumo-label">Hoy</span>
                  <span className="consumo-valor">{consumoAgua.diario} L</span>
                </div>
                <div className="consumo-item">
                  <span className="consumo-label">Este mes</span>
                  <span className="consumo-valor">{consumoAgua.mensual} L</span>
                </div>
                <div className="consumo-item">
                  <span className="consumo-label">Flujo actual</span>
                  <span className="consumo-valor">{consumoAgua.flujo} L/min</span>
                </div>
              </div>
            </div>

            {/* Pesajes */}
            <div className="card pesajes-card">
              <h3>⚖️ Báscula</h3>
              <div className="ultimo-peso">
                <span className="peso-valor">
                  {pesajes.ultimo ? `${pesajes.ultimo.peso} kg` : '--'}
                </span>
                <span className="peso-fecha">
                  {pesajes.ultimo 
                    ? new Date(pesajes.ultimo.createdAt).toLocaleString() 
                    : 'Sin registros'}
                </span>
              </div>
              {pesajes.historial.length > 0 && (
                <div className="historial-pesos">
                  <h4>Últimos pesajes</h4>
                  <ul>
                    {pesajes.historial.slice(0, 5).map((p, i) => (
                      <li key={i}>
                        {p.peso} kg - {new Date(p.createdAt).toLocaleDateString()}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Bombas */}
            <div className="card bombas-card">
              <h3>🔧 Control de Bombas</h3>
              <div className="bombas-grid">
                {bombas.map(bomba => (
                  <div key={bomba._id} className={`bomba ${bomba.estado ? 'encendida' : 'apagada'} ${!bomba.conectada ? 'desconectada' : ''}`}>
                    <span className="bomba-nombre">{bomba.nombre}</span>
                    <span className="bomba-estado">
                      {!bomba.conectada ? '⚫ Desconectada' : bomba.estado ? '🟢 Encendida' : '🔴 Apagada'}
                    </span>
                    <button 
                      onClick={() => toggleBomba(bomba._id)}
                      disabled={!bomba.conectada}
                      className={`btn-bomba ${bomba.estado ? 'apagar' : 'encender'}`}
                    >
                      {bomba.estado ? 'Apagar' : 'Encender'}
                    </button>
                  </div>
                ))}
                {bombas.length === 0 && (
                  <p className="sin-datos">No hay bombas configuradas</p>
                )}
              </div>
            </div>

            {/* Alertas */}
            <div className="card alertas-card">
              <h3>🔔 Alertas Recientes</h3>
              <ul className="alertas-lista">
                {alertas.map((alerta, i) => (
                  <li key={i} className={`alerta-item ${alerta.tipo}`}>
                    <span className="alerta-mensaje">{alerta.mensaje}</span>
                    <span className="alerta-fecha">
                      {new Date(alerta.createdAt).toLocaleString()}
                    </span>
                  </li>
                ))}
                {alertas.length === 0 && (
                  <li className="sin-alertas">No hay alertas recientes ✓</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER: DASHBOARD SUPERADMIN
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div className="app">
      {/* Sidebar izquierdo - Panel Contable */}
      <PanelContable />
      
      <div className="main-content">
        {/* Header */}
        <header className="header">
          <div className="header-left">
            <h1>🐷 COO ALIANZAS - Admin</h1>
            <span className="user-badge admin">👑 {usuario.nombre || usuario.usuario}</span>
          </div>
          <div className="header-right">
            <button onClick={handleLogout} className="btn-logout">
              Cerrar Sesión
            </button>
          </div>
        </header>

        {/* Stats */}
        <div className="admin-stats">
          <div className="stat-card">
            <span className="stat-valor">{farms.length}</span>
            <span className="stat-label">Granjas</span>
          </div>
          <div className="stat-card">
            <span className="stat-valor">{users.length}</span>
            <span className="stat-label">Usuarios</span>
          </div>
          <div className="stat-card">
            <span className="stat-valor">
              {sessions.filter(s => !s.fecha_salida).length}
            </span>
            <span className="stat-label">Sesiones Activas</span>
          </div>
          <div className="stat-card alerta">
            <span className="stat-valor">
              {alertas.filter(a => a.tipo === 'critica').length}
            </span>
            <span className="stat-label">Alertas Críticas</span>
          </div>
        </div>

        {/* Grid Admin */}
        <div className="admin-grid">
          {/* Granjas */}
          <div className="card">
            <h3>🏠 Granjas</h3>
            <table className="tabla-admin">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Ubicación</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {farms.map(farm => (
                  <tr key={farm._id}>
                    <td>{farm.nombre}</td>
                    <td>{farm.ubicacion}</td>
                    <td>
                      <span className={`badge ${farm.activo ? 'activo' : 'inactivo'}`}>
                        {farm.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Usuarios */}
          <div className="card">
            <h3>👥 Usuarios</h3>
            <table className="tabla-admin">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user._id}>
                    <td>{user.usuario}</td>
                    <td>{user.rol}</td>
                    <td>
                      <span className={`badge ${user.activo ? 'activo' : 'inactivo'}`}>
                        {user.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sesiones */}
          <div className="card">
            <h3>📋 Sesiones</h3>
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
                {sessions.slice(0, 10).map(session => (
                  <tr key={session._id}>
                    <td>{session.usuario}</td>
                    <td>{new Date(session.fecha_entrada).toLocaleString()}</td>
                    <td>
                      {session.fecha_salida 
                        ? new Date(session.fecha_salida).toLocaleString() 
                        : '-'}
                    </td>
                    <td>
                      <span className={`badge ${!session.fecha_salida ? 'activo' : 'inactivo'}`}>
                        {!session.fecha_salida ? 'Activa' : 'Cerrada'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Reportes */}
          <div className="card">
            <h3>📊 Reportes</h3>
            <div className="reportes-grid">
              <button onClick={() => descargarReporte('sensores')} className="btn-reporte">
                📈 Sensores
              </button>
              <button onClick={() => descargarReporte('pesajes')} className="btn-reporte">
                ⚖️ Pesajes
              </button>
              <button onClick={() => descargarReporte('agua')} className="btn-reporte">
                💧 Agua
              </button>
              <button onClick={() => descargarReporte('completo')} className="btn-reporte">
                📋 Completo
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App