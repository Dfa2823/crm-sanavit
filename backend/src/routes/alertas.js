const express = require('express');
const pool    = require('../db');
const auth    = require('../middleware/auth');
const router  = express.Router();

/* ──────────────────────────────────────────────────────────
   GET /api/alertas/resumen
   Retorna conteos para el badge del header (rápido, <50 ms).
   admin/director ven todo; resto ve solo su sala.
────────────────────────────────────────────────────────── */
router.get('/resumen', auth, async (req, res) => {
  const { rol, sala_id, id: userId } = req.user;
  const esAdmin = ['admin', 'director'].includes(rol);

  try {
    // 1. Cuotas vencidas hace > 5 días y sin gestión reciente
    const cuotasRes = await pool.query(`
      SELECT COUNT(*) AS total
      FROM cuotas cu
      JOIN contratos c ON cu.contrato_id = c.id
      WHERE cu.estado IN ('vencido','pendiente')
        AND cu.fecha_vencimiento < CURRENT_DATE - INTERVAL '5 days'
        AND (cu.observacion IS NULL OR LENGTH(cu.observacion) < 5)
        AND ($1::boolean OR c.sala_id = $2)
    `, [esAdmin, sala_id || 0]);

    // 2. Tickets SAC abiertos > 3 días (si tabla existe)
    let ticketsCount = 0;
    try {
      const ticketsRes = await pool.query(`
        SELECT COUNT(*) AS total
        FROM pqr_tickets
        WHERE estado IN ('abierto','en_proceso')
          AND fecha_apertura < NOW() - INTERVAL '3 days'
      `);
      ticketsCount = parseInt(ticketsRes.rows[0].total);
    } catch (e) { /* tabla no existe aún */ }

    // 3. Cuotas pendientes con vencimiento en los próximos 7 días
    const proxVencRes = await pool.query(`
      SELECT COUNT(*) AS total
      FROM cuotas cu
      JOIN contratos c ON cu.contrato_id = c.id
      WHERE cu.estado = 'pendiente'
        AND cu.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
        AND ($1::boolean OR c.sala_id = $2)
    `, [esAdmin, sala_id || 0]);

    const cuotasVencidas = parseInt(cuotasRes.rows[0].total);
    const proxVencer     = parseInt(proxVencRes.rows[0].total);
    const total          = cuotasVencidas + ticketsCount + proxVencer;

    res.json({
      total,
      cuotas_vencidas:    cuotasVencidas,
      tickets_urgentes:   ticketsCount,
      proximas_a_vencer:  proxVencer,
    });
  } catch (err) {
    console.error('[alertas/resumen]', err);
    res.status(500).json({ error: err.message });
  }
});

