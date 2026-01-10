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

const { verificarUmbrales } = require('./controllers/configController');
const Alert = require('./models/Alert');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

connectDB();

app.use(cors());
app.use(express.json());

app.use('/api/sensors', sensorRoutes);
app.use('/api/motorbombs', motorbombRoutes);
app.use('/api/users', userRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/config', configRoutes);
app.use('/api/water', waterRoutes);
app.use('/api/farms', farmRoutes);

app.get('/', (req, res) => {
  res.json({ mensaje: 'API COP Alianza funcionando' });
});

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);
  
  socket.on('toggle_bomba', (data) => {
    io.emit('bomba_actualizada', data);
  });

  socket.on('nueva_lectura', async (data) => {
    io.emit('lectura_actualizada', data);
    
    if (data.temperatura && data.humedad) {
      const resultado = await verificarUmbrales(data.temperatura, data.humedad);
      if (resultado && resultado.alerta) {
        const alert = new Alert({
          tipo: resultado.alerta.tipo,
          mensaje: resultado.alerta.mensaje,
          enviado_whatsapp: false,
          enviado_email: false
        });
        await alert.save();
        io.emit('nueva_alerta', alert);
        io.emit('bomba_automatica', { activada: true, razon: resultado.alerta.mensaje });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});