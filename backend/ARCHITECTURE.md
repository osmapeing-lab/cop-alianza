# Backend COP Alianza - Documentacion de Arquitectura

## Descripcion General

Sistema backend para gestion de granjas con monitoreo IoT, control automatico de bombas de riego, alertas en tiempo real y seguimiento de consumo de agua.

---

## Stack Tecnologico

| Componente | Tecnologia | Version |
|------------|-----------|---------|
| Runtime | Node.js | - |
| Framework | Express.js | 5.2.1 |
| Base de datos | MongoDB | - |
| ODM | Mongoose | 9.1.2 |
| Autenticacion | JWT | 9.0.3 |
| Encriptacion | bcryptjs | 3.0.3 |
| WebSockets | Socket.io | 4.8.3 |
| CORS | cors | 2.8.5 |
| Variables de entorno | dotenv | 17.2.3 |

---

## Estructura del Proyecto

```
backend/
├── config/
│   └── db.js                 # Conexion a MongoDB
├── controllers/
│   ├── userController.js     # Gestion de usuarios
│   ├── sensorController.js   # Sensores y lecturas
│   ├── motorbombController.js # Control de bombas
│   ├── alertController.js    # Sistema de alertas
│   ├── sessionController.js  # Auditoria de sesiones
│   ├── configController.js   # Configuracion y umbrales
│   ├── waterController.js    # Consumo de agua
│   └── farmController.js     # Gestion de granjas
├── models/
│   ├── User.js               # Usuarios del sistema
│   ├── Sensor.js             # Dispositivos IoT
│   ├── Reading.js            # Lecturas de sensores
│   ├── Motorbomb.js          # Bombas de riego
│   ├── Alert.js              # Alertas generadas
│   ├── Farm.js               # Granjas/locales
│   ├── Config.js             # Configuracion por granja
│   ├── Session.js            # Sesiones de usuario
│   ├── Weighing.js           # Pesaje de animales
│   └── WaterConsumption.js   # Consumo de agua
├── routes/
│   ├── users.js
│   ├── sensors.js
│   ├── motorbombs.js
│   ├── alerts.js
│   ├── sessions.js
│   ├── config.js
│   ├── water.js
│   └── farms.js
├── .env                      # Variables de entorno
├── server.js                 # Punto de entrada
└── package.json
```

---

## Arquitectura

### Patron de Diseno: MVC (Model-View-Controller)

```
Cliente (Frontend / IoT)
         │
         ▼
    ┌─────────┐
    │ Routes  │  ← Definicion de endpoints HTTP
    └────┬────┘
         │
         ▼
  ┌──────────────┐
  │ Controllers  │  ← Logica de negocio
  └──────┬───────┘
         │
         ▼
    ┌─────────┐
    │ Models  │  ← Esquemas Mongoose
    └────┬────┘
         │
         ▼
    ┌─────────┐
    │ MongoDB │  ← Persistencia
    └─────────┘
```

### Comunicacion en Tiempo Real

```
Frontend ◄──────► Socket.io ◄──────► Backend
                     │
         ┌───────────┼───────────┐
         │           │           │
    Lecturas     Bombas      Alertas
    Sensores    (toggle)   (automaticas)
```

---

## Modelos de Datos

### User (Usuario)
```javascript
{
  usuario: String,        // Unico
  correo: String,         // Unico
  password: String,       // Hasheada con bcrypt
  rol: ['superadmin', 'cliente'],
  granja_id: ObjectId,    // Referencia a Farm
  activo: Boolean,
  ultimo_acceso: Date
}
```

### Sensor
```javascript
{
  codigo_sensor: String,  // Unico
  tipo: ['temperatura', 'humedad', 'nivel', 'flujo', 'peso'],
  ubicacion: String,
  estado: ['activo', 'inactivo', 'mantenimiento']
}
```

### Reading (Lectura)
```javascript
{
  sensor: String,
  valor: Number,
  unidad: String,
  fecha: Date
}
```