/* ──────────────────────────────────────────────────────────
   GET /api/alertas/detalle
   Retorna la lista completa de alertas para la página.
   Mismo filtrado por rol que /resumen.
────────────────────────────────────────────────────────── */
router.get('/detalle', auth, async (req, res) => {
  const { rol, sala_id } = req.user;
  const esAdmin = ['admin', 'director'].includes(rol);

  try {
    const alertas = [];

    // ── Cuotas vencidas sin gestión ──────────────────────
    const cuotasRes = await pool.query(`
      SELECT
        cu.id,
        cu.fecha_vencimiento,
        cu.monto_esperado,
        cu.estado,
        c.numero_contrato,
        p.nombres || ' ' || COALESCE(p.apellidos, '') AS cliente,
        p.telefono,
        s.nombre AS sala_nombre,
        NOW()::date - cu.fecha_vencimiento::date AS dias_mora
      FROM cuotas cu
      JOIN contratos c ON cu.contrato_id = c.id
      JOIN personas p ON c.persona_id = p.id
      LEFT JOIN salas s ON c.sala_id = s.id
      WHERE cu.estado IN ('vencido','pendiente')
        AND cu.fecha_vencimiento < CURRENT_DATE - INTERVAL '5 days'
        AND (cu.observacion IS NULL OR LENGTH(cu.observacion) < 5)
        AND ($1::boolean OR c.sala_id = $2)
      ORDER BY dias_mora DESC
      LIMIT 50
    `, [esAdmin, sala_id || 0]);

    cuotasRes.rows.forEach(r => alertas.push({
      tipo:       'cuota_vencida',
      prioridad:  r.dias_mora > 60 ? 'alta' : r.dias_mora > 30 ? 'media' : 'baja',
      titulo:     `Cuota vencida — ${r.cliente}`,
      descripcion:`Contrato ${r.numero_contrato} · ${r.dias_mora} días de mora · $${r.monto_esperado}`,
      telefono:   r.telefono,
      sala:       r.sala_nombre,
      fecha:      r.fecha_vencimiento,
      meta:       r,
    }));

    // ── Tickets SAC urgentes ─────────────────────────────
    try {
      const tickRes = await pool.query(`
        SELECT
          pt.*,
          p.nombres || ' ' || COALESCE(p.apellidos, '') AS cliente,
          p.telefono,
          NOW() - pt.fecha_apertura AS tiempo_abierto
        FROM pqr_tickets pt
        JOIN personas p ON pt.persona_id = p.id
        WHERE pt.estado IN ('abierto','en_proceso')
          AND pt.fecha_apertura < NOW() - INTERVAL '3 days'
        ORDER BY pt.fecha_apertura ASC
        LIMIT 20
      `);

      tickRes.rows.forEach(r => alertas.push({
        tipo:       'ticket_urgente',
        prioridad:  r.prioridad || 'media',
        titulo:     `Ticket SAC sin resolver — ${r.numero_ticket}`,
        descripcion:`${r.tipo} · ${r.cliente} · Abierto hace más de 3 días`,
        telefono:   r.telefono,
        fecha:      r.fecha_apertura,
        meta:       r,
      }));
    } catch (e) { /* tabla pqr_tickets no existe aún */ }

    // ── Cuotas próximas a vencer (7 días) ───────────────
    const proxRes = await pool.query(`
      SELECT
        cu.id,
        cu.fecha_vencimiento,
        cu.monto_esperado,
        c.numero_contrato,
        p.nombres || ' ' || COALESCE(p.apellidos, '') AS cliente,
        p.telefono,
        s.nombre AS sala_nombre,
        cu.fecha_vencimiento::date - CURRENT_DATE AS dias_restantes
      FROM cuotas cu
      JOIN contratos c ON cu.contrato_id = c.id
      JOIN personas p ON c.persona_id = p.id
      LEFT JOIN salas s ON c.sala_id = s.id
      WHERE cu.estado = 'pendiente'
        AND cu.fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
        AND ($1::boolean OR c.sala_id = $2)
      ORDER BY cu.fecha_vencimiento ASC
      LIMIT 30
    `, [esAdmin, sala_id || 0]);

    proxRes.rows.forEach(r => alertas.push({
      tipo:       'proximo_vencer',
      prioridad:  r.dias_restantes <= 2 ? 'alta' : 'media',
      titulo:     `Cuota próxima a vencer — ${r.cliente}`,
      descripcion:`Contrato ${r.numero_contrato} · Vence en ${r.dias_restantes} día(s) · $${r.monto_esperado}`,
      telefono:   r.telefono,
      sala:       r.sala_nombre,
      fecha:      r.fecha_vencimiento,
      meta:       r,
    }));

    // ── Ordenar: alta prioridad primero ─────────────────
    const orden = { alta: 0, media: 1, baja: 2 };
    alertas.sort((a, b) => orden[a.prioridad] - orden[b.prioridad]);

    res.json({ total: alertas.length, alertas });
  } catch (err) {
    console.error('[alertas/detalle]', err);
    res.status(500).json({ error: err.message });
  }
});

/* ──────────────────────────────────────────────────────────
   GET /api/alertas/tours-recientes
   Retorna tours calificados en los últimos 30 minutos.
   Para notificaciones "bombitas" a TMK y confirmadores.
────────────────────────────────────────────────────────── */
router.get('/tours-recientes', auth, async (req, res) => {
  const { rol } = req.user;

  // Solo roles que necesitan ver la notificación
  if (!['tmk', 'confirmador', 'supervisor_cc', 'admin', 'director'].includes(rol)) {
    return res.json([]);
  }

  try {
    const result = await pool.query(`
      SELECT vs.id, vs.created_at,
        p.nombres, p.apellidos,
        s.nombre AS sala
      FROM visitas_sala vs
      JOIN personas p ON vs.persona_id = p.id
      JOIN salas s ON vs.sala_id = s.id
      WHERE vs.calificacion = 'TOUR'
        AND vs.created_at >= NOW() - INTERVAL '30 minutes'
      ORDER BY vs.created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error('[alertas/tours-recientes]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
