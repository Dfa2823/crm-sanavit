const express = require('express');
const pool = require('../db');
const { hoyEC } = require('../db');
const auth = require('../middleware/auth');
const { dispararWebhook } = require('../utils/webhook');

const router = express.Router();

// GET /api/citas/premanifiesto?sala_id=X&fecha=YYYY-MM-DD
// Retorna citas agrupadas por estado para el pre-manifiesto
router.get('/premanifiesto', auth, async (req, res) => {
  const { sala_id, fecha } = req.query;
  const { sala_id: userSalaId, rol, id: userId } = req.user;

  // Fecha a consultar (por defecto: mañana)
  const fechaConsulta = fecha || (() => {
    const m = new Date();
    m.setDate(m.getDate() + 1);
    return m.toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
  })();

  const salaId = sala_id || userSalaId;

  try {
    let whereExtra = '';
    const params = [fechaConsulta, salaId];
    let idx = 3;

    // Outsourcing solo ve los suyos
    if (rol === 'outsourcing') {
      whereExtra = ` AND l.outsourcing_id = $${idx}`;
      params.push(userId);
      idx++;
    }

    // Confirmador solo ve sus citas asignadas (o las sin asignar)
    if (rol === 'confirmador') {
      whereExtra += ` AND (l.confirmador_id = $${idx} OR l.confirmador_id IS NULL)`;
      params.push(userId);
      idx++;
    }

    const baseQuery = `
      SELECT
        l.id, l.estado, l.patologia, l.observacion,
        l.fecha_cita, l.outsourcing_id, l.tipificacion_id,
        p.nombres, p.apellidos, p.telefono, p.ciudad,
        f.nombre AS fuente_nombre,
        t.nombre AS tipificacion_nombre,
        u.nombre AS tmk_nombre,
        ou.nombre AS outsourcing_nombre
      FROM leads l
      JOIN personas p ON l.persona_id = p.id
      LEFT JOIN fuentes f ON l.fuente_id = f.id
      LEFT JOIN tipificaciones t ON l.tipificacion_id = t.id
      LEFT JOIN usuarios u ON l.tmk_id = u.id
      LEFT JOIN usuarios ou ON l.outsourcing_id = ou.id
      WHERE DATE(l.fecha_cita AT TIME ZONE 'America/Guayaquil') = $1
        AND ($2::integer IS NULL OR l.sala_id = $2)
        ${whereExtra}
    `;

    // Incluir TODOS los estados de citas: confirmada, tentativa, cancelada,
    // inasistencia, tour, no_tour, pendiente. Las citas que ya están en tour/no_tour
    // se cuentan como confirmadas (ya cumplió la cita).
    const [confirmadas, tentativas, canceladas, inasistencias, tours, noTours, pendientes] = await Promise.all([
      pool.query(`${baseQuery} AND l.estado = 'confirmada' ORDER BY l.fecha_cita ASC`, params),
      pool.query(`${baseQuery} AND l.estado = 'tentativa' ORDER BY l.fecha_cita ASC`, params),
      pool.query(`${baseQuery} AND l.estado = 'cancelada' ORDER BY l.fecha_cita DESC`, params),
      pool.query(`${baseQuery} AND l.estado = 'inasistencia' ORDER BY l.fecha_cita DESC`, params),
      pool.query(`${baseQuery} AND l.estado = 'tour' ORDER BY l.fecha_cita ASC`, params),
      pool.query(`${baseQuery} AND l.estado = 'no_tour' ORDER BY l.fecha_cita ASC`, params),
      pool.query(`${baseQuery} AND l.estado = 'pendiente' AND l.fecha_cita IS NOT NULL ORDER BY l.fecha_cita ASC`, params),
    ]);

    res.json({
      fecha: fechaConsulta,
      confirmadas: confirmadas.rows,
      tentativas: tentativas.rows,
      canceladas: canceladas.rows,
      inasistencias: inasistencias.rows,
      tours: tours.rows,
      no_tours: noTours.rows,
      pendientes: pendientes.rows,
      totales: {
        confirmadas: confirmadas.rows.length,
        tentativas: tentativas.rows.length,
        canceladas: canceladas.rows.length,
        inasistencias: inasistencias.rows.length,
        tours: tours.rows.length,
        no_tours: noTours.rows.length,
        pendientes: pendientes.rows.length,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener pre-manifiesto' });
  }
});

// GET /api/citas/hoy?sala_id=X&desde=YYYY-MM-DD&hasta=YYYY-MM-DD
// Citas para la vista de Recepción (Hostess). Sin desde/hasta = hoy.
router.get('/hoy', auth, async (req, res) => {
  const { sala_id, desde, hasta } = req.query;
  const { sala_id: userSalaId } = req.user;
  const salaId = sala_id || userSalaId;

  const hoy = hoyEC();
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  const desdeStr = desde || hoy;
  const hastaStr = hasta || desde || hoy;

  if (!ISO_DATE.test(desdeStr) || !ISO_DATE.test(hastaStr)) {
    return res.status(400).json({ error: 'Fechas deben tener formato YYYY-MM-DD' });
  }
  if (desdeStr > hastaStr) {
    return res.status(400).json({ error: 'Rango inválido: desde > hasta' });
  }
  // Límite de 62 días para evitar consultas pesadas accidentales
  const msDia = 86400000;
  const dias = Math.round((Date.parse(hastaStr) - Date.parse(desdeStr)) / msDia) + 1;
  if (dias > 62) {
    return res.status(400).json({ error: 'Rango máximo 62 días' });
  }

  try {
    const result = await pool.query(`
      SELECT
        l.id AS lead_id, l.estado, l.patologia, l.fecha_cita, l.observacion,
        l.tipificacion_id,
        p.id AS persona_id, p.nombres, p.apellidos, p.telefono, p.ciudad, p.edad,
        f.nombre AS fuente_nombre,
        t.nombre AS tipificacion_nombre,
        u.nombre AS tmk_nombre,
        vs.id AS visita_id, vs.hora_llegada, vs.calificacion, vs.hora_cita_agendada,
        vs.consultor_id, vs.acompanante,
        uc.nombre AS consultor_nombre
      FROM leads l
      JOIN personas p ON l.persona_id = p.id
      LEFT JOIN fuentes f ON l.fuente_id = f.id
      LEFT JOIN tipificaciones t ON l.tipificacion_id = t.id
      LEFT JOIN usuarios u ON l.tmk_id = u.id
      LEFT JOIN LATERAL (
        SELECT id, hora_llegada, calificacion, hora_cita_agendada,
               consultor_id, acompanante
        FROM visitas_sala
        WHERE lead_id = l.id
        ORDER BY fecha DESC, id DESC
        LIMIT 1
      ) vs ON true
      LEFT JOIN usuarios uc ON vs.consultor_id = uc.id
      WHERE (
            -- Lead con cita en el rango (caso normal)
            (
              (l.fecha_cita AT TIME ZONE 'America/Guayaquil')::date
                BETWEEN $1::date AND $2::date
              AND l.estado IN ('confirmada', 'tentativa', 'tour', 'no_tour', 'inasistencia')
            )
            OR
            -- Lead sin fecha de cita capturado en el rango (ej. tipificacion
            -- "Ya asistio" o similar) — la hostess debe verlo para revisar/agendar
            (
              l.fecha_cita IS NULL
              AND l.estado = 'pendiente'
              AND (l.created_at AT TIME ZONE 'America/Guayaquil')::date
                  BETWEEN $1::date AND $2::date
            )
          )
        AND ($3::integer IS NULL OR l.sala_id = $3)
      ORDER BY
        CASE
          WHEN l.estado = 'pendiente'  THEN 0
          WHEN l.estado = 'tentativa'  THEN 1
          WHEN l.estado = 'confirmada' THEN 2
          ELSE 3
        END,
        COALESCE(l.fecha_cita, l.created_at) ASC
    `, [desdeStr, hastaStr, salaId]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener citas' });
  }
});

// PATCH /api/citas/:lead_id/calificar
// Hostess registra llegada y califica al cliente
router.patch('/:lead_id/calificar', auth, async (req, res) => {
  if (!['admin','director','hostess','supervisor_cc'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso para calificar visitas' });
  }

  const { lead_id } = req.params;
  const { calificacion, hora_llegada, consultor_id, acompanante, outsourcing_indicado } = req.body;

  if (!calificacion) {
    return res.status(400).json({ error: 'La calificación es requerida (TOUR o NO_TOUR)' });
  }

  const estadoMap = { TOUR: 'tour', NO_TOUR: 'no_tour' };
  const nuevoEstado = estadoMap[calificacion];
  if (!nuevoEstado) {
    return res.status(400).json({ error: 'Calificación inválida' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Obtener el lead
    const leadRes = await client.query('SELECT * FROM leads WHERE id = $1', [lead_id]);
    if (leadRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Lead no encontrado' });
    }
    const lead = leadRes.rows[0];

    const hoy = hoyEC();

    // Verificar si ya existe visita hoy
    const visitaExistente = await client.query(
      'SELECT id FROM visitas_sala WHERE lead_id = $1 AND fecha = $2::date',
      [lead_id, hoy]
    );

    if (visitaExistente.rows.length > 0) {
      // Actualizar visita existente
      await client.query(`
        UPDATE visitas_sala
        SET calificacion = $1, hora_llegada = $2, consultor_id = $3,
            acompanante = $4, outsourcing_indicado = $5, updated_at = NOW()
        WHERE lead_id = $6 AND fecha = $7::date
      `, [calificacion, hora_llegada || null, consultor_id || null,
          acompanante || null, outsourcing_indicado || null, lead_id, hoy]);
    } else {
      // Crear nueva visita
      await client.query(`
        INSERT INTO visitas_sala (
          lead_id, persona_id, sala_id, hora_cita_agendada, hora_llegada,
          calificacion, consultor_id, hostess_id, acompanante, outsourcing_indicado, fecha
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::date)
      `, [
        lead_id, lead.persona_id, lead.sala_id,
        lead.fecha_cita ? new Date(lead.fecha_cita).toTimeString().slice(0,5) : null,
        hora_llegada || null,
        calificacion,
        consultor_id || null,
        req.user.id,
        acompanante || null,
        outsourcing_indicado || null,
        hoy,
      ]);
    }

    // Actualizar estado del lead
    await client.query(
      'UPDATE leads SET estado = $1, updated_at = NOW() WHERE id = $2',
      [nuevoEstado, lead_id]
    );

    await client.query('COMMIT');

    res.json({ message: 'Calificación registrada', estado: nuevoEstado });

    // Webhook: tour_registrado (fire-and-forget tras COMMIT, solo si es TOUR)
    if (calificacion === 'TOUR') {
      dispararWebhook('tour_registrado', {
        lead_id: parseInt(lead_id),
        persona_id: lead.persona_id,
        sala_id: lead.sala_id,
        consultor_id: consultor_id || null,
      });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al calificar visita' });
  } finally {
    client.release();
  }
});

module.exports = router;
