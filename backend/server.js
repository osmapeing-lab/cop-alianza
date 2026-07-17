  const express = require('express');
  const cors = require('cors');
  const http = require('http');
  const { Server } = require('socket.io');
  require('dotenv').config();

  const connectDB = require('./config/db');

  // ═══════════════════════════════════════════════════════════════════════
  // IMPORTAR MODELOS (para limpiar sesiones)
  // ═══════════════════════════════════════════════════════════════════════
  const Session = require('./models/Session');

  // ═══════════════════════════════════════════════════════════════════════
  // IMPORTAR RUTAS
  // ═══════════════════════════════════════════════════════════════════════
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
  const loteRoutes = require('./routes/lotes');
  const contabilidadRoutes = require('./routes/contabilidad');
  const pesajeRoutes = require('./routes/pesajes');
  const camarasRoutes = require('./routes/camaras');
  const grabacionesRoutes = require('./routes/grabaciones');
  const ventasRoutes = require('./routes/ventas');
  const costosRoutes = require('./routes/costos');
const inventarioRoutes = require('./routes/inventario');
const inventarioAlimentoRoutes = require('./routes/inventarioAlimento');
const fcmRoutes = require('./routes/fcm');
const pushRoutes = require('./routes/push');
const mercadoRoutes = require('./routes/mercado');
const analyticsRoutes = require('./routes/analytics');
const adminAnalyticsRoutes = require('./routes/adminAnalytics');

  // ═══════════════════════════════════════════════════════════════════════
  // INICIALIZAR EXPRESS Y WEBSOCKET
  // ═══════════════════════════════════════════════════════════════════════
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { 
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE']
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // CONECTAR A MONGODB
  // ═══════════════════════════════════════════════════════════════════════
  connectDB();

  // ═══════════════════════════════════════════════════════════════════════
  // MIDDLEWARES
  // ═══════════════════════════════════════════════════════════════════════
  app.use(cors());
  app.use(express.json({ limit: '10mb' })); // ← Aumentado para imágenes base64
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Pasar io (WebSocket) a todas las rutas
  app.use((req, res, next) => {
    req.io = io;
    next();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // RUTAS API
  // ═══════════════════════════════════════════════════════════════════════

  // Rutas principales
  app.use('/api/users', userRoutes);
  app.use('/api/sensors', sensorRoutes);
  app.use('/api/motorbombs', motorbombRoutes);
  app.use('/api/alerts', alertRoutes);
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/config', configRoutes);
  app.use('/api/water', waterRoutes);
  app.use('/api/admin/farms', farmRoutes);
  app.use('/api/esp', espRoutes);
  app.use('/api/reporte', reporteRoutes);
  app.use('/api/idtolu', idtoluRoutes);

  // Rutas nuevas (sistema completo)
  app.use('/api/lotes', loteRoutes);
  app.use('/api/contabilidad', contabilidadRoutes);
  app.use('/api/pesajes', pesajeRoutes);
  app.use('/api/camaras', camarasRoutes);
  app.use('/api/grabaciones', grabacionesRoutes);
  app.use('/api/ventas', ventasRoutes);
  app.use('/api/costos', costosRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/inventario-alimento', inventarioAlimentoRoutes);
app.use('/api/fcm', fcmRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/mercado', mercadoRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin/analytics', adminAnalyticsRoutes);

  // ═══════════════════════════════════════════════════════════════════════
  // RUTA RAÍZ (Información de la API)
  // ═══════════════════════════════════════════════════════════════════════
  app.get('/', (req, res) => {
    res.json({ 
      mensaje: 'API COO Alianzas v2.5',
      estado: 'Funcionando ✅',
      version: '2.5.0',
      fecha: new Date().toISOString(),
      endpoints: {
        // Usuarios y autenticación
        usuarios: '/api/users',
        login: '/api/users/login',
        me: '/api/users/me',
        
        // Sensores y hardware
        sensores: '/api/sensors',
        esp32: '/api/esp',
        bombas: '/api/motorbombs',
        
        // Gestión de granja
        granjas: '/api/admin/farms',
        lotes: '/api/lotes',
        pesajes: '/api/pesajes',
        inventario: '/api/inventario',
        
        // Finanzas
        ventas: '/api/ventas',
        costos: '/api/costos',
        contabilidad: '/api/contabilidad',
        
        // Vigilancia
        camaras: '/api/camaras',
        grabaciones: '/api/grabaciones',
        
        // Sistema
        alertas: '/api/alerts',
        sesiones: '/api/sessions',
        config: '/api/config',
        agua: '/api/water',
        reportes: '/api/reporte',
        
        // Integración externa
        idtolu: '/api/idtolu'
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // RUTA DE HEALTH CHECK (para Render)
  // ═══════════════════════════════════════════════════════════════════════
  app.get('/health', (req, res) => {
    res.status(200).json({ 
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // MANEJO DE RUTAS NO ENCONTRADAS (404)
  // ═══════════════════════════════════════════════════════════════════════
  app.use((req, res) => {
    res.status(404).json({
      error: 'Ruta no encontrada',
      ruta: req.originalUrl,
      metodo: req.method,
      mensaje: 'Verifica la documentación en GET /',
      sugerencias: [
        'Verifica que la URL esté correctamente escrita',
        'Consulta GET / para ver endpoints disponibles',
        'Asegúrate de usar el método HTTP correcto'
      ]
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // MANEJO DE ERRORES GLOBAL
  // ═══════════════════════════════════════════════════════════════════════
  app.use((err, req, res, next) => {
    console.error('❌ Error no manejado:', err);
    
    res.status(err.status || 500).json({
      error: 'Error del servidor',
      mensaje: process.env.NODE_ENV === 'production' 
        ? 'Ocurrió un error interno' 
        : err.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // TAREAS PROGRAMADAS
  // ═══════════════════════════════════════════════════════════════════════

  const {
    revisarTareasDiarias,
    enviarResumenDiarioAgua,
    resetearNotificacionesDiarias,
    verificarPesajeSemanal,
    getTareaDiariaEjecutada,
    setTareaDiariaEjecutada,
    getResumenAguaEnviado,
    setResumenAguaEnviado
  } = require('./utils/notificationManager');

  // Limpiar sesiones expiradas cada 5 minutos
  setInterval(async () => {
    try {
      const resultado = await Session.updateMany(
        { activa: true, expira_en: { $lt: new Date() } },
        { activa: false, fecha_salida: new Date() }
      );
      if (resultado.modifiedCount > 0) {
        console.log(`✅ ${resultado.modifiedCount} sesiones expiradas cerradas`);
      }
    } catch (error) {
      console.error('❌ Error limpiando sesiones:', error.message);
    }
  }, 5 * 60 * 1000);

  // ═══════════════════════════════════════════════════════════════════════
  // CRON: Tareas diarias de salud/etapas y resumen de agua
  // Revisa cada 30 minutos si hay algo que notificar
  // ═══════════════════════════════════════════════════════════════════════

  // Estado de cron ahora persistido en BD (sobrevive reinicios de Render)

  setInterval(async () => {
    try {
      const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
      const hoy = ahora.toDateString();
      const hora = ahora.getHours();

      // Tareas de salud: ejecutar una vez al día a las 7 AM
      const tareaDiariaEjecutada = await getTareaDiariaEjecutada();
      if (hora >= 7 && hora < 8 && tareaDiariaEjecutada !== hoy) {
        await setTareaDiariaEjecutada(hoy);
        console.log('[CRON] Ejecutando tareas diarias de salud...');
        await revisarTareasDiarias();
        await verificarPesajeSemanal();
      }

      // Resumen de agua: enviar una vez al día a las 7 PM
      const resumenAguaEnviado = await getResumenAguaEnviado();
      if (hora >= 19 && hora < 20 && resumenAguaEnviado !== hoy) {
        await setResumenAguaEnviado(hoy);
        console.log('[CRON] Enviando resumen diario de agua...');
        await enviarResumenDiarioAgua();
      }

      // Reset de cooldowns a medianoche
      if (hora === 0 && tareaDiariaEjecutada && tareaDiariaEjecutada !== hoy) {
        await resetearNotificacionesDiarias();
      }
    } catch (error) {
      console.error('[CRON] Error:', error.message);
    }
  }, 30 * 60 * 1000); // Cada 30 minutos

  // ═══════════════════════════════════════════════════════════════════════
  // WEBSOCKET
  // ═══════════════════════════════════════════════════════════════════════
  io.on('connection', (socket) => {
    console.log('🔌 Cliente conectado:', socket.id);
    
    // Evento: Toggle de bomba
    socket.on('toggle_bomba', (data) => {
      console.log('💧 Bomba actualizada:', data);
      io.emit('bomba_actualizada', data);
    });

    // Evento: Nueva lectura de sensor
    socket.on('nueva_lectura', (data) => {
      console.log('📊 Nueva lectura:', data);
      io.emit('lectura_actualizada', data);
    });

    // Evento: Nuevo pesaje
    socket.on('nuevo_peso', (data) => {
      console.log('⚖️ Nuevo peso:', data);
      io.emit('nuevo_peso', data);
    });

    // Evento: Nueva alerta
    socket.on('nueva_alerta', (data) => {
      console.log('🚨 Nueva alerta:', data);
      io.emit('nueva_alerta', data);
    });

    // Evento: Desconexión
    socket.on('disconnect', () => {
      console.log('🔌 Cliente desconectado:', socket.id);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // INICIAR SERVIDOR
  // ═══════════════════════════════════════════════════════════════════════
  const PORT = process.env.PORT || 5000;

  server.listen(PORT, () => {
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`🚀 Servidor COO Alianzas v2.5 corriendo en puerto ${PORT}`);
    console.log(`📡 WebSocket habilitado`);
    console.log(`🌐 Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log(`⏰ Iniciado: ${new Date().toLocaleString()}`);
    console.log('═══════════════════════════════════════════════════════════');
  });

  // ═══════════════════════════════════════════════════════════════════════
  // MANEJO DE CIERRE GRACEFUL
  // ═══════════════════════════════════════════════════════════════════════
  process.on('SIGTERM', () => {
    console.log('⚠️ SIGTERM recibido, cerrando servidor...');
    server.close(() => {
      console.log('✅ Servidor cerrado correctamente');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('⚠️ SIGINT recibido, cerrando servidor...');
    server.close(() => {
      console.log('✅ Servidor cerrado correctamente');
      process.exit(0);
    });
  });