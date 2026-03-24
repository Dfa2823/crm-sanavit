const express = require('express');
const pool = require('../db');

const router = express.Router();

/**
 * Endpoints de administración de tenants.
 * En producción deberían estar protegidos por un rol "superadmin".
 * Por ahora solo se registran detrás de authMiddleware.
 */

// GET /api/admin/tenants — listar todos los tenants
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, nombre, slug, logo_url, config, activo, created_at FROM tenants ORDER BY id'
    );
    res.json(rows);
  } catch (err) {
    console.error('[TENANTS] Error al listar:', err.message);
    res.status(500).json({ error: 'Error al listar tenants' });
  }
});

// POST /api/admin/tenants — crear tenant
router.post('/', async (req, res) => {
  const { nombre, slug, logo_url, config } = req.body;

  if (!nombre || !slug) {
    return res.status(400).json({ error: 'nombre y slug son requeridos' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO tenants (nombre, slug, logo_url, config)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [nombre, slug, logo_url || null, config || {}]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un tenant con ese slug' });
    }
    console.error('[TENANTS] Error al crear:', err.message);
    res.status(500).json({ error: 'Error al crear tenant' });
  }
});

// PATCH /api/admin/tenants/:id — editar tenant
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, slug, logo_url, config, activo } = req.body;

  const campos = [];
  const valores = [];
  let idx = 1;

  if (nombre !== undefined) { campos.push(`nombre = $${idx++}`); valores.push(nombre); }
  if (slug !== undefined)   { campos.push(`slug = $${idx++}`);   valores.push(slug); }
  if (logo_url !== undefined) { campos.push(`logo_url = $${idx++}`); valores.push(logo_url); }
  if (config !== undefined) { campos.push(`config = $${idx++}`); valores.push(config); }
  if (activo !== undefined) { campos.push(`activo = $${idx++}`); valores.push(activo); }

  if (campos.length === 0) {
    return res.status(400).json({ error: 'Nada que actualizar' });
  }

  valores.push(id);

  try {
    const { rows } = await pool.query(
      `UPDATE tenants SET ${campos.join(', ')} WHERE id = $${idx} RETURNING *`,
      valores
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un tenant con ese slug' });
    }
    console.error('[TENANTS] Error al editar:', err.message);
    res.status(500).json({ error: 'Error al editar tenant' });
  }
});

module.exports = router;
