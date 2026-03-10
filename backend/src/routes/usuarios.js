const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/usuarios?sala_id=X&rol=consultor
// Lista de usuarios con filtros
router.get('/', auth, async (req, res) => {
  const { sala_id, rol } = req.query;

  try {
    const params = [];
    const where = ['u.activo = true'];
    let idx = 1;

    if (sala_id) {
      where.push(`u.sala_id = $${idx}`);
      params.push(sala_id);
      idx++;
    }

    if (rol) {
      where.push(`r.nombre = $${idx}`);
      params.push(rol);
      idx++;
    }

    const result = await pool.query(`
      SELECT u.id, u.nombre, u.username, u.activo,
             r.nombre AS rol, r.label AS rol_label,
             s.nombre AS sala_nombre, s.ciudad AS sala_ciudad
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      LEFT JOIN salas s ON u.sala_id = s.id
      WHERE ${where.join(' AND ')}
      ORDER BY r.nombre, u.nombre
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// GET /api/usuarios/salas — lista de salas activas
router.get('/salas', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM salas WHERE activo = true ORDER BY nombre'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener salas' });
  }
});

module.exports = router;
