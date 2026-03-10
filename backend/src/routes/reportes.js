const express = require('express');
const pool = require('../db');

const router = express.Router();

// ── Helper: parsear rango de fechas ──────────────────────────
function parseFechas(fecha_inicio, fecha_fin) {
  const hoy = new Date();
  const primerDiaMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
  const inicio = fecha_inicio || primerDiaMes;
  const fin    = fecha_fin    || hoy.toISOString().split('T')[0];
  return { inicio, fin };
}

// ═══════════════════════════════════════════════════════════════
// GET /api/reportes/leads?sala_id=X&fecha_inicio=Y&fecha_fin=Z
// Exporta leads en formato apto para Excel (JSON plano)
// ═══════════════════════════════════════════════════════════════
router.get('/leads', async (req, res) => {
  const { sala_id, fecha_inicio, fecha_fin } = req.query;
  const { sala_id: userSalaId, rol } = req.user;

  const { inicio, fin } = parseFechas(fecha_inicio, fecha_fin);

  // Determinar sala a filtrar
  const salaFiltro = sala_id ||
    (['admin', 'director'].includes(rol) ? null : userSalaId);

  try {
    const result = await pool.query(`
      SELECT
        l.id                                          AS "ID Lead",
        p.nombres || ' ' || p.apellidos              AS "Nombre Completo",
        p.nombres                                     AS "Nombres",
        p.apellidos                                   AS "Apellidos",
        p.telefono                                    AS "Teléfono",
        p.email                                       AS "Email",
        p.ciudad                                      AS "Ciudad",
        p.cedula                                      AS "Cédula",
        p.edad                                        AS "Edad",
        p.genero                                      AS "Género",
        f.nombre                                      AS "Fuente",
        t.nombre                                      AS "Tipificación",
        l.patologia                                   AS "Patología",
        l.estado                                      AS "Estado",
        l.fecha_cita                                  AS "Fecha Cita",
        l.fecha_rellamar                              AS "Fecha Rellamar",
        l.observacion                                 AS "Observación",
        u_tmk.nombre                                  AS "TMK",
        u_conf.nombre                                 AS "Confirmador",
        s.nombre                                      AS "Sala",
        s.ciudad                                      AS "Ciudad Sala",
        TO_CHAR(l.created_at, 'YYYY-MM-DD HH24:MI')  AS "Fecha Creación",
        TO_CHAR(l.updated_at, 'YYYY-MM-DD HH24:MI')  AS "Última Actualización"
      FROM leads l
      JOIN personas p ON l.persona_id = p.id
      LEFT JOIN fuentes f ON l.fuente_id = f.id
      LEFT JOIN tipificaciones t ON l.tipificacion_id = t.id
      LEFT JOIN usuarios u_tmk ON l.tmk_id = u_tmk.id
      LEFT JOIN usuarios u_conf ON l.confirmador_id = u_conf.id
      LEFT JOIN salas s ON l.sala_id = s.id
      WHERE DATE(l.created_at) BETWEEN $1::date AND $2::date
        AND ($3::integer IS NULL OR l.sala_id = $3)
      ORDER BY l.created_at DESC
    `, [inicio, fin, salaFiltro || null]);

    res.json({
      meta: {
        total: result.rows.length,
        fecha_inicio: inicio,
        fecha_fin: fin,
        sala_id: salaFiltro || 'todas',
        generado_en: new Date().toISOString(),
      },
      data: result.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar reporte de leads' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/reportes/asistencias?sala_id=X&fecha_inicio=Y&fecha_fin=Z
// Leads que se convirtieron en asistencias (visita a sala) y tours
// ═══════════════════════════════════════════════════════════════
router.get('/asistencias', async (req, res) => {
  const { sala_id, fecha_inicio, fecha_fin } = req.query;
  const { sala_id: userSalaId, rol } = req.user;

  const { inicio, fin } = parseFechas(fecha_inicio, fecha_fin);

  const salaFiltro = sala_id ||
    (['admin', 'director'].includes(rol) ? null : userSalaId);

  try {
    // Visitas registradas en el período
    const visitasRes = await pool.query(`
      SELECT
        vs.id                                           AS "ID Visita",
        l.id                                            AS "ID Lead",
        p.nombres || ' ' || p.apellidos                AS "Nombre Completo",
        p.nombres                                       AS "Nombres",
        p.apellidos                                     AS "Apellidos",
        p.telefono                                      AS "Teléfono",
        p.email                                         AS "Email",
        p.ciudad                                        AS "Ciudad",
        p.cedula                                        AS "Cédula",
        p.edad                                          AS "Edad",
        p.genero                                        AS "Género",
        vs.calificacion                                 AS "Calificación Sala",
        vs.fecha                                        AS "Fecha Visita",
        vs.hora_cita_agendada                           AS "Hora Cita Agendada",
        vs.hora_llegada                                 AS "Hora Llegada",
        vs.acompanante                                  AS "Acompañante",
        l.patologia                                     AS "Patología",
        f.nombre                                        AS "Fuente",
        t.nombre                                        AS "Tipificación",
        u_tmk.nombre                                    AS "TMK",
        u_conf.nombre                                   AS "Confirmador",
        u_cons.nombre                                   AS "Consultor Sala",
        u_host.nombre                                   AS "Hostess",
        vs.outsourcing_indicado                         AS "Outsourcing Indicado",
        s.nombre                                        AS "Sala",
        s.ciudad                                        AS "Ciudad Sala",
        TO_CHAR(vs.created_at, 'YYYY-MM-DD HH24:MI')   AS "Fecha Registro"
      FROM visitas_sala vs
      JOIN personas p ON vs.persona_id = p.id
      LEFT JOIN leads l ON vs.lead_id = l.id
      LEFT JOIN fuentes f ON l.fuente_id = f.id
      LEFT JOIN tipificaciones t ON l.tipificacion_id = t.id
      LEFT JOIN usuarios u_tmk ON l.tmk_id = u_tmk.id
      LEFT JOIN usuarios u_conf ON l.confirmador_id = u_conf.id
      LEFT JOIN usuarios u_cons ON vs.consultor_id = u_cons.id
      LEFT JOIN usuarios u_host ON vs.hostess_id = u_host.id
      LEFT JOIN salas s ON vs.sala_id = s.id
      WHERE vs.fecha BETWEEN $1::date AND $2::date
        AND ($3::integer IS NULL OR vs.sala_id = $3)
      ORDER BY vs.fecha DESC, vs.hora_llegada ASC NULLS LAST
    `, [inicio, fin, salaFiltro || null]);

    // Resumen por calificación
    const tours    = visitasRes.rows.filter(r => r['Calificación Sala'] === 'TOUR');
    const noTours  = visitasRes.rows.filter(r => r['Calificación Sala'] === 'NO_TOUR');
    const noShows  = visitasRes.rows.filter(r => r['Calificación Sala'] === 'NO_SHOW');

    res.json({
      meta: {
        total_asistencias: visitasRes.rows.length,
        total_tours:   tours.length,
        total_no_tour: noTours.length,
        total_no_show: noShows.length,
        conversion_tour: visitasRes.rows.length > 0
          ? Number(((tours.length / visitasRes.rows.length) * 100).toFixed(1))
          : 0,
        fecha_inicio: inicio,
        fecha_fin:    fin,
        sala_id:      salaFiltro || 'todas',
        generado_en:  new Date().toISOString(),
      },
      data: visitasRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar reporte de asistencias' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/reportes/tmk?sala_id=X&fecha_inicio=Y&fecha_fin=Z
// Reporte de productividad por TMK
// ═══════════════════════════════════════════════════════════════
router.get('/tmk', async (req, res) => {
  const { sala_id, fecha_inicio, fecha_fin } = req.query;
  const { sala_id: userSalaId, rol } = req.user;

  const { inicio, fin } = parseFechas(fecha_inicio, fecha_fin);

  const salaFiltro = sala_id ||
    (['admin', 'director'].includes(rol) ? null : userSalaId);

  try {
    const result = await pool.query(`
      SELECT
        u.id                                                              AS tmk_id,
        u.nombre                                                          AS "TMK",
        s.nombre                                                          AS "Sala",
        COUNT(l.id)                                                       AS "Total Leads",
        COUNT(l.id) FILTER (WHERE l.estado IN ('confirmada','tentativa')) AS "Citas Agendadas",
        COUNT(l.id) FILTER (WHERE l.estado IN ('tour','no_tour','no_show','inasistencia'))
                                                                          AS "Asistencias",
        COUNT(l.id) FILTER (WHERE l.estado = 'tour')                      AS "Tours",
        COUNT(l.id) FILTER (WHERE l.estado = 'no_tour')                   AS "No Tours",
        COUNT(l.id) FILTER (WHERE l.estado = 'no_show')                   AS "No Shows",
        COUNT(l.id) FILTER (WHERE l.estado = 'pendiente')                 AS "Pendientes",
        COUNT(l.id) FILTER (WHERE l.estado = 'no_interesado')             AS "No Interesados"
      FROM usuarios u
      JOIN leads l ON l.tmk_id = u.id
      LEFT JOIN salas s ON u.sala_id = s.id
      WHERE DATE(l.created_at) BETWEEN $1::date AND $2::date
        AND ($3::integer IS NULL OR l.sala_id = $3)
      GROUP BY u.id, u.nombre, s.nombre
      ORDER BY "Total Leads" DESC
    `, [inicio, fin, salaFiltro || null]);

    // Calcular ratios de conversión
    const data = result.rows.map(row => ({
      ...row,
      "Efectividad Datos (%)": Number(row["Total Leads"]) > 0
        ? Number(((Number(row["Citas Agendadas"]) / Number(row["Total Leads"])) * 100).toFixed(1))
        : 0,
      "Conversión Tour (%)": Number(row["Asistencias"]) > 0
        ? Number(((Number(row["Tours"]) / Number(row["Asistencias"])) * 100).toFixed(1))
        : 0,
    }));

    res.json({
      meta: {
        total_tmks:  data.length,
        fecha_inicio: inicio,
        fecha_fin:    fin,
        sala_id:      salaFiltro || 'todas',
        generado_en:  new Date().toISOString(),
      },
      data,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar reporte TMK' });
  }
});

module.exports = router;
