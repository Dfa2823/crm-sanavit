const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { paginate, paginatedResponse } = require('../utils/pagination');
const { dispararWebhook } = require('../utils/webhook');

const router = express.Router();

// ── Auto-migrate: tipificacion "Super tentativa" ─────────
(async () => {
  try {
    const exists = await pool.query(
      "SELECT id FROM tipificaciones WHERE nombre = 'Super tentativa'"
    );
    if (exists.rows.length === 0) {
      await pool.query(
        "INSERT INTO tipificaciones (nombre, requiere_fecha_cita, requiere_fecha_rellamar) VALUES ('Super tentativa', true, false)"
      );
      console.log('  ✓ Tipificacion "Super tentativa" creada');
    }
  } catch (err) {
    console.error('Error auto-migrate Super tentativa:', err.message);
  }
})();

// ── Auto-migrate: tabla lead_observaciones ────────────────
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lead_observaciones (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
        tipificacion_id INTEGER REFERENCES tipificaciones(id),
        observacion TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_lead_obs_lead ON lead_observaciones(lead_id)
    `);
    console.log('  ✓ lead_observaciones table ready');
  } catch (err) {
    console.error('Error auto-migrate lead_observaciones:', err.message);
  }
})();

// ── Helpers ────────────────────────────────────────────────
function buildLeadSelect() {
  return `
    SELECT
      l.id, l.persona_id, l.sala_id, l.outsourcing_id, l.tmk_id,
      l.fuente_id, l.tipificacion_id, l.patologia,
      l.fecha_cita, l.fecha_rellamar, l.confirmador_id,
      l.estado, l.observacion, l.created_at, l.updated_at,
      p.nombres, p.apellidos, p.telefono, p.email, p.ciudad,
      f.nombre AS fuente_nombre,
      t.nombre AS tipificacion_nombre,
      t.requiere_fecha_cita, t.requiere_fecha_rellamar,
      u.nombre AS tmk_nombre,
      s.nombre AS sala_nombre,
      conf.nombre AS confirmador_nombre
    FROM leads l
    JOIN personas p ON l.persona_id = p.id
    LEFT JOIN fuentes f ON l.fuente_id = f.id
    LEFT JOIN tipificaciones t ON l.tipificacion_id = t.id
    LEFT JOIN usuarios u ON l.tmk_id = u.id
    LEFT JOIN salas s ON l.sala_id = s.id
    LEFT JOIN usuarios conf ON l.confirmador_id = conf.id
  `;
}

/**
 * @openapi
 * /api/leads:
 *   get:
 *     tags: [Leads]
 *     summary: Listar leads
 *     description: Retorna leads del TMK actual o todos para supervisores. Soporta paginacion y filtros por fecha y sala.
 *     parameters:
 *       - in: query
 *         name: fecha
 *         schema:
 *           type: string
 *           format: date
 *         description: Filtrar por fecha (YYYY-MM-DD)
 *       - in: query
 *         name: sala_id
 *         schema:
 *           type: integer
 *         description: Filtrar por sala
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Lista paginada de leads
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       persona_id:
 *                         type: integer
 *                       nombres:
 *                         type: string
 *                       apellidos:
 *                         type: string
 *                       estado:
 *                         type: string
 *                         enum: [pendiente, confirmada, tentativa, tour, no_tour, inasistencia, cancelada]
 *                       fuente_nombre:
 *                         type: string
 *                       tipificacion_nombre:
 *                         type: string
 *                       tmk_nombre:
 *                         type: string
 *                       fecha_cita:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 */
router.get('/', auth, async (req, res) => {
  const { fecha, sala_id, page, limit } = req.query;
  const { rol, id: userId, sala_id: userSalaId } = req.user;

  try {
    let where = [];
    let params = [];
    let idx = 1;

    // TMK solo ve sus propios leads
    if (rol === 'tmk') {
      where.push(`l.tmk_id = $${idx}`);
      params.push(userId);
      idx++;
    }

    // Outsourcing solo ve sus propios leads
    if (rol === 'outsourcing') {
      where.push(`l.outsourcing_id = $${idx}`);
      params.push(userId);
      idx++;
    }

    // Filtrar por sala del usuario si no es admin/director
    if (!['admin','director','supervisor_cc','confirmador'].includes(rol) && userSalaId) {
      where.push(`l.sala_id = $${idx}`);
      params.push(userSalaId);
      idx++;
    }

    // Filtro de sala explícito
    if (sala_id) {
      where.push(`l.sala_id = $${idx}`);
      params.push(sala_id);
      idx++;
    }

    // Filtro de fecha (por fecha_cita o created_at) — usa rango para aprovechar índice
    if (fecha) {
      where.push(`(
        (l.fecha_cita AT TIME ZONE 'America/Guayaquil')::date = $${idx}::date
        OR (l.created_at AT TIME ZONE 'America/Guayaquil')::date = $${idx}::date
      )`);
      params.push(fecha);
      idx++;
    }

    const whereStr = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    // Contar total
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM leads l JOIN personas p ON l.persona_id = p.id ${whereStr}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Query paginada
    const baseQuery = `
      ${buildLeadSelect()}
      ${whereStr}
      ORDER BY
        CASE WHEN l.estado = 'pendiente' AND l.fecha_rellamar IS NOT NULL AND l.fecha_rellamar::date <= CURRENT_DATE THEN 0 ELSE 1 END,
        l.created_at DESC
    `;
    const { paginatedQuery, page: p, limit: l } = paginate(baseQuery, { page, limit });
    const result = await pool.query(paginatedQuery, params);

    res.json(paginatedResponse(result.rows, total, p, l));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener leads' });
  }
});

// GET /api/leads/configuracion — tipificaciones y fuentes activas
router.get('/configuracion', auth, async (req, res) => {
  try {
    const [tipificaciones, fuentes] = await Promise.all([
      pool.query('SELECT * FROM tipificaciones WHERE activo = true ORDER BY nombre'),
      pool.query('SELECT * FROM fuentes WHERE activo = true ORDER BY nombre'),
    ]);
    res.json({ tipificaciones: tipificaciones.rows, fuentes: fuentes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

// GET /api/leads/citas?inicio=YYYY-MM-DD&fin=YYYY-MM-DD&sala_id=X
// Citas para el calendario visual (leads con fecha_cita en el rango)
// Confirmador solo ve SUS citas asignadas (o las sin asignar como fallback)
router.get('/citas', auth, async (req, res) => {
  const { inicio, fin, sala_id } = req.query;
  const { sala_id: userSalaId, rol, id: userId } = req.user;
  const salaId = sala_id || (['admin','director','supervisor_cc','confirmador'].includes(rol) ? null : userSalaId);

  const now = new Date();
  const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  const inicioFinal = inicio || `${y}-${m}-01`;
  const finFinal    = fin    || `${y}-${m}-${lastDay}`;

  try {
    // Filtro de confirmador: solo para rol confirmador
    let confirmadorFilter = '';
    const params = [inicioFinal, finFinal, salaId || null];
    if (rol === 'confirmador') {
      confirmadorFilter = ` AND (l.confirmador_id = $4 OR l.confirmador_id IS NULL)`;
      params.push(userId);
    }

    const result = await pool.query(`
      ${buildLeadSelect()}
      WHERE (l.fecha_cita AT TIME ZONE 'America/Guayaquil')::date BETWEEN $1::date AND $2::date
        AND l.estado IN ('pendiente','confirmada','tentativa','tour','no_tour')
        AND ($3::integer IS NULL OR l.sala_id = $3)
        ${confirmadorFilter}
      ORDER BY l.fecha_cita ASC
    `, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener citas' });
  }
});

// GET /api/leads/calendario — pendientes "Volver a llamar" para el Confirmador
// Confirmador solo ve SUS pendientes asignados (o los sin asignar como fallback)
router.get('/calendario', auth, async (req, res) => {
  const { sala_id } = req.query;
  const { sala_id: userSalaId, rol, id: userId } = req.user;

  try {
    const salaFiltro = sala_id || userSalaId;
    const params = [salaFiltro];

    // Filtro de confirmador: solo para rol confirmador
    let confirmadorFilter = '';
    if (rol === 'confirmador') {
      confirmadorFilter = ` AND (l.confirmador_id = $2 OR l.confirmador_id IS NULL)`;
      params.push(userId);
    }

    const result = await pool.query(`
      ${buildLeadSelect()}
      WHERE l.estado = 'pendiente'
        AND l.fecha_rellamar IS NOT NULL
        AND ($1::integer IS NULL OR l.sala_id = $1)
        ${confirmadorFilter}
      ORDER BY l.fecha_rellamar ASC
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener calendario' });
  }
});

