const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/personas?q=BUSQUEDA
// Buscar persona por nombre, teléfono o documento
router.get('/', auth, async (req, res) => {
  const { q } = req.query;
  try {
    let result;
    if (q && q.trim()) {
      const term = `%${q.trim()}%`;
      result = await pool.query(`
        SELECT id, nombres, apellidos, telefono, telefono2, email, ciudad, edad,
               tipo_documento, num_documento, situacion_laboral, patologia,
               created_at
        FROM personas
        WHERE nombres ILIKE $1 OR apellidos ILIKE $1
           OR telefono LIKE $2 OR num_documento LIKE $2
           OR telefono2 LIKE $2
        ORDER BY nombres ASC
        LIMIT 20
      `, [term, `%${q.trim()}%`]);
    } else {
      result = await pool.query(`
        SELECT id, nombres, apellidos, telefono, telefono2, email, ciudad, edad,
               tipo_documento, num_documento, situacion_laboral, patologia,
               created_at
        FROM personas
        ORDER BY created_at DESC
        LIMIT 50
      `);
    }
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al buscar personas' });
  }
});

// GET /api/personas/:id — perfil completo
router.get('/:id', auth, async (req, res) => {
  try {
    const personaRes = await pool.query(`
      SELECT p.*,
             l.id AS lead_id, l.estado AS lead_estado,
             l.fecha_cita, l.patologia AS lead_patologia,
             f.nombre AS fuente_nombre,
             t.nombre AS tipificacion_nombre,
             u.nombre AS tmk_nombre
      FROM personas p
      LEFT JOIN leads l ON l.persona_id = p.id
      LEFT JOIN fuentes f ON l.fuente_id = f.id
      LEFT JOIN tipificaciones t ON l.tipificacion_id = t.id
      LEFT JOIN usuarios u ON l.tmk_id = u.id
      WHERE p.id = $1
      ORDER BY l.created_at DESC
      LIMIT 1
    `, [req.params.id]);

    if (personaRes.rows.length === 0) {
      return res.status(404).json({ error: 'Persona no encontrada' });
    }

    const visitaRes = await pool.query(`
      SELECT vs.*,
             uc.nombre AS consultor_nombre,
             uh.nombre AS hostess_nombre
      FROM visitas_sala vs
      LEFT JOIN usuarios uc ON vs.consultor_id = uc.id
      LEFT JOIN usuarios uh ON vs.hostess_id = uh.id
      WHERE vs.persona_id = $1
      ORDER BY vs.created_at DESC
      LIMIT 1
    `, [req.params.id]);

    res.json({
      persona: personaRes.rows[0],
      visita: visitaRes.rows[0] || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener persona' });
  }
});

// POST /api/personas — crear nueva persona
router.post('/', auth, async (req, res) => {
  const {
    nombres, apellidos, telefono, telefono2, email, ciudad, edad,
    tipo_documento, num_documento, situacion_laboral, patologia
  } = req.body;

  if (!nombres || !telefono) {
    return res.status(400).json({ error: 'Nombre y teléfono son requeridos' });
  }

  try {
    // Verificar si ya existe por teléfono
    const exists = await pool.query(
      'SELECT id FROM personas WHERE telefono = $1', [telefono]
    );
    if (exists.rows.length > 0) {
      return res.status(409).json({
        error: 'Ya existe un cliente con ese teléfono',
        persona_id: exists.rows[0].id,
      });
    }

    const result = await pool.query(`
      INSERT INTO personas (nombres, apellidos, telefono, telefono2, email, ciudad, edad,
                            tipo_documento, num_documento, situacion_laboral, patologia)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `, [nombres, apellidos, telefono, telefono2 || null, email, ciudad, edad,
        tipo_documento, num_documento, situacion_laboral, patologia]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear persona' });
  }
});

// PATCH /api/personas/:id — actualizar datos
router.patch('/:id', auth, async (req, res) => {
  const fields = ['nombres','apellidos','telefono','email','ciudad','edad',
                  'tipo_documento','num_documento','fecha_nacimiento','genero',
                  'estado_civil','direccion','situacion_laboral','tipo_seguridad_social'];

  const updates = [];
  const values = [];
  let idx = 1;

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = $${idx}`);
      values.push(req.body[field]);
      idx++;
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No hay campos para actualizar' });
  }

  values.push(req.params.id);
  try {
    const result = await pool.query(`
      UPDATE personas SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${idx}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Persona no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar persona' });
  }
});

module.exports = router;
