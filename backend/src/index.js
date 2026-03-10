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

// ── Health check ───────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    sistema: 'CRM Sanavit Ecuador',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
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