### Motorbomb (Bomba)
```javascript
{
  codigo_bomba: String,   // Unico
  nombre: String,
  estado: Boolean,        // true = encendida
  fecha_cambio: Date
}
```

### Alert (Alerta)
```javascript
{
  tipo: String,
  mensaje: String,
  enviado_whatsapp: Boolean,
  enviado_email: Boolean,
  fecha: Date
}
```

### Farm (Granja)
```javascript
{
  nombre: String,
  ubicacion: String,
  propietario: String,
  telefono: String,
  email: String,
  activo: Boolean,
  fecha_registro: Date
}
```

### Config (Configuracion)
```javascript
{
  granja_id: ObjectId,
  umbral_temp_max: Number,    // Default: 32
  umbral_temp_min: Number,    // Default: 18
  umbral_humedad_max: Number, // Default: 85
  alerta_activa: Boolean,
  bomba_automatica: Boolean,
  telefono_alerta: String,
  email_alerta: String
}
```

### WaterConsumption (Consumo de Agua)
```javascript
{
  granja_id: ObjectId,
  fecha: Date,
  litros: Number,
  tipo: ['lectura', 'diario', 'mensual']
}
```

### Session (Sesion)
```javascript
{
  usuario_id: ObjectId,
  usuario: String,
  fecha_entrada: Date,
  fecha_salida: Date,
  ip: String
}
```

### Weighing (Pesaje)
```javascript
{
  cerdo: String,
  peso: Number,
  unidad: String,         // Default: 'kg'
  validado: Boolean
}
```

### Relaciones entre Entidades

```
User ───────────────┐
  │                 │
  └─► Farm ◄────────┤
       │            │
       ├─► Config   │
       │            │
       └─► WaterConsumption
                    │
Session ◄───────────┘

Sensor ───► Reading

Motorbomb (independiente, controlado por Config)

Alert (generada automaticamente)
```

---

## API REST - Endpoints

### Base URL: `http://localhost:5000/api`

### Usuarios `/api/users`

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/register` | Registrar nuevo usuario |
| POST | `/login` | Autenticar usuario |
| GET | `/` | Listar usuarios |
| PUT | `/:id/toggle` | Activar/desactivar usuario |
| DELETE | `/:id` | Eliminar usuario |

**Login Response:**
```json
{
  "token": "JWT_TOKEN",
  "usuario": "admin",
  "rol": "superadmin",
  "session_id": "SESSION_ID"
}
```

### Sensores `/api/sensors`

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/` | Listar sensores |
| POST | `/` | Crear sensor |
| GET | `/readings` | Ultimas 100 lecturas |
| POST | `/readings` | Registrar lectura |

### Bombas `/api/motorbombs`

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/` | Listar bombas |
| POST | `/` | Crear bomba |
| PUT | `/:id/toggle` | Encender/apagar bomba |

### Alertas `/api/alerts`

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/` | Ultimas 50 alertas |
| POST | `/` | Crear alerta |

### Sesiones `/api/sessions`

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/` | Historial de sesiones |

### Configuracion `/api/config`

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/` | Obtener configuracion |
| PUT | `/` | Actualizar configuracion |

### Consumo de Agua `/api/water`

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | `/` | Registrar consumo |
| GET | `/diario` | Consumo del dia |
| GET | `/mensual` | Consumo del mes |
| GET | `/historial` | Historial de consumo |

