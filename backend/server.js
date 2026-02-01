const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const connectDB = require('./config/db');

// Rutas
const sensorRoutes = require('./routes/sensors');
const motorbombRoutes = require('./routes/motorbombs');
const userRoutes = require('./routes/users');
const alertRoutes = require('./routes/alerts');
const sessionRoutes = require('./routes/sessions');
const configRoutes = require('./routes/config');
const waterRoutes = require('./routes/water');
const farmRoutes = require('./routes/farms');
const espRoutes = require('./routes/esp');
const reporteRoutes = require('./routes/reporte');
const idtoluRoutes = require('./routes/idtolu');
const Session = require('./models/Session');
const loteRoutes = require('./routes/lotes');
const contabilidadRoutes = require('./routes/contabilidad');
const pesajeRoutes = require('./routes/pesajes');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

connectDB();

app.use(cors());
app.use(express.json());

// Pasar io a las rutas
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Rutas API
app.use('/api/sensors', sensorRoutes);
app.use('/api/motorbombs', motorbombRoutes);
app.use('/api/users', userRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/config', configRoutes);
app.use('/api/water', waterRoutes);
app.use('/api/farms', farmRoutes);
app.use('/api/esp', espRoutes);
app.use('/api/reporte', reporteRoutes);
app.use('/api/idtolu', idtoluRoutes);
app.use('/api/lotes', loteRoutes);
app.use('/api/contabilidad', contabilidadRoutes);
app.use('/api/pesajes', pesajeRoutes);


app.get('/', (req, res) => {
  res.json({ 
    mensaje: 'API COP Alianza v2.0',
    estado: 'Funcionando',
    endpoints: {
      sensores: '/api/sensors',
      bombas: '/api/motorbombs',
      usuarios: '/api/users',
      alertas: '/api/alerts',
      sesiones: '/api/sessions',
      config: '/api/config',
      agua: '/api/water',
      granjas: '/api/farms',
      esp32: '/api/esp',
      reportes: '/api/reporte',
      idtolu: '/api/idtolu'
    }
  });
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

