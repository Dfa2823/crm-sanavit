const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

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
    return m.toISOString().split('T')[0];
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
        l.fecha_cita, l.outsourcing_id,
        p.nombres, p.apellidos, p.telefono, p.ciudad,
        f.nombre AS fuente_nombre,
        u.nombre AS tmk_nombre,
        ou.nombre AS outsourcing_nombre
      FROM leads l
      JOIN personas p ON l.persona_id = p.id
      LEFT JOIN fuentes f ON l.fuente_id = f.id
      LEFT JOIN usuarios u ON l.tmk_id = u.id
      LEFT JOIN usuarios ou ON l.outsourcing_id = ou.id
      WHERE DATE(l.fecha_cita) = $1
        AND ($2::integer IS NULL OR l.sala_id = $2)
        ${whereExtra}
    `;

    const [confirmadas, tentativas, canceladas, inasistencias] = await Promise.all([
      pool.query(`${baseQuery} AND l.estado = 'confirmada' ORDER BY l.fecha_cita ASC`, params),
      pool.query(`${baseQuery} AND l.estado = 'tentativa' ORDER BY l.fecha_cita ASC`, params),
      pool.query(`${baseQuery} AND l.estado = 'cancelada' ORDER BY l.fecha_cita DESC`, params),
      pool.query(`${baseQuery} AND l.estado = 'inasistencia' ORDER BY l.fecha_cita DESC`, params),
    ]);

    res.json({
      fecha: fechaConsulta,
      confirmadas: confirmadas.rows,
      tentativas: tentativas.rows,
      canceladas: canceladas.rows,
      inasistencias: inasistencias.rows,
      totales: {
        confirmadas: confirmadas.rows.length,
        tentativas: tentativas.rows.length,
        canceladas: canceladas.rows.length,
        inasistencias: inasistencias.rows.length,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener pre-manifiesto' });
  }
});

// GET /api/citas/hoy?sala_id=X
// Citas de hoy para la vista de Recepción (Hostess)
router.get('/hoy', auth, async (req, res) => {
  const { sala_id } = req.query;
  const { sala_id: userSalaId, rol, id: userId } = req.user;
  const salaId = sala_id || userSalaId;

  const hoy = new Date().toISOString().split('T')[0];

  try {
    const result = await pool.query(`
      SELECT
        l.id AS lead_id, l.estado, l.patologia, l.fecha_cita, l.observacion,
        p.id AS persona_id, p.nombres, p.apellidos, p.telefono, p.ciudad, p.edad,
        f.nombre AS fuente_nombre,
        u.nombre AS tmk_nombre,
        vs.id AS visita_id, vs.hora_llegada, vs.calificacion, vs.hora_cita_agendada,
        uc.nombre AS consultor_nombre
      FROM leads l
      JOIN personas p ON l.persona_id = p.id
      LEFT JOIN fuentes f ON l.fuente_id = f.id
      LEFT JOIN usuarios u ON l.tmk_id = u.id
      LEFT JOIN visitas_sala vs ON vs.lead_id = l.id AND vs.fecha = $1::date
      LEFT JOIN usuarios uc ON vs.consultor_id = uc.id
      WHERE DATE(l.fecha_cita) = $1
        AND ($2::integer IS NULL OR l.sala_id = $2)
        AND l.estado IN ('confirmada', 'tentativa', 'tour', 'no_tour', 'inasistencia')
      ORDER BY l.fecha_cita ASC
    `, [hoy, salaId]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener citas de hoy' });
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

  try {
    // Obtener el lead
    const leadRes = await pool.query('SELECT * FROM leads WHERE id = $1', [lead_id]);
    if (leadRes.rows.length === 0) {
      return res.status(404).json({ error: 'Lead no encontrado' });
    }
    const lead = leadRes.rows[0];

    const hoy = new Date().toISOString().split('T')[0];

    // Verificar si ya existe visita hoy
    const visitaExistente = await pool.query(
      'SELECT id FROM visitas_sala WHERE lead_id = $1 AND fecha = $2::date',
      [lead_id, hoy]
    );

    if (visitaExistente.rows.length > 0) {
      // Actualizar visita existente
      await pool.query(`
        UPDATE visitas_sala
        SET calificacion = $1, hora_llegada = $2, consultor_id = $3,
            acompanante = $4, outsourcing_indicado = $5, updated_at = NOW()
        WHERE lead_id = $6 AND fecha = $7::date
      `, [calificacion, hora_llegada || null, consultor_id || null,
          acompanante || null, outsourcing_indicado || null, lead_id, hoy]);
    } else {
      // Crear nueva visita
      await pool.query(`
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
    await pool.query(
      'UPDATE leads SET estado = $1, updated_at = NOW() WHERE id = $2',
      [nuevoEstado, lead_id]
    );

    res.json({ message: 'Calificación registrada', estado: nuevoEstado });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al calificar visita' });
  }
});

module.exports = router;
