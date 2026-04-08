const express = require('express');
const pool = require('../db');

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// GET /api/consultor/mis-clientes
// Contratos donde consultor_id = req.user.id, con total_pagado, saldo
// Query params: mes (YYYY-MM), estado
// ─────────────────────────────────────────────────────────────
router.get('/mis-clientes', async (req, res) => {
  const { id: userId } = req.user;
  const { mes, estado } = req.query;

  try {
    const params = [userId];
    let idx = 2;
    const condiciones = [`c.consultor_id = $1`];

    if (mes) {
      condiciones.push(`TO_CHAR(c.fecha_contrato, 'YYYY-MM') = $${idx}`);
      params.push(mes);
      idx++;
    }
    if (estado) {
      condiciones.push(`c.estado = $${idx}`);
      params.push(estado);
      idx++;
    }

    const whereStr = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT
        c.id,
        c.numero_contrato,
        c.fecha_contrato,
        c.tipo_plan,
        c.monto_total,
        c.n_cuotas,
        c.estado,
        p.nombres,
        p.apellidos,
        p.telefono,
        p.email,
        p.num_documento,
        s.nombre AS sala_nombre,
        COALESCE(SUM(r.valor) FILTER (WHERE r.estado = 'activo'), 0) AS total_pagado,
        c.monto_total - COALESCE(SUM(r.valor) FILTER (WHERE r.estado = 'activo'), 0) AS saldo
      FROM contratos c
      JOIN personas p ON c.persona_id = p.id
      LEFT JOIN salas s ON c.sala_id = s.id
      LEFT JOIN recibos r ON r.contrato_id = c.id
      ${whereStr}
      GROUP BY c.id, p.id, s.id
      ORDER BY c.fecha_contrato DESC
      LIMIT 200
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error('Error en GET /api/consultor/mis-clientes:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/consultor/resumen
// KPIs: ventas_mes, total_cobrado, tours_mes, comisiones pendientes/aprobadas
// Query params: mes (YYYY-MM)
// ─────────────────────────────────────────────────────────────
router.get('/resumen', async (req, res) => {
  const { id: userId } = req.user;
  const mesFiltro = req.query.mes || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' }).slice(0, 7);

  try {
    // Ventas del mes y montos
    const ventasRes = await pool.query(`
      SELECT
        COUNT(DISTINCT c.id) AS ventas_mes,
        COALESCE(SUM(c.monto_total), 0) AS monto_vendido_mes,
        COALESCE(SUM(r.total_cobrado), 0) AS total_cobrado_mes
      FROM contratos c
      LEFT JOIN (
        SELECT contrato_id, SUM(valor) AS total_cobrado
        FROM recibos
        WHERE estado = 'activo'
        GROUP BY contrato_id
      ) r ON r.contrato_id = c.id
      WHERE c.consultor_id = $1
        AND c.estado != 'cancelado'
        AND TO_CHAR(c.fecha_contrato, 'YYYY-MM') = $2
    `, [userId, mesFiltro]);

    // Tours del mes (visitas calificadas como TOUR para este consultor)
    let toursMes = 0;
    try {
      const toursRes = await pool.query(`
        SELECT COUNT(*) AS tours
        FROM visitas_sala vs
        WHERE vs.consultor_id = $1
          AND TO_CHAR(vs.fecha, 'YYYY-MM') = $2
          AND vs.calificacion = 'TOUR'
      `, [userId, mesFiltro]);
      toursMes = parseInt(toursRes.rows[0]?.tours || 0, 10);
    } catch (e) {
      toursMes = 0;
    }

    // Comisiones: pendientes (bloqueadas) y aprobadas (desbloqueadas)
    const comisionesRes = await pool.query(`
      SELECT
        COUNT(DISTINCT CASE
          WHEN c.monto_total > 0
            AND COALESCE(r.total_cobrado, 0) / c.monto_total * 100 >= COALESCE(u.pct_desbloqueo, 30)
          THEN c.id END) AS comisiones_aprobadas,
        COUNT(DISTINCT CASE
          WHEN c.monto_total > 0
            AND COALESCE(r.total_cobrado, 0) / c.monto_total * 100 < COALESCE(u.pct_desbloqueo, 30)
          THEN c.id END) AS comisiones_pendientes,
        COALESCE(SUM(
          CASE
            WHEN c.monto_total > 0
              AND COALESCE(r.total_cobrado, 0) / c.monto_total * 100 >= COALESCE(u.pct_desbloqueo, 30)
            THEN COALESCE(r.total_cobrado, 0) * COALESCE(u.pct_comision_venta, 10) / 100
            ELSE 0
          END
        ), 0) AS monto_comisiones_aprobadas,
        COALESCE(SUM(
          CASE
            WHEN c.monto_total > 0
              AND COALESCE(r.total_cobrado, 0) / c.monto_total * 100 < COALESCE(u.pct_desbloqueo, 30)
            THEN COALESCE(r.total_cobrado, 0) * COALESCE(u.pct_comision_venta, 10) / 100
            ELSE 0
          END
        ), 0) AS monto_comisiones_pendientes
      FROM contratos c
      JOIN usuarios u ON c.consultor_id = u.id
      LEFT JOIN (
        SELECT contrato_id, SUM(valor) AS total_cobrado
        FROM recibos
        WHERE estado = 'activo'
        GROUP BY contrato_id
      ) r ON r.contrato_id = c.id
      WHERE c.consultor_id = $1
        AND c.estado = 'activo'
        AND TO_CHAR(c.fecha_contrato, 'YYYY-MM') = $2
    `, [userId, mesFiltro]);

    const v = ventasRes.rows[0] || {};
    const cm = comisionesRes.rows[0] || {};

    res.json({
      ventas_mes: parseInt(v.ventas_mes || 0, 10),
      monto_vendido_mes: parseFloat(v.monto_vendido_mes || 0),
      total_cobrado_mes: parseFloat(v.total_cobrado_mes || 0),
      tours_mes: toursMes,
      comisiones_aprobadas: parseInt(cm.comisiones_aprobadas || 0, 10),
      comisiones_pendientes: parseInt(cm.comisiones_pendientes || 0, 10),
      monto_comisiones_aprobadas: parseFloat(cm.monto_comisiones_aprobadas || 0),
      monto_comisiones_pendientes: parseFloat(cm.monto_comisiones_pendientes || 0),
    });
  } catch (err) {
    console.error('Error en GET /api/consultor/resumen:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/consultor/comisiones
// Listado de comisiones del consultor con tipo, monto, periodo, estado
// Query params: mes (YYYY-MM), estado_comision (desbloqueada|bloqueada)
// ─────────────────────────────────────────────────────────────
router.get('/comisiones', async (req, res) => {
  const { id: userId } = req.user;
  const { mes, estado_comision } = req.query;
  const mesFiltro = mes || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' }).slice(0, 7);

  try {
    const result = await pool.query(`
      SELECT
        c.id,
        c.numero_contrato,
        p.nombres,
        p.apellidos,
        c.monto_total,
        c.fecha_contrato,
        COALESCE(r.total_cobrado, 0) AS total_cobrado,
        CASE
          WHEN c.monto_total > 0
          THEN ROUND(COALESCE(r.total_cobrado, 0) / c.monto_total * 100, 2)
          ELSE 0
        END AS pct_pagado,
        CASE
          WHEN c.monto_total > 0
            AND COALESCE(r.total_cobrado, 0) / c.monto_total * 100 >= COALESCE(u.pct_desbloqueo, 30)
          THEN ROUND(COALESCE(r.total_cobrado, 0) * COALESCE(u.pct_comision_venta, 10) / 100, 2)
          ELSE 0
        END AS monto_comision,
        CASE
          WHEN c.monto_total > 0
            AND COALESCE(r.total_cobrado, 0) / c.monto_total * 100 >= COALESCE(u.pct_desbloqueo, 30)
          THEN 'desbloqueada'
          ELSE 'bloqueada'
        END AS estado_comision,
        COALESCE(u.pct_comision_venta, 10) AS pct_comision,
        COALESCE(u.pct_desbloqueo, 30) AS pct_desbloqueo,
        CASE
          WHEN c.segunda_venta = true THEN 'Segunda venta'
          ELSE 'Venta directa'
        END AS tipo_comision,
        TO_CHAR(c.fecha_contrato, 'YYYY-MM') AS periodo
      FROM contratos c
      JOIN personas p ON c.persona_id = p.id
      JOIN usuarios u ON c.consultor_id = u.id
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
    `, [userId, mesFiltro]);

    let rows = result.rows;

    // Filtrar por estado de comision si se pide
    if (estado_comision) {
      rows = rows.filter(r => r.estado_comision === estado_comision);
    }

    res.json(rows);
  } catch (err) {
    console.error('Error en GET /api/consultor/comisiones:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
