const express = require('express');
const pool = require('../db');
const { paginate, paginatedResponse } = require('../utils/pagination');

const router = express.Router();

/**
 * @openapi
 * /api/cartera:
 *   get:
 *     tags: [Cartera]
 *     summary: Listar cuotas de cartera
 *     description: Retorna cuotas pendientes y vencidas con datos del contrato y persona. Soporta paginacion y filtros por sala, estado y rango de fechas.
 *     parameters:
 *       - in: query
 *         name: sala_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [pendiente, vencido, parcial, pagado]
 *       - in: query
 *         name: fecha_inicio
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: fecha_fin
 *         schema:
 *           type: string
 *           format: date
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
 *         description: Lista paginada de cuotas de cartera
 */

// Auto-migraciones: campos de tipificación de cartera + intereses
(async () => {
  try {
    await pool.query(`
      ALTER TABLE cuotas ADD COLUMN IF NOT EXISTS tipificacion_cartera VARCHAR(50);
      ALTER TABLE cuotas ADD COLUMN IF NOT EXISTS fecha_gestion TIMESTAMPTZ;
      ALTER TABLE cuotas ADD COLUMN IF NOT EXISTS gestionado_por INTEGER REFERENCES usuarios(id);
      ALTER TABLE cuotas ADD COLUMN IF NOT EXISTS monto_interes NUMERIC(10,2) DEFAULT 0;
      ALTER TABLE cuotas ADD COLUMN IF NOT EXISTS tasa_interes NUMERIC(5,2) DEFAULT 0;
    `);
  } catch (e) { /* ya existen */ }
})();

// Auto-migración: tabla refinanciaciones
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS refinanciaciones (
        id SERIAL PRIMARY KEY,
        contrato_id INT REFERENCES contratos(id),
        motivo TEXT,
        monto_abono NUMERIC(10,2) DEFAULT 0,
        saldo_anterior NUMERIC(10,2) DEFAULT 0,
        saldo_refinanciado NUMERIC(10,2) DEFAULT 0,
        nuevas_cuotas INT DEFAULT 0,
        cuotas_anteriores_json JSONB,
        cuotas_nuevas_json JSONB,
        usuario_id INT REFERENCES usuarios(id),
        fecha TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    // Agregar columnas nuevas si la tabla ya existía sin ellas
    await pool.query(`
      ALTER TABLE refinanciaciones ADD COLUMN IF NOT EXISTS monto_abono NUMERIC(10,2) DEFAULT 0;
      ALTER TABLE refinanciaciones ADD COLUMN IF NOT EXISTS saldo_anterior NUMERIC(10,2) DEFAULT 0;
      ALTER TABLE refinanciaciones ADD COLUMN IF NOT EXISTS saldo_refinanciado NUMERIC(10,2) DEFAULT 0;
      ALTER TABLE refinanciaciones ADD COLUMN IF NOT EXISTS nuevas_cuotas INT DEFAULT 0;
      ALTER TABLE refinanciaciones ADD COLUMN IF NOT EXISTS cuotas_nuevas_json JSONB;
    `);
  } catch (e) { /* ya existe */ }
})();

