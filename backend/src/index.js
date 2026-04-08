require('dotenv').config();

// ── Timezone Ecuador (UTC-5) ─────────────────────────────────
// DEBE ir antes de cualquier new Date() para que Node.js
// use America/Guayaquil en todas las operaciones de fecha.
process.env.TZ = 'America/Guayaquil';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Seguridad HTTP headers ────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

// ── Compresión gzip ───────────────────────────────────────
app.use(compression());

// ── Rate limiter global: 200 req/min por IP ───────────────
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' },
});
app.use(globalLimiter);

// ── Middlewares globales ───────────────────────────────────
app.use(cors({
  origin: function(origin, callback) {
    // Permitir requests sin origin (mobile, curl, postman)
    if (!origin) return callback(null, true);
    const allowed = [
      process.env.FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:4173',
    ].filter(Boolean);
    // Permitir cualquier *.railway.app y *.up.railway.app
    if (allowed.includes(origin) || /\.railway\.app$/.test(origin)) {
      return callback(null, true);
    }
    callback(new Error('CORS no permitido'));
  },
  credentials: true,
}));
app.use(express.json());

// ── Request logger ────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    if (res.statusCode >= 400) {
      console.error(`[${res.statusCode}] ${req.method} ${req.path} ${ms}ms ${req.user?.username || 'anon'}`);
    }
  });
  next();
});

// Servir archivos estáticos (documentos subidos)
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Swagger / OpenAPI docs ────────────────────────────────
const { setupSwagger } = require('./swagger');
setupSwagger(app);

// ── Middlewares de autenticación ───────────────────────────
const authMiddleware = require('./middleware/auth');

// ── Tenant middleware (multi-tenancy base) ────────────────
const tenantMiddleware = require('./middleware/tenant');

// ── Audit trail middleware ────────────────────────────────
const { auditMiddleware } = require('./middleware/audit');
app.use(auditMiddleware);

// ── Rutas ─────────────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/personas',  require('./routes/personas'));
app.use('/api/leads',     require('./routes/leads'));
app.use('/api/citas',     require('./routes/citas'));
app.use('/api/usuarios',  require('./routes/usuarios'));
app.use('/api/kpis',      require('./routes/kpis'));
app.use('/api/admin',     authMiddleware, tenantMiddleware, require('./routes/admin'));
app.use('/api/admin/tenants', authMiddleware, tenantMiddleware, require('./routes/tenants'));
app.use('/api/cartera',   authMiddleware, tenantMiddleware, require('./routes/cartera'));
app.use('/api/reportes',  authMiddleware, tenantMiddleware, require('./routes/reportes'));
app.use('/api/outsourcing', authMiddleware, tenantMiddleware, require('./routes/outsourcing'));
app.use('/api/comisiones', authMiddleware, tenantMiddleware, require('./routes/comisiones'));
app.use('/api/sac',        authMiddleware, tenantMiddleware, require('./routes/sac'));
app.use('/api/supervisor', authMiddleware, tenantMiddleware, require('./routes/supervisor'));
app.use('/api/inventario',   authMiddleware, tenantMiddleware, require('./routes/inventario'));
app.use('/api/alertas',      authMiddleware, tenantMiddleware, require('./routes/alertas'));
app.use('/api/liquidaciones', authMiddleware, tenantMiddleware, require('./routes/liquidaciones'));
app.use('/api/perfil',       authMiddleware, tenantMiddleware, require('./routes/perfil'));
app.use('/api/importar',     authMiddleware, tenantMiddleware, require('./routes/importar'));
app.use('/api/nomina',       authMiddleware, tenantMiddleware, require('./routes/nomina'));
app.use('/api/metas',        authMiddleware, tenantMiddleware, require('./routes/metas'));
app.use('/api/buscar',       authMiddleware, tenantMiddleware, require('./routes/buscar'));
app.use('/api/consultor',    authMiddleware, tenantMiddleware, require('./routes/consultor'));

app.use('/api/productos', authMiddleware, tenantMiddleware, require('./routes/productos'));
app.use('/api/ventas',    authMiddleware, tenantMiddleware, require('./routes/ventas'));
app.use('/api/recibos',   authMiddleware, tenantMiddleware, require('./routes/recibos'));

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
            '/api/nomina','/api/metas','/api/buscar','/api/consultor',
            '/api/admin/tenants'],
  });
});

// ── Migración multi-tenancy al arrancar ─────────────────────
require('./migrations/tenants')().catch(e => console.warn('[TENANTS]', e.message));

// ── Crear índices de rendimiento al arrancar ────────────────
require('./migrations/indices')().catch(e => console.warn('[INDICES]', e.message));

// ── 404 fallback ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Ruta ${req.method} ${req.path} no encontrada` });
});

// ── Error handler centralizado ─────────────────────────────
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Error interno del servidor'
      : err.message,
  });
});

// ── Arrancar servidor ──────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ CRM Sanavit Backend corriendo en puerto ${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
});
