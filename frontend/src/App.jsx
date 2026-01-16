import { useState, useEffect } from 'react'
import axios from 'axios'
import io from 'socket.io-client'
import { 
  Thermometer, Droplets, Wind, Gauge, Scale, Waves, 
  Power, PowerOff, AlertTriangle, CheckCircle, Clock,
  Users, Home, Activity, Download, Plus, Trash2, 
  UserCheck, UserX, LogOut, Settings, Bell, TrendingUp,
  Wifi, WifiOff, Sun, CloudRain, Building2, PiggyBank
} from 'lucide-react'
import './App.css'

const API_URL = 'https://cop-alianza-backend.onrender.com/api'
const socket = io('https://cop-alianza-backend.onrender.com')

const LAT = 9.2816
const LON = -75.8264

function App() {
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('login')
  
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showError, setShowError] = useState(false)
  
  // Datos de sensores
  const [sensores, setSensores] = useState({
    temp_ambiente: null,
    humedad_ambiente: null,
    temp_porqueriza: null,
    humedad_porqueriza: null,
    nivel_tanque1: 65,
    nivel_tanque2: 58,
    flujo: 12.5,
    peso: 85.3
  })
  
  const [bombas, setBombas] = useState([
    { _id: '1', nombre: 'Bomba Principal', estado: false, conectada: true },
    { _id: '2', nombre: 'Bomba Reserva', estado: false, conectada: true },
    { _id: '3', nombre: 'Bomba Riego 1', estado: false, conectada: true },
    { _id: '4', nombre: 'Bomba Riego 2', estado: false, conectada: false }
  ])
  
  const [alertas, setAlertas] = useState([])
  const [farms, setFarms] = useState([])
  const [users, setUsers] = useState([])
  const [sessions, setSessions] = useState([])
  const [consumoDiario, setConsumoDiario] = useState(847)
  const [consumoMensual, setConsumoMensual] = useState(12580)
  
  const [historialTemp, setHistorialTemp] = useState([31, 32, 34, 35, 34, 33, 32])
  const [historialAgua, setHistorialAgua] = useState([780, 920, 850, 1100, 890, 950, 847])
  const [historialPeso, setHistorialPeso] = useState([
    { fecha: '15/11', peso: 42.3, cantidad: 8 },
    { fecha: '22/11', peso: 48.7, cantidad: 10 },
    { fecha: '05/12', peso: 55.2, cantidad: 12 },
    { fecha: '18/12', peso: 63.8, cantidad: 9 },
    { fecha: '02/01', peso: 71.4, cantidad: 14 },
    { fecha: '08/01', peso: 78.9, cantidad: 11 },
    { fecha: 'Hoy', peso: 85.3, cantidad: 13 }
  ])
  
  const [showModalUser, setShowModalUser] = useState(false)
  const [showModalFarm, setShowModalFarm] = useState(false)
  const [newUser, setNewUser] = useState({ usuario: '', correo: '', password: '', rol: 'cliente' })
  const [newFarm, setNewFarm] = useState({ nombre: '', ubicacion: '', propietario: '', telefono: '', email: '' })

  // Obtener clima real de Lorica
  const fetchWeather = async () => {
    try {
      const res = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m&timezone=America/Bogota`)
      const temp = res.data.current.temperature_2m
      const hum = res.data.current.relative_humidity_2m
      setSensores(prev => ({ 
        ...prev, 
        temp_ambiente: temp, 
        humedad_ambiente: hum,
        // Simular temp porqueriza (ambiente + 2-4 grados por los animales)
        temp_porqueriza: prev.temp_porqueriza || Math.round((temp + 2.5) * 10) / 10,
        humedad_porqueriza: prev.humedad_porqueriza || Math.round((hum + 5) * 10) / 10
      }))
    } catch (err) {
      console.log('Error fetching weather')
    }
  }

  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
      setPage('dashboard')
    }

    socket.on('lectura_actualizada', (data) => {
      setSensores(prev => ({ ...prev, ...data }))
    })

    socket.on('bomba_actualizada', (data) => {
      setBombas(prev => prev.map(b => b._id === data._id ? data : b))
    })

    socket.on('nueva_alerta', (data) => {
      setAlertas(prev => [data, ...prev])
    })

    // Recibir datos del ESP32
    socket.on('esp_riego', (data) => {
      setSensores(prev => ({
        ...prev,
        temp_porqueriza: data.temperatura,
        humedad_porqueriza: data.humedad,
        nivel_tanque1: data.nivel_tanque1 || prev.nivel_tanque1,
        nivel_tanque2: data.nivel_tanque2 || prev.nivel_tanque2
      }))
    })

    socket.on('esp_peso', (data) => {
      setSensores(prev => ({ ...prev, peso: data.peso }))
    })

    return () => {
      socket.off('lectura_actualizada')
      socket.off('bomba_actualizada')
      socket.off('nueva_alerta')
      socket.off('esp_riego')
      socket.off('esp_peso')
    }
  }, [])

  useEffect(() => {
    if (user) {
      fetchData()
      if (user.rol === 'cliente') {
        fetchWeather()
        const interval = setInterval(fetchWeather, 300000)
        return () => clearInterval(interval)
      }
    }
  }, [user])

  const fetchData = async () => {
    try {
      if (user.rol === 'superadmin') {
        const [farmsRes, usersRes, sessionsRes] = await Promise.all([
          axios.get(`${API_URL}/farms`),
          axios.get(`${API_URL}/users`),
          axios.get(`${API_URL}/sessions`)
        ])
        setFarms(farmsRes.data)
        setUsers(usersRes.data)
        setSessions(sessionsRes.data)
      } else {
        const [bombasRes, alertasRes, diarioRes, mensualRes] = await Promise.all([
          axios.get(`${API_URL}/motorbombs`),
          axios.get(`${API_URL}/alerts`),
          axios.get(`${API_URL}/water/diario`),
          axios.get(`${API_URL}/water/mensual`)
        ])
        if (bombasRes.data.length > 0) setBombas(prev => bombasRes.data.map((b, i) => ({...b, conectada: prev[i]?.conectada ?? true})))
        if (alertasRes.data.length > 0) setAlertas(alertasRes.data)
        if (diarioRes.data.litros_total > 0) setConsumoDiario(diarioRes.data.litros_total)
        if (mensualRes.data.litros_total > 0) setConsumoMensual(mensualRes.data.litros_total)
      }
    } catch (err) {
      console.log('Error fetching data')
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    try {
      const res = await axios.post(`${API_URL}/users/login`, { usuario, password })
      const userData = { usuario: res.data.usuario, rol: res.data.rol, token: res.data.token, session_id: res.data.session_id }
      setUser(userData)
      localStorage.setItem('user', JSON.stringify(userData))
      setPage('dashboard')
      setError('')
      setShowError(false)
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error de conexión')
      setShowError(true)
      setTimeout(() => setShowError(false), 4000)
    }
  }

  const handleLogout = async () => {
    try {
      const savedUser = JSON.parse(localStorage.getItem('user'))
      if (savedUser?.session_id) {
        await axios.put(`${API_URL}/sessions/${savedUser.session_id}/logout`)
      }
    } catch (err) {
      console.log('Error closing session')
    }
    setUser(null)
    localStorage.removeItem('user')
    setPage('login')
  }

  const toggleBomba = async (id) => {
    setBombas(prev => prev.map(b => b._id === id ? { ...b, estado: !b.estado } : b))
    try {
      const res = await axios.put(`${API_URL}/motorbombs/${id}/toggle`)
      socket.emit('toggle_bomba', res.data)
    } catch (err) {
      console.log('Bomba toggle local')
    }
  }

  const toggleUserActive = async (id) => {
    try {
      const res = await axios.put(`${API_URL}/users/${id}/toggle`)
      setUsers(prev => prev.map(u => u._id === id ? res.data : u))
    } catch (err) {
      console.log('Error toggling user')
    }
  }

  const deleteUser = async (id) => {
    if (!confirm('¿Eliminar este usuario?')) return
    try {
      await axios.delete(`${API_URL}/users/${id}`)
      setUsers(prev => prev.filter(u => u._id !== id))
    } catch (err) {
      console.log('Error deleting user')
    }
  }

  const toggleFarmActive = async (id) => {
    try {
      const res = await axios.put(`${API_URL}/farms/${id}/toggle`)
      setFarms(prev => prev.map(f => f._id === id ? res.data : f))
    } catch (err) {
      console.log('Error toggling farm')
    }
  }

  const deleteFarm = async (id) => {
    if (!confirm('¿Eliminar esta granja?')) return
    try {
      await axios.delete(`${API_URL}/farms/${id}`)
      setFarms(prev => prev.filter(f => f._id !== id))
    } catch (err) {
      console.log('Error deleting farm')
    }
  }

  const createUser = async (e) => {
    e.preventDefault()
    try {
      await axios.post(`${API_URL}/users/register`, newUser)
      setShowModalUser(false)
      setNewUser({ usuario: '', correo: '', password: '', rol: 'cliente' })
      fetchData()
    } catch (err) {
      alert('Error creando usuario')
    }
  }

  const createFarm = async (e) => {
    e.preventDefault()
    try {
      await axios.post(`${API_URL}/farms`, newFarm)
      setShowModalFarm(false)
      setNewFarm({ nombre: '', ubicacion: '', propietario: '', telefono: '', email: '' })
      fetchData()
    } catch (err) {
      alert('Error creando granja')
    }
  }

  const downloadExcel = () => {
    const data = users.map(u => `${u.usuario},${u.correo},${u.rol},${u.activo ? 'Activo' : 'Inactivo'}`).join('\n')
    const csv = `Usuario,Correo,Rol,Estado\n${data}`
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'reporte_usuarios.csv'
    a.click()
  }

  const downloadExcelCliente = () => {
    const header = 'Reporte Granja Porcina COO-Alianzas\nFecha: ' + new Date().toLocaleString() + '\n\n'
    const clima = `CLIMA\nTemp Ambiente,${sensores.temp_ambiente}°C\nTemp Porqueriza,${sensores.temp_porqueriza}°C\nHumedad Ambiente,${sensores.humedad_ambiente}%\nHumedad Porqueriza,${sensores.humedad_porqueriza}%\n\n`
    const agua = `CONSUMO AGUA\nDiario,${consumoDiario} L\nMensual,${consumoMensual} L\n\n`
    const tanques = `TANQUES\nPrincipal,${sensores.nivel_tanque1}%\nReserva,${sensores.nivel_tanque2}%\n\n`
    
    const csv = header + clima + agua + tanques
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'reporte_granja.csv'
    a.click()
  }

  const enviarReporteEmail = async () => {
    try {
      await axios.post(`${API_URL}/email/reporte`, {
        destinatario: 'osmapeing@gmail.com',
        asunto: 'Reporte Diario - Granja COO-Alianzas',
        datos: {
          'Temperatura Ambiente': `${sensores.temp_ambiente}°C`,
          'Temperatura Porqueriza': `${sensores.temp_porqueriza}°C`,
          'Humedad': `${sensores.humedad_ambiente}%`,
          'Consumo Agua Diario': `${consumoDiario} L`,
          'Consumo Agua Mensual': `${consumoMensual} L`,
          'Nivel Tanque 1': `${sensores.nivel_tanque1}%`,
          'Nivel Tanque 2': `${sensores.nivel_tanque2}%`
        }
      })
      alert('Reporte enviado al correo')
    } catch (err) {
      alert('Error enviando reporte')
    }
  }

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

  const getTemperaturaStatus = (temp) => {
    if (!temp) return { clase: '', texto: 'Sin datos', icono: Thermometer }
    if (temp > 34) return { clase: 'danger', texto: 'Crítica', icono: AlertTriangle }
    if (temp > 30) return { clase: 'warning', texto: 'Alta', icono: TrendingUp }
    return { clase: 'success', texto: 'Normal', icono: CheckCircle }
  }

  // LOGIN
  if (page === 'login') {
    return (
      <div className="app">
        <div className="login-container">
          <div className="login-card">
            <div className="login-header">
              <div className="login-icon">
                <PiggyBank size={48} />
              </div>
              <h1>COP Alianza</h1>
              <p>Sistema de Monitoreo Inteligente</p>
            </div>
            
            <form onSubmit={handleLogin} className="login-form">
              {showError && (
                <div className="error-alert">
                  <AlertTriangle size={18} />
                  <span>{error}</span>
                </div>
              )}
              
              <div className="form-group">
                <label>Usuario</label>
                <input
                  type="text"
                  placeholder="Ingrese su usuario"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Contraseña</label>
                <input
                  type="password"
                  placeholder="Ingrese su contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              
              <button type="submit" className="btn-primary">
                Ingresar al Sistema
              </button>
            </form>
            
            <div className="login-footer">
              <p>Cooperativa Alianzas - Lorica, Córdoba</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // SUPERADMIN
  if (user?.rol === 'superadmin') {
    return (
      <div className="app">
        <header className="header">
          <div className="header-brand">
            <PiggyBank size={32} />
            <div>
              <h1>COP Alianza</h1>
              <span className="header-subtitle">Panel Administrativo</span>
            </div>
          </div>
          <div className="header-actions">
            <div className="user-info">
              <Users size={18} />
              <span>{user?.usuario}</span>
            </div>
            <button onClick={handleLogout} className="btn-logout">
              <LogOut size={18} />
              <span>Salir</span>
            </button>
          </div>
        </header>

        <main className="main-content">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon farms">
                <Home size={24} />
              </div>
              <div className="stat-info">
                <h3>{farms.length}</h3>
                <p>Granjas</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon users">
                <Users size={24} />
              </div>
              <div className="stat-info">
                <h3>{users.length}</h3>
                <p>Usuarios</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon active">
                <UserCheck size={24} />
              </div>
              <div className="stat-info">
                <h3>{users.filter(u => u.activo).length}</h3>
                <p>Activos</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon sessions">
                <Activity size={24} />
              </div>
              <div className="stat-info">
                <h3>{sessions.filter(s => !s.fecha_salida).length}</h3>
                <p>En línea</p>
              </div>
            </div>
          </div>

          <section className="section">
            <div className="section-header">
              <h2><Home size={20} /> Gestión de Granjas</h2>
              <button onClick={() => setShowModalFarm(true)} className="btn-add">
                <Plus size={18} />
                Nueva Granja
              </button>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Ubicación</th>
                    <th>Propietario</th>
                    <th>Teléfono</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {farms.length === 0 ? (
                    <tr><td colSpan="6" className="empty-row">No hay granjas registradas</td></tr>
                  ) : (
                    farms.map(farm => (
                      <tr key={farm._id}>
                        <td className="cell-main">{farm.nombre}</td>
                        <td>{farm.ubicacion}</td>
                        <td>{farm.propietario}</td>
                        <td>{farm.telefono}</td>
                        <td>
                          <span className={`badge ${farm.activo ? 'badge-success' : 'badge-danger'}`}>
                            {farm.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="cell-actions">
                          <button onClick={() => toggleFarmActive(farm._id)} className="btn-icon">
                            {farm.activo ? <UserX size={16} /> : <UserCheck size={16} />}
                          </button>
                          <button onClick={() => deleteFarm(farm._id)} className="btn-icon danger">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="section">
            <div className="section-header">
              <h2><Users size={20} /> Gestión de Usuarios</h2>
              <div className="section-actions">
                <button onClick={downloadExcel} className="btn-secondary">
                  <Download size={18} />
                  Exportar
                </button>
                <button onClick={() => setShowModalUser(true)} className="btn-add">
                  <Plus size={18} />
                  Nuevo Usuario
                </button>
              </div>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Correo</th>
                    <th>Rol</th>
                    <th>Último Acceso</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u._id}>
                      <td className="cell-main">{u.usuario}</td>
                      <td>{u.correo}</td>
                      <td>
                        <span className={`badge ${u.rol === 'superadmin' ? 'badge-admin' : 'badge-client'}`}>
                          {u.rol}
                        </span>
                      </td>
                      <td>{u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString() : 'Nunca'}</td>
                      <td>
                        <span className={`badge ${u.activo ? 'badge-success' : 'badge-danger'}`}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="cell-actions">
                        <button onClick={() => toggleUserActive(u._id)} className="btn-icon">
                          {u.activo ? <UserX size={16} /> : <UserCheck size={16} />}
                        </button>
                        <button onClick={() => deleteUser(u._id)} className="btn-icon danger">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="section">
            <div className="section-header">
              <h2><Clock size={20} /> Historial de Sesiones</h2>
            </div>
            <div className="table-container">
              <table>
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
                    <tr><td colSpan="4" className="empty-row">No hay sesiones registradas</td></tr>
                  ) : (
                    sessions.slice(0, 15).map(s => (
                      <tr key={s._id}>
                        <td className="cell-main">{s.usuario}</td>
                        <td>{new Date(s.fecha_entrada).toLocaleString()}</td>
                        <td>{s.fecha_salida ? new Date(s.fecha_salida).toLocaleString() : '-'}</td>
                        <td>
                          <span className={`badge ${s.fecha_salida ? 'badge-neutral' : 'badge-success'}`}>
                            {s.fecha_salida ? 'Cerrada' : 'Activa'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>

        {showModalUser && (
          <div className="modal-overlay" onClick={() => setShowModalUser(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>Nuevo Usuario</h2>
              <form onSubmit={createUser}>
                <div className="form-group">
                  <label>Usuario</label>
                  <input placeholder="Nombre de usuario" value={newUser.usuario} onChange={e => setNewUser({...newUser, usuario: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Correo</label>
                  <input type="email" placeholder="correo@ejemplo.com" value={newUser.correo} onChange={e => setNewUser({...newUser, correo: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Contraseña</label>
                  <input type="password" placeholder="Contraseña segura" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Rol</label>
                  <select value={newUser.rol} onChange={e => setNewUser({...newUser, rol: e.target.value})}>
                    <option value="cliente">Cliente</option>
                    <option value="superadmin">SuperAdmin</option>
                  </select>
                </div>
                <div className="modal-actions">
                  <button type="button" onClick={() => setShowModalUser(false)} className="btn-secondary">Cancelar</button>
                  <button type="submit" className="btn-primary">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showModalFarm && (
          <div className="modal-overlay" onClick={() => setShowModalFarm(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>Nueva Granja</h2>
              <form onSubmit={createFarm}>
                <div className="form-group">
                  <label>Nombre</label>
                  <input placeholder="Nombre de la granja" value={newFarm.nombre} onChange={e => setNewFarm({...newFarm, nombre: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Ubicación</label>
                  <input placeholder="Ciudad, Departamento" value={newFarm.ubicacion} onChange={e => setNewFarm({...newFarm, ubicacion: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Propietario</label>
                  <input placeholder="Nombre del propietario" value={newFarm.propietario} onChange={e => setNewFarm({...newFarm, propietario: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Teléfono</label>
                  <input placeholder="Número de contacto" value={newFarm.telefono} onChange={e => setNewFarm({...newFarm, telefono: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" placeholder="correo@ejemplo.com" value={newFarm.email} onChange={e => setNewFarm({...newFarm, email: e.target.value})} />
                </div>
                <div className="modal-actions">
                  <button type="button" onClick={() => setShowModalFarm(false)} className="btn-secondary">Cancelar</button>
                  <button type="submit" className="btn-primary">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }

  // CLIENTE
  const tempStatus = getTemperaturaStatus(sensores.temp_porqueriza)
  
  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <PiggyBank size={32} />
          <div>
            <h1>Cooperativa Alianzas</h1>
            <span className="header-subtitle">Granja Porcina - Lorica, Córdoba</span>
          </div>
        </div>
        <div className="header-actions">
          <button onClick={enviarReporteEmail} className="btn-secondary">
            <Bell size={18} />
            <span>Enviar Reporte</span>
          </button>
          <button onClick={downloadExcelCliente} className="btn-secondary">
            <Download size={18} />
            <span>Descargar</span>
          </button>
          <div className="user-info">
            <Users size={18} />
            <span>{user?.usuario}</span>
          </div>
          <button onClick={handleLogout} className="btn-logout">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="main-content">
        {/* Clima */}
        <section className="section">
          <div className="section-header">
            <h2><Sun size={20} /> Condiciones Climáticas</h2>
            <span className="location-badge">
              <Building2 size={14} />
              9°16'N 75°49'W
            </span>
          </div>
          
          <div className="climate-grid">
            <div className="climate-card ambiente">
              <div className="climate-header">
                <CloudRain size={20} />
                <span>Ambiente Exterior</span>
              </div>
              <div className="climate-data">
                <div className="climate-item">
                  <Thermometer size={24} />
                  <div>
                    <span className="value">{sensores.temp_ambiente ?? '--'}</span>
                    <span className="unit">°C</span>
                  </div>
                  <span className="label">Temperatura</span>
                </div>
                <div className="climate-item">
                  <Droplets size={24} />
                  <div>
                    <span className="value">{sensores.humedad_ambiente ?? '--'}</span>
                    <span className="unit">%</span>
                  </div>
                  <span className="label">Humedad</span>
                </div>
              </div>
            </div>

            <div className={`climate-card porqueriza ${tempStatus.clase}`}>
              <div className="climate-header">
                <PiggyBank size={20} />
                <span>Porqueriza</span>
                {sensores.temp_porqueriza && (
                  <span className={`status-badge ${tempStatus.clase}`}>
                    <tempStatus.icono size={14} />
                    {tempStatus.texto}
                  </span>
                )}
              </div>
              <div className="climate-data">
                <div className="climate-item">
                  <Thermometer size={24} />
                  <div>
                    <span className="value">{sensores.temp_porqueriza ?? '--'}</span>
                    <span className="unit">°C</span>
                  </div>
                  <span className="label">Temperatura</span>
                </div>
                <div className="climate-item">
                  <Droplets size={24} />
                  <div>
                    <span className="value">{sensores.humedad_porqueriza ?? '--'}</span>
                    <span className="unit">%</span>
                  </div>
                  <span className="label">Humedad</span>
                </div>
                <div className="climate-item">
                  <Wind size={24} />
                  <div>
                    <span className="value">{sensacionTermica ?? '--'}</span>
                    <span className="unit">°C</span>
                  </div>
                  <span className="label">Sensación</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Monitoreo */}
        <section className="section">
          <div className="section-header">
            <h2><Gauge size={20} /> Monitoreo de Instalaciones</h2>
          </div>
          
          <div className="monitor-grid">
            <div className="monitor-card">
              <div className="monitor-icon">
                <Waves size={24} />
              </div>
              <div className="monitor-info">
                <span className="monitor-value">{sensores.nivel_tanque1}%</span>
                <span className="monitor-label">Tanque Principal</span>
                <div className="progress-bar">
                  <div className="progress-fill" style={{width: `${sensores.nivel_tanque1}%`}}></div>
                </div>
              </div>
            </div>

            <div className="monitor-card">
              <div className="monitor-icon">
                <Waves size={24} />
              </div>
              <div className="monitor-info">
                <span className="monitor-value">{sensores.nivel_tanque2}%</span>
                <span className="monitor-label">Tanque Reserva</span>
                <div className="progress-bar">
                  <div className="progress-fill" style={{width: `${sensores.nivel_tanque2}%`}}></div>
                </div>
              </div>
            </div>

            <div className="monitor-card">
              <div className="monitor-icon">
                <Scale size={24} />
              </div>
              <div className="monitor-info">
                <span className="monitor-value">{sensores.peso} kg</span>
                <span className="monitor-label">Último Pesaje</span>
              </div>
            </div>

            <div className="monitor-card">
              <div className="monitor-icon">
                <Droplets size={24} />
              </div>
              <div className="monitor-info">
                <span className="monitor-value">{consumoDiario} L</span>
                <span className="monitor-label">Consumo Hoy</span>
              </div>
            </div>

            <div className="monitor-card">
              <div className="monitor-icon">
                <TrendingUp size={24} />
              </div>
              <div className="monitor-info">
                <span className="monitor-value">{consumoMensual.toLocaleString()} L</span>
                <span className="monitor-label">Consumo Mensual</span>
              </div>
            </div>

            <div className="monitor-card">
              <div className="monitor-icon">
                <Activity size={24} />
              </div>
              <div className="monitor-info">
                <span className="monitor-value">{sensores.flujo} L/min</span>
                <span className="monitor-label">Flujo Actual</span>
              </div>
            </div>
          </div>
        </section>

        {/* Gráficas */}
        <section className="section">
          <div className="section-header">
            <h2><TrendingUp size={20} /> Historial y Tendencias</h2>
          </div>
          
          <div className="charts-grid">
            <div className="chart-card">
              <h3>Temperatura Porqueriza (7 horas)</h3>
              <div className="chart-bars">
                {historialTemp.map((val, i) => (
                  <div key={i} className="chart-bar-container">
                    <div 
                      className={`chart-bar ${val > 34 ? 'danger' : val > 30 ? 'warning' : ''}`} 
                      style={{height: `${(val/40)*100}%`}}
                    >
                      <span className="bar-value">{val}°</span>
                    </div>
                    <span className="bar-label">{['6h', '5h', '4h', '3h', '2h', '1h', 'Ahora'][i]}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="chart-card">
              <h3>Consumo de Agua (7 días)</h3>
              <div className="chart-bars">
                {historialAgua.map((val, i) => (
                  <div key={i} className="chart-bar-container">
                    <div 
                      className="chart-bar water" 
                      style={{height: `${(val/1200)*100}%`}}
                    >
                      <span className="bar-value">{val}L</span>
                    </div>
                    <span className="bar-label">{['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Hoy'][i]}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="chart-card table-card">
              <h3>Registro de Pesajes</h3>
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Peso Prom.</th>
                    <th>Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {historialPeso.map((p, i) => (
                    <tr key={i}>
                      <td>{p.fecha}</td>
                      <td>{p.peso} kg</td>
                      <td>{p.cantidad} cerdos</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Bombas */}
        <section className="section">
          <div className="section-header">
            <h2><Power size={20} /> Control de Bombas</h2>
          </div>
          
          <div className="pumps-grid">
            {bombas.map((bomba) => (
              <div key={bomba._id} className={`pump-card ${bomba.estado ? 'active' : ''} ${!bomba.conectada ? 'offline' : ''}`}>
                <div className="pump-header">
                  <span className="pump-name">{bomba.nombre}</span>
                  <span className={`connection-badge ${bomba.conectada ? 'online' : 'offline'}`}>
                    {bomba.conectada ? <Wifi size={14} /> : <WifiOff size={14} />}
                    {bomba.conectada ? 'Conectada' : 'Sin conexión'}
                  </span>
                </div>
                <div className="pump-status">
                  {bomba.estado ? <Power size={32} /> : <PowerOff size={32} />}
                  <span>{bomba.estado ? 'ENCENDIDA' : 'APAGADA'}</span>
                </div>
                <button 
                  className={`pump-btn ${bomba.estado ? 'off' : 'on'}`}
                  onClick={() => toggleBomba(bomba._id)}
                  disabled={!bomba.conectada}
                >
                  {bomba.estado ? 'Apagar' : 'Encender'}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Alertas */}
        <section className="section">
          <div className="section-header">
            <h2><Bell size={20} /> Alertas Recientes</h2>
          </div>
          
          <div className="alerts-list">
            {alertas.length === 0 ? (
              <div className="empty-alerts">
                <CheckCircle size={32} />
                <p>Sistema operando normalmente</p>
              </div>
            ) : (
              alertas.slice(0, 5).map((alerta) => (
                <div key={alerta._id} className={`alert-item ${alerta.tipo?.includes('alta') || alerta.tipo?.includes('critica') ? 'critical' : 'warning'}`}>
                  <div className="alert-icon">
                    <AlertTriangle size={20} />
                  </div>
                  <div className="alert-content">
                    <p className="alert-message">{alerta.mensaje}</p>
                    <span className="alert-time">{new Date(alerta.fecha).toLocaleString()}</span>
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

export default App