// GET /api/leads/:id — lead individual
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      ${buildLeadSelect()}
      WHERE l.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener lead' });
  }
});

/**
 * @openapi
 * /api/leads:
 *   post:
 *     tags: [Leads]
 *     summary: Crear nuevo lead
 *     description: Registra un nuevo lead asociado a una persona existente. Requiere persona_id, tipificacion_id y fuente_id.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [persona_id, tipificacion_id, fuente_id]
 *             properties:
 *               persona_id:
 *                 type: integer
 *               fuente_id:
 *                 type: integer
 *               tipificacion_id:
 *                 type: integer
 *               patologia:
 *                 type: string
 *               fecha_cita:
 *                 type: string
 *                 format: date-time
 *               fecha_rellamar:
 *                 type: string
 *                 format: date-time
 *               observacion:
 *                 type: string
 *               outsourcing_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Lead creado exitosamente
 *       400:
 *         description: Datos faltantes o invalidos
 */
router.post('/', auth, async (req, res) => {
  const {
    persona_id,
    fuente_id,
    tipificacion_id,
    patologia,
    fecha_cita,
    fecha_rellamar,
    observacion,
    outsourcing_id,
  } = req.body;

  if (!persona_id || !tipificacion_id || !fuente_id) {
    return res.status(400).json({ error: 'persona_id, tipificacion_id y fuente_id son requeridos' });
  }

  const { id: userId, rol, sala_id } = req.user;

  try {
    // Determinar estado inicial
    const tipRes = await pool.query('SELECT * FROM tipificaciones WHERE id = $1', [tipificacion_id]);
    if (tipRes.rows.length === 0) {
      return res.status(400).json({ error: 'Tipificación no válida' });
    }
    const tip = tipRes.rows[0];

    let estado = 'pendiente';
    if (tip.requiere_fecha_cita) {
      // Respetar el estado enviado explícitamente por el frontend (tentativa o confirmada)
      if (req.body.estado === 'tentativa' || req.body.estado === 'confirmada') {
        estado = req.body.estado;
      } else {
        // Fallback: Super tentativa → tentativa, resto → confirmada
        estado = tip.nombre === 'Super tentativa' ? 'tentativa' : 'confirmada';
      }
    }

    // Auto-asignar confirmador_id si el TMK tiene asignación
    const tmkIdFinal = rol === 'tmk' ? userId : (req.body.tmk_id || userId);
    let confirmadorId = null;
    if (tip.requiere_fecha_cita) {
      const asigRes = await pool.query(
        'SELECT confirmador_id FROM asignacion_tmk_confirmador WHERE tmk_id = $1 AND activo = true',
        [tmkIdFinal]
      );
      if (asigRes.rows.length > 0) {
        confirmadorId = asigRes.rows[0].confirmador_id;
      }
    }

    const result = await pool.query(`
      INSERT INTO leads (
        persona_id, sala_id, tmk_id, fuente_id, tipificacion_id,
        patologia, fecha_cita, fecha_rellamar, estado, observacion, outsourcing_id, confirmador_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING id
    `, [
      persona_id,
      sala_id,
      tmkIdFinal,
      fuente_id,
      tipificacion_id,
      patologia,
      fecha_cita || null,
      fecha_rellamar || null,
      estado,
      observacion,
      outsourcing_id || null,
      confirmadorId,
    ]);

    const newLead = await pool.query(`
      ${buildLeadSelect()} WHERE l.id = $1
    `, [result.rows[0].id]);

    res.status(201).json(newLead.rows[0]);

    // Webhook: lead_creado (fire-and-forget)
    dispararWebhook('lead_creado', {
      lead_id: result.rows[0].id,
      persona_id,
      fuente_id,
      tipificacion_id,
      estado,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear lead' });
  }
});

// PATCH /api/leads/:id — actualizar estado, confirmar, campos editables
router.patch('/:id', auth, async (req, res) => {
  const {
    estado, fecha_cita, fecha_rellamar, confirmador_id,
    observacion, tmk_id, tipificacion_id,
    patologia, sala_id,
  } = req.body;

  const allowed = ['admin','director','supervisor_cc','confirmador','tmk','hostess','outsourcing'];
  if (!allowed.includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso para modificar leads' });
  }

  try {
    // TMK y outsourcing NO pueden cambiar el estado libremente
    // Solo pueden elegir entre 'tentativa' y 'confirmada' al tipificar como Cita
    const rolesNoEstado = ['tmk', 'outsourcing'];
    let estadoFinal;
    if (rolesNoEstado.includes(req.user.rol)) {
      // Permitir solo tentativa/confirmada (cuando tipifican Cita)
      estadoFinal = (estado === 'tentativa' || estado === 'confirmada') ? estado : undefined;
    } else {
      estadoFinal = estado;
    }
    if (tipificacion_id !== undefined && estado === undefined) {
      const tipCheck = await pool.query('SELECT requiere_fecha_cita FROM tipificaciones WHERE id = $1', [tipificacion_id]);
      if (tipCheck.rows.length > 0 && tipCheck.rows[0].requiere_fecha_cita) {
        const leadCheck = await pool.query('SELECT estado FROM leads WHERE id = $1', [req.params.id]);
        if (leadCheck.rows.length > 0 && leadCheck.rows[0].estado === 'pendiente') {
          estadoFinal = 'tentativa';
        }
      }
    }

    // Auto-asignar confirmador_id cuando el estado cambia a 'confirmada' o 'tentativa'
    // y no se envió confirmador_id explícitamente
    let autoConfirmadorId = confirmador_id;
    if (
      (estadoFinal === 'confirmada' || estadoFinal === 'tentativa') &&
      confirmador_id === undefined
    ) {
      // Buscar el TMK del lead para resolver su confirmador asignado
      const leadActual = await pool.query('SELECT tmk_id, confirmador_id FROM leads WHERE id = $1', [req.params.id]);
      if (leadActual.rows.length > 0) {
        const tmkDelLead = tmk_id || leadActual.rows[0].tmk_id;
        // Solo auto-asignar si no tiene confirmador ya
        if (!leadActual.rows[0].confirmador_id && tmkDelLead) {
          const asigRes = await pool.query(
            'SELECT confirmador_id FROM asignacion_tmk_confirmador WHERE tmk_id = $1 AND activo = true',
            [tmkDelLead]
          );
          if (asigRes.rows.length > 0) {
            autoConfirmadorId = asigRes.rows[0].confirmador_id;
          }
        }
      }
    }

    const updates = [];
    const params = [];
    let idx = 1;

    if (estadoFinal !== undefined)       { updates.push(`estado = $${idx++}`);           params.push(estadoFinal); }
    if (fecha_cita !== undefined)       { updates.push(`fecha_cita = $${idx++}`);       params.push(fecha_cita); }
    if (fecha_rellamar !== undefined)   { updates.push(`fecha_rellamar = $${idx++}`);   params.push(fecha_rellamar); }
    if (autoConfirmadorId !== undefined) { updates.push(`confirmador_id = $${idx++}`);  params.push(autoConfirmadorId); }
    if (observacion !== undefined)      { updates.push(`observacion = $${idx++}`);      params.push(observacion); }
    if (tmk_id !== undefined)           { updates.push(`tmk_id = $${idx++}`);           params.push(tmk_id); }
    if (tipificacion_id !== undefined)  { updates.push(`tipificacion_id = $${idx++}`);  params.push(tipificacion_id); }
    if (patologia !== undefined)        { updates.push(`patologia = $${idx++}`);        params.push(patologia); }
    if (sala_id !== undefined)          { updates.push(`sala_id = $${idx++}`);          params.push(sala_id); }

    if (updates.length === 0) {
      // Mensaje más claro si el TMK intentó cambiar el estado sin permiso
      if (rolesNoEstado.includes(req.user.rol) && estado !== undefined && estadoFinal === undefined) {
        return res.status(403).json({ error: 'El TMK no puede modificar el estado del lead a ese valor' });
      }
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    updates.push(`updated_at = NOW()`);
    params.push(req.params.id);

    await pool.query(`
      UPDATE leads SET ${updates.join(', ')} WHERE id = $${idx}
    `, params);

    // Auto-guardar en historial si viene observación con tipificación
    if (observacion && tipificacion_id) {
      await pool.query(`
        INSERT INTO lead_observaciones (lead_id, usuario_id, tipificacion_id, observacion)
        VALUES ($1, $2, $3, $4)
      `, [req.params.id, req.user.id, tipificacion_id, observacion]);
    }

    const updated = await pool.query(`
      ${buildLeadSelect()} WHERE l.id = $1
    `, [req.params.id]);

    res.json(updated.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar lead' });
  }
});

// POST /api/leads/:id/observacion — Guardar observación con tipificación
router.post('/:id/observacion', auth, async (req, res) => {
  const { observacion, tipificacion_id } = req.body;
  if (!observacion) {
    return res.status(400).json({ error: 'observacion es requerida' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO lead_observaciones (lead_id, usuario_id, tipificacion_id, observacion)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [req.params.id, req.user.id, tipificacion_id || null, observacion]);

    // También actualizar la observación principal del lead
    await pool.query(`
      UPDATE leads SET observacion = $1, updated_at = NOW() WHERE id = $2
    `, [observacion, req.params.id]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al guardar observación' });
  }
});

// GET /api/leads/:id/historial — Listar observaciones históricas
router.get('/:id/historial', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        lo.id, lo.lead_id, lo.usuario_id, lo.tipificacion_id,
        lo.observacion, lo.created_at,
        u.nombre AS usuario_nombre,
        t.nombre AS tipificacion_nombre
      FROM lead_observaciones lo
      LEFT JOIN usuarios u ON lo.usuario_id = u.id
      LEFT JOIN tipificaciones t ON lo.tipificacion_id = t.id
      WHERE lo.lead_id = $1
      ORDER BY lo.created_at DESC
      LIMIT 50
    `, [req.params.id]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

module.exports = router;
