const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// ── Auto-migrate: tabla asignacion_tmk_confirmador ─────────
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS asignacion_tmk_confirmador (
        id SERIAL PRIMARY KEY,
        tmk_id INTEGER NOT NULL REFERENCES usuarios(id),
        confirmador_id INTEGER NOT NULL REFERENCES usuarios(id),
        sala_id INTEGER REFERENCES salas(id),
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(tmk_id)
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_asig_tmk ON asignacion_tmk_confirmador(tmk_id) WHERE activo = true
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_asig_conf ON asignacion_tmk_confirmador(confirmador_id) WHERE activo = true
    `);
    console.log('  ✓ asignacion_tmk_confirmador table ready');
  } catch (err) {
    console.error('Error auto-migrate asignacion_tmk_confirmador:', err.message);
  }
})();

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
        COUNT(CASE WHEN t.nombre = 'Super tentativa' THEN 1 END)                    AS citas_no_concretas,
        COUNT(CASE WHEN t.nombre = 'Volver a llamar' THEN 1 END)                      AS volver_llamar,
        COUNT(CASE WHEN t.nombre = 'No contesta' THEN 1 END)                           AS no_contesta,
        COUNT(CASE WHEN t.nombre = 'Buzón' THEN 1 END)                                AS buzon,
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
        citas_no_concretas: Number(row.citas_no_concretas),
        volver_llamar: Number(row.volver_llamar),
        no_contesta: Number(row.no_contesta),
        buzon: Number(row.buzon),
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
        COUNT(CASE WHEN t.nombre = 'Super tentativa' THEN 1 END)            AS total_no_concretas,
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
      total_no_concretas: Number(totales.total_no_concretas),
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

// ── GET /api/supervisor/asignaciones ──────────────────────
// Lista todas las asignaciones TMK ↔ Confirmador
router.get('/asignaciones', auth, soloSupervisor, async (req, res) => {
  const { sala_id } = req.query;
  const { sala_id: userSalaId, rol } = req.user;

  const salaFiltro = sala_id
    ? parseInt(sala_id, 10)
    : !['admin', 'director'].includes(rol)
      ? userSalaId
      : null;

  try {
    const result = await pool.query(`
      SELECT
        a.id,
        a.tmk_id,
        a.confirmador_id,
        a.sala_id,
        a.activo,
        a.created_at,
        tmk.nombre AS tmk_nombre,
        tmk.username AS tmk_username,
        conf.nombre AS confirmador_nombre,
        conf.username AS confirmador_username,
        COALESCE(s.nombre, 'Sin sala') AS sala_nombre
      FROM asignacion_tmk_confirmador a
      JOIN usuarios tmk ON a.tmk_id = tmk.id
      JOIN usuarios conf ON a.confirmador_id = conf.id
      LEFT JOIN salas s ON a.sala_id = s.id
      WHERE a.activo = true
        AND ($1::integer IS NULL OR a.sala_id = $1)
      ORDER BY conf.nombre, tmk.nombre
    `, [salaFiltro || null]);

    // Agrupar por confirmador para facilitar la vista
    const porConfirmador = {};
    for (const row of result.rows) {
      if (!porConfirmador[row.confirmador_id]) {
        porConfirmador[row.confirmador_id] = {
          confirmador_id: row.confirmador_id,
          confirmador_nombre: row.confirmador_nombre,
          tmks: [],
        };
      }
      porConfirmador[row.confirmador_id].tmks.push({
        id: row.tmk_id,
        nombre: row.tmk_nombre,
        asignacion_id: row.id,
      });
    }

    res.json({
      asignaciones: result.rows,
      por_confirmador: Object.values(porConfirmador),
    });
  } catch (err) {
    console.error('Error en GET /api/supervisor/asignaciones:', err);
    res.status(500).json({ error: 'Error al obtener asignaciones' });
  }
});

// ── POST /api/supervisor/asignaciones ─────────────────────
// Asignar TMK(s) a un confirmador. Body: { tmk_ids: [4,5], confirmador_id: 6 }
router.post('/asignaciones', auth, soloSupervisor, async (req, res) => {
  const { tmk_ids, confirmador_id } = req.body;

  if (!tmk_ids || !Array.isArray(tmk_ids) || tmk_ids.length === 0 || !confirmador_id) {
    return res.status(400).json({ error: 'tmk_ids (array) y confirmador_id son requeridos' });
  }

  try {
    // Verificar que el confirmador existe y tiene rol confirmador
    const confCheck = await pool.query(`
      SELECT u.id, u.sala_id FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      WHERE u.id = $1 AND r.nombre = 'confirmador' AND u.activo = true
    `, [confirmador_id]);
    if (confCheck.rows.length === 0) {
      return res.status(400).json({ error: 'El confirmador_id no corresponde a un confirmador activo' });
    }

    const salaId = confCheck.rows[0].sala_id;
    const resultados = [];

    for (const tmkId of tmk_ids) {
      // Upsert: si ya existe la asignación para ese TMK, actualizar
      const result = await pool.query(`
        INSERT INTO asignacion_tmk_confirmador (tmk_id, confirmador_id, sala_id, activo)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (tmk_id)
        DO UPDATE SET confirmador_id = $2, sala_id = $3, activo = true, created_at = NOW()
        RETURNING *
      `, [tmkId, confirmador_id, salaId]);
      resultados.push(result.rows[0]);
    }

    res.status(201).json({
      message: `${resultados.length} TMK(s) asignados al confirmador`,
      asignaciones: resultados,
    });
  } catch (err) {
    console.error('Error en POST /api/supervisor/asignaciones:', err);
    res.status(500).json({ error: 'Error al crear asignaciones' });
  }
});

// ── DELETE /api/supervisor/asignaciones/:tmk_id ───────────
// Desasignar un TMK de su confirmador
router.delete('/asignaciones/:tmk_id', auth, soloSupervisor, async (req, res) => {
  const { tmk_id } = req.params;

  try {
    const result = await pool.query(`
      UPDATE asignacion_tmk_confirmador
      SET activo = false
      WHERE tmk_id = $1 AND activo = true
      RETURNING *
    `, [tmk_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontró asignación activa para ese TMK' });
    }

    res.json({ message: 'TMK desasignado correctamente', asignacion: result.rows[0] });
  } catch (err) {
    console.error('Error en DELETE /api/supervisor/asignaciones:', err);
    res.status(500).json({ error: 'Error al desasignar TMK' });
  }
});

// ── GET /api/supervisor/confirmadores ─────────────────────
// Lista confirmadores activos (para el dropdown de asignaciones)
router.get('/confirmadores', auth, soloSupervisor, async (req, res) => {
  const { sala_id } = req.query;
  const { sala_id: userSalaId, rol } = req.user;

  const salaFiltro = sala_id
    ? parseInt(sala_id, 10)
    : !['admin', 'director'].includes(rol)
      ? userSalaId
      : null;

  try {
    const result = await pool.query(`
      SELECT u.id, u.nombre, u.username, COALESCE(s.nombre, 'Sin sala') AS sala_nombre
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      LEFT JOIN salas s ON u.sala_id = s.id
      WHERE r.nombre = 'confirmador'
        AND u.activo = true
        AND ($1::integer IS NULL OR u.sala_id = $1)
      ORDER BY u.nombre
    `, [salaFiltro || null]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error en GET /api/supervisor/confirmadores:', err);
    res.status(500).json({ error: 'Error al obtener confirmadores' });
  }
});

// ── GET /api/supervisor/tmks-disponibles ──────────────────
// Lista TMKs activos con info de si ya están asignados
router.get('/tmks-disponibles', auth, soloSupervisor, async (req, res) => {
  const { sala_id } = req.query;
  const { sala_id: userSalaId, rol } = req.user;

  const salaFiltro = sala_id
    ? parseInt(sala_id, 10)
    : !['admin', 'director'].includes(rol)
      ? userSalaId
      : null;

  try {
    const result = await pool.query(`
      SELECT
        u.id, u.nombre, u.username,
        COALESCE(s.nombre, 'Sin sala') AS sala_nombre,
        a.confirmador_id,
        conf.nombre AS confirmador_nombre
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      LEFT JOIN salas s ON u.sala_id = s.id
      LEFT JOIN asignacion_tmk_confirmador a ON a.tmk_id = u.id AND a.activo = true
      LEFT JOIN usuarios conf ON a.confirmador_id = conf.id
      WHERE r.nombre = 'tmk'
        AND u.activo = true
        AND ($1::integer IS NULL OR u.sala_id = $1)
      ORDER BY u.nombre
    `, [salaFiltro || null]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error en GET /api/supervisor/tmks-disponibles:', err);
    res.status(500).json({ error: 'Error al obtener TMKs disponibles' });
  }
});

module.exports = router;
