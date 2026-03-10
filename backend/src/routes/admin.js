const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');

const router = express.Router();

// ── Middleware de rol admin/director ──────────────────────────
function requireAdmin(req, res, next) {
  if (req.user.rol !== 'admin' && req.user.rol !== 'director') {
    return res.status(403).json({ error: 'No autorizado' });
  }
  next();
}

// ═══════════════════════════════════════════════════════════════
// USUARIOS
// ═══════════════════════════════════════════════════════════════

// GET /api/admin/usuarios — listar todos los usuarios (sin password)
router.get('/usuarios', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id, u.nombre, u.username, u.activo, u.created_at,
        r.id AS rol_id, r.nombre AS rol, r.label AS rol_label,
        s.id AS sala_id, s.nombre AS sala_nombre, s.ciudad AS sala_ciudad
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      LEFT JOIN salas s ON u.sala_id = s.id
      ORDER BY u.activo DESC, r.nombre, u.nombre
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// POST /api/admin/usuarios — crear nuevo usuario
router.post('/usuarios', requireAdmin, async (req, res) => {
  const { nombre, username, password, rol_id, sala_id } = req.body;

  if (!nombre || !username || !password || !rol_id) {
    return res.status(400).json({ error: 'nombre, username, password y rol_id son requeridos' });
  }

  try {
    // Verificar que el username no exista
    const existing = await pool.query(
      'SELECT id FROM usuarios WHERE username = $1',
      [username]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'El username ya existe' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(`
      INSERT INTO usuarios (nombre, username, password_hash, rol_id, sala_id, activo)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING id
    `, [nombre, username, password_hash, rol_id, sala_id || null]);

    const newUser = await pool.query(`
      SELECT
        u.id, u.nombre, u.username, u.activo, u.created_at,
        r.id AS rol_id, r.nombre AS rol, r.label AS rol_label,
        s.id AS sala_id, s.nombre AS sala_nombre, s.ciudad AS sala_ciudad
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      LEFT JOIN salas s ON u.sala_id = s.id
      WHERE u.id = $1
    `, [result.rows[0].id]);

    res.status(201).json(newUser.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// PATCH /api/admin/usuarios/:id — actualizar usuario
router.patch('/usuarios/:id', requireAdmin, async (req, res) => {
  const { nombre, sala_id, rol_id, activo, password } = req.body;

  try {
    const updates = [];
    const params = [];
    let idx = 1;

    if (nombre !== undefined)   { updates.push(`nombre = $${idx++}`);   params.push(nombre); }
    if (sala_id !== undefined)  { updates.push(`sala_id = $${idx++}`);  params.push(sala_id); }
    if (rol_id !== undefined)   { updates.push(`rol_id = $${idx++}`);   params.push(rol_id); }
    if (activo !== undefined)   { updates.push(`activo = $${idx++}`);   params.push(activo); }

    if (password !== undefined && password !== '') {
      const password_hash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${idx++}`);
      params.push(password_hash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    params.push(req.params.id);

    await pool.query(`
      UPDATE usuarios SET ${updates.join(', ')} WHERE id = $${idx}
    `, params);

    const updated = await pool.query(`
      SELECT
        u.id, u.nombre, u.username, u.activo, u.created_at,
        r.id AS rol_id, r.nombre AS rol, r.label AS rol_label,
        s.id AS sala_id, s.nombre AS sala_nombre, s.ciudad AS sala_ciudad
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      LEFT JOIN salas s ON u.sala_id = s.id
      WHERE u.id = $1
    `, [req.params.id]);

    if (updated.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(updated.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// DELETE /api/admin/usuarios/:id — soft delete (activo = false)
router.delete('/usuarios/:id', requireAdmin, async (req, res) => {
  try {
    // Prevenir auto-desactivación
    if (Number(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
    }

    const result = await pool.query(
      'UPDATE usuarios SET activo = false WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ message: 'Usuario desactivado correctamente', id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al desactivar usuario' });
  }
});

// ═══════════════════════════════════════════════════════════════
// SALAS
// ═══════════════════════════════════════════════════════════════

// GET /api/admin/salas — listar todas las salas
router.get('/salas', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM salas ORDER BY activo DESC, nombre ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener salas' });
  }
});

// POST /api/admin/salas — crear sala
router.post('/salas', requireAdmin, async (req, res) => {
  const { nombre, ciudad, direccion } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre de la sala es requerido' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO salas (nombre, ciudad, direccion, activo)
      VALUES ($1, $2, $3, true)
      RETURNING *
    `, [nombre, ciudad || null, direccion || null]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear sala' });
  }
});

// PATCH /api/admin/salas/:id — actualizar sala
router.patch('/salas/:id', requireAdmin, async (req, res) => {
  const { nombre, ciudad, direccion, activo } = req.body;

  try {
    const updates = [];
    const params = [];
    let idx = 1;

    if (nombre !== undefined)    { updates.push(`nombre = $${idx++}`);    params.push(nombre); }
    if (ciudad !== undefined)    { updates.push(`ciudad = $${idx++}`);    params.push(ciudad); }
    if (direccion !== undefined) { updates.push(`direccion = $${idx++}`); params.push(direccion); }
    if (activo !== undefined)    { updates.push(`activo = $${idx++}`);    params.push(activo); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    params.push(req.params.id);

    const result = await pool.query(`
      UPDATE salas SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *
    `, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sala no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar sala' });
  }
});

// ═══════════════════════════════════════════════════════════════
// TIPIFICACIONES
// ═══════════════════════════════════════════════════════════════

// GET /api/admin/tipificaciones — listar todas las tipificaciones
router.get('/tipificaciones', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tipificaciones ORDER BY activo DESC, nombre ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener tipificaciones' });
  }
});

// POST /api/admin/tipificaciones — crear tipificacion
router.post('/tipificaciones', requireAdmin, async (req, res) => {
  const { nombre, requiere_fecha_cita, requiere_fecha_rellamar, color } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre de la tipificación es requerido' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO tipificaciones (nombre, requiere_fecha_cita, requiere_fecha_rellamar, color, activo)
      VALUES ($1, $2, $3, $4, true)
      RETURNING *
    `, [
      nombre,
      requiere_fecha_cita || false,
      requiere_fecha_rellamar || false,
      color || null,
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear tipificación' });
  }
});

// PATCH /api/admin/tipificaciones/:id — actualizar tipificacion
router.patch('/tipificaciones/:id', requireAdmin, async (req, res) => {
  const { nombre, requiere_fecha_cita, requiere_fecha_rellamar, color, activo } = req.body;

  try {
    const updates = [];
    const params = [];
    let idx = 1;

    if (nombre !== undefined)                { updates.push(`nombre = $${idx++}`);                params.push(nombre); }
    if (requiere_fecha_cita !== undefined)   { updates.push(`requiere_fecha_cita = $${idx++}`);   params.push(requiere_fecha_cita); }
    if (requiere_fecha_rellamar !== undefined) { updates.push(`requiere_fecha_rellamar = $${idx++}`); params.push(requiere_fecha_rellamar); }
    if (color !== undefined)                 { updates.push(`color = $${idx++}`);                 params.push(color); }
    if (activo !== undefined)                { updates.push(`activo = $${idx++}`);                params.push(activo); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    params.push(req.params.id);

    const result = await pool.query(`
      UPDATE tipificaciones SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *
    `, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tipificación no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar tipificación' });
  }
});

// ═══════════════════════════════════════════════════════════════
// FUENTES
// ═══════════════════════════════════════════════════════════════

// GET /api/admin/fuentes — listar todas las fuentes
router.get('/fuentes', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM fuentes ORDER BY activo DESC, nombre ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener fuentes' });
  }
});

// POST /api/admin/fuentes — crear fuente
router.post('/fuentes', requireAdmin, async (req, res) => {
  const { nombre, descripcion } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre de la fuente es requerido' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO fuentes (nombre, descripcion, activo)
      VALUES ($1, $2, true)
      RETURNING *
    `, [nombre, descripcion || null]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear fuente' });
  }
});

// PATCH /api/admin/fuentes/:id — actualizar fuente
router.patch('/fuentes/:id', requireAdmin, async (req, res) => {
  const { nombre, descripcion, activo } = req.body;

  try {
    const updates = [];
    const params = [];
    let idx = 1;

    if (nombre !== undefined)      { updates.push(`nombre = $${idx++}`);      params.push(nombre); }
    if (descripcion !== undefined) { updates.push(`descripcion = $${idx++}`); params.push(descripcion); }
    if (activo !== undefined)      { updates.push(`activo = $${idx++}`);      params.push(activo); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    params.push(req.params.id);

    const result = await pool.query(`
      UPDATE fuentes SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *
    `, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fuente no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar fuente' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ROLES
// ═══════════════════════════════════════════════════════════════

// GET /api/admin/roles — listar todos los roles
router.get('/roles', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM roles ORDER BY nombre ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener roles' });
  }
});

module.exports = router;
