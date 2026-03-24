const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// Auto-crear tabla si no existe al cargar el módulo
;(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pqr_tickets (
        id SERIAL PRIMARY KEY,
        numero_ticket VARCHAR(20) UNIQUE,
        persona_id INTEGER REFERENCES personas(id),
        contrato_id INTEGER REFERENCES contratos(id),
        sala_id INTEGER REFERENCES salas(id),
        tipo VARCHAR(30) NOT NULL DEFAULT 'queja',
        categoria VARCHAR(50),
        descripcion TEXT NOT NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'abierto',
        prioridad VARCHAR(10) DEFAULT 'normal',
        asignado_a INTEGER REFERENCES usuarios(id),
        creado_por INTEGER REFERENCES usuarios(id),
        fecha_apertura TIMESTAMPTZ DEFAULT NOW(),
        fecha_cierre TIMESTAMPTZ,
        resolucion TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pqr_persona ON pqr_tickets(persona_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pqr_estado  ON pqr_tickets(estado)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pqr_sala    ON pqr_tickets(sala_id)`);
    console.log('✅ SAC: tabla pqr_tickets lista');

    // Tabla de activaciones de control de calidad
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sac_activaciones (
        id SERIAL PRIMARY KEY,
        contrato_id INT UNIQUE REFERENCES contratos(id),
        usuario_id INT REFERENCES usuarios(id),
        observacion TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('✅ SAC: tabla sac_activaciones lista');
  } catch (err) {
    console.error('SAC: error al crear tablas SAC:', err.message);
  }
})();

// ─────────────────────────────────────────────────────────
// GET /api/sac/stats
// ─────────────────────────────────────────────────────────
router.get('/stats', auth, async (req, res) => {
  const { sala_id } = req.query;
  const { rol, sala_id: userSalaId } = req.user;

  try {
    let where = [];
    let params = [];
    let idx = 1;

    // Agentes sin rol admin/director/sac ven solo su sala
    if (!['admin', 'director', 'sac'].includes(rol) && userSalaId) {
      where.push(`sala_id = $${idx}`); params.push(userSalaId); idx++;
    }
    if (sala_id) { where.push(`sala_id = $${idx}`); params.push(sala_id); idx++; }

    const whereStr = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE estado = 'abierto')     AS abiertos,
        COUNT(*) FILTER (WHERE estado = 'en_proceso')  AS en_proceso,
        COUNT(*) FILTER (WHERE estado = 'resuelto')    AS resueltos,
        COUNT(*) FILTER (WHERE estado = 'cerrado')     AS cerrados,
        COUNT(*) FILTER (WHERE tipo = 'queja')         AS quejas,
        COUNT(*) FILTER (WHERE tipo = 'reclamo')       AS reclamos,
        COUNT(*) FILTER (WHERE tipo = 'peticion')      AS peticiones,
        COUNT(*) FILTER (WHERE tipo = 'felicitacion')  AS felicitaciones,
        COUNT(*) FILTER (WHERE prioridad = 'urgente')  AS urgentes,
        COUNT(*) FILTER (WHERE prioridad = 'alta')     AS alta,
        COUNT(*) FILTER (WHERE prioridad = 'normal')   AS normal,
        COUNT(*) FILTER (WHERE prioridad = 'baja')     AS baja
      FROM pqr_tickets
      ${whereStr}
    `, params);

    const row = result.rows[0];
    res.json({
      total:      parseInt(row.total),
      abiertos:   parseInt(row.abiertos),
      en_proceso: parseInt(row.en_proceso),
      resueltos:  parseInt(row.resueltos),
      cerrados:   parseInt(row.cerrados),
      por_tipo: {
        queja:        parseInt(row.quejas),
        reclamo:      parseInt(row.reclamos),
        peticion:     parseInt(row.peticiones),
        felicitacion: parseInt(row.felicitaciones),
      },
      por_prioridad: {
        urgente: parseInt(row.urgentes),
        alta:    parseInt(row.alta),
        normal:  parseInt(row.normal),
        baja:    parseInt(row.baja),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
/**
 * @openapi
 * /api/sac/tickets:
 *   get:
 *     tags: [SAC]
 *     summary: Listar tickets PQR
 *     description: Retorna tickets de servicio al cliente (quejas, peticiones, reclamos). Soporta filtros por sala, estado, tipo, prioridad y asignado.
 *     parameters:
 *       - in: query
 *         name: sala_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [abierto, en_proceso, resuelto, cerrado]
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [queja, peticion, reclamo, sugerencia]
 *       - in: query
 *         name: prioridad
 *         schema:
 *           type: string
 *           enum: [baja, normal, alta, urgente]
 *       - in: query
 *         name: asignado_a
 *         schema:
 *           type: integer
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Busqueda por texto en descripcion o numero de ticket
 *     responses:
 *       200:
 *         description: Lista de tickets SAC
 */
router.get('/tickets', auth, async (req, res) => {
  const { sala_id, estado, tipo, prioridad, asignado_a, q } = req.query;
  const { rol, sala_id: userSalaId } = req.user;

  try {
    let where = [];
    let params = [];
    let idx = 1;

    // Restricción por sala para roles no globales
    if (!['admin', 'director', 'sac'].includes(rol) && userSalaId) {
      where.push(`t.sala_id = $${idx}`); params.push(userSalaId); idx++;
    }
    if (sala_id)    { where.push(`t.sala_id = $${idx}`);    params.push(sala_id);    idx++; }
    if (estado)     { where.push(`t.estado = $${idx}`);     params.push(estado);     idx++; }
    if (tipo)       { where.push(`t.tipo = $${idx}`);       params.push(tipo);       idx++; }
    if (prioridad)  { where.push(`t.prioridad = $${idx}`);  params.push(prioridad);  idx++; }
    if (asignado_a) { where.push(`t.asignado_a = $${idx}`); params.push(asignado_a); idx++; }
    if (q) {
      where.push(`(
        t.numero_ticket ILIKE $${idx} OR
        p.nombres ILIKE $${idx} OR
        p.apellidos ILIKE $${idx} OR
        p.telefono ILIKE $${idx}
      )`);
      params.push(`%${q}%`);
      idx++;
    }

    const whereStr = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT
        t.id,
        t.numero_ticket,
        t.tipo,
        t.categoria,
        t.descripcion,
        t.estado,
        t.prioridad,
        t.fecha_apertura,
        t.fecha_cierre,
        t.resolucion,
        t.creado_por,
        t.asignado_a,
        p.id          AS persona_id,
        p.nombres     AS persona_nombres,
        p.apellidos   AS persona_apellidos,
        p.telefono    AS persona_telefono,
        c.numero_contrato,
        s.nombre      AS sala_nombre,
        ua.nombre     AS asignado_nombre,
        uc.nombre     AS creado_por_nombre
      FROM pqr_tickets t
      LEFT JOIN personas  p  ON t.persona_id  = p.id
      LEFT JOIN contratos c  ON t.contrato_id = c.id
      LEFT JOIN salas     s  ON t.sala_id     = s.id
      LEFT JOIN usuarios  ua ON t.asignado_a  = ua.id
      LEFT JOIN usuarios  uc ON t.creado_por  = uc.id
      ${whereStr}
      ORDER BY t.fecha_apertura DESC
      LIMIT 100
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/sac/tickets
// ─────────────────────────────────────────────────────────
router.post('/tickets', auth, async (req, res) => {
  const { id: userId, sala_id: userSalaId } = req.user;
  const {
    persona_id,
    contrato_id,
    sala_id,
    tipo = 'queja',
    categoria,
    descripcion,
    prioridad = 'normal',
  } = req.body;

  if (!persona_id || !descripcion) {
    return res.status(400).json({ error: 'persona_id y descripcion son requeridos' });
  }

  try {
    // Generar número de ticket
    const seqResult = await pool.query(`
      SELECT COALESCE(MAX(CAST(SPLIT_PART(numero_ticket, '-', 2) AS INT)), 0) + 1 AS next_num
      FROM pqr_tickets
    `);
    const nextNum = seqResult.rows[0].next_num;
    const numeroTicket = `SAC-${String(nextNum).padStart(4, '0')}`;

    const salaFinal = sala_id || userSalaId || null;

    const result = await pool.query(`
      INSERT INTO pqr_tickets (
        numero_ticket, persona_id, contrato_id, sala_id,
        tipo, categoria, descripcion, prioridad,
        estado, creado_por, fecha_apertura
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'abierto',$9,NOW())
      RETURNING *
    `, [
      numeroTicket,
      persona_id,
      contrato_id || null,
      salaFinal,
      tipo,
      categoria || null,
      descripcion,
      prioridad,
      userId,
    ]);

    const ticket = result.rows[0];

    // Retornar con datos enriquecidos
    const full = await pool.query(`
      SELECT
        t.*,
        p.nombres     AS persona_nombres,
        p.apellidos   AS persona_apellidos,
        p.telefono    AS persona_telefono,
        c.numero_contrato,
        s.nombre      AS sala_nombre,
        ua.nombre     AS asignado_nombre,
        uc.nombre     AS creado_por_nombre
      FROM pqr_tickets t
      LEFT JOIN personas  p  ON t.persona_id  = p.id
      LEFT JOIN contratos c  ON t.contrato_id = c.id
      LEFT JOIN salas     s  ON t.sala_id     = s.id
      LEFT JOIN usuarios  ua ON t.asignado_a  = ua.id
      LEFT JOIN usuarios  uc ON t.creado_por  = uc.id
      WHERE t.id = $1
    `, [ticket.id]);

    res.status(201).json(full.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(409).json({ error: 'Número de ticket duplicado, reintente' });
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/sac/tickets/:id
// ─────────────────────────────────────────────────────────
router.get('/tickets/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        t.*,
        p.id          AS persona_id,
        p.nombres     AS persona_nombres,
        p.apellidos   AS persona_apellidos,
        p.telefono    AS persona_telefono,
        p.email       AS persona_email,
        p.num_documento AS persona_documento,
        c.numero_contrato,
        c.tipo_plan,
        c.monto_total,
        c.estado      AS contrato_estado,
        s.nombre      AS sala_nombre,
        ua.nombre     AS asignado_nombre,
        uc.nombre     AS creado_por_nombre
      FROM pqr_tickets t
      LEFT JOIN personas  p  ON t.persona_id  = p.id
      LEFT JOIN contratos c  ON t.contrato_id = c.id
      LEFT JOIN salas     s  ON t.sala_id     = s.id
      LEFT JOIN usuarios  ua ON t.asignado_a  = ua.id
      LEFT JOIN usuarios  uc ON t.creado_por  = uc.id
      WHERE t.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// PATCH /api/sac/tickets/:id
// ─────────────────────────────────────────────────────────
router.patch('/tickets/:id', auth, async (req, res) => {
  const { estado, prioridad, asignado_a, resolucion, categoria } = req.body;

  try {
    // Verificar que el ticket existe
    const existing = await pool.query('SELECT id, estado FROM pqr_tickets WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    const sets = [];
    const params = [];
    let idx = 1;

    if (estado !== undefined) {
      sets.push(`estado = $${idx}`); params.push(estado); idx++;
      // Si se cierra o resuelve, registrar fecha de cierre
      if (estado === 'resuelto' || estado === 'cerrado') {
        sets.push(`fecha_cierre = NOW()`);
      }
    }
    if (prioridad !== undefined)  { sets.push(`prioridad = $${idx}`);  params.push(prioridad);  idx++; }
    if (asignado_a !== undefined) { sets.push(`asignado_a = $${idx}`); params.push(asignado_a); idx++; }
    if (resolucion !== undefined) { sets.push(`resolucion = $${idx}`); params.push(resolucion); idx++; }
    if (categoria !== undefined)  { sets.push(`categoria = $${idx}`);  params.push(categoria);  idx++; }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    sets.push(`updated_at = NOW()`);
    params.push(req.params.id);

    const result = await pool.query(`
      UPDATE pqr_tickets
      SET ${sets.join(', ')}
      WHERE id = $${idx}
      RETURNING *
    `, params);

    // Retornar con datos enriquecidos
    const full = await pool.query(`
      SELECT
        t.*,
        p.nombres     AS persona_nombres,
        p.apellidos   AS persona_apellidos,
        p.telefono    AS persona_telefono,
        c.numero_contrato,
        s.nombre      AS sala_nombre,
        ua.nombre     AS asignado_nombre,
        uc.nombre     AS creado_por_nombre
      FROM pqr_tickets t
      LEFT JOIN personas  p  ON t.persona_id  = p.id
      LEFT JOIN contratos c  ON t.contrato_id = c.id
      LEFT JOIN salas     s  ON t.sala_id     = s.id
      LEFT JOIN usuarios  ua ON t.asignado_a  = ua.id
      LEFT JOIN usuarios  uc ON t.creado_por  = uc.id
      WHERE t.id = $1
    `, [result.rows[0].id]);

    res.json(full.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/sac/calidad
// Contratos de últimos 15 días que NO están en sac_activaciones
// ─────────────────────────────────────────────────────────
router.get('/calidad', auth, async (req, res) => {
  const { sala_id } = req.query;
  try {
    const params = [];
    let salaFilter = '';
    if (sala_id) {
      params.push(sala_id);
      salaFilter = `AND c.sala_id = $${params.length}`;
    }

    const result = await pool.query(`
      SELECT c.id, c.numero_contrato, c.fecha_contrato, c.monto_total, c.estado,
             p.nombres, p.apellidos, p.telefono,
             s.nombre AS sala_nombre, u.nombre AS consultor_nombre,
             CURRENT_DATE - c.fecha_contrato::date AS dias_desde_venta
      FROM contratos c
      JOIN personas p ON c.persona_id = p.id
      LEFT JOIN salas s ON c.sala_id = s.id
      LEFT JOIN usuarios u ON c.consultor_id = u.id
      WHERE c.fecha_contrato >= CURRENT_DATE - INTERVAL '15 days'
        AND NOT EXISTS (
          SELECT 1 FROM sac_activaciones sa
          WHERE sa.contrato_id = c.id
        )
        ${salaFilter}
      ORDER BY c.fecha_contrato DESC
      LIMIT 100
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Ruta legacy por compatibilidad
router.get('/control-calidad', auth, async (req, res) => {
  const { sala_id } = req.query;
  try {
    const params = [];
    let salaFilter = '';
    if (sala_id) {
      params.push(sala_id);
      salaFilter = `AND c.sala_id = $${params.length}`;
    }
    const result = await pool.query(`
      SELECT c.id, c.numero_contrato, c.fecha_contrato, c.monto_total, c.estado,
             p.nombres, p.apellidos, p.telefono,
             s.nombre AS sala_nombre, u.nombre AS consultor_nombre,
             CURRENT_DATE - c.fecha_contrato::date AS dias_desde_venta
      FROM contratos c
      JOIN personas p ON c.persona_id = p.id
      LEFT JOIN salas s ON c.sala_id = s.id
      LEFT JOIN usuarios u ON c.consultor_id = u.id
      WHERE c.fecha_contrato >= CURRENT_DATE - INTERVAL '15 days'
        AND NOT EXISTS (
          SELECT 1 FROM sac_activaciones sa WHERE sa.contrato_id = c.id
        )
        ${salaFilter}
      ORDER BY c.fecha_contrato DESC
      LIMIT 100
    `, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/sac/calidad/:contrato_id/activar
// INSERT en sac_activaciones con observación
// ─────────────────────────────────────────────────────────
router.post('/calidad/:contrato_id/activar', auth, async (req, res) => {
  const contratoId = req.params.contrato_id;
  const { id: userId } = req.user;
  const { observacion } = req.body;
  try {
    // Verificar que el contrato existe
    const cRes = await pool.query('SELECT id FROM contratos WHERE id = $1', [contratoId]);
    if (cRes.rows.length === 0) return res.status(404).json({ error: 'Contrato no encontrado' });

    await pool.query(`
      INSERT INTO sac_activaciones (contrato_id, usuario_id, observacion)
      VALUES ($1, $2, $3)
      ON CONFLICT (contrato_id) DO NOTHING
    `, [contratoId, userId, observacion || 'Venta activada - control de calidad aprobado']);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Mantener ruta legacy
router.post('/activar/:contrato_id', auth, async (req, res) => {
  req.params.contrato_id = req.params.contrato_id;
  req.body.observacion = req.body.observacion || 'Venta activada - control de calidad aprobado';
  // Redirigir al nuevo endpoint
  const contratoId = req.params.contrato_id;
  const { id: userId } = req.user;
  const { observacion } = req.body;
  try {
    const cRes = await pool.query('SELECT id FROM contratos WHERE id = $1', [contratoId]);
    if (cRes.rows.length === 0) return res.status(404).json({ error: 'Contrato no encontrado' });
    await pool.query(`
      INSERT INTO sac_activaciones (contrato_id, usuario_id, observacion)
      VALUES ($1, $2, $3) ON CONFLICT (contrato_id) DO NOTHING
    `, [contratoId, userId, observacion]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/sac/fidelizacion
// Contratos con fecha_contrato entre 60-120 días atrás, estado='activo'
// ─────────────────────────────────────────────────────────
router.get('/fidelizacion', auth, async (req, res) => {
  const { sala_id } = req.query;
  try {
    const params = [];
    let salaFilter = '';
    if (sala_id) {
      params.push(sala_id);
      salaFilter = `AND c.sala_id = $${params.length}`;
    }

    const result = await pool.query(`
      SELECT c.id, c.numero_contrato, c.fecha_contrato, c.monto_total,
             p.id AS persona_id, p.nombres, p.apellidos, p.telefono,
             s.nombre AS sala_nombre,
             CURRENT_DATE - c.fecha_contrato::date AS dias_desde_compra
      FROM contratos c
      JOIN personas p ON c.persona_id = p.id
      LEFT JOIN salas s ON c.sala_id = s.id
      WHERE c.estado = 'activo'
        AND c.fecha_contrato::date BETWEEN CURRENT_DATE - INTERVAL '120 days' AND CURRENT_DATE - INTERVAL '60 days'
        AND NOT EXISTS (
          SELECT 1 FROM leads l2
          WHERE l2.persona_id = p.id
            AND l2.estado IN ('confirmada', 'tentativa', 'tour')
            AND l2.created_at >= NOW() - INTERVAL '30 days'
        )
        ${salaFilter}
      ORDER BY c.fecha_contrato ASC
      LIMIT 100
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/sac/fidelizacion/:contrato_id/agendar
// Crear lead con fecha_cita para re-visita
// ─────────────────────────────────────────────────────────
router.post('/fidelizacion/:contrato_id/agendar', auth, async (req, res) => {
  const contratoId = req.params.contrato_id;
  const { id: userId, sala_id: userSalaId } = req.user;
  const { fecha_cita } = req.body;
  try {
    // Obtener persona_id del contrato
    const cRes = await pool.query('SELECT persona_id FROM contratos WHERE id = $1', [contratoId]);
    if (cRes.rows.length === 0) return res.status(404).json({ error: 'Contrato no encontrado' });
    const personaId = cRes.rows[0].persona_id;

    const result = await pool.query(`
      INSERT INTO leads (persona_id, sala_id, tmk_id, fuente_id, tipificacion_id, estado, fecha_cita, observacion)
      VALUES ($1, $2, $3, 1, 2, 'confirmada', $4, 'Re-visita generada desde modulo de fidelizacion SAC')
      RETURNING id
    `, [personaId, userSalaId || 1, userId, fecha_cita || null]);

    res.json({ ok: true, lead_id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Mantener ruta legacy
router.post('/recitar/:persona_id', auth, async (req, res) => {
  const personaId = req.params.persona_id;
  const { id: userId, sala_id: userSalaId } = req.user;
  const { fecha_cita } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO leads (persona_id, sala_id, tmk_id, fuente_id, tipificacion_id, estado, fecha_cita, observacion)
      VALUES ($1, $2, $3, 1, 2, 'confirmada', $4, 'Re-cita generada desde modulo de fidelizacion SAC')
      RETURNING id
    `, [personaId, userSalaId || 1, userId, fecha_cita || null]);
    res.json({ ok: true, lead_id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