### Granjas `/api/farms`

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/` | Listar granjas |
| POST | `/` | Crear granja |
| PUT | `/:id` | Actualizar granja |
| PUT | `/:id/toggle` | Activar/desactivar |
| DELETE | `/:id` | Eliminar granja |

---

## WebSockets (Socket.io)

### Eventos Cliente → Servidor

| Evento | Payload | Descripcion |
|--------|---------|-------------|
| `toggle_bomba` | `{ bomba_id }` | Cambiar estado de bomba |
| `nueva_lectura` | `{ sensor, temperatura, humedad }` | Enviar lectura |

### Eventos Servidor → Cliente

| Evento | Payload | Descripcion |
|--------|---------|-------------|
| `bomba_actualizada` | `{ bomba }` | Confirmacion de cambio |
| `lectura_actualizada` | `{ lectura }` | Confirmacion de lectura |
| `nueva_alerta` | `{ alerta }` | Alerta generada |
| `bomba_automatica` | `{ bomba }` | Bomba activada automaticamente |

### Flujo de Control Automatico

```
1. Cliente envia 'nueva_lectura' con temperatura y humedad
                    │
                    ▼
2. Server ejecuta verificarUmbrales()
                    │
                    ▼
3. ┌─ Temperatura > umbral_max? ─────────────────┐
   │                                              │
   │ SI                                        NO │
   ▼                                              ▼
4. Crear Alert                              Emitir solo
   Activar Motorbomb (si bomba_automatica)  'lectura_actualizada'
   Emitir 'nueva_alerta'
   Emitir 'bomba_automatica'
```

---

## Logica de Negocio Clave

### Calculo de Sensacion Termica

Implementado en `configController.js`:

```javascript
// Formula Heat Index (solo si temperatura >= 27°C)
ST = -8.784 + 1.611×T + 2.338×H - 0.146×T×H

// Donde:
// T = temperatura en °C
// H = humedad en %
// ST = sensacion termica
```

### Verificacion de Umbrales

1. Compara temperatura con `umbral_temp_max` y `umbral_temp_min`
2. Si excede limites y `alerta_activa = true`:
   - Genera alerta
   - Activa bomba si `bomba_automatica = true`
3. Retorna sensacion termica calculada

---

## Configuracion

### Variables de Entorno (`.env`)

```env
PORT=5000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=cop_alianza_secreto_2026
```

### JWT

- Algoritmo: HS256
- Expiracion: 24 horas
- Payload: `{ id, usuario, rol }`

---

## Middlewares

| Middleware | Funcion |
|------------|---------|
| `cors()` | Permite requests cross-origin |
| `express.json()` | Parsea body JSON |
| Socket.io CORS | Permite WebSockets cross-origin |

---

## Flujos Principales

### 1. Autenticacion de Usuario

```
POST /api/users/login
         │
         ▼
Buscar usuario en BD
         │
         ▼
Validar password con bcrypt
         │
         ▼
Generar JWT (24h)
         │
         ▼
Registrar sesion
         │
         ▼
Retornar { token, usuario, rol, session_id }
```

### 2. Monitoreo de Sensores

```
Dispositivo IoT
      │
      ▼
Socket.io 'nueva_lectura'
      │
      ▼
Guardar en Reading
      │
      ▼
verificarUmbrales()
      │
      ├─► Alerta? → Notificar + Activar bomba
      │
      └─► Broadcast 'lectura_actualizada'
```

### 3. Control de Bombas

```
Usuario toggle
      │
      ▼
PUT /api/motorbombs/:id/toggle
      │
      ▼
Invertir estado en BD
      │
      ▼
Registrar fecha_cambio
      │
      ▼
Socket.io 'bomba_actualizada'
```

---

## Ejecucion

### Desarrollo

```bash
npm install
npm run dev
```

### Produccion

```bash
npm start
```

### Puerto por defecto: `5000`

---

## Dependencias

```json
{
  "bcryptjs": "^3.0.3",
  "cors": "^2.8.5",
  "dotenv": "^17.2.3",
  "express": "^5.2.1",
  "jsonwebtoken": "^9.0.3",
  "mongoose": "^9.1.2",
  "socket.io": "^4.8.3"
}
```

---

## Resumen

- **10 modelos** de datos
- **8 controladores** con logica de negocio
- **~30 endpoints** REST
- **4 eventos** Socket.io
- Autenticacion JWT
- Control automatico de bombas por umbrales
- Alertas en tiempo real
- Auditoria de sesiones
- Gestion multi-granja
