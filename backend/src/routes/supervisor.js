const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// Middleware: solo roles autorizados
function soloSupervisor(req, res, next) {
  const rolesPermitidos = ['admin', 'director', 'supervisor_cc'];
  if (!rolesPermitidos.includes(req.user.rol)) {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol supervisor_cc, director o admin.' });
  }
  next();
}

// ── GET /api/supervisor/tmk ────────────────────────────────
// Métricas por TMK para el día especificado
// Query params: sala_id, fecha (YYYY-MM-DD, default hoy)
router.get('/tmk', auth, soloSupervisor, async (req, res) => {
  const { sala_id, fecha } = req.query;
  const { sala_id: userSalaId, rol } = req.user;

  // Determinar la sala a filtrar
  const salaFiltro = sala_id
    ? parseInt(sala_id, 10)
    : rol !== 'admin' && rol !== 'director'
      ? userSalaId
      : null;

  // Determinar la fecha (default: hoy en UTC)
  let fechaDia;
  if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    fechaDia = fecha;
  } else {
    const now = new Date();
    fechaDia = now.toISOString().split('T')[0];
  }

  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.nombre,
        COALESCE(s.nombre, 'Sin sala') AS sala_nombre,
        COUNT(l.id)                                                                    AS leads_captados,
        COUNT(CASE WHEN t.nombre = 'Cita' THEN 1 END)                                 AS citas_agendadas,
        COUNT(CASE WHEN t.nombre = 'Volver a llamar' THEN 1 END)                      AS volver_llamar,
        COUNT(CASE WHEN t.nombre IN ('Buzón','No contesta') THEN 1 END)               AS no_contacto,
        COUNT(CASE WHEN t.nombre = 'No le interesa' THEN 1 END)                       AS rechazos,
        COUNT(CASE WHEN t.nombre = 'Dato falso' THEN 1 END)                           AS datos_falsos,
        ROUND(
          COUNT(CASE WHEN t.nombre = 'Cita' THEN 1 END)::numeric
          / NULLIF(COUNT(l.id), 0) * 100,
        1) AS pct_efectividad
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      LEFT JOIN salas s ON u.sala_id = s.id
      LEFT JOIN leads l
        ON l.tmk_id = u.id
        AND DATE(l.created_at) = $1::date
        AND ($2::integer IS NULL OR l.sala_id = $2)
      LEFT JOIN tipificaciones t ON l.tipificacion_id = t.id
      WHERE r.nombre = 'tmk'
        AND u.activo = true
        AND ($2::integer IS NULL OR u.sala_id = $2)
      GROUP BY u.id, u.nombre, s.nombre
      ORDER BY leads_captados DESC
    `, [fechaDia, salaFiltro || null]);

    res.json({
      fecha: fechaDia,
      sala_id: salaFiltro || null,
      tmks: result.rows.map(row => ({
        id: Number(row.id),
        nombre: row.nombre,
        sala_nombre: row.sala_nombre,
        leads_captados: Number(row.leads_captados),
        citas_agendadas: Number(row.citas_agendadas),
        volver_llamar: Number(row.volver_llamar),
        no_contacto: Number(row.no_contacto),
        rechazos: Number(row.rechazos),
        datos_falsos: Number(row.datos_falsos),
        pct_efectividad: row.pct_efectividad !== null ? Number(row.pct_efectividad) : 0,
      })),
    });
  } catch (err) {
    console.error('Error en GET /api/supervisor/tmk:', err);
    res.status(500).json({ error: 'Error al obtener métricas de TMKs' });
  }
});

// ── GET /api/supervisor/resumen ────────────────────────────
// Totales del día + top fuente y top tipificación
// Query params: sala_id, fecha (YYYY-MM-DD, default hoy)
router.get('/resumen', auth, soloSupervisor, async (req, res) => {
  const { sala_id, fecha } = req.query;
  const { sala_id: userSalaId, rol } = req.user;

  const salaFiltro = sala_id
    ? parseInt(sala_id, 10)
    : rol !== 'admin' && rol !== 'director'
      ? userSalaId
      : null;

  let fechaDia;
  if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    fechaDia = fecha;
  } else {
    const now = new Date();
    fechaDia = now.toISOString().split('T')[0];
  }

  try {
    const params = [fechaDia, salaFiltro || null];

    // Totales del día
    const totalesRes = await pool.query(`
      SELECT
        COUNT(l.id)                                                              AS total_leads,
        COUNT(CASE WHEN t.nombre = 'Cita' THEN 1 END)                          AS total_citas,
        COUNT(CASE WHEN l.estado = 'confirmada' THEN 1 END)                    AS total_confirmadas,
        ROUND(
          COUNT(CASE WHEN t.nombre = 'Cita' THEN 1 END)::numeric
          / NULLIF(COUNT(l.id), 0) * 100,
        1) AS efectividad_pct
      FROM leads l
      LEFT JOIN tipificaciones t ON l.tipificacion_id = t.id
      WHERE DATE(l.created_at) = $1::date
        AND ($2::integer IS NULL OR l.sala_id = $2)
    `, params);

    // Top fuente del día
    const topFuenteRes = await pool.query(`
      SELECT f.nombre AS fuente, COUNT(*) AS cantidad
      FROM leads l
      JOIN fuentes f ON l.fuente_id = f.id
      WHERE DATE(l.created_at) = $1::date
        AND ($2::integer IS NULL OR l.sala_id = $2)
      GROUP BY f.nombre
      ORDER BY cantidad DESC
      LIMIT 1
    `, params);

    // Top tipificación del día
    const topTipRes = await pool.query(`
      SELECT t.nombre AS tipificacion, COUNT(*) AS cantidad
      FROM leads l
      JOIN tipificaciones t ON l.tipificacion_id = t.id
      WHERE DATE(l.created_at) = $1::date
        AND ($2::integer IS NULL OR l.sala_id = $2)
      GROUP BY t.nombre
      ORDER BY cantidad DESC
      LIMIT 1
    `, params);

    // Distribución por tipificación (top 5)
    const tipDistRes = await pool.query(`
      SELECT t.nombre AS tipificacion, COUNT(*) AS cantidad
      FROM leads l
      JOIN tipificaciones t ON l.tipificacion_id = t.id
      WHERE DATE(l.created_at) = $1::date
        AND ($2::integer IS NULL OR l.sala_id = $2)
      GROUP BY t.nombre
      ORDER BY cantidad DESC
      LIMIT 5
    `, params);

    const totales = totalesRes.rows[0];

    res.json({
      fecha: fechaDia,
      sala_id: salaFiltro || null,
      total_leads: Number(totales.total_leads),
      total_citas: Number(totales.total_citas),
      total_confirmadas: Number(totales.total_confirmadas),
      efectividad_pct: totales.efectividad_pct !== null ? Number(totales.efectividad_pct) : 0,
      top_fuente: topFuenteRes.rows[0]?.fuente || null,
      top_tipificacion: topTipRes.rows[0]?.tipificacion || null,
      tipificaciones_distribucion: tipDistRes.rows.map(r => ({
        tipificacion: r.tipificacion,
        cantidad: Number(r.cantidad),
      })),
    });
  } catch (err) {
    console.error('Error en GET /api/supervisor/resumen:', err);
    res.status(500).json({ error: 'Error al obtener resumen del día' });
  }
});

// ── GET /api/supervisor/ranking ────────────────────────────
// Ranking mensual de TMKs por citas agendadas
// Query params: sala_id, mes (YYYY-MM, default mes actual)
router.get('/ranking', auth, soloSupervisor, async (req, res) => {
  const { sala_id, mes } = req.query;
  const { sala_id: userSalaId, rol } = req.user;

  const salaFiltro = sala_id
    ? parseInt(sala_id, 10)
    : rol !== 'admin' && rol !== 'director'
      ? userSalaId
      : null;

  // Determinar rango de fechas del mes
  let fechaInicio, fechaFin;
  if (mes && /^\d{4}-\d{2}$/.test(mes)) {
    const [year, month] = mes.split('-');
    fechaInicio = `${year}-${month}-01`;
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    fechaFin = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
  } else {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    fechaInicio = `${y}-${m}-01`;
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    fechaFin = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
  }

  const mesPeriodo = fechaInicio.slice(0, 7); // YYYY-MM

  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.nombre,
        COALESCE(s.nombre, 'Sin sala') AS sala_nombre,
        COUNT(l.id)                                                                    AS leads_captados,
        COUNT(CASE WHEN t.nombre = 'Cita' THEN 1 END)                                 AS citas_agendadas,
        ROUND(
          COUNT(CASE WHEN t.nombre = 'Cita' THEN 1 END)::numeric
          / NULLIF(COUNT(l.id), 0) * 100,
        1) AS pct_efectividad
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      LEFT JOIN salas s ON u.sala_id = s.id
      LEFT JOIN leads l
        ON l.tmk_id = u.id
        AND DATE(l.created_at) BETWEEN $1::date AND $2::date
        AND ($3::integer IS NULL OR l.sala_id = $3)
      LEFT JOIN tipificaciones t ON l.tipificacion_id = t.id
      WHERE r.nombre = 'tmk'
        AND u.activo = true
        AND ($3::integer IS NULL OR u.sala_id = $3)
      GROUP BY u.id, u.nombre, s.nombre
      ORDER BY citas_agendadas DESC, leads_captados DESC
    `, [fechaInicio, fechaFin, salaFiltro || null]);

    res.json({
      mes: mesPeriodo,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      sala_id: salaFiltro || null,
      ranking: result.rows.map((row, index) => ({
        posicion: index + 1,
        id: Number(row.id),
        nombre: row.nombre,
        sala_nombre: row.sala_nombre,
        leads_captados: Number(row.leads_captados),
        citas_agendadas: Number(row.citas_agendadas),
        pct_efectividad: row.pct_efectividad !== null ? Number(row.pct_efectividad) : 0,
      })),
    });
  } catch (err) {
    console.error('Error en GET /api/supervisor/ranking:', err);
    res.status(500).json({ error: 'Error al obtener ranking mensual' });
  }
});

module.exports = router;
