const express = require('express');
const pool = require('../db');

const router = express.Router();

/**
 * @openapi
 * /api/comisiones:
 *   get:
 *     tags: [Comisiones]
 *     summary: Listar comisiones
 *     description: Retorna comisiones de consultores por mes. Consultores solo ven sus propios datos. Admin y directores ven todos.
 *     parameters:
 *       - in: query
 *         name: mes
 *         schema:
 *           type: string
 *           example: '2026-03'
 *         description: Periodo YYYY-MM (por defecto mes actual)
 *       - in: query
 *         name: sala_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: consultor_id
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de comisiones por consultor
 */
router.get('/', async (req, res) => {
  const { mes, sala_id, consultor_id } = req.query;
  const { rol, id: userId, sala_id: userSalaId } = req.user;

  const mesFiltro = mes || new Date().toISOString().slice(0, 7);

  try {
    const params = [];
    let idx = 1;
    const condiciones = [];

    // Base: siempre filtramos por mes en fecha_contrato
    condiciones.push(`TO_CHAR(c.fecha_contrato, 'YYYY-MM') = $${idx}`);
    params.push(mesFiltro);
    idx++;

    // Restricción por rol: consultor solo ve sus propios datos
    if (rol === 'consultor') {
      condiciones.push(`u.id = $${idx}`);
      params.push(userId);
      idx++;
    } else {
      // Filtro opcional por consultor_id (admin/director)
      if (consultor_id) {
        condiciones.push(`u.id = $${idx}`);
        params.push(consultor_id);
        idx++;
      }
    }

    // Filtro por sala
    if (sala_id) {
      condiciones.push(`c.sala_id = $${idx}`);
      params.push(sala_id);
      idx++;
    } else if (!['admin', 'director'].includes(rol) && userSalaId) {
      // Rol sin acceso global: limitar a su propia sala
      condiciones.push(`c.sala_id = $${idx}`);
      params.push(userSalaId);
      idx++;
    }

    const whereStr = condiciones.length > 0 ? `AND ${condiciones.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT
        u.id                            AS consultor_id,
        u.nombre                        AS consultor_nombre,
        s.id                            AS sala_id,
        s.nombre                        AS sala_nombre,
        COUNT(DISTINCT c.id)            AS total_contratos,
        COUNT(DISTINCT CASE
          WHEN COALESCE(r.total_cobrado, 0) / NULLIF(c.monto_total, 0) * 100 >= COALESCE(u.pct_desbloqueo, 30)
          THEN c.id END)                AS contratos_desbloqueados,
        COALESCE(SUM(c.monto_total), 0) AS cartera_total,
        COALESCE(SUM(r.total_cobrado), 0) AS total_cobrado,
        COALESCE(SUM(
          CASE
            WHEN COALESCE(r.total_cobrado, 0) / NULLIF(c.monto_total, 0) * 100 >= COALESCE(u.pct_desbloqueo, 30)
            THEN r.total_cobrado * COALESCE(u.pct_comision_venta, 10) / 100
            ELSE 0
          END
        ), 0)                           AS comision_calculada
      FROM usuarios u
      JOIN roles ro ON u.rol_id = ro.id
      JOIN contratos c ON c.consultor_id = u.id AND c.estado = 'activo'
      LEFT JOIN salas s ON c.sala_id = s.id
      LEFT JOIN (
        SELECT contrato_id, SUM(valor) AS total_cobrado
        FROM recibos
        WHERE estado = 'activo'
        GROUP BY contrato_id
      ) r ON r.contrato_id = c.id
      WHERE ro.nombre = 'consultor'
        AND u.activo = true
        ${whereStr}
      GROUP BY u.id, u.nombre, s.id, s.nombre
      ORDER BY comision_calculada DESC
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error('Error en GET /api/comisiones:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/comisiones/detalle/:consultor_id
// Query params: mes (YYYY-MM)
// Retorna contratos del consultor con cálculo de comisión por contrato
// ─────────────────────────────────────────────────────────────
router.get('/detalle/:consultor_id', async (req, res) => {
  const { consultor_id } = req.params;
  const { mes } = req.query;
  const { rol, id: userId } = req.user;

  // Consultor solo puede ver sus propios detalles
  if (rol === 'consultor' && parseInt(consultor_id, 10) !== userId) {
    return res.status(403).json({ error: 'Sin permiso para ver datos de otro consultor' });
  }

  const mesFiltro = mes || new Date().toISOString().slice(0, 7);

  try {
    const result = await pool.query(`
      SELECT
        c.id,
        c.numero_contrato,
        p.nombres,
        p.apellidos,
        c.monto_total,
        COALESCE(r.total_cobrado, 0)                                        AS total_cobrado,
        CASE
          WHEN c.monto_total > 0
          THEN ROUND(COALESCE(r.total_cobrado, 0) / c.monto_total * 100, 2)
          ELSE 0
        END                                                                  AS pct_pagado,
        CASE
          WHEN c.monto_total > 0
            AND COALESCE(r.total_cobrado, 0) / c.monto_total * 100 >= COALESCE(cons.pct_desbloqueo, 30)
          THEN ROUND(COALESCE(r.total_cobrado, 0) * COALESCE(cons.pct_comision_venta, 10) / 100, 2)
          ELSE 0
        END                                                                  AS comision_por_contrato,
        CASE
          WHEN c.monto_total > 0
            AND COALESCE(r.total_cobrado, 0) / c.monto_total * 100 >= COALESCE(cons.pct_desbloqueo, 30)
          THEN 'desbloqueada'
          ELSE 'bloqueada'
        END                                                                  AS estado_comision,
        COALESCE(cons.pct_comision_venta, 10) AS pct_comision_venta,
        COALESCE(cons.pct_desbloqueo, 30)     AS pct_desbloqueo,
        c.fecha_contrato,
        c.estado
      FROM contratos c
      JOIN personas p ON c.persona_id = p.id
      JOIN usuarios cons ON c.consultor_id = cons.id
      LEFT JOIN (
        SELECT contrato_id, SUM(valor) AS total_cobrado
        FROM recibos
        WHERE estado = 'activo'
        GROUP BY contrato_id
      ) r ON r.contrato_id = c.id
      WHERE c.consultor_id = $1
        AND c.estado = 'activo'
        AND TO_CHAR(c.fecha_contrato, 'YYYY-MM') = $2
      ORDER BY c.fecha_contrato DESC
    `, [consultor_id, mesFiltro]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error en GET /api/comisiones/detalle/:consultor_id:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
