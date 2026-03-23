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

// Servir archivos estáticos (documentos subidos)
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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
app.use('/api/sac',        authMiddleware, require('./routes/sac'));
app.use('/api/supervisor', authMiddleware, require('./routes/supervisor'));
app.use('/api/inventario',   authMiddleware, require('./routes/inventario'));
app.use('/api/alertas',      authMiddleware, require('./routes/alertas'));
app.use('/api/liquidaciones', authMiddleware, require('./routes/liquidaciones'));
app.use('/api/perfil',       authMiddleware, require('./routes/perfil'));
app.use('/api/importar',     authMiddleware, require('./routes/importar'));
app.use('/api/nomina',       authMiddleware, require('./routes/nomina'));
app.use('/api/metas',        authMiddleware, require('./routes/metas'));
app.use('/api/buscar',       authMiddleware, require('./routes/buscar'));
app.use('/api/consultor',    authMiddleware, require('./routes/consultor'));

app.use('/api/productos', authMiddleware, require('./routes/productos'));
app.use('/api/ventas',    authMiddleware, require('./routes/ventas'));
app.use('/api/recibos',   authMiddleware, require('./routes/recibos'));

// ── Health check ───────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    sistema: 'CRM Sanavit Ecuador',
    version: '2.0.0',
    fase: 'Fases 12–19 — Nómina, Metas, Timeline, Búsqueda Global, Notificaciones, Gráficos, Firma Digital, Dark Mode',
    timestamp: new Date().toISOString(),
    rutas: ['/api/auth','/api/personas','/api/leads','/api/citas','/api/kpis',
            '/api/admin','/api/cartera','/api/reportes','/api/outsourcing',
            '/api/comisiones','/api/sac','/api/supervisor','/api/inventario',
            '/api/productos','/api/ventas','/api/recibos',
            '/api/alertas','/api/liquidaciones','/api/perfil','/api/importar',
            '/api/nomina','/api/metas','/api/buscar','/api/consultor'],
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
