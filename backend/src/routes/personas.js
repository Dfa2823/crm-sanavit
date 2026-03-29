const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

/**
 * @openapi
 * /api/personas:
 *   get:
 *     tags: [Personas]
 *     summary: Buscar personas
 *     description: Busca personas por nombre, telefono o documento. Sin parametro q retorna las 50 mas recientes.
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Termino de busqueda (nombre, telefono o documento)
 *         example: Juan
 *     responses:
 *       200:
 *         description: Lista de personas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   nombres:
 *                     type: string
 *                   apellidos:
 *                     type: string
 *                   telefono:
 *                     type: string
 *                   email:
 *                     type: string
 *                   ciudad:
 *                     type: string
 *                   num_documento:
 *                     type: string
 */
router.get('/', auth, async (req, res) => {
  const { q } = req.query;
  try {
    let result;
    if (q && q.trim()) {
      const term = `%${q.trim()}%`;
      result = await pool.query(`
        SELECT id, nombres, apellidos, telefono, telefono2, email, ciudad, edad,
               tipo_documento, num_documento, situacion_laboral, patologia,
               created_at
        FROM personas
        WHERE nombres ILIKE $1 OR apellidos ILIKE $1
           OR CONCAT(nombres,' ',apellidos) ILIKE $1
           OR telefono ILIKE $2 OR num_documento ILIKE $2
           OR telefono2 ILIKE $2
           OR email ILIKE $1
        ORDER BY nombres ASC
        LIMIT 20
      `, [term, `%${q.trim()}%`]);
    } else {
      result = await pool.query(`
        SELECT id, nombres, apellidos, telefono, telefono2, email, ciudad, edad,
               tipo_documento, num_documento, situacion_laboral, patologia,
               created_at
        FROM personas
        ORDER BY created_at DESC
        LIMIT 50
      `);
    }
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al buscar personas' });
  }
});

