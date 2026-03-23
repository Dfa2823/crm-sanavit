const express = require('express');
const pool = require('../db');

const router = express.Router();

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
  const { sala_id, estado = 'todos', aging } = req.query;
  const { rol, sala_id: userSalaId } = req.user;

  try {
    const params = [];
    let idx = 1;
    const whereClauses = [
      `c.estado = 'activo'`,
      `cu.estado != 'pagado'`,
    ];

    // Restringir sala para roles no privilegiados
    const efectivaSalaId =
      sala_id ||
      (!['admin', 'director', 'asesor_cartera'].includes(rol) ? userSalaId : null);

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

    const result = await pool.query(
      `SELECT
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
        cu.fecha_vencimiento ASC
      LIMIT 500`,
      params
    );

    res.json(result.rows);
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
      `cu.estado != 'pagado'`,
      `cu.fecha_vencimiento < CURRENT_DATE`,
    ];

    const efectivaSalaId =
      sala_id ||
      (!['admin', 'director', 'asesor_cartera'].includes(rol) ? userSalaId : null);

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
  if (!['asesor_cartera', 'admin', 'director'].includes(rol)) {
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
  if (!['asesor_cartera', 'admin', 'director'].includes(rol)) {
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
// POST /api/cartera/refinanciar/:contrato_id
// Refinanciar un contrato (solo 1 vez, no cambia intereses)
// Body: { n_cuotas_nuevas, fecha_primer_pago, motivo }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/refinanciar/:contrato_id', async (req, res) => {
  const { rol } = req.user;
  if (!['admin', 'director', 'asesor_cartera'].includes(rol)) {
    return res.status(403).json({ error: 'Sin permiso para refinanciar' });
  }

  const contratoId = req.params.contrato_id;
  const { n_cuotas_nuevas, fecha_primer_pago, motivo } = req.body;

  if (!n_cuotas_nuevas || !fecha_primer_pago) {
    return res.status(400).json({ error: 'n_cuotas_nuevas y fecha_primer_pago son requeridos' });
  }

  try {
    // Verificar que no tenga refinanciación previa
    const refCheck = await pool.query(
      'SELECT id FROM refinanciaciones WHERE contrato_id = $1', [contratoId]
    );
    if (refCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Este contrato ya fue refinanciado. Solo se permite una vez.' });
    }

    // Obtener cuotas pendientes actuales
    const cuotasRes = await pool.query(
      `SELECT id, numero_cuota, monto_esperado, monto_pagado, fecha_vencimiento, estado, tasa_interes
       FROM cuotas WHERE contrato_id = $1 AND estado IN ('pendiente', 'vencido', 'parcial')
       ORDER BY numero_cuota`,
      [contratoId]
    );
    if (cuotasRes.rows.length === 0) {
      return res.status(400).json({ error: 'No hay cuotas pendientes para refinanciar' });
    }

    const cuotasAnteriores = cuotasRes.rows;
    const saldoPendiente = cuotasAnteriores.reduce(
      (s, c) => s + (Number(c.monto_esperado) - Number(c.monto_pagado)), 0
    );

    // Calcular nuevas cuotas
    const montoCuota = parseFloat((saldoPendiente / n_cuotas_nuevas).toFixed(2));
    const tasaInteres = Number(cuotasAnteriores[0].tasa_interes) || 0; // mantener misma tasa

    // Guardar refinanciación
    await pool.query(`
      INSERT INTO refinanciaciones (contrato_id, motivo, cuotas_anteriores_json, usuario_id)
      VALUES ($1, $2, $3, $4)
    `, [contratoId, motivo || null, JSON.stringify(cuotasAnteriores), req.user.id]);

    // Marcar cuotas viejas como refinanciadas
    await pool.query(
      `UPDATE cuotas SET estado = 'refinanciado' WHERE contrato_id = $1 AND estado IN ('pendiente', 'vencido', 'parcial')`,
      [contratoId]
    );

    // Crear nuevas cuotas
    const ultimaCuota = await pool.query(
      'SELECT COALESCE(MAX(numero_cuota), 0) AS max_cuota FROM cuotas WHERE contrato_id = $1',
      [contratoId]
    );
    let numBase = ultimaCuota.rows[0].max_cuota;

    for (let i = 0; i < n_cuotas_nuevas; i++) {
      const [anio, mesStr, diaStr] = fecha_primer_pago.split('-').map(Number);
      let mesCalc = mesStr + i;
      let anioCalc = anio;
      while (mesCalc > 12) { mesCalc -= 12; anioCalc++; }
      const diasEnMes = new Date(anioCalc, mesCalc, 0).getDate();
      const diaFinal = Math.min(diaStr, diasEnMes);
      const fvenc = `${anioCalc}-${String(mesCalc).padStart(2, '0')}-${String(diaFinal).padStart(2, '0')}`;
      const interes = i >= 3 ? parseFloat((montoCuota * tasaInteres / 100).toFixed(2)) : 0;

      await pool.query(`
        INSERT INTO cuotas (contrato_id, numero_cuota, monto_esperado, monto_interes, tasa_interes, fecha_vencimiento, estado)
        VALUES ($1, $2, $3, $4, $5, $6, 'pendiente')
      `, [contratoId, numBase + i + 1, montoCuota, interes, tasaInteres, fvenc]);
    }

    // Actualizar contrato
    await pool.query(
      `UPDATE contratos SET n_cuotas = n_cuotas + $2, monto_cuota = $3, updated_at = NOW() WHERE id = $1`,
      [contratoId, n_cuotas_nuevas, montoCuota]
    );

    res.json({
      ok: true,
      saldo_refinanciado: saldoPendiente,
      nuevas_cuotas: n_cuotas_nuevas,
      monto_cuota: montoCuota,
    });
  } catch (err) {
    console.error('Refinanciación error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
