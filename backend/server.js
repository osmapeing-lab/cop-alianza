const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const connectDB = require('./config/db');

const sensorRoutes = require('./routes/sensors');
const motorbombRoutes = require('./routes/motorbombs');
const userRoutes = require('./routes/users');
const alertRoutes = require('./routes/alerts');
const sessionRoutes = require('./routes/sessions');
const configRoutes = require('./routes/config');
const waterRoutes = require('./routes/water');
const farmRoutes = require('./routes/farms');
const espRoutes = require('./routes/esp');
const emailRoutes = require('./routes/email');
const Session = require('./models/Session');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

connectDB();

app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/sensors', sensorRoutes);
app.use('/api/motorbombs', motorbombRoutes);
app.use('/api/users', userRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/config', configRoutes);
app.use('/api/water', waterRoutes);
app.use('/api/farms', farmRoutes);
app.use('/api/esp', espRoutes);
app.use('/api/email', emailRoutes);

app.get('/', (req, res) => {
  res.json({ mensaje: 'API COP Alianza v2.0 - Sistema Profesional' });
});

// Limpiar sesiones expiradas cada 5 minutos
setInterval(async () => {
  try {
    const resultado = await Session.updateMany(
      { activa: true, expira_en: { $lt: new Date() } },
      { activa: false, fecha_salida: new Date() }
    );
    if (resultado.modifiedCount > 0) {
      console.log(`${resultado.modifiedCount} sesiones expiradas cerradas`);
    }
  } catch (error) {
    console.log('Error limpiando sesiones:', error.message);
  }
}, 5 * 60 * 1000);

// WebSocket
io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);
  
  socket.on('toggle_bomba', (data) => {
    io.emit('bomba_actualizada', data);
  });

  socket.on('nueva_lectura', (data) => {
    io.emit('lectura_actualizada', data);
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Servidor COP Alianza corriendo en puerto ${PORT}`);
});
```

**Paso 8:** Actualiza `.env` agregando las variables de WhatsApp:
```
PORT=5000
MONGODB_URI=tu_string_mongodb
JWT_SECRET=cop_alianza_secreto_2026
WHATSAPP_NUMBER=573001234567
WHATSAPP_APIKEY=tu_apikey_callmebot