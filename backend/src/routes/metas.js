const express = require('express');
const pool    = require('../db');
const auth    = require('../middleware/auth');

const router = express.Router();

// Auto-migración
pool.query(`
  CREATE TABLE IF NOT EXISTS metas_mensuales (
    id                  SERIAL PRIMARY KEY,
    usuario_id          INTEGER REFERENCES usuarios(id) NOT NULL,
    sala_id             INTEGER REFERENCES salas(id),
    mes                 VARCHAR(7) NOT NULL,
    meta_ventas_monto   NUMERIC(10,2) DEFAULT 0,
    meta_tours          INTEGER       DEFAULT 0,
    meta_contratos      INTEGER       DEFAULT 0,
    bono_cumplimiento   NUMERIC(10,2) DEFAULT 0,
    created_at          TIMESTAMPTZ   DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   DEFAULT NOW(),
    UNIQUE(usuario_id, mes)
  )
`).catch(console.error);

function getMesActual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getDateRange(mes) {
  const [year, month] = mes.split('-');
  const inicio = `${year}-${month}-01`;
  const fin    = `${year}-${month}-${new Date(Number(year), Number(month), 0).getDate()}`;
  return { inicio, fin };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/metas/progreso?mes=YYYY-MM&sala_id=X
// Todos los empleados con su meta + progreso real del período
// ─────────────────────────────────────────────────────────────────────────────
router.get('/progreso', auth, async (req, res) => {
  const { mes, sala_id } = req.query;
  const { sala_id: userSalaId, rol } = req.user;
  const salaId  = sala_id || (['admin', 'director'].includes(rol) ? null : userSalaId);
  const mesStr  = mes || getMesActual();
  const { inicio, fin } = getDateRange(mesStr);

  try {
    const result = await pool.query(`
      SELECT
        u.id   AS usuario_id,
        u.nombre,
        r.nombre AS rol,
        s.nombre AS sala_nombre,
        COALESCE(m.meta_ventas_monto, 0) AS meta_ventas_monto,
        COALESCE(m.meta_tours, 0)        AS meta_tours,
        COALESCE(m.meta_contratos, 0)    AS meta_contratos,
        COALESCE(m.bono_cumplimiento, 0) AS bono_cumplimiento,
        m.id AS meta_id,
        -- Real contratos (para consultores)
        (SELECT COUNT(*) FROM contratos c
          WHERE c.consultor_id = u.id
            AND DATE(c.fecha_contrato) BETWEEN $2::date AND $3::date
            AND c.estado NOT IN ('cancelado')
        ) AS real_contratos,
        -- Real monto vendido
        (SELECT COALESCE(SUM(c.monto_total), 0) FROM contratos c
          WHERE c.consultor_id = u.id
            AND DATE(c.fecha_contrato) BETWEEN $2::date AND $3::date
            AND c.estado NOT IN ('cancelado')
        ) AS real_ventas_monto,
        -- Real tours (para TMKs, via leads.tmk_id)
        (SELECT COUNT(*) FROM visitas_sala vs
          JOIN leads l ON l.id = vs.lead_id
          WHERE DATE(vs.fecha) BETWEEN $2::date AND $3::date
            AND vs.calificacion = 'TOUR'
            AND l.tmk_id = u.id
        ) AS real_tours
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      LEFT JOIN salas s ON u.sala_id = s.id
      LEFT JOIN metas_mensuales m ON m.usuario_id = u.id AND m.mes = $4
      WHERE u.activo = true
        AND ($1::integer IS NULL OR u.sala_id = $1)
        AND r.nombre IN ('consultor','tmk','confirmador','asesor_cartera','director')
      ORDER BY r.nombre, u.nombre
    `, [salaId || null, inicio, fin, mesStr]);

    res.json({ mes: mesStr, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/metas?mes=YYYY-MM&sala_id=X
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  const { mes, sala_id } = req.query;
  const { sala_id: userSalaId, rol } = req.user;
  const salaId = sala_id || (['admin', 'director'].includes(rol) ? null : userSalaId);
  const mesStr = mes || getMesActual();
  try {
    const result = await pool.query(`
      SELECT m.*, u.nombre AS usuario_nombre, r.nombre AS rol_nombre, s.nombre AS sala_nombre
      FROM metas_mensuales m
      JOIN usuarios u ON m.usuario_id = u.id
      JOIN roles r ON u.rol_id = r.id
      LEFT JOIN salas s ON m.sala_id = s.id
      WHERE m.mes = $1
        AND ($2::integer IS NULL OR m.sala_id = $2)
      ORDER BY u.nombre
    `, [mesStr, salaId || null]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/metas — crear o actualizar meta (upsert)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
  const { rol } = req.user;
  if (!['admin', 'director'].includes(rol)) {
    return res.status(403).json({ error: 'Sin permiso' });
  }
  const { usuario_id, mes, sala_id, meta_ventas_monto, meta_tours, meta_contratos, bono_cumplimiento } = req.body;
  if (!usuario_id || !mes) return res.status(400).json({ error: 'usuario_id y mes son requeridos' });
  try {
    const result = await pool.query(`
      INSERT INTO metas_mensuales
        (usuario_id, sala_id, mes, meta_ventas_monto, meta_tours, meta_contratos, bono_cumplimiento)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (usuario_id, mes) DO UPDATE SET
        sala_id           = EXCLUDED.sala_id,
        meta_ventas_monto = EXCLUDED.meta_ventas_monto,
        meta_tours        = EXCLUDED.meta_tours,
        meta_contratos    = EXCLUDED.meta_contratos,
        bono_cumplimiento = EXCLUDED.bono_cumplimiento,
        updated_at        = NOW()
      RETURNING *
    `, [usuario_id, sala_id || null, mes,
        meta_ventas_monto || 0, meta_tours || 0, meta_contratos || 0, bono_cumplimiento || 0]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/metas/:id
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id', auth, async (req, res) => {
  const { rol } = req.user;
  if (!['admin', 'director'].includes(rol)) {
    return res.status(403).json({ error: 'Sin permiso' });
  }
  const { id } = req.params;
  const { meta_ventas_monto, meta_tours, meta_contratos, bono_cumplimiento } = req.body;
  try {
    const result = await pool.query(`
      UPDATE metas_mensuales SET
        meta_ventas_monto = COALESCE($1, meta_ventas_monto),
        meta_tours        = COALESCE($2, meta_tours),
        meta_contratos    = COALESCE($3, meta_contratos),
        bono_cumplimiento = COALESCE($4, bono_cumplimiento),
        updated_at        = NOW()
      WHERE id = $5
      RETURNING *
    `, [meta_ventas_monto, meta_tours, meta_contratos, bono_cumplimiento, id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Meta no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/metas/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  const { rol } = req.user;
  if (!['admin', 'director'].includes(rol)) {
    return res.status(403).json({ error: 'Sin permiso' });
  }
  try {
    await pool.query('DELETE FROM metas_mensuales WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