// Auto-migraciones: tablas de tipificaciones y gestiones de cartera
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tipificaciones_cartera (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) UNIQUE NOT NULL,
        requiere_fecha BOOLEAN DEFAULT false,
        activo BOOLEAN DEFAULT true
      );
      INSERT INTO tipificaciones_cartera (nombre, requiere_fecha) VALUES
        ('Pagó', false),
        ('Promesa de pago', true),
        ('No contesta', false),
        ('Buzón', false),
        ('Volver a llamar', true),
        ('Número equivocado', false),
        ('Cliente enojado', false),
        ('Acuerdo de pago', true),
        ('Refinanciación solicitada', false)
      ON CONFLICT (nombre) DO NOTHING;

      CREATE TABLE IF NOT EXISTS gestiones_cartera (
        id SERIAL PRIMARY KEY,
        cuota_id INT REFERENCES cuotas(id),
        contrato_id INT REFERENCES contratos(id),
        persona_id INT REFERENCES personas(id),
        usuario_id INT REFERENCES usuarios(id),
        tipificacion_cartera_id INT,
        observacion TEXT,
        fecha_rellamar TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } catch (e) { console.error('Auto-migrate tipificaciones/gestiones:', e.message); }
})();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cartera
// Query params:
//   sala_id  — filtra por sala
//   estado   — 'vencido' | 'pendiente' | 'todos' (default: todos)
//   aging    — 30 | 60 | 90  — filtra cuotas vencidas hace >= X días
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { sala_id, estado = 'todos', aging, page, limit } = req.query;
  const { rol, sala_id: userSalaId } = req.user;

  try {
    const params = [];
    let idx = 1;
    const whereClauses = [
      `c.estado = 'activo'`,
      `cu.estado NOT IN ('pagado', 'refinanciado')`,
    ];

    // Restringir sala para roles no privilegiados
    const efectivaSalaId =
      sala_id ||
      (!['admin', 'director', 'asesor_cartera', 'cartera'].includes(rol) ? userSalaId : null);

    if (efectivaSalaId) {
      whereClauses.push(`c.sala_id = $${idx}`);
      params.push(efectivaSalaId);
      idx++;
    }

    // Filtro por estado
    if (estado === 'vencido') {
      whereClauses.push(`cu.fecha_vencimiento < CURRENT_DATE`);
    } else if (estado === 'pendiente') {
      whereClauses.push(`cu.fecha_vencimiento >= CURRENT_DATE`);
    }

    // Filtro por aging (solo cuotas vencidas hace >= X días)
    const agingNum = parseInt(aging, 10);
    if (!isNaN(agingNum) && agingNum > 0) {
      whereClauses.push(`(CURRENT_DATE - cu.fecha_vencimiento) >= $${idx}`);
      params.push(agingNum);
      idx++;
    }

    const whereStr = `WHERE ${whereClauses.join(' AND ')}`;

    // Contar total
    const countResult = await pool.query(
      `SELECT COUNT(*)
       FROM cuotas cu
       JOIN contratos c ON cu.contrato_id = c.id
       ${whereStr}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Query paginada
    const baseQuery = `SELECT
        cu.id                                                          AS cuota_id,
        cu.numero_cuota,
        cu.monto_esperado,
        cu.monto_pagado,
        cu.monto_esperado - cu.monto_pagado                           AS saldo_cuota,
        cu.fecha_vencimiento,
        cu.estado                                                      AS estado_cuota,
        cu.observacion                                                 AS observacion_gestion,
        cu.tipificacion_cartera,
        cu.fecha_gestion,
        cu.monto_interes,
        CURRENT_DATE - cu.fecha_vencimiento                           AS dias_vencido,
        CASE
          WHEN cu.fecha_vencimiento >= CURRENT_DATE                   THEN 'vigente'
          WHEN CURRENT_DATE - cu.fecha_vencimiento <= 30              THEN 'mora_30'
          WHEN CURRENT_DATE - cu.fecha_vencimiento <= 60              THEN 'mora_60'
          WHEN CURRENT_DATE - cu.fecha_vencimiento <= 90              THEN 'mora_90'
          ELSE 'mora_90_plus'
        END                                                            AS tramo_mora,
        c.id                                                           AS contrato_id,
        c.numero_contrato,
        c.monto_total,
        p.id                                                           AS persona_id,
        p.nombres,
        p.apellidos,
        p.telefono,
        p.email,
        u.nombre                                                       AS consultor_nombre,
        s.id                                                           AS sala_id,
        s.nombre                                                       AS sala_nombre,
        ug.ultima_tipificacion,
        ug.ultima_fecha_gestion,
        ug.fecha_rellamar,
        ug.ultima_observacion_gestion
      FROM cuotas cu
      JOIN contratos c  ON cu.contrato_id = c.id
      JOIN personas  p  ON c.persona_id   = p.id
      LEFT JOIN usuarios u ON c.consultor_id = u.id
      LEFT JOIN salas    s ON c.sala_id       = s.id
      LEFT JOIN LATERAL (
        SELECT tc.nombre AS ultima_tipificacion,
               g.created_at AS ultima_fecha_gestion,
               g.fecha_rellamar,
               g.observacion AS ultima_observacion_gestion
        FROM gestiones_cartera g
        LEFT JOIN tipificaciones_cartera tc ON g.tipificacion_cartera_id = tc.id
        WHERE g.cuota_id = cu.id
        ORDER BY g.created_at DESC
        LIMIT 1
      ) ug ON true
      ${whereStr}
      ORDER BY
        CASE WHEN ug.fecha_rellamar IS NOT NULL AND ug.fecha_rellamar::date <= CURRENT_DATE THEN 0 ELSE 1 END,
        CASE WHEN cu.tipificacion_cartera = 'volver_a_llamar' THEN 0 ELSE 1 END,
        cu.fecha_vencimiento ASC`;

    const { paginatedQuery, page: p, limit: l } = paginate(baseQuery, { page, limit });
    const result = await pool.query(paginatedQuery, params);

    res.json(paginatedResponse(result.rows, total, p, l));
  } catch (err) {
    console.error('GET /api/cartera error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cartera/resumen
// Totales por tramo de mora para cuotas vencidas y no pagadas
// ─────────────────────────────────────────────────────────────────────────────
router.get('/resumen', async (req, res) => {
  const { sala_id } = req.query;
  const { rol, sala_id: userSalaId } = req.user;

  try {
    const params = [];
    let idx = 1;
    const whereClauses = [
      `c.estado = 'activo'`,
      `cu.estado NOT IN ('pagado', 'refinanciado')`,
      `cu.fecha_vencimiento < CURRENT_DATE`,
    ];

    const efectivaSalaId =
      sala_id ||
      (!['admin', 'director', 'asesor_cartera', 'cartera'].includes(rol) ? userSalaId : null);

    if (efectivaSalaId) {
      whereClauses.push(`c.sala_id = $${idx}`);
      params.push(efectivaSalaId);
      idx++;
    }

    const whereStr = `WHERE ${whereClauses.join(' AND ')}`;

    const result = await pool.query(
      `SELECT
        COUNT(*)        FILTER (WHERE dias_calc > 0  AND dias_calc <= 30)  AS mora_30_count,
        SUM(saldo)      FILTER (WHERE dias_calc > 0  AND dias_calc <= 30)  AS mora_30_monto,
        COUNT(*)        FILTER (WHERE dias_calc > 30 AND dias_calc <= 60)  AS mora_60_count,
        SUM(saldo)      FILTER (WHERE dias_calc > 30 AND dias_calc <= 60)  AS mora_60_monto,
        COUNT(*)        FILTER (WHERE dias_calc > 60 AND dias_calc <= 90)  AS mora_90_count,
        SUM(saldo)      FILTER (WHERE dias_calc > 60 AND dias_calc <= 90)  AS mora_90_monto,
        COUNT(*)        FILTER (WHERE dias_calc > 90)                      AS mora_plus_count,
        SUM(saldo)      FILTER (WHERE dias_calc > 90)                      AS mora_plus_monto
      FROM (
        SELECT
          GREATEST(0, CURRENT_DATE - cu.fecha_vencimiento)  AS dias_calc,
          cu.monto_esperado - cu.monto_pagado                AS saldo
        FROM cuotas cu
        JOIN contratos c ON cu.contrato_id = c.id
        ${whereStr}
      ) sub`,
      params
    );

    const row = result.rows[0];
    res.json({
      mora_30_count:   Number(row.mora_30_count   || 0),
      mora_30_monto:   Number(row.mora_30_monto   || 0),
      mora_60_count:   Number(row.mora_60_count   || 0),
      mora_60_monto:   Number(row.mora_60_monto   || 0),
      mora_90_count:   Number(row.mora_90_count   || 0),
      mora_90_monto:   Number(row.mora_90_monto   || 0),
      mora_plus_count: Number(row.mora_plus_count || 0),
      mora_plus_monto: Number(row.mora_plus_monto || 0),
    });
  } catch (err) {
    console.error('GET /api/cartera/resumen error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cartera/tipificaciones
// Lista tipificaciones_cartera activas
// ─────────────────────────────────────────────────────────────────────────────
router.get('/tipificaciones', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nombre, requiere_fecha FROM tipificaciones_cartera WHERE activo = true ORDER BY nombre`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/cartera/tipificaciones error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cartera/cuotas/:id/gestion
// Registrar gestión en tabla gestiones_cartera
// Body: { tipificacion_cartera_id, observacion, fecha_rellamar }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/cuotas/:id/gestion', async (req, res) => {
  const { rol } = req.user;
  if (!['asesor_cartera', 'cartera', 'admin', 'director'].includes(rol)) {
    return res.status(403).json({ error: 'Sin permiso para registrar gestión de cartera' });
  }

  const cuotaId = parseInt(req.params.id, 10);
  if (isNaN(cuotaId)) {
    return res.status(400).json({ error: 'ID de cuota inválido' });
  }

  const { tipificacion_cartera_id, observacion, fecha_rellamar } = req.body;
  if (!tipificacion_cartera_id) {
    return res.status(400).json({ error: 'tipificacion_cartera_id es requerido' });
  }

  try {
    // Obtener datos de la cuota para el contrato y persona
    const cuotaRes = await pool.query(
      `SELECT cu.contrato_id, c.persona_id FROM cuotas cu JOIN contratos c ON cu.contrato_id = c.id WHERE cu.id = $1`,
      [cuotaId]
    );
    if (cuotaRes.rows.length === 0) {
      return res.status(404).json({ error: 'Cuota no encontrada' });
    }
    const { contrato_id, persona_id } = cuotaRes.rows[0];

    // Insertar gestión
    const insertRes = await pool.query(
      `INSERT INTO gestiones_cartera (cuota_id, contrato_id, persona_id, usuario_id, tipificacion_cartera_id, observacion, fecha_rellamar)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [cuotaId, contrato_id, persona_id, req.user.id, tipificacion_cartera_id, observacion || null, fecha_rellamar || null]
    );

    // Obtener nombre de la tipificación
    const tipRes = await pool.query(
      `SELECT nombre FROM tipificaciones_cartera WHERE id = $1`, [tipificacion_cartera_id]
    );
    const tipNombre = tipRes.rows[0]?.nombre || '';

    // Actualizar también la cuota con la última tipificación (compatibilidad)
    await pool.query(
      `UPDATE cuotas SET tipificacion_cartera = $1, observacion = $2, fecha_gestion = NOW(), gestionado_por = $3 WHERE id = $4`,
      [tipNombre, observacion || null, req.user.id, cuotaId]
    );

    res.json({ ...insertRes.rows[0], tipificacion_nombre: tipNombre });
  } catch (err) {
    console.error('POST /api/cartera/cuotas/:id/gestion error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cartera/historial/:contrato_id
// Historial de gestiones de un contrato
// ─────────────────────────────────────────────────────────────────────────────
router.get('/historial/:contrato_id', async (req, res) => {
  const contratoId = parseInt(req.params.contrato_id, 10);
  if (isNaN(contratoId)) {
    return res.status(400).json({ error: 'ID de contrato inválido' });
  }

  try {
    const result = await pool.query(
      `SELECT g.id, g.cuota_id, g.observacion, g.fecha_rellamar, g.created_at,
              tc.nombre AS tipificacion_nombre,
              u.nombre AS usuario_nombre,
              cu.numero_cuota
       FROM gestiones_cartera g
       LEFT JOIN tipificaciones_cartera tc ON g.tipificacion_cartera_id = tc.id
       LEFT JOIN usuarios u ON g.usuario_id = u.id
       LEFT JOIN cuotas cu ON g.cuota_id = cu.id
       WHERE g.contrato_id = $1
       ORDER BY g.created_at DESC
       LIMIT 100`,
      [contratoId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/cartera/historial error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/cartera/cuotas/:id/gestion  (legacy — mantener compatibilidad)
// Body: { observacion: string }
// Solo roles: asesor_cartera | admin | director
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/cuotas/:id/gestion', async (req, res) => {
  const { rol } = req.user;
  if (!['asesor_cartera', 'cartera', 'admin', 'director'].includes(rol)) {
    return res.status(403).json({ error: 'Sin permiso para registrar gestión de cartera' });
  }

  const { observacion, tipificacion_cartera } = req.body;
  const cuotaId = parseInt(req.params.id, 10);

  if (isNaN(cuotaId)) {
    return res.status(400).json({ error: 'ID de cuota inválido' });
  }

  try {
    const updates = [];
    const params = [];
    let idx = 1;

    if (observacion !== undefined) { updates.push(`observacion = $${idx++}`); params.push(observacion); }
    if (tipificacion_cartera !== undefined) { updates.push(`tipificacion_cartera = $${idx++}`); params.push(tipificacion_cartera); }
    updates.push(`fecha_gestion = NOW()`);
    updates.push(`gestionado_por = $${idx++}`); params.push(req.user.id);

    if (updates.length === 2) { // solo fecha_gestion y gestionado_por
      return res.status(400).json({ error: 'Debe enviar al menos observacion o tipificacion_cartera' });
    }

    params.push(cuotaId);
    const result = await pool.query(
      `UPDATE cuotas
       SET ${updates.join(', ')}
       WHERE id = $${idx}
       RETURNING id, contrato_id, numero_cuota, estado, observacion, tipificacion_cartera, fecha_gestion`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cuota no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/cartera/cuotas/:id/gestion error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cartera/refinanciacion/:contrato_id
// Verificar si un contrato ya tiene refinanciación + obtener saldo pendiente
// ─────────────────────────────────────────────────────────────────────────────
router.get('/refinanciacion/:contrato_id', async (req, res) => {
  const contratoId = parseInt(req.params.contrato_id, 10);
  if (isNaN(contratoId)) {
    return res.status(400).json({ error: 'ID de contrato inválido' });
  }

  try {
    // Verificar refinanciación previa
    const refCheck = await pool.query(
      'SELECT id, created_at FROM refinanciaciones WHERE contrato_id = $1', [contratoId]
    );
    const yaRefinanciado = refCheck.rows.length > 0;

    // Obtener cuotas pendientes
    const cuotasRes = await pool.query(
      `SELECT id, numero_cuota, monto_esperado, monto_pagado, fecha_vencimiento, estado, tasa_interes
       FROM cuotas WHERE contrato_id = $1 AND estado IN ('pendiente', 'vencido', 'parcial')
       ORDER BY numero_cuota`,
      [contratoId]
    );

    const cuotasPendientes = cuotasRes.rows;
    const saldoPendiente = cuotasPendientes.reduce(
      (s, c) => s + (Number(c.monto_esperado) - Number(c.monto_pagado)), 0
    );

    // Obtener info del contrato
    const contratoRes = await pool.query(
      `SELECT c.id, c.numero_contrato, c.monto_total, p.nombres, p.apellidos
       FROM contratos c JOIN personas p ON c.persona_id = p.id WHERE c.id = $1`,
      [contratoId]
    );

    res.json({
      ya_refinanciado: yaRefinanciado,
      refinanciacion: yaRefinanciado ? refCheck.rows[0] : null,
      contrato: contratoRes.rows[0] || null,
      cuotas_pendientes: cuotasPendientes.length,
      saldo_pendiente: parseFloat(saldoPendiente.toFixed(2)),
    });
  } catch (err) {
    console.error('GET /api/cartera/refinanciacion error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cartera/refinanciar/:contrato_id
// Refinanciar un contrato (solo 1 vez, no cambia intereses)
// Body: { monto_abono, nuevas_cuotas, motivo }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/refinanciar/:contrato_id', async (req, res) => {
  const { rol } = req.user;
  if (!['admin', 'director', 'asesor_cartera', 'cartera'].includes(rol)) {
    return res.status(403).json({ error: 'Sin permiso para refinanciar' });
  }

  const contratoId = parseInt(req.params.contrato_id, 10);
  if (isNaN(contratoId)) {
    return res.status(400).json({ error: 'ID de contrato inválido' });
  }

  const { monto_abono, nuevas_cuotas, motivo } = req.body;

  if (monto_abono === undefined || monto_abono === null || Number(monto_abono) < 0) {
    return res.status(400).json({ error: 'monto_abono es requerido y debe ser >= 0' });
  }
  if (!nuevas_cuotas || Number(nuevas_cuotas) < 1) {
    return res.status(400).json({ error: 'nuevas_cuotas es requerido y debe ser >= 1' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verificar que no tenga refinanciación previa
    const refCheck = await client.query(
      'SELECT id FROM refinanciaciones WHERE contrato_id = $1', [contratoId]
    );
    if (refCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Este contrato ya fue refinanciado. Solo se permite una vez.' });
    }

    // 2. Obtener cuotas pendientes actuales
    const cuotasRes = await client.query(
      `SELECT id, numero_cuota, monto_esperado, monto_pagado, fecha_vencimiento, estado, tasa_interes
       FROM cuotas WHERE contrato_id = $1 AND estado IN ('pendiente', 'vencido', 'parcial')
       ORDER BY numero_cuota`,
      [contratoId]
    );
    if (cuotasRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No hay cuotas pendientes para refinanciar' });
    }

    const cuotasAnteriores = cuotasRes.rows;
    const saldoPendiente = cuotasAnteriores.reduce(
      (s, c) => s + (Number(c.monto_esperado) - Number(c.monto_pagado)), 0
    );

    const abono = Number(monto_abono);
    if (abono >= saldoPendiente) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El abono no puede ser mayor o igual al saldo pendiente' });
    }

    const nCuotas = Number(nuevas_cuotas);
    const tasaInteres = Number(cuotasAnteriores[0].tasa_interes) || 0;
    const saldoRestante = parseFloat((saldoPendiente - abono).toFixed(2));
    const montoCuotaNueva = parseFloat((saldoRestante / nCuotas).toFixed(2));

    // 3. Si hay abono > 0, registrar el abono distribuyéndolo en las primeras cuotas pendientes
    if (abono > 0) {
      let abonoRestante = abono;
      for (const cuota of cuotasAnteriores) {
        if (abonoRestante <= 0) break;
        const saldoCuota = Number(cuota.monto_esperado) - Number(cuota.monto_pagado);
        const pagoAplicado = Math.min(abonoRestante, saldoCuota);
        const nuevoPagado = Number(cuota.monto_pagado) + pagoAplicado;
        const nuevoEstado = nuevoPagado >= Number(cuota.monto_esperado) ? 'pagado' : 'parcial';

        await client.query(
          `UPDATE cuotas SET monto_pagado = $1, estado = $2, fecha_pago = CASE WHEN $2 = 'pagado' THEN NOW() ELSE fecha_pago END,
           observacion = COALESCE(observacion, '') || ' [Abono refinanciación: $' || $3 || ']'
           WHERE id = $4`,
          [nuevoPagado, nuevoEstado, pagoAplicado.toFixed(2), cuota.id]
        );
        abonoRestante = parseFloat((abonoRestante - pagoAplicado).toFixed(2));
      }
    }

    // 4. Marcar cuotas pendientes restantes como 'refinanciado'
    await client.query(
      `UPDATE cuotas SET estado = 'refinanciado' WHERE contrato_id = $1 AND estado IN ('pendiente', 'vencido', 'parcial')`,
      [contratoId]
    );

    // 5. Crear nuevas cuotas con el saldo restante distribuido
    const ultimaCuota = await client.query(
      'SELECT COALESCE(MAX(numero_cuota), 0) AS max_cuota FROM cuotas WHERE contrato_id = $1',
      [contratoId]
    );
    const numBase = ultimaCuota.rows[0].max_cuota;

    // Fecha primer pago: próximo mes desde hoy
    const hoy = new Date();
    let mesInicio = hoy.getMonth() + 2; // +1 porque getMonth es 0-based, +1 para próximo mes
    let anioInicio = hoy.getFullYear();
    if (mesInicio > 12) { mesInicio -= 12; anioInicio++; }
    const diaInicio = Math.min(hoy.getDate(), 28); // usar día actual o 28 para meses cortos

    const cuotasNuevasCreadas = [];
    // Ajuste para que la última cuota absorba el redondeo
    let acumulado = 0;
    for (let i = 0; i < nCuotas; i++) {
      let mesCalc = mesInicio + i;
      let anioCalc = anioInicio;
      while (mesCalc > 12) { mesCalc -= 12; anioCalc++; }
      const diasEnMes = new Date(anioCalc, mesCalc, 0).getDate();
      const diaFinal = Math.min(diaInicio, diasEnMes);
      const fvenc = `${anioCalc}-${String(mesCalc).padStart(2, '0')}-${String(diaFinal).padStart(2, '0')}`;

      // Última cuota absorbe diferencia por redondeo
      let montoEsta;
      if (i === nCuotas - 1) {
        montoEsta = parseFloat((saldoRestante - acumulado).toFixed(2));
      } else {
        montoEsta = montoCuotaNueva;
        acumulado += montoCuotaNueva;
      }

      const interes = i >= 3 ? parseFloat((montoEsta * tasaInteres / 100).toFixed(2)) : 0;

      const insertRes = await client.query(`
        INSERT INTO cuotas (contrato_id, numero_cuota, monto_esperado, monto_pagado, monto_interes, tasa_interes, fecha_vencimiento, estado)
        VALUES ($1, $2, $3, 0, $4, $5, $6, 'pendiente')
        RETURNING id, numero_cuota, monto_esperado, fecha_vencimiento
      `, [contratoId, numBase + i + 1, montoEsta, interes, tasaInteres, fvenc]);

      cuotasNuevasCreadas.push(insertRes.rows[0]);
    }

    // 6. Guardar en tabla refinanciaciones con snapshot
    await client.query(`
      INSERT INTO refinanciaciones (contrato_id, motivo, monto_abono, saldo_anterior, saldo_refinanciado, nuevas_cuotas, cuotas_anteriores_json, cuotas_nuevas_json, usuario_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      contratoId,
      motivo || null,
      abono,
      saldoPendiente,
      saldoRestante,
      nCuotas,
      JSON.stringify(cuotasAnteriores),
      JSON.stringify(cuotasNuevasCreadas),
      req.user.id,
    ]);

    await client.query('COMMIT');

    req.audit('refinanciar_contrato', 'refinanciaciones', null, { contrato_id: contratoId, monto_abono: abono, saldo_anterior: parseFloat(saldoPendiente.toFixed(2)), saldo_refinanciado: saldoRestante, nuevas_cuotas: nCuotas });

    res.json({
      ok: true,
      saldo_anterior: parseFloat(saldoPendiente.toFixed(2)),
      monto_abono: abono,
      saldo_refinanciado: saldoRestante,
      nuevas_cuotas: nCuotas,
      monto_cuota: montoCuotaNueva,
      cuotas_creadas: cuotasNuevasCreadas,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Refinanciación error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
