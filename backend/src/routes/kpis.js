const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/kpis?sala_id=X&periodo=2026-03
router.get('/', auth, async (req, res) => {
  const { sala_id, periodo } = req.query;
  const { sala_id: userSalaId, rol } = req.user;

  const salaId = sala_id || userSalaId;

  // Período (mes) — default: mes actual
  let fechaInicio, fechaFin;
  if (periodo) {
    const [year, month] = periodo.split('-');
    fechaInicio = `${year}-${month}-01`;
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    fechaFin = `${year}-${month}-${lastDay}`;
  } else {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2,'0');
    fechaInicio = `${y}-${m}-01`;
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    fechaFin = `${y}-${m}-${lastDay}`;
  }

  try {
    const params = [fechaInicio, fechaFin, salaId || null];

    // ── KPIs de Mercadeo ──────────────────────────────────
    const mercadeoRes = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE l.tipificacion_id IS NOT NULL)                    AS total_leads,
        COUNT(*) FILTER (WHERE l.estado IN ('confirmada','tentativa'))            AS total_citas,
        COUNT(*) FILTER (WHERE l.estado IN ('tour','no_tour','no_show','confirmada') AND l.fecha_cita <= NOW())
                                                                                  AS total_asistencias,
        COUNT(*) FILTER (WHERE l.estado = 'tour')                                 AS total_tours,
        COUNT(*) FILTER (WHERE l.estado = 'no_tour')                              AS total_no_tour,
        COUNT(*) FILTER (WHERE l.estado = 'no_show')                              AS total_no_show
      FROM leads l
      WHERE DATE(l.created_at) BETWEEN $1::date AND $2::date
        AND ($3::integer IS NULL OR l.sala_id = $3)
    `, params);

    // ── KPIs de Sala ──────────────────────────────────────
    const salaRes = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE vs.calificacion = 'TOUR')    AS tours,
        COUNT(*) FILTER (WHERE vs.calificacion = 'NO_TOUR') AS no_tours,
        COUNT(*) FILTER (WHERE vs.calificacion = 'NO_SHOW') AS no_shows,
        COUNT(*)                                             AS total_visitas
      FROM visitas_sala vs
      WHERE vs.fecha BETWEEN $1::date AND $2::date
        AND ($3::integer IS NULL OR vs.sala_id = $3)
    `, params);

    // ── Leads por fuente ──────────────────────────────────
    const fuentesRes = await pool.query(`
      SELECT f.nombre AS fuente, COUNT(*) AS cantidad
      FROM leads l
      JOIN fuentes f ON l.fuente_id = f.id
      WHERE DATE(l.created_at) BETWEEN $1::date AND $2::date
        AND ($3::integer IS NULL OR l.sala_id = $3)
      GROUP BY f.nombre
      ORDER BY cantidad DESC
    `, params);

    // ── Leads por tipificación ────────────────────────────
    const tipificacionesRes = await pool.query(`
      SELECT t.nombre AS tipificacion, COUNT(*) AS cantidad
      FROM leads l
      JOIN tipificaciones t ON l.tipificacion_id = t.id
      WHERE DATE(l.created_at) BETWEEN $1::date AND $2::date
        AND ($3::integer IS NULL OR l.sala_id = $3)
      GROUP BY t.nombre
      ORDER BY cantidad DESC
    `, params);

    // ── KPIs por TMK ─────────────────────────────────────
    const tmkRes = await pool.query(`
      SELECT
        u.nombre AS tmk_nombre,
        COUNT(*)                                              AS total_leads,
        COUNT(*) FILTER (WHERE l.estado IN ('confirmada','tentativa')) AS citas_agendadas,
        COUNT(*) FILTER (WHERE l.estado IN ('tour','no_tour','no_show')) AS asistencias,
        COUNT(*) FILTER (WHERE l.estado = 'tour')             AS tours
      FROM leads l
      JOIN usuarios u ON l.tmk_id = u.id
      WHERE DATE(l.created_at) BETWEEN $1::date AND $2::date
        AND ($3::integer IS NULL OR l.sala_id = $3)
      GROUP BY u.id, u.nombre
      ORDER BY total_leads DESC
    `, params);

    // ── KPIs de Ventas ───────────────────────────────────
    const ventasRes = await pool.query(`
      SELECT
        COUNT(*)                         AS total_contratos,
        COALESCE(SUM(monto_total), 0)    AS monto_total,
        COALESCE(SUM(valor_financiado), 0) AS monto_financiado,
        COUNT(*) FILTER (WHERE segunda_venta = true) AS segundas_ventas
      FROM contratos
      WHERE DATE(fecha_contrato) BETWEEN $1::date AND $2::date
        AND ($3::integer IS NULL OR sala_id = $3)
        AND estado NOT IN ('cancelado')
    `, params);

    const merc = mercadeoRes.rows[0];
    const sala = salaRes.rows[0];
    const vent = ventasRes.rows[0];

    // Calcular ratios
    const totalLeads    = Number(merc.total_leads);
    const totalCitas    = Number(merc.total_citas);
    const totalAsist    = Number(merc.total_asistencias);
    const totalTours    = Number(sala.tours);
    const totalVisitas  = Number(sala.total_visitas);

    const efectividad_datos  = totalLeads  > 0 ? ((totalCitas   / totalLeads) * 100).toFixed(1) : 0;
    const efectividad_citas  = totalCitas  > 0 ? ((totalAsist   / totalCitas) * 100).toFixed(1) : 0;
    const asist_a_tours      = totalAsist  > 0 ? ((totalTours   / totalAsist) * 100).toFixed(1) : 0;
    const efectividad_sala   = totalTours  > 0 ? ((totalTours   / totalVisitas) * 100).toFixed(1) : 0;

    res.json({
      periodo: { inicio: fechaInicio, fin: fechaFin },
      mercadeo: {
        total_leads:       totalLeads,
        total_citas:       totalCitas,
        total_asistencias: totalAsist,
        total_tours:       totalTours,
        efectividad_datos: Number(efectividad_datos),  // Leads → Citas %
        efectividad_citas: Number(efectividad_citas),  // Citas → Asistencias %
        asist_a_tours:     Number(asist_a_tours),      // Asistencias → Tours %
      },
      sala: {
        tours:             totalTours,
        no_tours:          Number(sala.no_tours),
        no_shows:          Number(sala.no_shows),
        total_visitas:     totalVisitas,
        efectividad:       Number(efectividad_sala),   // Tours / Total visitas %
      },
      ventas: {
        total_contratos:  Number(vent.total_contratos),
        monto_total:      Number(vent.monto_total),
        monto_financiado: Number(vent.monto_financiado),
        segundas_ventas:  Number(vent.segundas_ventas),
      },
      fuentes: fuentesRes.rows,
      tipificaciones: tipificacionesRes.rows,
      tmks: tmkRes.rows.map(r => ({
        ...r,
        conversion: Number(r.asistencias) > 0
          ? ((Number(r.tours) / Number(r.asistencias)) * 100).toFixed(1)
          : 0,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al calcular KPIs' });
  }
});

// GET /api/kpis/tendencia?sala_id=X&semanas=8
// Retorna ventas (contratos creados) por semana, últimas N semanas
router.get('/tendencia', auth, async (req, res) => {
  const { sala_id, semanas = 8 } = req.query;
  const { sala_id: userSalaId, rol } = req.user;
  const salaId = sala_id || (['admin','director'].includes(rol) ? null : userSalaId);
  const n = Math.min(parseInt(semanas), 52);
  try {
    const result = await pool.query(`
      SELECT
        DATE_TRUNC('week', fecha_contrato)::date AS semana_inicio,
        COUNT(*)                                  AS total_contratos,
        COALESCE(SUM(monto_total), 0)             AS monto_total
      FROM contratos
      WHERE fecha_contrato >= NOW() - INTERVAL '${n} weeks'
        AND ($1::integer IS NULL OR sala_id = $1)
        AND estado NOT IN ('cancelado')
      GROUP BY 1
      ORDER BY 1 ASC
    `, [salaId || null]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/kpis/top-consultores?sala_id=X&periodo=YYYY-MM
// Top 5 consultores por número de contratos y monto en el período
router.get('/top-consultores', auth, async (req, res) => {
  const { sala_id, periodo } = req.query;
  const { sala_id: userSalaId, rol } = req.user;
  const salaId = sala_id || (['admin','director'].includes(rol) ? null : userSalaId);
  const now = new Date();
  let fechaInicio, fechaFin;
  if (periodo) {
    const [y, m] = periodo.split('-');
    fechaInicio = `${y}-${m}-01`;
    fechaFin    = `${y}-${m}-${new Date(y, m, 0).getDate()}`;
  } else {
    const y = now.getFullYear(), m = String(now.getMonth()+1).padStart(2,'0');
    fechaInicio = `${y}-${m}-01`;
    fechaFin    = `${y}-${m}-${new Date(y, now.getMonth()+1, 0).getDate()}`;
  }
  try {
    const result = await pool.query(`
      SELECT
        u.nombre                             AS consultor,
        u.id                                 AS consultor_id,
        COUNT(c.id)                          AS total_contratos,
        COALESCE(SUM(c.monto_total), 0)      AS monto_total,
        COALESCE(SUM(CASE WHEN c.segunda_venta THEN 1 ELSE 0 END), 0) AS segundas_ventas
      FROM contratos c
      JOIN usuarios u ON c.consultor_id = u.id
      WHERE DATE(c.fecha_contrato) BETWEEN $1::date AND $2::date
        AND ($3::integer IS NULL OR c.sala_id = $3)
        AND c.estado NOT IN ('cancelado')
      GROUP BY u.id, u.nombre
      ORDER BY total_contratos DESC, monto_total DESC
      LIMIT 5
    `, [fechaInicio, fechaFin, salaId || null]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
