const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

/**
 * @openapi
 * /api/kpis:
 *   get:
 *     tags: [KPIs]
 *     summary: Obtener KPIs del periodo
 *     description: Retorna indicadores clave de mercadeo, sala y ventas para un periodo mensual. Incluye efectividad de datos, citas, tours y ventas por consultor y TMK.
 *     parameters:
 *       - in: query
 *         name: sala_id
 *         schema:
 *           type: integer
 *         description: Filtrar por sala (por defecto la sala del usuario)
 *       - in: query
 *         name: periodo
 *         schema:
 *           type: string
 *           example: '2026-03'
 *         description: Periodo en formato YYYY-MM (por defecto mes actual)
 *     responses:
 *       200:
 *         description: KPIs del periodo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 periodo:
 *                   type: object
 *                   properties:
 *                     inicio:
 *                       type: string
 *                       format: date
 *                     fin:
 *                       type: string
 *                       format: date
 *                 mercadeo:
 *                   type: object
 *                   properties:
 *                     total_leads:
 *                       type: integer
 *                     total_citas:
 *                       type: integer
 *                     total_tours:
 *                       type: integer
 *                     efectividad_datos:
 *                       type: number
 *                 ventas:
 *                   type: object
 *                   properties:
 *                     total_contratos:
 *                       type: integer
 *                     monto_total:
 *                       type: number
 */
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
        COUNT(*) FILTER (WHERE l.estado IN ('tour','no_tour','inasistencia','confirmada') AND l.fecha_cita <= NOW())
                                                                                  AS total_asistencias,
        COUNT(*) FILTER (WHERE l.estado = 'tour')                                 AS total_tours,
        COUNT(*) FILTER (WHERE l.estado = 'no_tour')                              AS total_no_tour,
        COUNT(*) FILTER (WHERE l.estado = 'inasistencia')                         AS total_inasistencia
      FROM leads l
      WHERE l.created_at >= $1::date AND l.created_at < ($2::date + INTERVAL '1 day')
        AND ($3::integer IS NULL OR l.sala_id = $3)
    `, params);

    // ── KPIs de Sala ──────────────────────────────────────
    const salaRes = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE vs.calificacion = 'TOUR')    AS tours,
        COUNT(*) FILTER (WHERE vs.calificacion = 'NO_TOUR') AS no_tours,
        0 AS no_shows, -- NO_SHOW eliminado
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
      WHERE l.created_at >= $1::date AND l.created_at < ($2::date + INTERVAL '1 day')
        AND ($3::integer IS NULL OR l.sala_id = $3)
      GROUP BY f.nombre
      ORDER BY cantidad DESC
    `, params);

    // ── Leads por tipificación ────────────────────────────
    const tipificacionesRes = await pool.query(`
      SELECT t.nombre AS tipificacion, COUNT(*) AS cantidad
      FROM leads l
      JOIN tipificaciones t ON l.tipificacion_id = t.id
      WHERE l.created_at >= $1::date AND l.created_at < ($2::date + INTERVAL '1 day')
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
        COUNT(*) FILTER (WHERE l.estado IN ('tour','no_tour','inasistencia')) AS asistencias,
        COUNT(*) FILTER (WHERE l.estado = 'tour')             AS tours
      FROM leads l
      JOIN usuarios u ON l.tmk_id = u.id
      WHERE l.created_at >= $1::date AND l.created_at < ($2::date + INTERVAL '1 day')
        AND ($3::integer IS NULL OR l.sala_id = $3)
      GROUP BY u.id, u.nombre
      ORDER BY total_leads DESC
    `, params);

    // ── KPIs de Ventas ───────────────────────────────────
    const ventasRes = await pool.query(`
      SELECT
        COUNT(*)                         AS total_contratos,
        COALESCE(SUM(monto_total), 0)    AS monto_total,
        COALESCE(SUM(CASE WHEN n_cuotas > 1 THEN monto_total ELSE 0 END), 0) AS monto_financiado,
        COUNT(*) FILTER (WHERE segunda_venta = true) AS segundas_ventas
      FROM contratos
      WHERE fecha_contrato >= $1::date AND fecha_contrato < ($2::date + INTERVAL '1 day')
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
      WHERE fecha_contrato >= NOW() - make_interval(weeks => $2)
        AND ($1::integer IS NULL OR sala_id = $1)
        AND estado NOT IN ('cancelado')
      GROUP BY 1
      ORDER BY 1 ASC
    `, [salaId || null, n]);
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
      WHERE c.fecha_contrato >= $1::date AND c.fecha_contrato < ($2::date + INTERVAL '1 day')
        AND ($3::integer IS NULL OR c.sala_id = $3)
        AND c.estado NOT IN ('cancelado')
      GROUP BY u.id, u.nombre
      ORDER BY total_contratos DESC, monto_total DESC
      LIMIT 5
    `, [fechaInicio, fechaFin, salaId || null]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/kpis/hoy?sala_id=X
// Datos en tiempo real del día actual (para dashboard live)
router.get('/hoy', auth, async (req, res) => {
  const { sala_id } = req.query;
  const { sala_id: userSalaId, rol } = req.user;
  const salaId = sala_id || (['admin', 'director'].includes(rol) ? null : userSalaId);
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM leads
         WHERE created_at >= CURRENT_DATE AND created_at < (CURRENT_DATE + INTERVAL '1 day')
           AND ($1::integer IS NULL OR sala_id = $1)) AS leads_hoy,
        (SELECT COUNT(*) FROM leads
         WHERE (fecha_cita AT TIME ZONE 'America/Guayaquil')::date = CURRENT_DATE + 1
           AND ($1::integer IS NULL OR sala_id = $1)
           AND estado IN ('confirmada','tentativa')) AS citas_manana,
        (SELECT COUNT(*) FROM visitas_sala
         WHERE fecha = CURRENT_DATE
           AND ($1::integer IS NULL OR sala_id = $1)
           AND calificacion = 'TOUR') AS tours_hoy,
        (SELECT COALESCE(SUM(r.valor), 0)
         FROM recibos r
         JOIN contratos c ON r.contrato_id = c.id
         WHERE r.fecha_pago >= CURRENT_DATE AND r.fecha_pago < (CURRENT_DATE + INTERVAL '1 day')
           AND r.estado IN ('pagado','activo')
           AND ($1::integer IS NULL OR c.sala_id = $1)) AS cobros_dia
    `, [salaId || null]);
    const row = result.rows[0];
    res.json({
      timestamp: new Date().toISOString(),
      leads_hoy:    Number(row.leads_hoy),
      citas_manana: Number(row.citas_manana),
      tours_hoy:    Number(row.tours_hoy),
      cobros_dia:   Number(row.cobros_dia),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener KPIs de hoy' });
  }
});

