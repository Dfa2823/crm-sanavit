const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const { auditLog } = require('../middleware/audit');

const router = express.Router();

// Rate limiter específico para login: 5 intentos fallidos cada 15 min
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos de login. Espera 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  }

  try {
    const result = await pool.query(`
      SELECT u.id, u.nombre, u.username, u.password_hash, u.activo, u.permisos,
             r.nombre AS rol, r.label AS rol_label,
             s.id AS sala_id, s.nombre AS sala_nombre, s.ciudad AS sala_ciudad
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      LEFT JOIN salas s ON u.sala_id = s.id
      WHERE u.username = $1
    `, [username]);

    if (result.rows.length === 0) {
      const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
      auditLog({ username, accion: 'login_fallido', tabla: 'usuarios', registro_id: null, datos_despues: { razon: 'usuario_no_existe' }, ip });
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const user = result.rows[0];

    if (!user.activo) {
      const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
      auditLog({ usuario_id: user.id, username, accion: 'login_fallido', tabla: 'usuarios', registro_id: user.id, datos_despues: { razon: 'usuario_inactivo' }, ip });
      return res.status(403).json({ error: 'Usuario inactivo. Contacte al administrador.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
      auditLog({ usuario_id: user.id, username, accion: 'login_fallido', tabla: 'usuarios', registro_id: user.id, datos_despues: { razon: 'password_incorrecto' }, ip });
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const payload = {
      id: user.id,
      nombre: user.nombre,
      username: user.username,
      rol: user.rol,
      rol_label: user.rol_label,
      sala_id: user.sala_id,
      sala_nombre: user.sala_nombre,
      sala_ciudad: user.sala_ciudad,
      permisos: user.permisos || null,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    auditLog({ usuario_id: user.id, username: user.username, accion: 'login_exitoso', tabla: 'usuarios', registro_id: user.id, ip });

    res.json({
      token,
      usuario: payload,
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/auth/me — verificar token activo
router.get('/me', require('../middleware/auth'), async (req, res) => {
  res.json({ usuario: req.user });
});

module.exports = router;
