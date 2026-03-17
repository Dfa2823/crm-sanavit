const express = require('express');
const pool = require('../db');

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cartera
// Query params:
//   sala_id  — filtra por sala
//   estado   — 'vencido' | 'pendiente' | 'todos' (default: todos)
//   aging    — 30 | 60 | 90  — filtra cuotas vencidas hace >= X días
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { sala_id, estado = 'todos', aging } = req.query;
  const { rol, sala_id: userSalaId } = req.user;

  try {
    const params = [];
    let idx = 1;
    const whereClauses = [
      `c.estado = 'activo'`,
      `cu.estado != 'pagado'`,
    ];

    // Restringir sala para roles no privilegiados
    const efectivaSalaId =
      sala_id ||
      (!['admin', 'director', 'asesor_cartera'].includes(rol) ? userSalaId : null);

    if (efectivaSalaId) {
      whereClauses.push(`c.sala_id = $${idx}`);
      params.push(efectivaSalaId);
      idx++;
    }

    // Filtro por estado
    if (estado === 'vencido') {
      whereClauses.push(`cu.fecha_vencimiento < CURRENT_DATE`);
    } else if (estado === 'pendiente') {
      whereClauses.push(`cu.fecha_vencimiento >= CURRENT_DATE`);
    }

    // Filtro por aging (solo cuotas vencidas hace >= X días)
    const agingNum = parseInt(aging, 10);
    if (!isNaN(agingNum) && agingNum > 0) {
      whereClauses.push(`(CURRENT_DATE - cu.fecha_vencimiento) >= $${idx}`);
      params.push(agingNum);
      idx++;
    }

    const whereStr = `WHERE ${whereClauses.join(' AND ')}`;

    const result = await pool.query(
      `SELECT
        cu.id                                                          AS cuota_id,
        cu.numero_cuota,
        cu.monto_esperado,
        cu.monto_pagado,
        cu.monto_esperado - cu.monto_pagado                           AS saldo_cuota,
        cu.fecha_vencimiento,
        cu.estado                                                      AS estado_cuota,
        cu.observacion                                                 AS observacion_gestion,
        CURRENT_DATE - cu.fecha_vencimiento                           AS dias_vencido,
        CASE
          WHEN cu.fecha_vencimiento >= CURRENT_DATE                   THEN 'vigente'
          WHEN CURRENT_DATE - cu.fecha_vencimiento <= 30              THEN 'mora_30'
          WHEN CURRENT_DATE - cu.fecha_vencimiento <= 60              THEN 'mora_60'
          WHEN CURRENT_DATE - cu.fecha_vencimiento <= 90              THEN 'mora_90'
          ELSE 'mora_90_plus'
        END                                                            AS tramo_mora,
        c.id                                                           AS contrato_id,
        c.numero_contrato,
        c.monto_total,
        p.id                                                           AS persona_id,
        p.nombres,
        p.apellidos,
        p.telefono,
        p.email,
        u.nombre                                                       AS consultor_nombre,
        s.id                                                           AS sala_id,
        s.nombre                                                       AS sala_nombre
      FROM cuotas cu
      JOIN contratos c  ON cu.contrato_id = c.id
      JOIN personas  p  ON c.persona_id   = p.id
      LEFT JOIN usuarios u ON c.consultor_id = u.id
      LEFT JOIN salas    s ON c.sala_id       = s.id
      ${whereStr}
      ORDER BY cu.fecha_vencimiento ASC
      LIMIT 500`,
      params
    );

    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/cartera error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cartera/resumen
// Totales por tramo de mora para cuotas vencidas y no pagadas
// ─────────────────────────────────────────────────────────────────────────────
router.get('/resumen', async (req, res) => {
  const { sala_id } = req.query;
  const { rol, sala_id: userSalaId } = req.user;

  try {
    const params = [];
    let idx = 1;
    const whereClauses = [
      `c.estado = 'activo'`,
      `cu.estado != 'pagado'`,
      `cu.fecha_vencimiento < CURRENT_DATE`,
    ];

    const efectivaSalaId =
      sala_id ||
      (!['admin', 'director', 'asesor_cartera'].includes(rol) ? userSalaId : null);

    if (efectivaSalaId) {
      whereClauses.push(`c.sala_id = $${idx}`);
      params.push(efectivaSalaId);
      idx++;
    }

    const whereStr = `WHERE ${whereClauses.join(' AND ')}`;

    const result = await pool.query(
      `SELECT
        COUNT(*)        FILTER (WHERE dias_calc > 0  AND dias_calc <= 30)  AS mora_30_count,
        SUM(saldo)      FILTER (WHERE dias_calc > 0  AND dias_calc <= 30)  AS mora_30_monto,
        COUNT(*)        FILTER (WHERE dias_calc > 30 AND dias_calc <= 60)  AS mora_60_count,
        SUM(saldo)      FILTER (WHERE dias_calc > 30 AND dias_calc <= 60)  AS mora_60_monto,
        COUNT(*)        FILTER (WHERE dias_calc > 60 AND dias_calc <= 90)  AS mora_90_count,
        SUM(saldo)      FILTER (WHERE dias_calc > 60 AND dias_calc <= 90)  AS mora_90_monto,
        COUNT(*)        FILTER (WHERE dias_calc > 90)                      AS mora_plus_count,
        SUM(saldo)      FILTER (WHERE dias_calc > 90)                      AS mora_plus_monto
      FROM (
        SELECT
          GREATEST(0, CURRENT_DATE - cu.fecha_vencimiento)  AS dias_calc,
          cu.monto_esperado - cu.monto_pagado                AS saldo
        FROM cuotas cu
        JOIN contratos c ON cu.contrato_id = c.id
        ${whereStr}
      ) sub`,
      params
    );

    const row = result.rows[0];
    res.json({
      mora_30_count:   Number(row.mora_30_count   || 0),
      mora_30_monto:   Number(row.mora_30_monto   || 0),
      mora_60_count:   Number(row.mora_60_count   || 0),
      mora_60_monto:   Number(row.mora_60_monto   || 0),
      mora_90_count:   Number(row.mora_90_count   || 0),
      mora_90_monto:   Number(row.mora_90_monto   || 0),
      mora_plus_count: Number(row.mora_plus_count || 0),
      mora_plus_monto: Number(row.mora_plus_monto || 0),
    });
  } catch (err) {
    console.error('GET /api/cartera/resumen error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/cartera/cuotas/:id/gestion
// Body: { observacion: string }
// Solo roles: asesor_cartera | admin | director
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/cuotas/:id/gestion', async (req, res) => {
  const { rol } = req.user;
  if (!['asesor_cartera', 'admin', 'director'].includes(rol)) {
    return res.status(403).json({ error: 'Sin permiso para registrar gestión de cartera' });
  }

  const { observacion } = req.body;
  const cuotaId = parseInt(req.params.id, 10);

  if (isNaN(cuotaId)) {
    return res.status(400).json({ error: 'ID de cuota inválido' });
  }

  try {
    const result = await pool.query(
      `UPDATE cuotas
       SET observacion = $1
       WHERE id = $2
       RETURNING id, contrato_id, numero_cuota, estado, observacion`,
      [observacion ?? null, cuotaId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cuota no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/cartera/cuotas/:id/gestion error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
