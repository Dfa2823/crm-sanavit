const express = require('express');
const pool = require('../db');
const router = express.Router();

// GET /api/outsourcing/empresas — listar todas las empresas
router.get('/empresas', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM outsourcing_empresas ORDER BY activo DESC, nombre ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener empresas outsourcing' });
  }
});

// POST /api/outsourcing/empresas — crear empresa
router.post('/empresas', async (req, res) => {
  const { nombre, contacto_nombre, contacto_telefono, contacto_email, ciudad, notas } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    const result = await pool.query(
      `INSERT INTO outsourcing_empresas (nombre, contacto_nombre, contacto_telefono, contacto_email, ciudad, notas, activo)
       VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING *`,
      [nombre, contacto_nombre || null, contacto_telefono || null, contacto_email || null, ciudad || null, notas || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear empresa outsourcing' });
  }
});

// PATCH /api/outsourcing/empresas/:id — actualizar empresa
router.patch('/empresas/:id', async (req, res) => {
  const { nombre, contacto_nombre, contacto_telefono, contacto_email, ciudad, notas, activo } = req.body;
  try {
    const updates = [];
    const params = [];
    let idx = 1;
    if (nombre !== undefined) { updates.push(`nombre = $${idx++}`); params.push(nombre); }
    if (contacto_nombre !== undefined) { updates.push(`contacto_nombre = $${idx++}`); params.push(contacto_nombre); }
    if (contacto_telefono !== undefined) { updates.push(`contacto_telefono = $${idx++}`); params.push(contacto_telefono); }
    if (contacto_email !== undefined) { updates.push(`contacto_email = $${idx++}`); params.push(contacto_email); }
    if (ciudad !== undefined) { updates.push(`ciudad = $${idx++}`); params.push(ciudad); }
    if (notas !== undefined) { updates.push(`notas = $${idx++}`); params.push(notas); }
    if (activo !== undefined) { updates.push(`activo = $${idx++}`); params.push(activo); }
    if (updates.length === 0) return res.status(400).json({ error: 'Sin campos para actualizar' });
    params.push(req.params.id);
    const result = await pool.query(
      `UPDATE outsourcing_empresas SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar empresa outsourcing' });
  }
});

// GET /api/outsourcing/stats — estadísticas por empresa
router.get('/stats', async (req, res) => {
  const { sala_id, fecha_inicio, fecha_fin } = req.query;
  const { sala_id: userSalaId, rol } = req.user;
  const hoy = new Date();
  const primerMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
  const inicio = fecha_inicio || primerMes;
  const fin = fecha_fin || hoy.toISOString().split('T')[0];
  const salaFiltro = sala_id || (['admin', 'director'].includes(rol) ? null : userSalaId);
  try {
    const result = await pool.query(`
      SELECT
        oe.id AS empresa_id,
        oe.nombre AS empresa,
        oe.ciudad,
        COUNT(l.id) AS total_leads,
        COUNT(l.id) FILTER (WHERE l.estado IN ('confirmada','tentativa')) AS citas,
        COUNT(l.id) FILTER (WHERE l.estado IN ('tour','no_tour','inasistencia')) AS asistencias,
        COUNT(l.id) FILTER (WHERE l.estado = 'tour') AS tours,
        CASE WHEN COUNT(l.id) > 0
          THEN ROUND(COUNT(l.id) FILTER (WHERE l.estado IN ('confirmada','tentativa'))::numeric / COUNT(l.id) * 100, 1)
          ELSE 0 END AS efectividad_datos,
        CASE WHEN COUNT(l.id) FILTER (WHERE l.estado IN ('tour','no_tour','inasistencia')) > 0
          THEN ROUND(COUNT(l.id) FILTER (WHERE l.estado = 'tour')::numeric /
               COUNT(l.id) FILTER (WHERE l.estado IN ('tour','no_tour','inasistencia')) * 100, 1)
          ELSE 0 END AS efectividad_tour
      FROM outsourcing_empresas oe
      LEFT JOIN leads l ON l.outsourcing_empresa_id = oe.id
        AND DATE(l.created_at) BETWEEN $1::date AND $2::date
        AND ($3::integer IS NULL OR l.sala_id = $3)
      WHERE oe.activo = true
      GROUP BY oe.id, oe.nombre, oe.ciudad
      ORDER BY total_leads DESC
    `, [inicio, fin, salaFiltro || null]);
    res.json({ data: result.rows, meta: { inicio, fin, sala_id: salaFiltro || 'todas' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener estadísticas outsourcing' });
  }
});

module.exports = router;
