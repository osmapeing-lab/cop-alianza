import { useState, useEffect } from 'react'
import axios from 'axios'
import io from 'socket.io-client'
import './App.css'

const API_URL = 'http://localhost:5000/api'
const socket = io('http://localhost:5000')

function App() {
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('login')
  
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  
  const [sensores, setSensores] = useState({
    temperatura: 28,
    humedad: 75,
    nivel_tanque1: 65,
    nivel_tanque2: 58,
    flujo: 12.5,
    peso: 85.3
  })
  const [bombas, setBombas] = useState([])
  const [alertas, setAlertas] = useState([])
  const [farms, setFarms] = useState([])
  const [users, setUsers] = useState([])
  const [sessions, setSessions] = useState([])
  const [config, setConfig] = useState({})
  const [consumoDiario, setConsumoDiario] = useState(0)
  const [consumoMensual, setConsumoMensual] = useState(0)

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
        setBombas(bombasRes.data)
        setAlertas(alertasRes.data)
        setConfig(configRes.data)
        setConsumoDiario(diarioRes.data.litros_total || 0)
        setConsumoMensual(mensualRes.data.litros_total || 0)
      }
    } catch (err) {
      console.log('Error fetching data')
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    try {
      const res = await axios.post(`${API_URL}/users/login`, { usuario, password })
      const userData = { usuario: res.data.usuario, rol: res.data.rol, token: res.data.token }
      setUser(userData)
      localStorage.setItem('user', JSON.stringify(userData))
      setPage('dashboard')
      setError('')
    } catch (err) {
      setError('Usuario o contraseña incorrectos')
    }
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('user')
    setPage('login')
  }

  const toggleBomba = async (id) => {
    try {
      const res = await axios.put(`${API_URL}/motorbombs/${id}/toggle`)
      socket.emit('toggle_bomba', res.data)
      setBombas(prev => prev.map(b => b._id === id ? res.data : b))
    } catch (err) {
      console.log('Error toggling bomba')
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

  const toggleFarmActive = async (id) => {
    try {
      const res = await axios.put(`${API_URL}/farms/${id}/toggle`)
      setFarms(prev => prev.map(f => f._id === id ? res.data : f))
    } catch (err) {
      console.log('Error toggling farm')
    }
  }

  const calcularSensacionTermica = (temp, humedad) => {
    if (temp >= 27) {
      const st = -8.784 + 1.611 * temp + 2.338 * humedad - 0.146 * temp * humedad
      return Math.round(st * 10) / 10
    }
    return temp
  }

  const sensacionTermica = calcularSensacionTermica(sensores.temperatura, sensores.humedad)

  if (page === 'login') {
    return (
      <div className="app">
        <div className="login-container">
          <div className="login-box">
            <h1>🐷 COP Alianza</h1>
            <form onSubmit={handleLogin}>
              {error && <p className="error">{error}</p>}
              <input
                type="text"
                placeholder="Usuario"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
              />
              <input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="submit">Ingresar</button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // SUPERADMIN VIEW
  if (user?.rol === 'superadmin') {
    return (
      <div className="app">
        <header className="header">
          <h1>🐷 COP Alianza - Panel Administrativo</h1>
          <div className="header-right">
            <span>{user?.usuario} (SuperAdmin)</span>
            <button onClick={handleLogout}>Salir</button>
          </div>
        </header>

        <div className="dashboard">
          <h2>Gestión de Granjas</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Ubicación</th>
                  <th>Propietario</th>
                  <th>Teléfono</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {farms.length === 0 ? (
                  <tr><td colSpan="6">No hay granjas registradas</td></tr>
                ) : (
                  farms.map(farm => (
                    <tr key={farm._id}>
                      <td>{farm.nombre}</td>
                      <td>{farm.ubicacion}</td>
                      <td>{farm.propietario}</td>
                      <td>{farm.telefono}</td>
                      <td className={farm.activo ? 'activo' : 'inactivo'}>
                        {farm.activo ? '🟢 Activo' : '🔴 Inactivo'}
                      </td>
                      <td>
                        <button onClick={() => toggleFarmActive(farm._id)}>
                          {farm.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <h2>Gestión de Usuarios</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Último Acceso</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u._id}>
                    <td>{u.usuario}</td>
                    <td>{u.correo}</td>
                    <td>{u.rol}</td>
                    <td>{u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleString() : 'Nunca'}</td>
                    <td className={u.activo ? 'activo' : 'inactivo'}>
                      {u.activo ? '🟢 Activo' : '🔴 Inactivo'}
                    </td>
                    <td>
                      <button onClick={() => toggleUserActive(u._id)}>
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>Historial de Sesiones</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr><td colSpan="3">No hay sesiones registradas</td></tr>
                ) : (
                  sessions.slice(0, 20).map(s => (
                    <tr key={s._id}>
                      <td>{s.usuario}</td>
                      <td>{new Date(s.fecha_entrada).toLocaleString()}</td>
                      <td>{s.fecha_salida ? new Date(s.fecha_salida).toLocaleString() : 'Activa'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // CLIENTE VIEW
  return (
    <div className="app">
      <header className="header">
        <h1>🐷 COP Alianza - Dashboard</h1>
        <div className="header-right">
          <span>{user?.usuario} (Cliente)</span>
          <button onClick={handleLogout}>Salir</button>
        </div>
      </header>

      <div className="dashboard">
        <h2>Monitoreo en Tiempo Real</h2>
        
        <div className="cards">
          <div className={`card ${sensores.temperatura > 32 ? 'danger' : sensores.temperatura > 28 ? 'warning' : ''}`}>
            <h3>🌡️ Temperatura</h3>
            <span className="value">{sensores.temperatura}</span>
            <span className="unit">°C</span>
          </div>
          
          <div className="card">
            <h3>💧 Humedad</h3>
            <span className="value">{sensores.humedad}</span>
            <span className="unit">%</span>
          </div>

          <div className={`card ${sensacionTermica > 35 ? 'danger' : sensacionTermica > 30 ? 'warning' : ''}`}>
            <h3>🥵 Sensación Térmica</h3>
            <span className="value">{sensacionTermica}</span>
            <span className="unit">°C</span>
          </div>
          
          <div className={`card ${sensores.nivel_tanque1 < 30 ? 'warning' : ''}`}>
            <h3>🛢️ Tanque 1</h3>
            <span className="value">{sensores.nivel_tanque1}</span>
            <span className="unit">%</span>
          </div>
          
          <div className={`card ${sensores.nivel_tanque2 < 30 ? 'warning' : ''}`}>
            <h3>🛢️ Tanque 2</h3>
            <span className="value">{sensores.nivel_tanque2}</span>
            <span className="unit">%</span>
          </div>
          
          <div className="card">
            <h3>🌊 Flujo Agua</h3>
            <span className="value">{sensores.flujo}</span>
            <span className="unit">L/min</span>
          </div>
          
          <div className="card">
            <h3>⚖️ Peso Báscula</h3>
            <span className="value">{sensores.peso}</span>
            <span className="unit">kg</span>
          </div>

          <div className="card">
            <h3>💦 Consumo Hoy</h3>
            <span className="value">{consumoDiario}</span>
            <span className="unit">L</span>
          </div>

          <div className="card">
            <h3>📅 Consumo Mes</h3>
            <span className="value">{consumoMensual}</span>
            <span className="unit">L</span>
          </div>
        </div>

        <div className="bombas-section">
          <h3>🔌 Control de Bombas</h3>
          <div className="bombas-grid">
            {bombas.length === 0 ? (
              <p>No hay bombas registradas</p>
            ) : (
              bombas.map((bomba) => (
                <div key={bomba._id} className={`bomba-card ${bomba.estado ? 'activa' : ''}`}>
                  <h4>{bomba.nombre}</h4>
                  <p className={`estado ${bomba.estado ? '' : 'off'}`}>
                    {bomba.estado ? '🟢 ENCENDIDA' : '⚫ APAGADA'}
                  </p>
                  <button
                    className={bomba.estado ? 'apagar' : 'encender'}
                    onClick={() => toggleBomba(bomba._id)}
                  >
                    {bomba.estado ? 'Apagar' : 'Encender'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="alertas-section">
          <h3>🚨 Últimas Alertas</h3>
          {alertas.length === 0 ? (
            <p>No hay alertas recientes</p>
          ) : (
            alertas.slice(0, 5).map((alerta) => (
              <div key={alerta._id} className={`alerta-item ${alerta.tipo?.includes('alta') ? 'critica' : ''}`}>
                <p className="mensaje">{alerta.mensaje}</p>
                <p className="fecha">{new Date(alerta.fecha).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default App