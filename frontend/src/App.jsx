import { useState, useEffect } from 'react'
import axios from 'axios'
import io from 'socket.io-client'
import { 
  Thermometer, Droplets, Wind, Scale, Waves, 
  Power, PowerOff, AlertTriangle, CheckCircle, Clock,
  Users, Home, Activity, Download, Plus, Trash2, 
  UserCheck, UserX, LogOut, Bell, TrendingUp,
  Wifi, WifiOff, Sun, CloudRain, Building2,
  RefreshCw, AlertCircle, FileSpreadsheet, PiggyBank
} from 'lucide-react'
import './App.css'

// ==================== CONFIGURACIÓN ====================
const API_URL = 'https://cop-alianza-backend.onrender.com/api'
const socket = io('https://cop-alianza-backend.onrender.com')

// Coordenadas Lorica, Córdoba
const LAT = 9.2816
const LON = -75.8264

function App() {
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('login')
  const [loading, setLoading] = useState(false)
  
  // Login
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  // Estados de conexión
  const [conexiones, setConexiones] = useState({
    api_clima: false,
    sensor_porqueriza: false,
    bascula: false,
    backend: false
  })

  // Datos de sensores
  const [sensores, setSensores] = useState({
    temp_ambiente: null,
    humedad_ambiente: null,
    temp_porqueriza: null,
    humedad_porqueriza: null,
    nivel_tanque1: null,
    nivel_tanque2: null,
    flujo: null
  })

  // Datos del sistema
  const [bombas, setBombas] = useState([])
  const [alertas, setAlertas] = useState([])
  const [ultimoPeso, setUltimoPeso] = useState(null)
  const [historialPeso, setHistorialPeso] = useState([])
  const [consumoDiario, setConsumoDiario] = useState(0)
  const [consumoMensual, setConsumoMensual] = useState(0)
  const [consumoSemanal, setConsumoSemanal] = useState([])

  // Datos SuperAdmin
  const [farms, setFarms] = useState([])
  const [users, setUsers] = useState([])
  const [sessions, setSessions] = useState([])

  // ==================== EFECTOS ====================

  // Cargar usuario de localStorage al inicio
  useEffect(() => {
    const savedUser = localStorage.getItem('cooalianzas_user')
    if (savedUser) {
      const userData = JSON.parse(savedUser)
      setUser(userData)
      setPage(userData.rol === 'superadmin' ? 'superadmin' : 'cliente')
    }
  }, [])

  // Cargar clima de Lorica (API Open-Meteo)
  useEffect(() => {
    const fetchClima = async () => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m&timezone=America/Bogota`
        )
        const data = await res.json()
        if (data.current) {
          setSensores(prev => ({
            ...prev,
            temp_ambiente: data.current.temperature_2m,
            humedad_ambiente: data.current.relative_humidity_2m
          }))
          setConexiones(prev => ({ ...prev, api_clima: true }))
        }
      } catch (err) {
        console.log('Error fetching clima:', err)
        setConexiones(prev => ({ ...prev, api_clima: false }))
      }
    }
    
    fetchClima()
    const interval = setInterval(fetchClima, 5 * 60 * 1000) // Cada 5 min
    return () => clearInterval(interval)
  }, [])

  // WebSocket listeners
  useEffect(() => {
    socket.on('connect', () => {
      setConexiones(prev => ({ ...prev, backend: true }))
    })

    socket.on('disconnect', () => {
      setConexiones(prev => ({ ...prev, backend: false }))
    })

    socket.on('lectura_actualizada', (data) => {
      if (data.tipo === 'porqueriza') {
        setSensores(prev => ({
          ...prev,
          temp_porqueriza: data.temperatura,
          humedad_porqueriza: data.humedad
        }))
        setConexiones(prev => ({ ...prev, sensor_porqueriza: true }))
      }
      if (data.tipo === 'tanques') {
        setSensores(prev => ({
          ...prev,
          nivel_tanque1: data.tanque1,
          nivel_tanque2: data.tanque2
        }))
      }
    })

    socket.on('bomba_actualizada', (data) => {
      setBombas(prev => prev.map(b => b._id === data._id ? data : b))
    })

    socket.on('nueva_alerta', (data) => {
      setAlertas(prev => [data, ...prev].slice(0, 20))
    })

    socket.on('nuevo_peso', (data) => {
      setUltimoPeso(data)
      setHistorialPeso(prev => [data, ...prev].slice(0, 50))
      setConexiones(prev => ({ ...prev, bascula: true }))
    })

    return () => {
      socket.off('connect')
      socket.off('disconnect')
      socket.off('lectura_actualizada')
      socket.off('bomba_actualizada')
      socket.off('nueva_alerta')
      socket.off('nuevo_peso')
    }
  }, [])

  // Cargar datos cuando hay usuario
  useEffect(() => {
    if (user) {
      fetchAllData()
    }
  }, [user])

  // ==================== FUNCIONES API ====================

  const fetchAllData = async () => {
    try {
      const token = user?.token
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const [bombasRes, alertasRes, readingsRes] = await Promise.all([
        axios.get(`${API_URL}/motorbombs`, { headers }),
        axios.get(`${API_URL}/alerts`, { headers }),
        axios.get(`${API_URL}/sensors/readings?limit=100`, { headers })
      ])

      setBombas(bombasRes.data || [])
      setAlertas(alertasRes.data || [])

      // Procesar lecturas de sensores
      if (readingsRes.data && readingsRes.data.length > 0) {
        const lastReading = readingsRes.data[0]
        if (lastReading.temp_porqueriza) {
          setSensores(prev => ({
            ...prev,
            temp_porqueriza: lastReading.temp_porqueriza,
            humedad_porqueriza: lastReading.humedad_porqueriza,
            nivel_tanque1: lastReading.nivel_tanque1,
            nivel_tanque2: lastReading.nivel_tanque2,
            flujo: lastReading.flujo
          }))
          setConexiones(prev => ({ ...prev, sensor_porqueriza: true }))
        }
      }

      // Cargar pesajes
      try {
        const pesosRes = await axios.get(`${API_URL}/esp/pesos?limit=50`, { headers })
        if (pesosRes.data && pesosRes.data.length > 0) {
          setUltimoPeso(pesosRes.data[0])
          setHistorialPeso(pesosRes.data)
          setConexiones(prev => ({ ...prev, bascula: true }))
        }
      } catch (e) { console.log('Pesajes no disponibles') }

      // Cargar consumo de agua
      try {
        const [diarioRes, mensualRes] = await Promise.all([
          axios.get(`${API_URL}/water/diario`, { headers }),
          axios.get(`${API_URL}/water/mensual`, { headers })
        ])
        setConsumoDiario(diarioRes.data?.total || 0)
        setConsumoMensual(mensualRes.data?.total || 0)
      } catch (e) { console.log('Consumo no disponible') }

      // Si es admin, cargar datos adicionales
      if (user?.rol === 'superadmin') {
        try {
          const [farmsRes, usersRes, sessionsRes] = await Promise.all([
            axios.get(`${API_URL}/farms`, { headers }),
            axios.get(`${API_URL}/users`, { headers }),
            axios.get(`${API_URL}/sessions`, { headers })
          ])
          setFarms(farmsRes.data || [])
          setUsers(usersRes.data || [])
          setSessions(sessionsRes.data || [])
        } catch (e) { console.log('Datos admin no disponibles') }
      }

      setConexiones(prev => ({ ...prev, backend: true }))
    } catch (err) {
      console.log('Error fetching data:', err)
      setConexiones(prev => ({ ...prev, backend: false }))
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      const res = await axios.post(`${API_URL}/users/login`, { usuario, password })
      const userData = {
        usuario: res.data.usuario,
        rol: res.data.rol,
        nombre: res.data.nombre || res.data.usuario,
        token: res.data.token
      }
      setUser(userData)
      localStorage.setItem('cooalianzas_user', JSON.stringify(userData))
      setPage(userData.rol === 'superadmin' ? 'superadmin' : 'cliente')
      setError('')
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Usuario o contraseña incorrectos')
    }
    setLoading(false)
  }

  const handleLogout = async () => {
    try {
      const token = user?.token
      if (token) {
        await axios.post(`${API_URL}/users/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        })
      }
    } catch (e) { }
    
    setUser(null)
    localStorage.removeItem('cooalianzas_user')
    setPage('login')
    setUsuario('')
    setPassword('')
  }

  const toggleBomba = async (id) => {
    try {
      const token = user?.token
      const res = await axios.put(`${API_URL}/motorbombs/${id}/toggle`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      socket.emit('toggle_bomba', res.data)
      setBombas(prev => prev.map(b => b._id === id ? res.data : b))
    } catch (err) {
      console.log('Error toggling bomba:', err)
    }
  }

  const descargarReporte = async (tipo) => {
    try {
      const token = user?.token
      const res = await axios.get(`${API_URL}/reporte/excel?tipo=${tipo}`, {
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
    } catch (err) {
      console.log('Error descargando reporte:', err)
    }
  }

  // ==================== FUNCIONES AUXILIARES ====================

  const calcularSensacionTermica = (temp, humedad) => {
    if (!temp || !humedad) return null
    if (temp >= 27 && humedad >= 40) {
      const T = temp
      const H = humedad
      const st = -8.784695 + 1.61139411 * T + 2.338549 * H - 0.14611605 * T * H - 0.012308094 * T * T - 0.016424828 * H * H + 0.002211732 * T * T * H + 0.00072546 * T * H * H - 0.000003582 * T * T * H * H
      return Math.round(st * 10) / 10
    }
    return temp
  }

  const sensacionTermica = calcularSensacionTermica(sensores.temp_porqueriza, sensores.humedad_porqueriza)

  const formatFecha = (fecha) => {
    if (!fecha) return '-'
    return new Date(fecha).toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
  }

  const getTempStatus = (temp) => {
    if (!temp) return { clase: 'desconectado', texto: 'Sin datos', icono: WifiOff }
    if (temp >= 40) return { clase: 'critico', texto: 'CRÍTICO', icono: AlertTriangle }
    if (temp >= 37) return { clase: 'alerta', texto: 'Alerta', icono: AlertCircle }
    return { clase: 'normal', texto: 'Normal', icono: CheckCircle }
  }

  const tempStatus = getTempStatus(sensores.temp_porqueriza)

  // ==================== RENDER LOGIN ====================
  if (page === 'login') {
    return (
      <div className="app">
        <div className="login-container">
          <div className="login-card">
            <div className="login-header">
              <div className="login-icon">
                <PiggyBank size={40} />
              </div>
              <h1>COO ALIANZAS</h1>
              <p>Sistema de Monitoreo IoT</p>
            </div>
            <form className="login-form" onSubmit={handleLogin}>
              {error && (
                <div className="error-alert">
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}
              <div className="form-group">
                <label>Usuario</label>
                <input
                  type="text"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="Ingrese su usuario"
                  required
                />
              </div>
              <div className="form-group">
                <label>Contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingrese su contraseña"
                  required
                />
              </div>
              <button type="submit" className="btn-login" disabled={loading}>
                {loading ? (
                  <><RefreshCw size={18} className="spin" /> Ingresando...</>
                ) : (
                  <><LogOut size={18} /> Ingresar</>
                )}
              </button>
            </form>
            <div className="login-footer">
              <p>INGENIEROS OMP © 2026</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ==================== RENDER DASHBOARD CLIENTE ====================
  if (page === 'cliente') {
    return (
      <div className="app">
        <header className="header">
          <div className="header-left">
            <PiggyBank size={28} />
            <div>
              <h1>Cooperativa Alianzas</h1>
              <span className="subtitle">Sistema de Monitoreo IoT - Lorica, Córdoba</span>
            </div>
          </div>
          <div className="header-right">
            <button className="btn-refresh" onClick={fetchAllData} title="Actualizar datos">
              <RefreshCw size={18} />
            </button>
            <div className="user-info">
              <UserCheck size={18} />
              <span>{user?.nombre}</span>
            </div>
            <button className="btn-logout" onClick={handleLogout}>
              <LogOut size={18} /> Salir
            </button>
          </div>
        </header>

        <main className="dashboard">
          {/* Indicadores de conexión */}
          <div className="conexiones-bar">
            <div className={`conexion-item ${conexiones.backend ? 'conectado' : 'desconectado'}`}>
              {conexiones.backend ? <Wifi size={16} /> : <WifiOff size={16} />}
              <span>Backend</span>
            </div>
            <div className={`conexion-item ${conexiones.api_clima ? 'conectado' : 'desconectado'}`}>
              {conexiones.api_clima ? <Wifi size={16} /> : <WifiOff size={16} />}
              <span>API Clima</span>
            </div>
            <div className={`conexion-item ${conexiones.sensor_porqueriza ? 'conectado' : 'desconectado'}`}>
              {conexiones.sensor_porqueriza ? <Wifi size={16} /> : <WifiOff size={16} />}
              <span>Sensor Porqueriza</span>
            </div>
            <div className={`conexion-item ${conexiones.bascula ? 'conectado' : 'desconectado'}`}>
              {conexiones.bascula ? <Wifi size={16} /> : <WifiOff size={16} />}
              <span>Báscula</span>
            </div>
          </div>

          {/* Alerta si temperatura alta */}
          {sensores.temp_porqueriza && sensores.temp_porqueriza >= 37 && (
            <div className={`alerta-banner ${sensores.temp_porqueriza >= 40 ? 'critico' : 'alerta'}`}>
              <AlertTriangle size={24} />
              <div>
                <strong>{sensores.temp_porqueriza >= 40 ? 'ALERTA CRÍTICA' : 'ATENCIÓN'}: Temperatura Elevada</strong>
                <p>Porqueriza a {sensores.temp_porqueriza}°C {sensacionTermica && `(Sensación: ${sensacionTermica}°C)`}</p>
              </div>
            </div>
          )}

          {/* Clima */}
          <section className="section">
            <div className="section-header">
              <h2><Sun size={20} /> Condiciones Climáticas</h2>
              <span className="location-badge">
                <Building2 size={14} /> Lorica 9°16'N 75°49'W
              </span>
            </div>
            
            <div className="climate-grid">
              {/* Ambiente exterior */}
              <div className="climate-card ambiente">
                <div className="climate-header">
                  <CloudRain size={20} />
                  <span>Ambiente Exterior</span>
                  <span className={`status-badge ${conexiones.api_clima ? 'conectado' : 'desconectado'}`}>
                    {conexiones.api_clima ? <><Wifi size={14} /> En línea</> : <><WifiOff size={14} /> Sin datos</>}
                  </span>
                </div>
                <div className="climate-data">
                  <div className="climate-item">
                    <Thermometer size={28} className="icon-temp" />
                    <div className="climate-value">
                      <span className="value">{sensores.temp_ambiente ?? '--'}</span>
                      <span className="unit">°C</span>
                    </div>
                    <span className="label">Temperatura</span>
                  </div>
                  <div className="climate-item">
                    <Droplets size={28} className="icon-humidity" />
                    <div className="climate-value">
                      <span className="value">{sensores.humedad_ambiente ?? '--'}</span>
                      <span className="unit">%</span>
                    </div>
                    <span className="label">Humedad</span>
                  </div>
                </div>
              </div>

              {/* Porqueriza */}
              <div className={`climate-card porqueriza ${tempStatus.clase}`}>
                <div className="climate-header">
                  <PiggyBank size={20} />
                  <span>Porqueriza (Techo Zinc)</span>
                  <span className={`status-badge ${tempStatus.clase}`}>
                    <tempStatus.icono size={14} />
                    {tempStatus.texto}
                  </span>
                </div>
                <div className="climate-data">
                  <div className="climate-item">
                    <Thermometer size={28} className="icon-temp" />
                    <div className="climate-value">
                      <span className={`value ${tempStatus.clase}`}>{sensores.temp_porqueriza ?? '--'}</span>
                      <span className="unit">°C</span>
                    </div>
                    <span className="label">Temperatura</span>
                  </div>
                  <div className="climate-item">
                    <Droplets size={28} className="icon-humidity" />
                    <div className="climate-value">
                      <span className="value">{sensores.humedad_porqueriza ?? '--'}</span>
                      <span className="unit">%</span>
                    </div>
                    <span className="label">Humedad</span>
                  </div>
                  <div className="climate-item">
                    <Wind size={28} className="icon-wind" />
                    <div className="climate-value">
                      <span className={`value ${sensacionTermica && sensacionTermica >= 45 ? 'critico' : sensacionTermica >= 40 ? 'alerta' : ''}`}>
                        {sensacionTermica ?? '--'}
                      </span>
                      <span className="unit">°C</span>
                    </div>
                    <span className="label">Sensación</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Tanques y Consumo */}
          <section className="section">
            <div className="section-header">
              <h2><Waves size={20} /> Agua y Consumo</h2>
            </div>
            
            <div className="water-grid">
              <div className="card tanques-card">
                <h3><Waves size={18} /> Nivel de Tanques</h3>
                <div className="tanques-container">
                  <div className="tanque">
                    <div className="tanque-visual">
                      <div 
                        className={`tanque-nivel ${(sensores.nivel_tanque1 || 0) < 30 ? 'bajo' : (sensores.nivel_tanque1 || 0) < 50 ? 'medio' : 'alto'}`}
                        style={{ height: `${sensores.nivel_tanque1 || 0}%` }}
                      ></div>
                    </div>
                    <div className="tanque-info">
                      <span className="tanque-nombre">Principal</span>
                      <span className="tanque-porcentaje">{sensores.nivel_tanque1 ?? '--'}%</span>
                    </div>
                  </div>
                  <div className="tanque">
                    <div className="tanque-visual">
                      <div 
                        className={`tanque-nivel ${(sensores.nivel_tanque2 || 0) < 30 ? 'bajo' : (sensores.nivel_tanque2 || 0) < 50 ? 'medio' : 'alto'}`}
                        style={{ height: `${sensores.nivel_tanque2 || 0}%` }}
                      ></div>
                    </div>
                    <div className="tanque-info">
                      <span className="tanque-nombre">Reserva</span>
                      <span className="tanque-porcentaje">{sensores.nivel_tanque2 ?? '--'}%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card consumo-card">
                <h3><TrendingUp size={18} /> Consumo de Agua</h3>
                <div className="consumo-stats">
                  <div className="consumo-item">
                    <span className="consumo-label">Hoy</span>
                    <span className="consumo-value">{consumoDiario.toLocaleString()} L</span>
                  </div>
                  <div className="consumo-item">
                    <span className="consumo-label">Este mes</span>
                    <span className="consumo-value">{consumoMensual.toLocaleString()} L</span>
                  </div>
                  <div className="consumo-item">
                    <span className="consumo-label">Flujo actual</span>
                    <span className="consumo-value">{sensores.flujo ?? '--'} L/min</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Báscula */}
          <section className="section">
            <div className="section-header">
              <h2><Scale size={20} /> Sistema de Pesaje</h2>
            </div>
            
            <div className="pesaje-grid">
              <div className="card peso-actual-card">
                <h3><Scale size={18} /> Último Pesaje</h3>
                <div className="peso-display">
                  <span className="peso-valor">{ultimoPeso?.peso ?? '--'}</span>
                  <span className="peso-unidad">kg</span>
                </div>
                {ultimoPeso && (
                  <div className="peso-info">
                    <span className="peso-tipo">
                      {ultimoPeso.peso >= 50 ? '🐷 Cerda adulta' : '🐽 Lechón'}
                    </span>
                    <span className="peso-fecha">{formatFecha(ultimoPeso.fecha || ultimoPeso.createdAt)}</span>
                  </div>
                )}
              </div>

              <div className="card historial-peso-card">
                <h3><Activity size={18} /> Historial de Pesajes</h3>
                <div className="tabla-scroll">
                  <table className="tabla-pesajes">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Peso</th>
                        <th>Tipo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historialPeso.length === 0 ? (
                        <tr><td colSpan="3" style={{textAlign:'center'}}>Sin datos de pesaje</td></tr>
                      ) : (
                        historialPeso.slice(0, 10).map((p, i) => (
                          <tr key={p._id || i}>
                            <td>{formatFecha(p.fecha || p.createdAt)}</td>
                            <td><strong>{p.peso} kg</strong></td>
                            <td>
                              <span className={`tipo-badge ${p.peso >= 50 ? 'adulta' : 'lechon'}`}>
                                {p.peso >= 50 ? 'Cerda adulta' : 'Lechón'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          {/* Control de Bombas */}
          <section className="section">
            <div className="section-header">
              <h2><Power size={20} /> Control de Bombas</h2>
            </div>
            
            <div className="bombas-grid">
              {bombas.length === 0 ? (
                <p>No hay bombas registradas</p>
              ) : (
                bombas.map((bomba) => (
                  <div key={bomba._id} className={`bomba-card ${!bomba.conectada ? 'desconectada' : bomba.estado ? 'encendida' : 'apagada'}`}>
                    <div className="bomba-header">
                      {bomba.conectada !== false ? (
                        bomba.estado ? <Power size={24} className="icon-on" /> : <PowerOff size={24} className="icon-off" />
                      ) : (
                        <WifiOff size={24} className="icon-disconnected" />
                      )}
                      <span className="bomba-nombre">{bomba.nombre}</span>
                    </div>
                    <div className="bomba-status">
                      {bomba.conectada === false ? (
                        <span className="status desconectada">Sin conexión</span>
                      ) : bomba.estado ? (
                        <span className="status encendida">ENCENDIDA</span>
                      ) : (
                        <span className="status apagada">Apagada</span>
                      )}
                    </div>
                    <button 
                      className={`btn-bomba ${bomba.estado ? 'apagar' : 'encender'}`}
                      onClick={() => toggleBomba(bomba._id)}
                      disabled={bomba.conectada === false}
                    >
                      {bomba.conectada === false ? 'No disponible' : (bomba.estado ? 'Apagar' : 'Encender')}
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Alertas */}
          <section className="section">
            <div className="section-header">
              <h2><Bell size={20} /> Alertas Recientes</h2>
            </div>
            
            <div className="alertas-lista">
              {alertas.length === 0 ? (
                <p className="no-data">No hay alertas recientes</p>
              ) : (
                alertas.slice(0, 5).map((alerta) => (
                  <div key={alerta._id} className={`alerta-item ${alerta.critica || alerta.tipo === 'critica' ? 'critica' : ''}`}>
                    <div className="alerta-icon">
                      {alerta.critica || alerta.tipo === 'critica' ? <AlertTriangle size={20} /> : <AlertCircle size={20} />}
                    </div>
                    <div className="alerta-content">
                      <p className="alerta-mensaje">{alerta.mensaje}</p>
                      <span className="alerta-fecha">{formatFecha(alerta.fecha || alerta.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </main>
      </div>
    )
  }

  // ==================== RENDER DASHBOARD SUPERADMIN ====================
  if (page === 'superadmin') {
    const sesionesActivas = sessions.filter(s => !s.fecha_salida && s.activa !== false).length

    return (
      <div className="app">
        <header className="header superadmin">
          <div className="header-left">
            <PiggyBank size={28} />
            <div>
              <h1>COO ALIANZAS</h1>
              <span className="subtitle">Panel de Administración</span>
            </div>
          </div>
          <div className="header-right">
            <button className="btn-nav" onClick={() => setPage('cliente')}>
              <Activity size={18} /> Ver Dashboard
            </button>
            <button className="btn-refresh" onClick={fetchAllData} title="Actualizar datos">
              <RefreshCw size={18} />
            </button>
            <div className="user-info admin">
              <UserCheck size={18} />
              <span>{user?.nombre}</span>
              <span className="badge-admin">Admin</span>
            </div>
            <button className="btn-logout" onClick={handleLogout}>
              <LogOut size={18} /> Salir
            </button>
          </div>
        </header>

        <main className="dashboard admin">
          {/* Stats Cards */}
          <div className="admin-stats">
            <div className="stat-card">
              <Home size={24} />
              <div>
                <span className="stat-value">{farms.length}</span>
                <span className="stat-label">Granjas</span>
              </div>
            </div>
            <div className="stat-card">
              <Users size={24} />
              <div>
                <span className="stat-value">{users.length}</span>
                <span className="stat-label">Usuarios</span>
              </div>
            </div>
            <div className="stat-card activo">
              <Activity size={24} />
              <div>
                <span className="stat-value">{sesionesActivas}</span>
                <span className="stat-label">En línea</span>
              </div>
            </div>
            <div className="stat-card alerta">
              <AlertTriangle size={24} />
              <div>
                <span className="stat-value">{alertas.filter(a => a.critica || a.tipo === 'critica').length}</span>
                <span className="stat-label">Alertas</span>
              </div>
            </div>
          </div>

          {/* Granjas */}
          <section className="section">
            <div className="section-header">
              <h2><Home size={20} /> Granjas Registradas</h2>
            </div>
            
            <div className="tabla-container">
              <table className="tabla-admin">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Ubicación</th>
                    <th>Propietario</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {farms.length === 0 ? (
                    <tr><td colSpan="4" style={{textAlign:'center'}}>No hay granjas registradas</td></tr>
                  ) : (
                    farms.map((farm) => (
                      <tr key={farm._id}>
                        <td><strong>{farm.nombre}</strong></td>
                        <td>{farm.ubicacion}</td>
                        <td>{farm.propietario}</td>
                        <td>
                          <span className={`estado-badge ${farm.activo !== false ? 'activo' : 'inactivo'}`}>
                            {farm.activo !== false ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Usuarios */}
          <section className="section">
            <div className="section-header">
              <h2><Users size={20} /> Gestión de Usuarios</h2>
            </div>
            
            <div className="tabla-container">
              <table className="tabla-admin">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Correo</th>
                    <th>Rol</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr><td colSpan="4" style={{textAlign:'center'}}>No hay usuarios</td></tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u._id}>
                        <td><strong>{u.usuario}</strong></td>
                        <td>{u.correo}</td>
                        <td>
                          <span className={`rol-badge ${u.rol}`}>
                            {u.rol === 'superadmin' ? 'Admin' : 'Cliente'}
                          </span>
                        </td>
                        <td>
                          <span className={`estado-badge ${u.activo !== false ? 'activo' : 'inactivo'}`}>
                            {u.activo !== false ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Sesiones */}
          <section className="section">
            <div className="section-header">
              <h2><Clock size={20} /> Historial de Sesiones</h2>
            </div>
            
            <div className="tabla-container">
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
                  {sessions.length === 0 ? (
                    <tr><td colSpan="4" style={{textAlign:'center'}}>No hay sesiones</td></tr>
                  ) : (
                    sessions.slice(0, 10).map((s) => (
                      <tr key={s._id}>
                        <td><strong>{s.usuario}</strong></td>
                        <td>{formatFecha(s.fecha_entrada)}</td>
                        <td>{s.fecha_salida ? formatFecha(s.fecha_salida) : '-'}</td>
                        <td>
                          <span className={`estado-badge ${s.fecha_salida || s.activa === false ? 'cerrada' : 'activo'}`}>
                            {s.fecha_salida || s.activa === false ? 'Cerrada' : 'En línea'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Reportes */}
          <section className="section">
            <div className="section-header">
              <h2><FileSpreadsheet size={20} /> Reportes</h2>
            </div>
            
            <div className="reportes-grid">
              <button className="btn-reporte" onClick={() => descargarReporte('sensores')}>
                <Download size={20} />
                <span>Exportar Datos Sensores</span>
              </button>
              <button className="btn-reporte" onClick={() => descargarReporte('pesajes')}>
                <Download size={20} />
                <span>Exportar Pesajes</span>
              </button>
              <button className="btn-reporte" onClick={() => descargarReporte('agua')}>
                <Download size={20} />
                <span>Exportar Consumo Agua</span>
              </button>
              <button className="btn-reporte" onClick={() => descargarReporte('completo')}>
                <Download size={20} />
                <span>Reporte Completo</span>
              </button>
            </div>
          </section>
        </main>
      </div>
    )
  }

  return null
}

export default App