/**
 * @openapi
 * /api/kpis/analytics:
 *   get:
 *     tags: [KPIs]
 *     summary: Analytics avanzado
 *     description: Dashboard analitico con funnel de conversion, comparativa mensual, cobros proyectados, top fuentes y actividad por hora.
 *     parameters:
 *       - in: query
 *         name: sala_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: periodo
 *         schema:
 *           type: string
 *           example: '2026-03'
 *     responses:
 *       200:
 *         description: Analytics del periodo
 */
router.get('/analytics', auth, async (req, res) => {
  const { sala_id, periodo } = req.query;
  const { sala_id: userSalaId, rol } = req.user;
  const salaId = sala_id || (['admin', 'director'].includes(rol) ? null : userSalaId);

  // Periodo actual
  let fechaInicio, fechaFin, yearNum, monthNum;
  if (periodo) {
    const [y, m] = periodo.split('-');
    yearNum = Number(y);
    monthNum = Number(m);
    fechaInicio = `${y}-${m}-01`;
    const lastDay = new Date(yearNum, monthNum, 0).getDate();
    fechaFin = `${y}-${m}-${lastDay}`;
  } else {
    const now = new Date();
    yearNum = now.getFullYear();
    monthNum = now.getMonth() + 1;
    const m = String(monthNum).padStart(2, '0');
    fechaInicio = `${yearNum}-${m}-01`;
    const lastDay = new Date(yearNum, monthNum, 0).getDate();
    fechaFin = `${yearNum}-${m}-${lastDay}`;
  }

  // Periodo anterior
  let prevYear = yearNum, prevMonth = monthNum - 1;
  if (prevMonth < 1) { prevMonth = 12; prevYear--; }
  const pm = String(prevMonth).padStart(2, '0');
  const prevInicio = `${prevYear}-${pm}-01`;
  const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
  const prevFin = `${prevYear}-${pm}-${prevLastDay}`;

  try {
    const salaParam = salaId || null;

    // ── Funnel del mes actual ──
    const funnelRes = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE l.tipificacion_id IS NOT NULL) AS leads,
        COUNT(*) FILTER (WHERE l.estado IN ('confirmada','tentativa')) AS citas,
        COUNT(*) FILTER (WHERE l.estado IN ('tour','no_tour','inasistencia','confirmada') AND l.fecha_cita <= NOW()) AS asistencias,
        COUNT(*) FILTER (WHERE l.estado = 'tour') AS tours
      FROM leads l
      WHERE l.created_at >= $1::date AND l.created_at < ($2::date + INTERVAL '1 day')
        AND ($3::integer IS NULL OR l.sala_id = $3)
    `, [fechaInicio, fechaFin, salaParam]);

    const ventasMesRes = await pool.query(`
      SELECT COUNT(*) AS ventas, COALESCE(SUM(monto_total), 0) AS monto
      FROM contratos
      WHERE fecha_contrato >= $1::date AND fecha_contrato < ($2::date + INTERVAL '1 day')
        AND ($3::integer IS NULL OR sala_id = $3)
        AND estado NOT IN ('cancelado')
    `, [fechaInicio, fechaFin, salaParam]);

    const f = funnelRes.rows[0];
    const vm = ventasMesRes.rows[0];
    const fLeads = Number(f.leads);
    const fCitas = Number(f.citas);
    const fAsist = Number(f.asistencias);
    const fTours = Number(f.tours);
    const fVentas = Number(vm.ventas);
    const fMonto = Number(vm.monto);

    const convLeadVenta = fLeads > 0 ? ((fVentas / fLeads) * 100).toFixed(1) : '0.0';

    // ── Mes anterior ──
    const prevFunnelRes = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE l.tipificacion_id IS NOT NULL) AS leads,
        COUNT(*) FILTER (WHERE l.estado = 'tour') AS tours
      FROM leads l
      WHERE l.created_at >= $1::date AND l.created_at < ($2::date + INTERVAL '1 day')
        AND ($3::integer IS NULL OR l.sala_id = $3)
    `, [prevInicio, prevFin, salaParam]);

    const prevVentasRes = await pool.query(`
      SELECT COUNT(*) AS ventas, COALESCE(SUM(monto_total), 0) AS monto
      FROM contratos
      WHERE fecha_contrato >= $1::date AND fecha_contrato < ($2::date + INTERVAL '1 day')
        AND ($3::integer IS NULL OR sala_id = $3)
        AND estado NOT IN ('cancelado')
    `, [prevInicio, prevFin, salaParam]);

    const pf = prevFunnelRes.rows[0];
    const pv = prevVentasRes.rows[0];
    const pLeads = Number(pf.leads);
    const pTours = Number(pf.tours);
    const pVentas = Number(pv.ventas);
    const pMonto = Number(pv.monto);

    function variacion(actual, anterior) {
      if (anterior === 0) return actual > 0 ? '+100.0%' : '0.0%';
      const v = ((actual - anterior) / anterior) * 100;
      return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
    }

    // ── Cobros proyectados (cuotas pendientes próximas) ──
    const cobrosRes = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE cu.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days') AS cuotas_7,
        COALESCE(SUM(cu.monto_esperado - cu.monto_pagado) FILTER (WHERE cu.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'), 0) AS monto_7,
        COUNT(*) FILTER (WHERE cu.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days') AS cuotas_30,
        COALESCE(SUM(cu.monto_esperado - cu.monto_pagado) FILTER (WHERE cu.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'), 0) AS monto_30
      FROM cuotas cu
      JOIN contratos c ON cu.contrato_id = c.id
      WHERE cu.estado IN ('pendiente','vencido','parcial')
        AND ($1::integer IS NULL OR c.sala_id = $1)
    `, [salaParam]);

    const cb = cobrosRes.rows[0];

    // ── Top fuentes con conversion ──
    const fuentesRes = await pool.query(`
      SELECT
        f.nombre AS fuente,
        COUNT(*) AS leads,
        COUNT(*) FILTER (WHERE l.estado = 'tour') AS tours
      FROM leads l
      JOIN fuentes f ON l.fuente_id = f.id
      WHERE l.created_at >= $1::date AND l.created_at < ($2::date + INTERVAL '1 day')
        AND ($3::integer IS NULL OR l.sala_id = $3)
      GROUP BY f.nombre
      ORDER BY leads DESC
      LIMIT 10
    `, [fechaInicio, fechaFin, salaParam]);

    const topFuentes = fuentesRes.rows.map(r => ({
      fuente: r.fuente,
      leads: Number(r.leads),
      tours: Number(r.tours),
      conversion: Number(r.leads) > 0 ? ((Number(r.tours) / Number(r.leads)) * 100).toFixed(1) + '%' : '0.0%',
    }));

    // ── Actividad por hora ──
    const actividadRes = await pool.query(`
      SELECT
        EXTRACT(HOUR FROM l.created_at) AS hora,
        COUNT(*) AS leads,
        COUNT(*) FILTER (WHERE l.estado IN ('confirmada','tentativa')) AS citas
      FROM leads l
      WHERE l.created_at >= $1::date AND l.created_at < ($2::date + INTERVAL '1 day')
        AND ($3::integer IS NULL OR l.sala_id = $3)
      GROUP BY 1
      ORDER BY 1
    `, [fechaInicio, fechaFin, salaParam]);

    const actividadHora = actividadRes.rows.map(r => ({
      hora: Number(r.hora),
      leads: Number(r.leads),
      citas: Number(r.citas),
    }));

    res.json({
      funnel: {
        leads: fLeads,
        citas: fCitas,
        asistencias: fAsist,
        tours: fTours,
        ventas: fVentas,
        conversion_lead_venta: convLeadVenta + '%',
      },
      comparativa: {
        mes_actual: { leads: fLeads, tours: fTours, ventas: fVentas, monto: fMonto },
        mes_anterior: { leads: pLeads, tours: pTours, ventas: pVentas, monto: pMonto },
        variacion_leads: variacion(fLeads, pLeads),
        variacion_ventas: variacion(fVentas, pVentas),
        variacion_monto: variacion(fMonto, pMonto),
      },
      cobros_proyectados: {
        cuotas_proximos_7_dias: Number(cb.cuotas_7),
        monto_proximos_7_dias: Number(cb.monto_7),
        cuotas_proximos_30_dias: Number(cb.cuotas_30),
        monto_proximos_30_dias: Number(cb.monto_30),
      },
      top_fuentes: topFuentes,
      actividad_hora: actividadHora,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al calcular analytics' });
  }
});

module.exports = router;