// GET /api/personas/:id — perfil completo
router.get('/:id', auth, async (req, res) => {
  try {
    const personaRes = await pool.query(`
      SELECT p.*,
             l.id AS lead_id, l.estado AS lead_estado,
             l.fecha_cita, l.patologia AS lead_patologia,
             f.nombre AS fuente_nombre,
             t.nombre AS tipificacion_nombre,
             u.nombre AS tmk_nombre
      FROM personas p
      LEFT JOIN leads l ON l.persona_id = p.id
      LEFT JOIN fuentes f ON l.fuente_id = f.id
      LEFT JOIN tipificaciones t ON l.tipificacion_id = t.id
      LEFT JOIN usuarios u ON l.tmk_id = u.id
      WHERE p.id = $1
      ORDER BY l.created_at DESC
      LIMIT 1
    `, [req.params.id]);

    if (personaRes.rows.length === 0) {
      return res.status(404).json({ error: 'Persona no encontrada' });
    }

    const visitaRes = await pool.query(`
      SELECT vs.*,
             uc.nombre AS consultor_nombre,
             uh.nombre AS hostess_nombre
      FROM visitas_sala vs
      LEFT JOIN usuarios uc ON vs.consultor_id = uc.id
      LEFT JOIN usuarios uh ON vs.hostess_id = uh.id
      WHERE vs.persona_id = $1
      ORDER BY vs.created_at DESC
      LIMIT 1
    `, [req.params.id]);

    res.json({
      persona: personaRes.rows[0],
      visita: visitaRes.rows[0] || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener persona' });
  }
});

// POST /api/personas — crear nueva persona
router.post('/', auth, async (req, res) => {
  const {
    nombres, apellidos, telefono, telefono2, email, ciudad, edad,
    tipo_documento, num_documento, situacion_laboral, patologia, direccion
  } = req.body;

  if (!nombres || !telefono) {
    return res.status(400).json({ error: 'Nombre y teléfono son requeridos' });
  }

  try {
    // Verificar si ya existe por teléfono
    const exists = await pool.query(
      'SELECT id FROM personas WHERE telefono = $1', [telefono]
    );
    if (exists.rows.length > 0) {
      return res.status(409).json({
        error: 'Ya existe un cliente con ese teléfono',
        persona_id: exists.rows[0].id,
      });
    }

    const result = await pool.query(`
      INSERT INTO personas (nombres, apellidos, telefono, telefono2, email, ciudad, edad,
                            tipo_documento, num_documento, situacion_laboral, patologia, direccion)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING *
    `, [nombres, apellidos, telefono, telefono2 || null, email, ciudad, edad,
        tipo_documento, num_documento, situacion_laboral, patologia, direccion || null]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear persona' });
  }
});

// PATCH /api/personas/:id — actualizar datos
router.patch('/:id', auth, async (req, res) => {
  const fields = ['nombres','apellidos','telefono','telefono2','email','ciudad','edad',
                  'tipo_documento','num_documento','fecha_nacimiento','genero',
                  'patologia','estado_civil','direccion','situacion_laboral','tipo_seguridad_social'];

  const updates = [];
  const values = [];
  let idx = 1;

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = $${idx}`);
      values.push(req.body[field]);
      idx++;
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No hay campos para actualizar' });
  }

  values.push(req.params.id);
  try {
    const result = await pool.query(`
      UPDATE personas SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${idx}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Persona no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar persona' });
  }
});

// GET /api/personas/:id/historia — historial 360° de una persona
router.get('/:id/historia', auth, async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Datos de la persona
    const personaRes = await pool.query(
      `SELECT * FROM personas WHERE id = $1`, [id]
    );
    if (personaRes.rows.length === 0) return res.status(404).json({ error: 'Persona no encontrada' });

    // 2. Leads (historial completo de llamadas)
    const leadsRes = await pool.query(`
      SELECT l.*,
        f.nombre AS fuente_nombre,
        t.nombre AS tipificacion_nombre,
        s.nombre AS sala_nombre,
        u_tmk.nombre AS tmk_nombre
      FROM leads l
      LEFT JOIN fuentes f ON l.fuente_id = f.id
      LEFT JOIN tipificaciones t ON l.tipificacion_id = t.id
      LEFT JOIN salas s ON l.sala_id = s.id
      LEFT JOIN usuarios u_tmk ON l.tmk_id = u_tmk.id
      WHERE l.persona_id = $1
      ORDER BY l.created_at DESC
    `, [id]);

    // 3. Visitas a sala
    const visitasRes = await pool.query(`
      SELECT vs.*,
        s.nombre AS sala_nombre,
        u.nombre AS consultor_nombre
      FROM visitas_sala vs
      LEFT JOIN salas s ON vs.sala_id = s.id
      LEFT JOIN usuarios u ON vs.consultor_id = u.id
      WHERE vs.persona_id = $1
      ORDER BY vs.fecha DESC
    `, [id]);

    // 4. Contratos con resumen financiero
    const contratosRes = await pool.query(`
      SELECT c.*,
        s.nombre AS sala_nombre,
        u.nombre AS consultor_nombre,
        COALESCE(SUM(r.valor) FILTER (WHERE r.estado='activo'), 0) AS total_pagado,
        COUNT(cu.id) FILTER (WHERE cu.estado='vencido') AS cuotas_vencidas
      FROM contratos c
      LEFT JOIN salas s ON c.sala_id = s.id
      LEFT JOIN usuarios u ON c.consultor_id = u.id
      LEFT JOIN recibos r ON r.contrato_id = c.id
      LEFT JOIN cuotas cu ON cu.contrato_id = c.id
      WHERE c.persona_id = $1
      GROUP BY c.id, s.id, u.id
      ORDER BY c.fecha_contrato DESC
    `, [id]);

    // 5. Productos por contrato (para despacho)
    let productosData = [];
    try {
      const productosRes = await pool.query(`
        SELECT vp.*, vp.contrato_id,
          pr.nombre AS producto_nombre, pr.tipo AS producto_tipo, pr.codigo
        FROM venta_productos vp
        JOIN productos pr ON vp.producto_id = pr.id
        JOIN contratos c ON vp.contrato_id = c.id
        WHERE c.persona_id = $1
        ORDER BY vp.contrato_id, vp.id
      `, [id]);
      productosData = productosRes.rows;
    } catch (e) { /* tabla no existe aún */ }

    // 6. Tickets SAC (si la tabla existe)
    let ticketsData = [];
    try {
      const ticketsRes = await pool.query(`
        SELECT pt.*, u.nombre AS asignado_nombre
        FROM pqr_tickets pt
        LEFT JOIN usuarios u ON pt.asignado_a = u.id
        WHERE pt.persona_id = $1
        ORDER BY pt.fecha_apertura DESC
      `, [id]);
      ticketsData = ticketsRes.rows;
    } catch (e) { /* tabla no existe aún */ }

    res.json({
      persona:   personaRes.rows[0],
      leads:     leadsRes.rows,
      visitas:   visitasRes.rows,
      contratos: contratosRes.rows,
      productos: productosData,
      tickets:   ticketsData,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/personas/:id/timeline — línea de tiempo unificada del cliente
router.get('/:id/timeline', auth, async (req, res) => {
  const { id } = req.params;
  try {
    const eventos = [];

    // 1. Leads
    const leadsRes = await pool.query(`
      SELECT l.id, l.created_at AS fecha, l.estado,
        'lead' AS tipo,
        CONCAT('Lead — ', COALESCE(t.nombre, 'sin tipificación'), ' · ', COALESCE(f.nombre, '')) AS descripcion,
        u.nombre AS actor,
        NULL::numeric AS monto
      FROM leads l
      LEFT JOIN fuentes f ON l.fuente_id = f.id
      LEFT JOIN tipificaciones t ON l.tipificacion_id = t.id
      LEFT JOIN usuarios u ON l.tmk_id = u.id
      WHERE l.persona_id = $1
    `, [id]);
    eventos.push(...leadsRes.rows);

    // 2. Visitas sala
    const visitasRes = await pool.query(`
      SELECT vs.id, vs.created_at AS fecha, vs.calificacion AS estado,
        'visita' AS tipo,
        CONCAT('Visita a sala — ', vs.calificacion, ' · ', COALESCE(s.nombre, '')) AS descripcion,
        u.nombre AS actor,
        NULL::numeric AS monto
      FROM visitas_sala vs
      LEFT JOIN salas s ON vs.sala_id = s.id
      LEFT JOIN usuarios u ON vs.consultor_id = u.id
      WHERE vs.persona_id = $1
    `, [id]);
    eventos.push(...visitasRes.rows);

    // 3. Contratos
    const contratosRes = await pool.query(`
      SELECT c.id, c.created_at AS fecha, c.estado,
        'contrato' AS tipo,
        CONCAT('Contrato ', c.numero_contrato, ' · ', c.tipo_plan, ' · ', c.n_cuotas, ' cuotas') AS descripcion,
        u.nombre AS actor,
        c.monto_total AS monto
      FROM contratos c
      LEFT JOIN usuarios u ON c.consultor_id = u.id
      WHERE c.persona_id = $1
    `, [id]);
    eventos.push(...contratosRes.rows);

    // 4. Pagos
    const pagosRes = await pool.query(`
      SELECT r.id, r.fecha_pago::timestamptz AS fecha, r.estado,
        'pago' AS tipo,
        CONCAT('Pago — ', fp.nombre, CASE WHEN r.numero_cuota IS NOT NULL THEN CONCAT(' · Cuota #', r.numero_cuota) ELSE '' END) AS descripcion,
        u.nombre AS actor,
        r.valor AS monto
      FROM recibos r
      JOIN contratos c ON r.contrato_id = c.id
      LEFT JOIN formas_pago fp ON r.forma_pago_id = fp.id
      LEFT JOIN usuarios u ON r.usuario_id = u.id
      WHERE c.persona_id = $1 AND r.estado = 'activo'
    `, [id]);
    eventos.push(...pagosRes.rows);

    // 5. Tickets SAC (opcional — puede no existir la tabla)
    try {
      const ticketsRes = await pool.query(`
        SELECT pt.id, pt.fecha_apertura::timestamptz AS fecha, pt.estado,
          'ticket' AS tipo,
          CONCAT('Ticket SAC — ', pt.tipo, ': ', LEFT(COALESCE(pt.descripcion,''), 60)) AS descripcion,
          u.nombre AS actor,
          NULL::numeric AS monto
        FROM pqr_tickets pt
        LEFT JOIN usuarios u ON pt.asignado_a = u.id
        WHERE pt.persona_id = $1
      `, [id]);
      eventos.push(...ticketsRes.rows);
    } catch (_) { /* tabla aún no existe */ }

    // Ordenar por fecha descendente
    eventos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    res.json(eventos.slice(0, 100));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
