const express = require('express');
const pool    = require('../db');
const auth    = require('../middleware/auth');

const router = express.Router();

// GET /api/buscar?q=texto
// Búsqueda global: personas + contratos + leads por nombre/teléfono/documento/número
router.get('/', auth, async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.json({ personas: [], contratos: [], leads: [] });
  }

  const term = `%${q.trim()}%`;
  const { sala_id: userSalaId, rol } = req.user;
  const salaFilter = ['admin','director'].includes(rol) ? null : userSalaId;

  try {
    const [personasRes, contratosRes, leadsRes] = await Promise.all([
      pool.query(`
        SELECT id, nombres, apellidos, telefono, num_documento, ciudad, email
        FROM personas
        WHERE nombres ILIKE $1 OR apellidos ILIKE $1
           OR telefono ILIKE $2 OR num_documento ILIKE $2
           OR email ILIKE $1
        ORDER BY nombres
        LIMIT 6
      `, [term, term]),

      pool.query(`
        SELECT c.id, c.numero_contrato, c.estado, c.monto_total, c.fecha_contrato,
               p.nombres || ' ' || COALESCE(p.apellidos,'') AS cliente,
               p.telefono, s.nombre AS sala_nombre
        FROM contratos c
        JOIN personas p ON c.persona_id = p.id
        LEFT JOIN salas s ON c.sala_id = s.id
        WHERE (c.numero_contrato ILIKE $1 OR p.nombres ILIKE $1 OR p.apellidos ILIKE $1 OR p.telefono ILIKE $2)
          AND ($3::integer IS NULL OR c.sala_id = $3)
        ORDER BY c.fecha_contrato DESC
        LIMIT 5
      `, [term, term, salaFilter]),

      pool.query(`
        SELECT l.id, l.estado, l.created_at,
               p.nombres || ' ' || COALESCE(p.apellidos,'') AS cliente,
               p.telefono, p.id AS persona_id,
               f.nombre AS fuente_nombre
        FROM leads l
        JOIN personas p ON l.persona_id = p.id
        LEFT JOIN fuentes f ON l.fuente_id = f.id
        WHERE (p.nombres ILIKE $1 OR p.apellidos ILIKE $1 OR p.telefono ILIKE $2)
          AND ($3::integer IS NULL OR l.sala_id = $3)
        ORDER BY l.created_at DESC
        LIMIT 5
      `, [term, term, salaFilter]),
    ]);

    res.json({
      personas:  personasRes.rows,
      contratos: contratosRes.rows,
      leads:     leadsRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
