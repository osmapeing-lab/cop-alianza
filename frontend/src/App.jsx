import { useState, useEffect } from 'react'
import axios from 'axios'
import io from 'socket.io-client'
import './App.css'

const API_URL = 'https://cop-alianza-backend.onrender.com/api'
const socket = io('https://cop-alianza-backend.onrender.com')

// Coordenadas Lorica, Córdoba
const LAT = 9.2816
const LON = -75.8264

function App() {
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('login')
  
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showError, setShowError] = useState(false)
  
  const [sensores, setSensores] = useState({
    temperatura: 32,
    humedad: 78,
    nivel_tanque1: 65,
    nivel_tanque2: 58,
    flujo: 12.5,
    peso: 85.3
  })
  
  const [bombas, setBombas] = useState([
    { _id: '1', nombre: 'Motobomba Pozo', estado: true, conectada: true },
    { _id: '2', nombre: 'Motobomba Tratamiento', estado: false, conectada: true },
    { _id: '3', nombre: 'Motobomba Riego 1', estado: true, conectada: true },
    { _id: '4', nombre: 'Motobomba Riego 2', estado: false, conectada: false }
  ])
  
  const [alertas, setAlertas] = useState([
    { _id: '1', tipo: 'temperatura_alta', mensaje: 'Temperatura superó 34°C - Riego activado automáticamente', fecha: new Date(Date.now() - 3600000) },
    { _id: '2', tipo: 'nivel_bajo', mensaje: 'Tanque 2 bajo 30% - Revisar suministro', fecha: new Date(Date.now() - 7200000) }
  ])
  const [farms, setFarms] = useState([])
  const [users, setUsers] = useState([])
  const [sessions, setSessions] = useState([])
  const [config, setConfig] = useState({})
  const [consumoDiario, setConsumoDiario] = useState(847)
  const [consumoMensual, setConsumoMensual] = useState(12580)
  
  // Datos históricos simulados realistas
  const [historialTemp, setHistorialTemp] = useState([31, 32, 34, 35, 34, 33, 32])
  const [historialHum, setHistorialHum] = useState([75, 72, 68, 65, 70, 74, 78])
  const [historialAgua, setHistorialAgua] = useState([780, 920, 850, 1100, 890, 950, 847])
  const [historialPeso, setHistorialPeso] = useState([
    { fecha: '01/01', peso: 45.2, cantidad: 12 },
    { fecha: '02/01', peso: 52.8, cantidad: 8 },
    { fecha: '03/01', peso: 78.5, cantidad: 15 },
    { fecha: '04/01', peso: 65.3, cantidad: 10 },
    { fecha: '05/01', peso: 88.2, cantidad: 18 },
    { fecha: '06/01', peso: 72.1, cantidad: 14 },
    { fecha: 'Hoy', peso: 85.3, cantidad: 11 }
  ])
  
  // Modales
  const [showModalUser, setShowModalUser] = useState(false)
  const [showModalFarm, setShowModalFarm] = useState(false)
  const [newUser, setNewUser] = useState({ usuario: '', correo: '', password: '', rol: 'cliente' })
  const [newFarm, setNewFarm] = useState({ nombre: '', ubicacion: '', propietario: '', telefono: '', email: '' })

  // Obtener temperatura real de Lorica
  const fetchWeather = async () => {
    try {
      const res = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,relative_humidity_2m&timezone=America/Bogota`)
      const temp = res.data.current.temperature_2m
      const hum = res.data.current.relative_humidity_2m
      setSensores(prev => ({ ...prev, temperatura: temp, humedad: hum }))
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

    return () => {
      socket.off('lectura_actualizada')
      socket.off('bomba_actualizada')
      socket.off('nueva_alerta')
    }
  }, [])

  useEffect(() => {
    if (user) {
      fetchData()
      if (user.rol === 'cliente') {
        fetchWeather()
        const interval = setInterval(fetchWeather, 300000) // cada 5 min
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
        const [bombasRes, alertasRes, configRes, diarioRes, mensualRes] = await Promise.all([
          axios.get(`${API_URL}/motorbombs`),
          axios.get(`${API_URL}/alerts`),
          axios.get(`${API_URL}/config`),
          axios.get(`${API_URL}/water/diario`),
          axios.get(`${API_URL}/water/mensual`)
        ])
        if (bombasRes.data.length > 0) setBombas(prev => bombasRes.data.map((b, i) => ({...b, conectada: prev[i]?.conectada ?? true})))
        if (alertasRes.data.length > 0) setAlertas(alertasRes.data)
        setConfig(configRes.data)
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
      setError('Usuario o contraseña incorrectos')
      setShowError(true)
      setTimeout(() => setShowError(false), 3000)
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
    const header = 'Reporte Granja Porcina - Lorica Córdoba\nFecha: ' + new Date().toLocaleDateString() + '\n\n'
    const clima = `CLIMA ACTUAL\nTemperatura,${sensores.temperatura}°C\nHumedad,${sensores.humedad}%\nSensación Térmica,${sensacionTermica}°C\n\n`
    const agua = `CONSUMO DE AGUA\nConsumo Diario,${consumoDiario} L\nConsumo Mensual,${consumoMensual} L\n\n`
    const tanques = `NIVELES TANQUES\nTanque 1,${sensores.nivel_tanque1}%\nTanque 2,${sensores.nivel_tanque2}%\n\n`
    const pesaje = `ÚLTIMO PESAJE\nPeso,${sensores.peso} kg\n\n`
    const histAgua = `HISTORIAL CONSUMO SEMANAL\nDía,Litros\n${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Hoy'].map((d, i) => `${d},${historialAgua[i]}`).join('\n')}`
    
    const csv = header + clima + agua + tanques + pesaje + histAgua
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'reporte_granja_cerdos.csv'
    a.click()
  }

  const calcularSensacionTermica = (temp, humedad) => {
    if (temp >= 27) {
      const st = -8.784 + 1.611 * temp + 2.338 * humedad - 0.146 * temp * humedad
      return Math.round(st * 10) / 10
    }
    return temp
  }

  const sensacionTermica = calcularSensacionTermica(sensores.temperatura, sensores.humedad)

  // LOGIN
  if (page === 'login') {
    return (
      <div className="app">
        <div className="login-container">
          <div className="login-box">
            <div className="login-logo">🐷</div>
            <h1>COP Alianza</h1>
            <p className="login-subtitle">Sistema de Control y Monitoreo Inteligente</p>
            <form onSubmit={handleLogin}>
              <div className={`error-message ${showError ? 'show' : ''}`}>
                {error}
              </div>
              <div className="input-group">
                <label>Usuario</label>
                <input
                  type="text"
                  placeholder="Ingrese su usuario"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label>Contraseña</label>
                <input
                  type="password"
                  placeholder="Ingrese su contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-login">Ingresar</button>
            </form>
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
          <div className="header-left">
            <span className="logo">🐷</span>
            <h1>COP Alianza</h1>
            <span className="badge-admin">SuperAdmin</span>
          </div>
          <div className="header-right">
            <span className="user-name">👤 {user?.usuario}</span>
            <button onClick={handleLogout} className="btn-logout">Cerrar Sesión</button>
          </div>
        </header>

        <div className="dashboard admin-dashboard">
          <div className="admin-stats">
            <div className="stat-card">
              <h3>{farms.length}</h3>
              <p>Granjas Registradas</p>
            </div>
            <div className="stat-card">
              <h3>{users.length}</h3>
              <p>Usuarios Totales</p>
            </div>
            <div className="stat-card">
              <h3>{users.filter(u => u.activo).length}</h3>
              <p>Usuarios Activos</p>
            </div>
            <div className="stat-card">
              <h3>{sessions.filter(s => !s.fecha_salida).length}</h3>
              <p>Sesiones Activas</p>
            </div>
          </div>

          <div className="section">
            <div className="section-header">
              <h2>🏠 Gestión de Granjas</h2>
              <button onClick={() => setShowModalFarm(true)} className="btn-add">+ Nueva Granja</button>
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
                    <tr><td colSpan="6" className="empty">No hay granjas registradas</td></tr>
                  ) : (
                    farms.map(farm => (
                      <tr key={farm._id}>
                        <td>{farm.nombre}</td>
                        <td>{farm.ubicacion}</td>
                        <td>{farm.propietario}</td>
                        <td>{farm.telefono}</td>
                        <td>
                          <span className={`status ${farm.activo ? 'active' : 'inactive'}`}>
                            {farm.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="actions">
                          <button onClick={() => toggleFarmActive(farm._id)} className="btn-toggle">
                            {farm.activo ? 'Desactivar' : 'Activar'}
                          </button>
                          <button onClick={() => deleteFarm(farm._id)} className="btn-delete">Eliminar</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="section">
            <div className="section-header">
              <h2>👥 Gestión de Usuarios</h2>
              <div className="section-actions">
                <button onClick={downloadExcel} className="btn-download">📥 Descargar Excel</button>
                <button onClick={() => setShowModalUser(true)} className="btn-add">+ Nuevo Usuario</button>
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
                      <td>{u.usuario}</td>
                      <td>{u.correo}</td>
                      <td><span className={`role ${u.rol}`}>{u.rol}</span></td>
                      <td>{u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString() : 'Nunca'}</td>
                      <td>
                        <span className={`status ${u.activo ? 'active' : 'inactive'}`}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="actions">
                        <button onClick={() => toggleUserActive(u._id)} className="btn-toggle">
                          {u.activo ? 'Desactivar' : 'Activar'}
                        </button>
                        <button onClick={() => deleteUser(u._id)} className="btn-delete">Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="section">
            <div className="section-header">
              <h2>📋 Historial de Sesiones</h2>
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
                    <tr><td colSpan="4" className="empty">No hay sesiones registradas</td></tr>
                  ) : (
                    sessions.slice(0, 20).map(s => (
                      <tr key={s._id}>
                        <td>{s.usuario}</td>
                        <td>{new Date(s.fecha_entrada).toLocaleString()}</td>
                        <td>{s.fecha_salida ? new Date(s.fecha_salida).toLocaleString() : '-'}</td>
                        <td>
                          <span className={`status ${s.fecha_salida ? 'inactive' : 'active'}`}>
                            {s.fecha_salida ? 'Cerrada' : 'Activa'}
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

        {showModalUser && (
          <div className="modal-overlay">
            <div className="modal">
              <h2>Nuevo Usuario</h2>
              <form onSubmit={createUser}>
                <input placeholder="Usuario" value={newUser.usuario} onChange={e => setNewUser({...newUser, usuario: e.target.value})} required />
                <input placeholder="Correo" type="email" value={newUser.correo} onChange={e => setNewUser({...newUser, correo: e.target.value})} required />
                <input placeholder="Contraseña" type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required />
                <select value={newUser.rol} onChange={e => setNewUser({...newUser, rol: e.target.value})}>
                  <option value="cliente">Cliente</option>
                  <option value="superadmin">SuperAdmin</option>
                </select>
                <div className="modal-actions">
                  <button type="button" onClick={() => setShowModalUser(false)} className="btn-cancel">Cancelar</button>
                  <button type="submit" className="btn-save">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showModalFarm && (
          <div className="modal-overlay">
            <div className="modal">
              <h2>Nueva Granja</h2>
              <form onSubmit={createFarm}>
                <input placeholder="Nombre" value={newFarm.nombre} onChange={e => setNewFarm({...newFarm, nombre: e.target.value})} required />
                <input placeholder="Ubicación" value={newFarm.ubicacion} onChange={e => setNewFarm({...newFarm, ubicacion: e.target.value})} />
                <input placeholder="Propietario" value={newFarm.propietario} onChange={e => setNewFarm({...newFarm, propietario: e.target.value})} />
                <input placeholder="Teléfono" value={newFarm.telefono} onChange={e => setNewFarm({...newFarm, telefono: e.target.value})} />
                <input placeholder="Email" type="email" value={newFarm.email} onChange={e => setNewFarm({...newFarm, email: e.target.value})} />
                <div className="modal-actions">
                  <button type="button" onClick={() => setShowModalFarm(false)} className="btn-cancel">Cancelar</button>
                  <button type="submit" className="btn-save">Guardar</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }

  // CLIENTE
  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <span className="logo">🐷</span>
          <h1>Granja Porcina - Lorica</h1>
          <span className="badge-location">📍 9°16'N 75°49'W</span>
        </div>
        <div className="header-right">
          <button onClick={downloadExcelCliente} className="btn-download">📥 Descargar Reporte</button>
          <span className="user-name">👤 {user?.usuario}</span>
          <button onClick={handleLogout} className="btn-logout">Cerrar Sesión</button>
        </div>
      </header>

      <div className="dashboard client-dashboard">
        <div className="section">
          <h2>🌡️ Clima en Tiempo Real - Lorica, Córdoba</h2>
          <div className="cards">
            <div className={`card ${sensores.temperatura > 32 ? 'danger' : sensores.temperatura > 28 ? 'warning' : ''}`}>
              <div className="card-icon">🌡️</div>
              <h3>Temperatura</h3>
              <span className="value">{sensores.temperatura}<span className="unit">°C</span></span>
              <p className="card-status">{sensores.temperatura > 32 ? '⚠️ Muy alta' : sensores.temperatura > 28 ? '⚡ Alta' : '✅ Normal'}</p>
            </div>
            
            <div className="card">
              <div className="card-icon">💧</div>
              <h3>Humedad</h3>
              <span className="value">{sensores.humedad}<span className="unit">%</span></span>
              <p className="card-status">✅ Normal</p>
            </div>

            <div className={`card ${sensacionTermica > 35 ? 'danger' : sensacionTermica > 30 ? 'warning' : ''}`}>
              <div className="card-icon">🥵</div>
              <h3>Sensación Térmica</h3>
              <span className="value">{sensacionTermica}<span className="unit">°C</span></span>
              <p className="card-status">{sensacionTermica > 35 ? '⚠️ Estrés térmico' : sensacionTermica > 30 ? '⚡ Incómoda' : '✅ Confortable'}</p>
            </div>
          </div>
        </div>

        <div className="section">
          <h2>📊 Monitoreo de Instalaciones</h2>
          <div className="cards">
            <div className={`card ${sensores.nivel_tanque1 < 30 ? 'warning' : ''}`}>
              <div className="card-icon">🛢️</div>
              <h3>Tanque Principal</h3>
              <span className="value">{sensores.nivel_tanque1}<span className="unit">%</span></span>
              <div className="progress-bar"><div style={{width: `${sensores.nivel_tanque1}%`}}></div></div>
            </div>
            
            <div className={`card ${sensores.nivel_tanque2 < 30 ? 'warning' : ''}`}>
              <div className="card-icon">🛢️</div>
              <h3>Tanque Reserva</h3>
              <span className="value">{sensores.nivel_tanque2}<span className="unit">%</span></span>
              <div className="progress-bar"><div style={{width: `${sensores.nivel_tanque2}%`}}></div></div>
            </div>
            
            <div className="card">
              <div className="card-icon">⚖️</div>
              <h3>Último Pesaje</h3>
              <span className="value">{sensores.peso}<span className="unit">kg</span></span>
              <p className="card-status">Hace 15 min</p>
            </div>

            <div className="card">
              <div className="card-icon">💦</div>
              <h3>Consumo Hoy</h3>
              <span className="value">{consumoDiario}<span className="unit">L</span></span>
            </div>

            <div className="card">
              <div className="card-icon">📅</div>
              <h3>Consumo Mes</h3>
              <span className="value">{consumoMensual.toLocaleString()}<span className="unit">L</span></span>
            </div>

            <div className="card">
              <div className="card-icon">🌊</div>
              <h3>Flujo Actual</h3>
              <span className="value">{sensores.flujo}<span className="unit">L/min</span></span>
            </div>
          </div>
        </div>

        <div className="section">
          <h2>📈 Historial y Tendencias</h2>
          <div className="charts-grid">
            <div className="chart-card">
              <h3>🌡️ Temperatura Últimas 7 Horas</h3>
              <div className="simple-chart">
                {historialTemp.map((val, i) => (
                  <div key={i} className={`chart-bar ${val > 32 ? 'hot' : ''}`} style={{height: `${(val/40)*100}%`}}>
                    <span className="chart-value">{val}°</span>
                  </div>
                ))}
              </div>
              <div className="chart-labels">
                {['6h', '5h', '4h', '3h', '2h', '1h', 'Ahora'].map((l, i) => <span key={i}>{l}</span>)}
              </div>
            </div>
            <div className="chart-card">
              <h3>💦 Consumo de Agua Semanal</h3>
              <div className="simple-chart">
                {historialAgua.map((val, i) => (
                  <div key={i} className="chart-bar water" style={{height: `${(val/1200)*100}%`}}>
                    <span className="chart-value">{val}L</span>
                  </div>
                ))}
              </div>
              <div className="chart-labels">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Hoy'].map((l, i) => <span key={i}>{l}</span>)}
              </div>
            </div>
            <div className="chart-card">
              <h3>⚖️ Registro de Pesajes Semanal</h3>
              <div className="peso-table">
                <table>
                  <thead>
                    <tr><th>Fecha</th><th>Peso Prom.</th><th>Cantidad</th></tr>
                  </thead>
                  <tbody>
                    {historialPeso.map((p, i) => (
                      <tr key={i}><td>{p.fecha}</td><td>{p.peso} kg</td><td>{p.cantidad} cerdos</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="chart-card">
              <h3>💧 Humedad Últimas 7 Horas</h3>
              <div className="simple-chart">
                {historialHum.map((val, i) => (
                  <div key={i} className="chart-bar humidity" style={{height: `${val}%`}}>
                    <span className="chart-value">{val}%</span>
                  </div>
                ))}
              </div>
              <div className="chart-labels">
                {['6h', '5h', '4h', '3h', '2h', '1h', 'Ahora'].map((l, i) => <span key={i}>{l}</span>)}
              </div>
            </div>
          </div>
        </div>

        <div className="section">
          <h2>🔌 Control de Motobombas</h2>
          <div className="bombas-grid">
            {bombas.map((bomba) => (
              <div key={bomba._id} className={`bomba-card ${bomba.estado ? 'activa' : ''} ${!bomba.conectada ? 'desconectada' : ''}`}>
                <div className="bomba-header">
                  <h4>{bomba.nombre}</h4>
                  <span className={`connection-status ${bomba.conectada ? 'connected' : 'disconnected'}`}>
                    {bomba.conectada ? '🟢 Conectada' : '🔴 Sin conexión'}
                  </span>
                </div>
                <p className={`estado ${bomba.estado ? 'on' : 'off'}`}>
                  {bomba.estado ? '⚡ ENCENDIDA' : '⭘ APAGADA'}
                </p>
                <button
                  className={bomba.estado ? 'apagar' : 'encender'}
                  onClick={() => toggleBomba(bomba._id)}
                  disabled={!bomba.conectada}
                >
                  {bomba.estado ? 'Apagar' : 'Encender'}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="section">
          <h2>🚨 Últimas Alertas</h2>
          <div className="alertas-list">
            {alertas.length === 0 ? (
              <p className="empty">No hay alertas recientes - Sistema operando normalmente ✅</p>
            ) : (
              alertas.slice(0, 5).map((alerta) => (
                <div key={alerta._id} className={`alerta-item ${alerta.tipo?.includes('alta') ? 'critica' : ''}`}>
                  <span className="alerta-icon">{alerta.tipo?.includes('alta') ? '🔴' : '🟡'}</span>
                  <div className="alerta-content">
                    <p className="mensaje">{alerta.mensaje}</p>
                    <p className="fecha">{new Date(alerta.fecha).toLocaleString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App