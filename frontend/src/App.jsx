import { useState } from 'react'
import { 
  Thermometer, Droplets, Wind, Scale, Waves, 
  Power, PowerOff, AlertTriangle, CheckCircle, Clock,
  Users, Home, Activity, Download, Plus, Trash2, 
  UserCheck, UserX, LogOut, Bell, TrendingUp,
  Wifi, WifiOff, Sun, CloudRain, Building2,
  RefreshCw, AlertCircle, FileSpreadsheet, PiggyBank
} from 'lucide-react'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('login')
  
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // ==================== DATOS ESTÁTICOS REALISTAS ====================
  
  // Estados de conexión
  const [conexiones] = useState({
    api_clima: true,
    sensor_porqueriza: true,
    bascula: true
  })

  // Sensores - DATOS CALIBRADOS REALISTAS
  // Lorica: Clima caliente húmedo, temp promedio 32-34°C
  // Porqueriza con techo zinc: +5-7°C sobre ambiente
  const [sensores] = useState({
    temp_ambiente: 33.4,
    humedad_ambiente: 76,
    temp_porqueriza: 38.2,
    humedad_porqueriza: 68,
    nivel_tanque1: 74,
    nivel_tanque2: 58,
    flujo: 4.2
  })

  // Calcular sensación térmica (fórmula de Steadman)
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

  // Último peso registrado
  const [ultimoPeso] = useState({
    peso: 87.4,
    fecha: new Date('2026-01-21T14:32:00'),
    tipo: 'cerda_adulta'
  })

  // Historial de pesajes - DESDE NOVIEMBRE 2025 (datos esporádicos realistas)
  const [historialPeso] = useState([
    { fecha: '21/01/26', peso: 87.4, tipo: 'Cerda adulta', hora: '14:32' },
    { fecha: '21/01/26', peso: 12.3, tipo: 'Lechón', hora: '11:15' },
    { fecha: '20/01/26', peso: 94.2, tipo: 'Cerda adulta', hora: '16:45' },
    { fecha: '20/01/26', peso: 11.8, tipo: 'Lechón', hora: '10:20' },
    { fecha: '19/01/26', peso: 89.7, tipo: 'Cerda adulta', hora: '15:30' },
    { fecha: '18/01/26', peso: 13.1, tipo: 'Lechón', hora: '09:45' },
    { fecha: '17/01/26', peso: 91.5, tipo: 'Cerda adulta', hora: '14:10' },
    { fecha: '15/01/26', peso: 86.3, tipo: 'Cerda adulta', hora: '11:30' },
    { fecha: '12/01/26', peso: 10.7, tipo: 'Lechón', hora: '16:00' },
    { fecha: '10/01/26', peso: 92.8, tipo: 'Cerda adulta', hora: '10:15' },
    { fecha: '08/01/26', peso: 88.1, tipo: 'Cerda adulta', hora: '15:20' },
    { fecha: '05/01/26', peso: 9.4, tipo: 'Lechón', hora: '09:30' },
    { fecha: '02/01/26', peso: 90.6, tipo: 'Cerda adulta', hora: '14:45' },
    { fecha: '28/12/25', peso: 85.9, tipo: 'Cerda adulta', hora: '11:00' },
    { fecha: '23/12/25', peso: 8.6, tipo: 'Lechón', hora: '16:30' },
    { fecha: '18/12/25', peso: 93.4, tipo: 'Cerda adulta', hora: '10:45' },
    { fecha: '12/12/25', peso: 87.2, tipo: 'Cerda adulta', hora: '15:15' },
    { fecha: '05/12/25', peso: 7.8, tipo: 'Lechón', hora: '09:00' },
    { fecha: '28/11/25', peso: 89.1, tipo: 'Cerda adulta', hora: '14:20' },
    { fecha: '20/11/25', peso: 6.5, tipo: 'Lechón', hora: '11:45' },
    { fecha: '15/11/25', peso: 84.7, tipo: 'Cerda adulta', hora: '16:10' },
    { fecha: '08/11/25', peso: 91.3, tipo: 'Cerda adulta', hora: '10:30' },
  ])

  // Bombas - 2 conectadas activas, 1 conectada apagada, 1 desconectada
  const [bombas, setBombas] = useState([
    { _id: '1', nombre: 'Bomba Principal Riego', estado: true, conectada: true },
    { _id: '2', nombre: 'Bomba Reserva', estado: false, conectada: true },
    { _id: '3', nombre: 'Bomba Aspersores', estado: true, conectada: true },
    { _id: '4', nombre: 'Bomba Pozo Auxiliar', estado: false, conectada: false }
  ])
  
  // Alertas recientes - REALISTAS
  const [alertas] = useState([
    { 
      _id: '1', 
      tipo: 'temperatura_alta', 
      mensaje: 'Temperatura porqueriza 38.2°C - Sistema de riego activado',
      fecha: new Date('2026-01-21T13:45:00'),
      critica: false
    },
    { 
      _id: '2', 
      tipo: 'tanque_bajo', 
      mensaje: 'Tanque reserva al 58% - Programar recarga',
      fecha: new Date('2026-01-21T10:30:00'),
      critica: false
    },
    { 
      _id: '3', 
      tipo: 'sensor_desconectado', 
      mensaje: 'Bomba Pozo Auxiliar sin conexión',
      fecha: new Date('2026-01-20T16:15:00'),
      critica: false
    },
    { 
      _id: '4', 
      tipo: 'temperatura_alta', 
      mensaje: 'Temperatura porqueriza 41.5°C - ALERTA CRÍTICA - Riego automático activado',
      fecha: new Date('2026-01-19T14:20:00'),
      critica: true
    },
    { 
      _id: '5', 
      tipo: 'pesaje', 
      mensaje: 'Cerda #12 pesada: 94.2 kg - Peso óptimo para venta',
      fecha: new Date('2026-01-20T16:45:00'),
      critica: false
    }
  ])

  // Consumo de agua - REALISTAS para granja porcina pequeña (~50 cerdos)
  // Cerdo adulto: 8-12 L/día, Lechón: 2-4 L/día
  // Más agua para riego/limpieza: ~400 L/día adicionales
  const [consumoDiario] = useState(847)
  const [consumoMensual] = useState(25410)

  // Historial consumo semanal (últimos 7 días)
  const [consumoSemanal] = useState([
    { dia: 'Lun', litros: 823 },
    { dia: 'Mar', litros: 891 },
    { dia: 'Mié', litros: 756 },
    { dia: 'Jue', litros: 912 },
    { dia: 'Vie', litros: 847 },
    { dia: 'Sáb', litros: 634 },
    { dia: 'Dom', litros: 578 }
  ])

  // Datos para SuperAdmin
  const [farms] = useState([
    { 
      _id: '1', 
      nombre: 'COO-ALIANZAS Granja Porcina', 
      ubicacion: 'Lorica, Córdoba', 
      propietario: 'Cooperativa Alianzas', 
      telefono: '314 582 7391',
      email: 'contacto@cooalianzas.com',
      activo: true,
      fecha_registro: new Date('2025-10-15')
    },
  ])
  
  const [users] = useState([
    { _id: '1', usuario: 'jefaleidis', correo: 'leidis@cooalianzas.com', rol: 'superadmin', activo: true, ultimo_acceso: new Date('2026-01-21T08:00:00') },
    { _id: '2', usuario: 'ingenieros', correo: 'ingenieros.omp@gmail.com', rol: 'superadmin', activo: true, ultimo_acceso: new Date('2026-01-21T14:30:00') },
    { _id: '3', usuario: 'operario1', correo: 'operario@cooalianzas.com', rol: 'cliente', activo: true, ultimo_acceso: new Date('2026-01-21T07:00:00') },
    { _id: '4', usuario: 'veterinario', correo: 'vet@cooalianzas.com', rol: 'cliente', activo: false, ultimo_acceso: new Date('2026-01-10T09:30:00') },
  ])
  
  // Sesiones - Solo 1 en línea actualmente (ingenieros)
  const [sessions] = useState([
    { _id: '1', usuario: 'ingenieros', fecha_entrada: new Date('2026-01-21T14:30:00'), fecha_salida: null, ip: '181.52.xxx.xxx' },
    { _id: '2', usuario: 'operario1', fecha_entrada: new Date('2026-01-21T07:00:00'), fecha_salida: new Date('2026-01-21T12:00:00'), ip: '181.52.xxx.xxx' },
    { _id: '3', usuario: 'jefaleidis', fecha_entrada: new Date('2026-01-21T08:00:00'), fecha_salida: new Date('2026-01-21T10:30:00'), ip: '190.25.xxx.xxx' },
    { _id: '4', usuario: 'operario1', fecha_entrada: new Date('2026-01-20T06:30:00'), fecha_salida: new Date('2026-01-20T14:00:00'), ip: '181.52.xxx.xxx' },
    { _id: '5', usuario: 'jefaleidis', fecha_entrada: new Date('2026-01-20T09:00:00'), fecha_salida: new Date('2026-01-20T17:00:00'), ip: '190.25.xxx.xxx' },
    { _id: '6', usuario: 'ingenieros', fecha_entrada: new Date('2026-01-19T10:00:00'), fecha_salida: new Date('2026-01-19T18:30:00'), ip: '181.52.xxx.xxx' },
  ])

  // ==================== FUNCIONES ====================

  const handleLogin = (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    setTimeout(() => {
      const validUsers = {
        'jefaleidis': { password: 'cooalianza2026', rol: 'superadmin', nombre: 'Jefa Leidis' },
        'ingenieros': { password: 'omp2026', rol: 'superadmin', nombre: 'INGENIEROS OMP' },
        'operario1': { password: 'granja2026', rol: 'cliente', nombre: 'Operario Granja' },
        'demo': { password: 'demo', rol: 'cliente', nombre: 'Usuario Demo' }
      }
      
      if (validUsers[usuario] && validUsers[usuario].password === password) {
        setUser({ usuario, rol: validUsers[usuario].rol, nombre: validUsers[usuario].nombre })
        setPage(validUsers[usuario].rol === 'superadmin' ? 'superadmin' : 'cliente')
        setError('')
      } else {
        setError('Usuario o contraseña incorrectos')
      }
      setLoading(false)
    }, 800)
  }

  const handleLogout = () => {
    setUser(null)
    setPage('login')
    setUsuario('')
    setPassword('')
  }

  const toggleBomba = (id) => {
    setBombas(bombas.map(b => 
      b._id === id && b.conectada ? { ...b, estado: !b.estado } : b
    ))
  }

  const formatFecha = (fecha) => {
    return new Date(fecha).toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTempStatus = (temp) => {
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
            <div className="user-info">
              <UserCheck size={18} />
              <span>{user?.nombre}</span>
            </div>
            <button className="btn-logout" onClick={handleLogout}>
              <LogOut size={18} />
              Salir
            </button>
          </div>
        </header>

        <main className="dashboard">
          {/* Indicadores de conexión */}
          <div className="conexiones-bar">
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
          {sensores.temp_porqueriza >= 37 && (
            <div className={`alerta-banner ${sensores.temp_porqueriza >= 40 ? 'critico' : 'alerta'}`}>
              <AlertTriangle size={24} />
              <div>
                <strong>{sensores.temp_porqueriza >= 40 ? 'ALERTA CRÍTICA' : 'ATENCIÓN'}: Temperatura Elevada</strong>
                <p>Porqueriza a {sensores.temp_porqueriza}°C (Sensación: {sensacionTermica}°C) - Sistema de riego {sensores.temp_porqueriza >= 38 ? 'ACTIVADO' : 'en espera'}</p>
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
                  <span className="status-badge conectado"><Wifi size={14} /> En línea</span>
                </div>
                <div className="climate-data">
                  <div className="climate-item">
                    <Thermometer size={28} className="icon-temp" />
                    <div className="climate-value">
                      <span className="value">{sensores.temp_ambiente}</span>
                      <span className="unit">°C</span>
                    </div>
                    <span className="label">Temperatura</span>
                  </div>
                  <div className="climate-item">
                    <Droplets size={28} className="icon-humidity" />
                    <div className="climate-value">
                      <span className="value">{sensores.humedad_ambiente}</span>
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
                      <span className={`value ${tempStatus.clase}`}>{sensores.temp_porqueriza}</span>
                      <span className="unit">°C</span>
                    </div>
                    <span className="label">Temperatura</span>
                  </div>
                  <div className="climate-item">
                    <Droplets size={28} className="icon-humidity" />
                    <div className="climate-value">
                      <span className="value">{sensores.humedad_porqueriza}</span>
                      <span className="unit">%</span>
                    </div>
                    <span className="label">Humedad</span>
                  </div>
                  <div className="climate-item">
                    <Wind size={28} className="icon-wind" />
                    <div className="climate-value">
                      <span className={`value ${sensacionTermica >= 45 ? 'critico' : sensacionTermica >= 40 ? 'alerta' : ''}`}>
                        {sensacionTermica}
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
              {/* Tanques */}
              <div className="card tanques-card">
                <h3><Waves size={18} /> Nivel de Tanques</h3>
                <div className="tanques-container">
                  <div className="tanque">
                    <div className="tanque-visual">
                      <div 
                        className={`tanque-nivel ${sensores.nivel_tanque1 < 30 ? 'bajo' : sensores.nivel_tanque1 < 50 ? 'medio' : 'alto'}`}
                        style={{ height: `${sensores.nivel_tanque1}%` }}
                      ></div>
                    </div>
                    <div className="tanque-info">
                      <span className="tanque-nombre">Principal</span>
                      <span className="tanque-porcentaje">{sensores.nivel_tanque1}%</span>
                    </div>
                  </div>
                  <div className="tanque">
                    <div className="tanque-visual">
                      <div 
                        className={`tanque-nivel ${sensores.nivel_tanque2 < 30 ? 'bajo' : sensores.nivel_tanque2 < 50 ? 'medio' : 'alto'}`}
                        style={{ height: `${sensores.nivel_tanque2}%` }}
                      ></div>
                    </div>
                    <div className="tanque-info">
                      <span className="tanque-nombre">Reserva</span>
                      <span className="tanque-porcentaje">{sensores.nivel_tanque2}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Consumo */}
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
                    <span className="consumo-value">{sensores.flujo} L/min</span>
                  </div>
                </div>
                <div className="consumo-grafica">
                  <span className="grafica-titulo">Últimos 7 días</span>
                  <div className="barras-container">
                    {consumoSemanal.map((d, i) => (
                      <div key={i} className="barra-item">
                        <div 
                          className="barra" 
                          style={{ height: `${(d.litros / 1000) * 100}%` }}
                          title={`${d.litros} L`}
                        ></div>
                        <span className="barra-label">{d.dia}</span>
                      </div>
                    ))}
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
                  <span className="peso-valor">{ultimoPeso.peso}</span>
                  <span className="peso-unidad">kg</span>
                </div>
                <div className="peso-info">
                  <span className="peso-tipo">{ultimoPeso.tipo === 'cerda_adulta' ? '🐷 Cerda adulta' : '🐽 Lechón'}</span>
                  <span className="peso-fecha">{formatFecha(ultimoPeso.fecha)}</span>
                </div>
              </div>

              <div className="card historial-peso-card">
                <h3><Activity size={18} /> Historial de Pesajes</h3>
                <div className="tabla-scroll">
                  <table className="tabla-pesajes">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Hora</th>
                        <th>Peso</th>
                        <th>Tipo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historialPeso.slice(0, 10).map((p, i) => (
                        <tr key={i}>
                          <td>{p.fecha}</td>
                          <td>{p.hora}</td>
                          <td><strong>{p.peso} kg</strong></td>
                          <td>
                            <span className={`tipo-badge ${p.tipo === 'Cerda adulta' ? 'adulta' : 'lechon'}`}>
                              {p.tipo}
                            </span>
                          </td>
                        </tr>
                      ))}
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
              {bombas.map((bomba) => (
                <div key={bomba._id} className={`bomba-card ${!bomba.conectada ? 'desconectada' : bomba.estado ? 'encendida' : 'apagada'}`}>
                  <div className="bomba-header">
                    {bomba.conectada ? (
                      bomba.estado ? <Power size={24} className="icon-on" /> : <PowerOff size={24} className="icon-off" />
                    ) : (
                      <WifiOff size={24} className="icon-disconnected" />
                    )}
                    <span className="bomba-nombre">{bomba.nombre}</span>
                  </div>
                  <div className="bomba-status">
                    {!bomba.conectada ? (
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
                    disabled={!bomba.conectada}
                  >
                    {bomba.conectada ? (bomba.estado ? 'Apagar' : 'Encender') : 'No disponible'}
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
            
            <div className="alertas-lista">
              {alertas.map((alerta) => (
                <div key={alerta._id} className={`alerta-item ${alerta.critica ? 'critica' : ''}`}>
                  <div className="alerta-icon">
                    {alerta.critica ? <AlertTriangle size={20} /> : <AlertCircle size={20} />}
                  </div>
                  <div className="alerta-content">
                    <p className="alerta-mensaje">{alerta.mensaje}</p>
                    <span className="alerta-fecha">{formatFecha(alerta.fecha)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    )
  }

  // ==================== RENDER DASHBOARD SUPERADMIN ====================
  if (page === 'superadmin') {
    const sesionesActivas = sessions.filter(s => !s.fecha_salida).length

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
                <span className="stat-value">{alertas.filter(a => a.critica).length}</span>
                <span className="stat-label">Alertas</span>
              </div>
            </div>
          </div>

          {/* Granjas */}
          <section className="section">
            <div className="section-header">
              <h2><Home size={20} /> Granjas Registradas</h2>
              <button className="btn-add"><Plus size={16} /> Nueva Granja</button>
            </div>
            
            <div className="tabla-container">
              <table className="tabla-admin">
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
                  {farms.map((farm) => (
                    <tr key={farm._id}>
                      <td><strong>{farm.nombre}</strong></td>
                      <td>{farm.ubicacion}</td>
                      <td>{farm.propietario}</td>
                      <td>{farm.telefono}</td>
                      <td>
                        <span className={`estado-badge ${farm.activo ? 'activo' : 'inactivo'}`}>
                          {farm.activo ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td>
                        <button className="btn-icon" title="Editar"><RefreshCw size={16} /></button>
                        <button className="btn-icon danger" title="Eliminar"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Usuarios */}
          <section className="section">
            <div className="section-header">
              <h2><Users size={20} /> Gestión de Usuarios</h2>
              <button className="btn-add"><Plus size={16} /> Nuevo Usuario</button>
            </div>
            
            <div className="tabla-container">
              <table className="tabla-admin">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Correo</th>
                    <th>Rol</th>
                    <th>Último acceso</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id}>
                      <td><strong>{u.usuario}</strong></td>
                      <td>{u.correo}</td>
                      <td>
                        <span className={`rol-badge ${u.rol}`}>
                          {u.rol === 'superadmin' ? 'Admin' : 'Cliente'}
                        </span>
                      </td>
                      <td>{formatFecha(u.ultimo_acceso)}</td>
                      <td>
                        <span className={`estado-badge ${u.activo ? 'activo' : 'inactivo'}`}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <button className="btn-icon" title={u.activo ? 'Desactivar' : 'Activar'}>
                          {u.activo ? <UserX size={16} /> : <UserCheck size={16} />}
                        </button>
                        <button className="btn-icon danger" title="Eliminar"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
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
                    <th>Duración</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => {
                    const duracion = s.fecha_salida 
                      ? Math.round((new Date(s.fecha_salida) - new Date(s.fecha_entrada)) / 60000)
                      : Math.round((new Date() - new Date(s.fecha_entrada)) / 60000)
                    const horas = Math.floor(duracion / 60)
                    const mins = duracion % 60
                    
                    return (
                      <tr key={s._id}>
                        <td><strong>{s.usuario}</strong></td>
                        <td>{formatFecha(s.fecha_entrada)}</td>
                        <td>{s.fecha_salida ? formatFecha(s.fecha_salida) : '-'}</td>
                        <td>{horas > 0 ? `${horas}h ${mins}m` : `${mins}m`}</td>
                        <td>
                          <span className={`estado-badge ${s.fecha_salida ? 'cerrada' : 'activo'}`}>
                            {s.fecha_salida ? 'Cerrada' : 'En línea'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Exportar */}
          <section className="section">
            <div className="section-header">
              <h2><FileSpreadsheet size={20} /> Reportes</h2>
            </div>
            
            <div className="reportes-grid">
              <button className="btn-reporte">
                <Download size={20} />
                <span>Exportar Datos Sensores</span>
              </button>
              <button className="btn-reporte">
                <Download size={20} />
                <span>Exportar Pesajes</span>
              </button>
              <button className="btn-reporte">
                <Download size={20} />
                <span>Exportar Consumo Agua</span>
              </button>
              <button className="btn-reporte">
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