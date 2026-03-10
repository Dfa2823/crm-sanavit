require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middlewares globales ───────────────────────────────────
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://localhost:4173',
  ],
  credentials: true,
}));
app.use(express.json());

// ── Middlewares de autenticación ───────────────────────────
const authMiddleware = require('./middleware/auth');

// ── Rutas ─────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/personas',  require('./routes/personas'));
app.use('/api/leads',     require('./routes/leads'));
app.use('/api/citas',     require('./routes/citas'));
app.use('/api/usuarios',  require('./routes/usuarios'));
app.use('/api/kpis',      require('./routes/kpis'));
app.use('/api/admin',     authMiddleware, require('./routes/admin'));
app.use('/api/cartera',   authMiddleware, require('./routes/cartera'));
app.use('/api/reportes',  authMiddleware, require('./routes/reportes'));
app.use('/api/outsourcing', authMiddleware, require('./routes/outsourcing'));
app.use('/api/comisiones', authMiddleware, require('./routes/comisiones'));

const productosRouter = require('./routes/productos');
const ventasRouter = require('./routes/ventas');
const recibosRouter = require('./routes/recibos');

app.use('/api/productos', productosRouter);
app.use('/api/ventas', ventasRouter);
app.use('/api/recibos', recibosRouter);

// ── Health check ───────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    sistema: 'CRM Sanavit Ecuador',
    version: '2.0.0',
    fase: 'Fase 3 - Productos, Ventas, Recibos',
    timestamp: new Date().toISOString(),
    rutas: ['/api/auth','/api/personas','/api/leads','/api/citas','/api/kpis',
            '/api/admin','/api/cartera','/api/reportes','/api/outsourcing',
            '/api/comisiones','/api/productos','/api/ventas','/api/recibos'],
  });
});

// ── 404 fallback ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Ruta ${req.method} ${req.path} no encontrada` });
});

// ── Error global ───────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ── Arrancar servidor ──────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ CRM Sanavit Backend corriendo en puerto ${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
});
