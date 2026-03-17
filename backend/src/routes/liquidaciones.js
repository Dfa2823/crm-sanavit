const express = require('express');
const pool    = require('../db');
const auth    = require('../middleware/auth');
const router  = express.Router();

// ─── Auto-crear tabla ────────────────────────────────────────────────────────
pool.query(`
  CREATE TABLE IF NOT EXISTS liquidaciones (
    id SERIAL PRIMARY KEY,
    consultor_id INTEGER REFERENCES usuarios(id) NOT NULL,
    sala_id INTEGER REFERENCES salas(id),
    mes VARCHAR(7) NOT NULL,
    monto_comision NUMERIC(12,2) NOT NULL DEFAULT 0,
    contratos_count INTEGER DEFAULT 0,
    estado VARCHAR(20) DEFAULT 'pendiente'
      CHECK (estado IN ('pendiente','aprobada','rechazada','pagada')),
    aprobado_por INTEGER REFERENCES usuarios(id),
    fecha_aprobacion TIMESTAMPTZ,
    fecha_pago TIMESTAMPTZ,
    observacion TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(consultor_id, mes)
  )
`).catch(console.error);

// ─── Middleware solo admin/director ─────────────────────────────────────────
function requireAdminOrDirector(req, res, next) {
  if (!['admin', 'director'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'No autorizado. Se requiere rol admin o director.' });
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/liquidaciones?mes=YYYY-MM&sala_id=X
// Solo admin/director
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', auth, requireAdminOrDirector, async (req, res) => {
  const { mes, sala_id } = req.query;
  const mesFiltro = mes || new Date().toISOString().slice(0, 7);
  const salaParam = sala_id ? parseInt(sala_id, 10) : null;

  try {
    const result = await pool.query(`
      SELECT
        l.id,
        l.mes,
        l.estado,
        l.monto_comision,
        l.contratos_count,
        l.fecha_aprobacion,
        l.fecha_pago,
        l.observacion,
        u.nombre   AS consultor_nombre,
        u.id       AS consultor_id,
        s.nombre   AS sala_nombre,
        ua.nombre  AS aprobado_por_nombre
      FROM liquidaciones l
      JOIN usuarios u ON l.consultor_id = u.id
      LEFT JOIN salas s ON l.sala_id = s.id
      LEFT JOIN usuarios ua ON l.aprobado_por = ua.id
      WHERE l.mes = $1
        AND ($2::integer IS NULL OR l.sala_id = $2)
      ORDER BY u.nombre
    `, [mesFiltro, salaParam]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error en GET /api/liquidaciones:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/liquidaciones/calcular
// Body: { mes: 'YYYY-MM', sala_id: X (opcional) }
// Solo admin/director — calcula y crea/actualiza liquidaciones del mes
// ─────────────────────────────────────────────────────────────────────────────
router.post('/calcular', auth, requireAdminOrDirector, async (req, res) => {
  const { mes, sala_id } = req.body;

  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).json({ error: 'El campo mes es requerido con formato YYYY-MM' });
  }

  const salaParam = sala_id ? parseInt(sala_id, 10) : null;

  try {
    // Calcular comisiones agrupadas por consultor
    const calculo = await pool.query(`
      SELECT
        c.consultor_id,
        c.sala_id,
        COUNT(c.id)::integer AS contratos_count,
        COALESCE(SUM(
          CASE
            WHEN (COALESCE(pagado.total, 0) / NULLIF(c.monto_total, 0) * 100) >= COALESCE(u.pct_desbloqueo, 30)
            THEN COALESCE(pagado.total, 0) * COALESCE(u.pct_comision_venta, 10) / 100
            ELSE 0
          END
        ), 0) AS monto_comision
      FROM contratos c
      JOIN usuarios u ON c.consultor_id = u.id
      LEFT JOIN (
        SELECT contrato_id, SUM(valor) AS total
        FROM recibos
        WHERE estado = 'activo'
        GROUP BY contrato_id
      ) pagado ON pagado.contrato_id = c.id
      WHERE TO_CHAR(c.fecha_contrato, 'YYYY-MM') = $1
        AND c.estado NOT IN ('cancelado')
        AND ($2::integer IS NULL OR c.sala_id = $2)
        AND c.consultor_id IS NOT NULL
      GROUP BY c.consultor_id, c.sala_id
    `, [mes, salaParam]);

    if (calculo.rows.length === 0) {
      return res.json({ mensaje: 'No hay contratos para calcular en este período', liquidaciones: [] });
    }

    // INSERT ... ON CONFLICT DO UPDATE solo si estado = 'pendiente'
    const insertPromises = calculo.rows.map(row =>
      pool.query(`
        INSERT INTO liquidaciones (consultor_id, sala_id, mes, monto_comision, contratos_count, estado)
        VALUES ($1, $2, $3, $4, $5, 'pendiente')
        ON CONFLICT (consultor_id, mes) DO UPDATE
          SET monto_comision   = EXCLUDED.monto_comision,
              contratos_count  = EXCLUDED.contratos_count,
              sala_id          = EXCLUDED.sala_id
          WHERE liquidaciones.estado = 'pendiente'
        RETURNING id
      `, [row.consultor_id, row.sala_id, mes, row.monto_comision, row.contratos_count])
    );

    await Promise.all(insertPromises);

    // Retornar lista actualizada del mes
    const lista = await pool.query(`
      SELECT
        l.id,
        l.mes,
        l.estado,
        l.monto_comision,
        l.contratos_count,
        l.fecha_aprobacion,
        l.fecha_pago,
        l.observacion,
        u.nombre   AS consultor_nombre,
        u.id       AS consultor_id,
        s.nombre   AS sala_nombre,
        ua.nombre  AS aprobado_por_nombre
      FROM liquidaciones l
      JOIN usuarios u ON l.consultor_id = u.id
      LEFT JOIN salas s ON l.sala_id = s.id
      LEFT JOIN usuarios ua ON l.aprobado_por = ua.id
      WHERE l.mes = $1
        AND ($2::integer IS NULL OR l.sala_id = $2)
      ORDER BY u.nombre
    `, [mes, salaParam]);

    res.json(lista.rows);
  } catch (err) {
    console.error('Error en POST /api/liquidaciones/calcular:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/liquidaciones/:id
// Body: { estado: 'aprobada'|'rechazada'|'pagada', observacion: '...' }
// Solo admin/director
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id', auth, requireAdminOrDirector, async (req, res) => {
  const { id } = req.params;
  const { estado, observacion } = req.body;

  const estadosValidos = ['aprobada', 'rechazada', 'pagada'];
  if (!estado || !estadosValidos.includes(estado)) {
    return res.status(400).json({ error: `El campo estado debe ser uno de: ${estadosValidos.join(', ')}` });
  }

  try {
    // Obtener liquidación actual
    const actual = await pool.query(
      'SELECT id, estado FROM liquidaciones WHERE id = $1',
      [id]
    );

    if (actual.rows.length === 0) {
      return res.status(404).json({ error: 'Liquidación no encontrada' });
    }

    const estadoActual = actual.rows[0].estado;

    // No se puede cambiar de 'pagada' a otro estado
    if (estadoActual === 'pagada') {
      return res.status(400).json({ error: 'No se puede modificar una liquidación ya pagada' });
    }

    // Construir campos a actualizar
    const campos = ['estado = $1', 'observacion = $2'];
    const valores = [estado, observacion || null];
    let idx = 3;

    if (estado === 'aprobada') {
      campos.push(`fecha_aprobacion = NOW()`);
      campos.push(`aprobado_por = $${idx}`);
      valores.push(req.user.id);
      idx++;
    } else if (estado === 'pagada') {
      campos.push(`fecha_pago = NOW()`);
    } else if (estado === 'rechazada') {
      // Al rechazar limpiamos aprobado_por y fecha_aprobacion si los hubiere
      campos.push(`fecha_aprobacion = NULL`);
      campos.push(`aprobado_por = NULL`);
    }

    valores.push(parseInt(id, 10));
    const idxId = valores.length;

    const updateResult = await pool.query(`
      UPDATE liquidaciones
      SET ${campos.join(', ')}
      WHERE id = $${idxId}
      RETURNING id
    `, valores);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Liquidación no encontrada' });
    }

    // Retornar liquidación actualizada con JOINs
    const liquidacion = await pool.query(`
      SELECT
        l.id,
        l.mes,
        l.estado,
        l.monto_comision,
        l.contratos_count,
        l.fecha_aprobacion,
        l.fecha_pago,
        l.observacion,
        u.nombre   AS consultor_nombre,
        u.id       AS consultor_id,
        s.nombre   AS sala_nombre,
        ua.nombre  AS aprobado_por_nombre
      FROM liquidaciones l
      JOIN usuarios u ON l.consultor_id = u.id
      LEFT JOIN salas s ON l.sala_id = s.id
      LEFT JOIN usuarios ua ON l.aprobado_por = ua.id
      WHERE l.id = $1
    `, [id]);

    res.json(liquidacion.rows[0]);
  } catch (err) {
    console.error('Error en PATCH /api/liquidaciones/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
