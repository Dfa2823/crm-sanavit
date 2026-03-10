const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const bcrypt = require('bcrypt');

const router = express.Router();

// GET /api/perfil/me — datos del usuario autenticado
router.get('/me', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.nombre, u.username, u.activo, u.created_at,
             r.nombre AS rol, r.label AS rol_label,
             s.nombre AS sala_nombre, s.ciudad AS sala_ciudad
      FROM usuarios u
      LEFT JOIN roles r ON u.rol_id = r.id
      LEFT JOIN salas s ON u.sala_id = s.id
      WHERE u.id = $1
    `, [req.user.id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/perfil/cambiar-password
router.patch('/cambiar-password', auth, async (req, res) => {
  const { password_actual, password_nuevo, password_confirmar } = req.body;

  if (!password_actual || !password_nuevo || !password_confirmar) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }
  if (password_nuevo.length < 6) {
    return res.status(400).json({ error: 'La nueva contrasena debe tener al menos 6 caracteres' });
  }
  if (password_nuevo !== password_confirmar) {
    return res.status(400).json({ error: 'Las contrasenas nuevas no coinciden' });
  }

  try {
    const userResult = await pool.query(
      'SELECT password_hash FROM usuarios WHERE id = $1',
      [req.user.id]
    );
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    const match = await bcrypt.compare(password_actual, userResult.rows[0].password_hash);
    if (!match) return res.status(400).json({ error: 'La contrasena actual es incorrecta' });

    const nuevoHash = await bcrypt.hash(password_nuevo, 10);
    await pool.query(
      'UPDATE usuarios SET password_hash = $1 WHERE id = $2',
      [nuevoHash, req.user.id]
    );

    res.json({ mensaje: 'Contrasena actualizada correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
