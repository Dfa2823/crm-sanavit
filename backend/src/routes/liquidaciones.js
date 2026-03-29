const express = require('express');
const pool    = require('../db');
const auth    = require('../middleware/auth');
const router  = express.Router();

// ─── Auto-crear tabla ────────────────────────────────────────────────────────
pool.query(`
  CREATE TABLE IF NOT EXISTS liquidaciones (
    id SERIAL PRIMARY KEY,
    consultor_id INTEGER REFERENCES usuarios(id) NOT NULL,
    sala_id INTEGER REFERENCES salas(id),
    mes VARCHAR(7) NOT NULL,
    monto_comision NUMERIC(12,2) NOT NULL DEFAULT 0,
    contratos_count INTEGER DEFAULT 0,
    estado VARCHAR(20) DEFAULT 'pendiente'
      CHECK (estado IN ('pendiente','aprobada','rechazada','pagada')),
    aprobado_por INTEGER REFERENCES usuarios(id),
    fecha_aprobacion TIMESTAMPTZ,
    fecha_pago TIMESTAMPTZ,
    observacion TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(consultor_id, mes)
  )
`).catch(console.error);

// ─── Auto-crear tabla comisiones_suspendidas ─────────────────────────────────
pool.query(`
  CREATE TABLE IF NOT EXISTS comisiones_suspendidas (
    id SERIAL PRIMARY KEY,
    liquidacion_id INTEGER REFERENCES liquidaciones(id) NOT NULL,
    contrato_id INTEGER REFERENCES contratos(id) NOT NULL,
    usuario_id INTEGER REFERENCES usuarios(id) NOT NULL,
    monto_comision NUMERIC(12,2) NOT NULL DEFAULT 0,
    motivo TEXT,
    suspendido_por INTEGER REFERENCES usuarios(id),
    fecha TIMESTAMPTZ DEFAULT NOW(),
    activo BOOLEAN DEFAULT true,
    UNIQUE(liquidacion_id, contrato_id)
  )
`).catch(console.error);

// ─── Middleware solo admin/director ─────────────────────────────────────────
function requireAdminOrDirector(req, res, next) {
  if (!['admin', 'director'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'No autorizado. Se requiere rol admin o director.' });
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/liquidaciones?mes=YYYY-MM&sala_id=X
// Solo admin/director
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', auth, requireAdminOrDirector, async (req, res) => {
  const { mes, sala_id } = req.query;
  const mesFiltro = mes || new Date().toISOString().slice(0, 7);
  const salaParam = sala_id ? parseInt(sala_id, 10) : null;

  try {
    const result = await pool.query(`
      SELECT
        l.id,
        l.mes,
        l.estado,
        l.monto_comision,
        l.contratos_count,
        l.fecha_aprobacion,
        l.fecha_pago,
        l.observacion,
        u.nombre   AS consultor_nombre,
        u.id       AS consultor_id,
        r.nombre   AS rol,
        r.label    AS rol_label,
        s.nombre   AS sala_nombre,
        ua.nombre  AS aprobado_por_nombre
      FROM liquidaciones l
      JOIN usuarios u ON l.consultor_id = u.id
      JOIN roles r ON u.rol_id = r.id
      LEFT JOIN salas s ON l.sala_id = s.id
      LEFT JOIN usuarios ua ON l.aprobado_por = ua.id
      WHERE l.mes = $1
        AND ($2::integer IS NULL OR l.sala_id = $2)
      ORDER BY l.monto_comision DESC, u.nombre
    `, [mesFiltro, salaParam]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error en GET /api/liquidaciones:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/liquidaciones/calcular
// Body: { mes: 'YYYY-MM', sala_id: X (opcional) }
// Solo admin/director — calcula y crea/actualiza liquidaciones del mes
// para TODOS los roles con comisiones: consultor, TMK, confirmador, hostess
// ─────────────────────────────────────────────────────────────────────────────
router.post('/calcular', auth, requireAdminOrDirector, async (req, res) => {
  const { mes, sala_id } = req.body;

  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).json({ error: 'El campo mes es requerido con formato YYYY-MM' });
  }

  const salaParam = sala_id ? parseInt(sala_id, 10) : null;

  try {
    const resultados = []; // { usuario_id, sala_id, monto_comision, contratos_count }

    // ─── 1. CONSULTORES: Comisión sobre ventas desbloqueadas ──────────────
    const calculo = await pool.query(`
      SELECT
        c.consultor_id AS usuario_id,
        c.sala_id,
        COUNT(c.id)::integer AS contratos_count,
        COALESCE(SUM(
          CASE
            WHEN (COALESCE(pagado.total, 0) / NULLIF(c.monto_total, 0) * 100) >= COALESCE(u.pct_desbloqueo, 30)
            THEN COALESCE(pagado.total_base, 0) * COALESCE(u.pct_comision_venta, 10) / 100
            ELSE 0
          END
        ), 0) AS monto_comision
      FROM contratos c
      JOIN usuarios u ON c.consultor_id = u.id
      LEFT JOIN (
        SELECT r.contrato_id,
               SUM(r.valor) AS total,
               SUM(r.valor) - COALESCE((SELECT SUM(COALESCE(cu.monto_interes, 0)) FROM cuotas cu WHERE cu.contrato_id = r.contrato_id AND cu.estado = 'pagado'), 0) AS total_base
        FROM recibos r
        WHERE r.estado = 'activo'
        GROUP BY r.contrato_id
      ) pagado ON pagado.contrato_id = c.id
      WHERE TO_CHAR(c.fecha_contrato, 'YYYY-MM') = $1
        AND c.estado NOT IN ('cancelado')
        AND ($2::integer IS NULL OR c.sala_id = $2)
        AND c.consultor_id IS NOT NULL
      GROUP BY c.consultor_id, c.sala_id
    `, [mes, salaParam]);
    resultados.push(...calculo.rows);

    // ─── 2. TMK: Bono por tours (leads que generaron TOUR) ────────────────
    const tmkCalculo = await pool.query(`
      SELECT
        l.tmk_id AS usuario_id,
        u.sala_id,
        COUNT(vs.id)::integer AS contratos_count,
        COALESCE(COUNT(vs.id) * COALESCE(u.bono_por_tour, 0), 0) AS monto_comision
      FROM leads l
      JOIN visitas_sala vs ON vs.lead_id = l.id
      JOIN usuarios u ON l.tmk_id = u.id
      JOIN roles r ON u.rol_id = r.id
      WHERE r.nombre = 'tmk'
        AND u.activo = true
        AND vs.calificacion = 'TOUR'
        AND TO_CHAR(vs.fecha, 'YYYY-MM') = $1
        AND ($2::integer IS NULL OR u.sala_id = $2)
        AND l.tmk_id IS NOT NULL
      GROUP BY l.tmk_id, u.sala_id, u.bono_por_tour
    `, [mes, salaParam]);
    resultados.push(...tmkCalculo.rows);

    // ─── 3. CONFIRMADOR: Bono por citas confirmadas ───────────────────────
    const confCalculo = await pool.query(`
      SELECT
        l.confirmador_id AS usuario_id,
        u.sala_id,
        COUNT(l.id)::integer AS contratos_count,
        COALESCE(COUNT(l.id) * COALESCE(u.bono_por_cita, 0), 0) AS monto_comision
      FROM leads l
      JOIN usuarios u ON l.confirmador_id = u.id
      JOIN roles r ON u.rol_id = r.id
      WHERE r.nombre = 'confirmador'
        AND u.activo = true
        AND l.estado IN ('confirmada', 'tour', 'venta')
        AND TO_CHAR(COALESCE(l.fecha_cita, l.created_at), 'YYYY-MM') = $1
        AND ($2::integer IS NULL OR u.sala_id = $2)
        AND l.confirmador_id IS NOT NULL
      GROUP BY l.confirmador_id, u.sala_id, u.bono_por_cita
    `, [mes, salaParam]);
    resultados.push(...confCalculo.rows);

    // ─── 4. HOSTESS: Bono por tours atendidos ─────────────────────────────
    const hostCalculo = await pool.query(`
      SELECT
        vs.hostess_id AS usuario_id,
        u.sala_id,
        COUNT(vs.id)::integer AS contratos_count,
        COALESCE(COUNT(vs.id) * COALESCE(u.bono_por_tour, 0), 0) AS monto_comision
      FROM visitas_sala vs
      JOIN usuarios u ON vs.hostess_id = u.id
      JOIN roles r ON u.rol_id = r.id
      WHERE r.nombre = 'hostess'
        AND u.activo = true
        AND vs.calificacion = 'TOUR'
        AND TO_CHAR(vs.fecha, 'YYYY-MM') = $1
        AND ($2::integer IS NULL OR u.sala_id = $2)
        AND vs.hostess_id IS NOT NULL
      GROUP BY vs.hostess_id, u.sala_id, u.bono_por_tour
    `, [mes, salaParam]);
    resultados.push(...hostCalculo.rows);

    // ─── Consolidar: agrupar por usuario (un usuario puede tener comisiones de distintas fuentes)
    const consolidado = {};
    for (const row of resultados) {
      if (!row.usuario_id) continue;
      const key = row.usuario_id;
      if (!consolidado[key]) {
        consolidado[key] = {
          usuario_id: row.usuario_id,
          sala_id: row.sala_id,
          monto_comision: 0,
          contratos_count: 0,
        };
      }
      consolidado[key].monto_comision += parseFloat(row.monto_comision) || 0;
      consolidado[key].contratos_count += parseInt(row.contratos_count) || 0;
    }

    const filas = Object.values(consolidado);

    if (filas.length === 0) {
      return res.json({ mensaje: 'No hay comisiones para calcular en este periodo', liquidaciones: [] });
    }

    // INSERT ... ON CONFLICT DO UPDATE solo si estado = 'pendiente'
    const insertPromises = filas.map(row =>
      pool.query(`
        INSERT INTO liquidaciones (consultor_id, sala_id, mes, monto_comision, contratos_count, estado)
        VALUES ($1, $2, $3, $4, $5, 'pendiente')
        ON CONFLICT (consultor_id, mes) DO UPDATE
          SET monto_comision   = EXCLUDED.monto_comision,
              contratos_count  = EXCLUDED.contratos_count,
              sala_id          = EXCLUDED.sala_id
          WHERE liquidaciones.estado = 'pendiente'
        RETURNING id
      `, [row.usuario_id, row.sala_id, mes, Math.round(row.monto_comision * 100) / 100, row.contratos_count])
    );

    await Promise.all(insertPromises);

    // Retornar lista actualizada del mes
    const lista = await pool.query(`
      SELECT
        l.id,
        l.mes,
        l.estado,
        l.monto_comision,
        l.contratos_count,
        l.fecha_aprobacion,
        l.fecha_pago,
        l.observacion,
        u.nombre   AS consultor_nombre,
        u.id       AS consultor_id,
        r.nombre   AS rol,
        r.label    AS rol_label,
        s.nombre   AS sala_nombre,
        ua.nombre  AS aprobado_por_nombre
      FROM liquidaciones l
      JOIN usuarios u ON l.consultor_id = u.id
      JOIN roles r ON u.rol_id = r.id
      LEFT JOIN salas s ON l.sala_id = s.id
      LEFT JOIN usuarios ua ON l.aprobado_por = ua.id
      WHERE l.mes = $1
        AND ($2::integer IS NULL OR l.sala_id = $2)
      ORDER BY l.monto_comision DESC, u.nombre
    `, [mes, salaParam]);

    res.json(lista.rows);
  } catch (err) {
    console.error('Error en POST /api/liquidaciones/calcular:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/liquidaciones/:id
// Body: { estado: 'aprobada'|'rechazada'|'pagada', observacion: '...' }
// Solo admin/director
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id', auth, requireAdminOrDirector, async (req, res) => {
  const { id } = req.params;
  const { estado, observacion } = req.body;

  const estadosValidos = ['aprobada', 'rechazada', 'pagada'];
  if (!estado || !estadosValidos.includes(estado)) {
    return res.status(400).json({ error: `El campo estado debe ser uno de: ${estadosValidos.join(', ')}` });
  }

  try {
    // Obtener liquidación actual
    const actual = await pool.query(
      'SELECT id, estado FROM liquidaciones WHERE id = $1',
      [id]
    );

    if (actual.rows.length === 0) {
      return res.status(404).json({ error: 'Liquidación no encontrada' });
    }

    const estadoActual = actual.rows[0].estado;

    // No se puede cambiar de 'pagada' a otro estado
    if (estadoActual === 'pagada') {
      return res.status(400).json({ error: 'No se puede modificar una liquidación ya pagada' });
    }

    // Construir campos a actualizar
    const campos = ['estado = $1', 'observacion = $2'];
    const valores = [estado, observacion || null];
    let idx = 3;

    if (estado === 'aprobada') {
      campos.push(`fecha_aprobacion = NOW()`);
      campos.push(`aprobado_por = $${idx}`);
      valores.push(req.user.id);
      idx++;
    } else if (estado === 'pagada') {
      campos.push(`fecha_pago = NOW()`);
    } else if (estado === 'rechazada') {
      // Al rechazar limpiamos aprobado_por y fecha_aprobacion si los hubiere
      campos.push(`fecha_aprobacion = NULL`);
      campos.push(`aprobado_por = NULL`);
    }

    valores.push(parseInt(id, 10));
    const idxId = valores.length;

    const updateResult = await pool.query(`
      UPDATE liquidaciones
      SET ${campos.join(', ')}
      WHERE id = $${idxId}
      RETURNING id
    `, valores);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Liquidación no encontrada' });
    }

    // Retornar liquidación actualizada con JOINs
    const liquidacion = await pool.query(`
      SELECT
        l.id,
        l.mes,
        l.estado,
        l.monto_comision,
        l.contratos_count,
        l.fecha_aprobacion,
        l.fecha_pago,
        l.observacion,
        u.nombre   AS consultor_nombre,
        u.id       AS consultor_id,
        r.nombre   AS rol,
        r.label    AS rol_label,
        s.nombre   AS sala_nombre,
        ua.nombre  AS aprobado_por_nombre
      FROM liquidaciones l
      JOIN usuarios u ON l.consultor_id = u.id
      JOIN roles r ON u.rol_id = r.id
      LEFT JOIN salas s ON l.sala_id = s.id
      LEFT JOIN usuarios ua ON l.aprobado_por = ua.id
      WHERE l.id = $1
    `, [id]);

    res.json(liquidacion.rows[0]);
  } catch (err) {
    console.error('Error en PATCH /api/liquidaciones/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/liquidaciones/:id/detalle
// Devuelve los contratos que componen la liquidación del consultor,
// con el monto de comisión individual y estado de suspensión.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/detalle', auth, requireAdminOrDirector, async (req, res) => {
  const { id } = req.params;

  try {
    // Obtener la liquidación
    const liqRes = await pool.query(
      `SELECT l.*, u.nombre AS consultor_nombre, u.pct_comision_venta, u.pct_desbloqueo
       FROM liquidaciones l
       JOIN usuarios u ON l.consultor_id = u.id
       WHERE l.id = $1`,
      [id]
    );
    if (liqRes.rows.length === 0) {
      return res.status(404).json({ error: 'Liquidación no encontrada' });
    }
    const liq = liqRes.rows[0];
    const pctComision = parseFloat(liq.pct_comision_venta || 10);
    const pctDesbloqueo = parseFloat(liq.pct_desbloqueo || 30);

    // Contratos del consultor en ese mes
    // REQ2: total_base = total_pagado - intereses de cuotas pagadas
    const contratosRes = await pool.query(`
      SELECT
        c.id, c.numero_contrato, c.fecha_contrato, c.monto_total, c.estado,
        c.tipo_plan,
        p.nombres, p.apellidos, p.num_documento,
        COALESCE(pagado.total, 0) AS total_pagado,
        COALESCE(pagado.total_base, 0) AS total_pagado_base,
        CASE
          WHEN COALESCE(pagado.total, 0) / NULLIF(c.monto_total, 0) * 100 >= $3
          THEN true ELSE false
        END AS desbloqueado,
        CASE
          WHEN COALESCE(pagado.total, 0) / NULLIF(c.monto_total, 0) * 100 >= $3
          THEN ROUND(COALESCE(pagado.total_base, 0) * $4 / 100, 2)
          ELSE 0
        END AS comision_individual
      FROM contratos c
      JOIN personas p ON c.persona_id = p.id
      LEFT JOIN (
        SELECT r.contrato_id,
               SUM(r.valor) AS total,
               SUM(r.valor) - COALESCE((SELECT SUM(COALESCE(cu.monto_interes, 0)) FROM cuotas cu WHERE cu.contrato_id = r.contrato_id AND cu.estado = 'pagado'), 0) AS total_base
        FROM recibos r
        WHERE r.estado = 'activo'
        GROUP BY r.contrato_id
      ) pagado ON pagado.contrato_id = c.id
      WHERE c.consultor_id = $1
        AND TO_CHAR(c.fecha_contrato, 'YYYY-MM') = $2
        AND c.estado NOT IN ('cancelado')
      ORDER BY c.fecha_contrato
    `, [liq.consultor_id, liq.mes, pctDesbloqueo, pctComision]);

    // Obtener suspensiones activas para esta liquidación
    const suspRes = await pool.query(
      `SELECT cs.*, u.nombre AS suspendido_por_nombre
       FROM comisiones_suspendidas cs
       LEFT JOIN usuarios u ON cs.suspendido_por = u.id
       WHERE cs.liquidacion_id = $1 AND cs.activo = true`,
      [id]
    );
    const suspMap = {};
    for (const s of suspRes.rows) {
      suspMap[s.contrato_id] = s;
    }

    // Calcular monto con y sin suspensiones
    let totalComision = 0;
    let totalSuspendido = 0;
    const contratos = contratosRes.rows.map(c => {
      const comision = parseFloat(c.comision_individual || 0);
      const susp = suspMap[c.id] || null;
      if (susp) {
        totalSuspendido += parseFloat(susp.monto_comision);
      } else {
        totalComision += comision;
      }
      return {
        ...c,
        comision_individual: comision,
        suspendido: !!susp,
        suspension: susp ? {
          id: susp.id,
          motivo: susp.motivo,
          suspendido_por_nombre: susp.suspendido_por_nombre,
          fecha: susp.fecha,
        } : null,
      };
    });

    res.json({
      liquidacion: liq,
      contratos,
      resumen: {
        total_comision: Math.round(totalComision * 100) / 100,
        total_suspendido: Math.round(totalSuspendido * 100) / 100,
        neto_comision: Math.round((totalComision) * 100) / 100,
      },
    });
  } catch (err) {
    console.error('Error en GET /api/liquidaciones/:id/detalle:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/liquidaciones/:id/suspender
// Body: { contrato_id, motivo }
// Suspende la comisión de un contrato específico en la liquidación
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/suspender', auth, requireAdminOrDirector, async (req, res) => {
  const { id } = req.params;
  const { contrato_id, motivo } = req.body;

  if (!contrato_id) {
    return res.status(400).json({ error: 'contrato_id es requerido' });
  }

  try {
    // Verificar que la liquidación existe y no está pagada
    const liqRes = await pool.query(
      `SELECT l.*, u.pct_comision_venta, u.pct_desbloqueo
       FROM liquidaciones l
       JOIN usuarios u ON l.consultor_id = u.id
       WHERE l.id = $1`,
      [id]
    );
    if (liqRes.rows.length === 0) {
      return res.status(404).json({ error: 'Liquidación no encontrada' });
    }
    const liq = liqRes.rows[0];
    if (liq.estado === 'pagada') {
      return res.status(400).json({ error: 'No se puede suspender comisiones de una liquidación pagada' });
    }

    // Calcular la comisión individual de ese contrato (base, sin intereses)
    const pctComision = parseFloat(liq.pct_comision_venta || 10);
    const pctDesbloqueo = parseFloat(liq.pct_desbloqueo || 30);

    const cRes = await pool.query(`
      SELECT
        c.monto_total,
        COALESCE(pagado.total, 0) AS total_pagado,
        COALESCE(pagado.total_base, 0) AS total_pagado_base
      FROM contratos c
      LEFT JOIN (
        SELECT contrato_id,
               SUM(valor) AS total,
               SUM(valor) - COALESCE((SELECT SUM(monto_interes) FROM cuotas WHERE contrato_id = r_agg.contrato_id AND estado = 'pagado'), 0) AS total_base
        FROM recibos r_agg
        WHERE estado = 'activo'
        GROUP BY contrato_id
      ) pagado ON pagado.contrato_id = c.id
      WHERE c.id = $1
    `, [contrato_id]);

    if (cRes.rows.length === 0) {
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }
    const contrato = cRes.rows[0];
    const pctPagado = parseFloat(contrato.total_pagado) / parseFloat(contrato.monto_total || 1) * 100;
    const montoComision = pctPagado >= pctDesbloqueo
      ? Math.round(parseFloat(contrato.total_pagado_base) * pctComision / 100 * 100) / 100
      : 0;

    // Insertar o reactivar suspensión
    await pool.query(`
      INSERT INTO comisiones_suspendidas (liquidacion_id, contrato_id, usuario_id, monto_comision, motivo, suspendido_por, activo)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      ON CONFLICT (liquidacion_id, contrato_id) DO UPDATE SET
        activo = true,
        motivo = EXCLUDED.motivo,
        monto_comision = EXCLUDED.monto_comision,
        suspendido_por = EXCLUDED.suspendido_por,
        fecha = NOW()
    `, [id, contrato_id, liq.consultor_id, montoComision, motivo || null, req.user.id]);

    // Recalcular monto_comision de la liquidación restando suspensiones activas
    await recalcularMontoLiquidacion(id);

    res.json({ ok: true, mensaje: 'Comisión suspendida correctamente' });
  } catch (err) {
    console.error('Error en PATCH /api/liquidaciones/:id/suspender:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/liquidaciones/:id/reactivar
// Body: { contrato_id }
// Reactiva la comisión de un contrato previamente suspendido
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/reactivar', auth, requireAdminOrDirector, async (req, res) => {
  const { id } = req.params;
  const { contrato_id } = req.body;

  if (!contrato_id) {
    return res.status(400).json({ error: 'contrato_id es requerido' });
  }

  try {
    // Verificar que la liquidación existe y no está pagada
    const liqRes = await pool.query('SELECT * FROM liquidaciones WHERE id = $1', [id]);
    if (liqRes.rows.length === 0) {
      return res.status(404).json({ error: 'Liquidación no encontrada' });
    }
    if (liqRes.rows[0].estado === 'pagada') {
      return res.status(400).json({ error: 'No se puede reactivar comisiones de una liquidación pagada' });
    }

    // Desactivar la suspensión
    const result = await pool.query(
      `UPDATE comisiones_suspendidas SET activo = false WHERE liquidacion_id = $1 AND contrato_id = $2 AND activo = true RETURNING *`,
      [id, contrato_id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontró suspensión activa para este contrato' });
    }

    // Recalcular monto_comision de la liquidación
    await recalcularMontoLiquidacion(id);

    res.json({ ok: true, mensaje: 'Comisión reactivada correctamente' });
  } catch (err) {
    console.error('Error en PATCH /api/liquidaciones/:id/reactivar:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Helper: recalcular monto_comision descontando suspendidas ───────────────
async function recalcularMontoLiquidacion(liquidacionId) {
  const liqRes = await pool.query(
    `SELECT l.*, u.pct_comision_venta, u.pct_desbloqueo
     FROM liquidaciones l
     JOIN usuarios u ON l.consultor_id = u.id
     WHERE l.id = $1`,
    [liquidacionId]
  );
  if (liqRes.rows.length === 0) return;
  const liq = liqRes.rows[0];
  const pctComision = parseFloat(liq.pct_comision_venta || 10);
  const pctDesbloqueo = parseFloat(liq.pct_desbloqueo || 30);

  // Obtener total comisión bruta (sobre monto base, sin intereses)
  const totalRes = await pool.query(`
    SELECT COALESCE(SUM(
      CASE
        WHEN COALESCE(pagado.total, 0) / NULLIF(c.monto_total, 0) * 100 >= $3
        THEN COALESCE(pagado.total_base, 0) * $4 / 100
        ELSE 0
      END
    ), 0) AS comision_bruta
    FROM contratos c
    LEFT JOIN (
      SELECT contrato_id,
             SUM(valor) AS total,
             SUM(valor) - COALESCE((SELECT SUM(monto_interes) FROM cuotas WHERE contrato_id = r_agg.contrato_id AND estado = 'pagado'), 0) AS total_base
      FROM recibos r_agg
      WHERE estado = 'activo'
      GROUP BY contrato_id
    ) pagado ON pagado.contrato_id = c.id
    WHERE c.consultor_id = $1
      AND TO_CHAR(c.fecha_contrato, 'YYYY-MM') = $2
      AND c.estado NOT IN ('cancelado')
  `, [liq.consultor_id, liq.mes, pctDesbloqueo, pctComision]);

  const comisionBruta = parseFloat(totalRes.rows[0].comision_bruta || 0);

  // Obtener total suspendido
  const suspRes = await pool.query(
    `SELECT COALESCE(SUM(monto_comision), 0) AS total_suspendido
     FROM comisiones_suspendidas
     WHERE liquidacion_id = $1 AND activo = true`,
    [liquidacionId]
  );
  const totalSuspendido = parseFloat(suspRes.rows[0].total_suspendido || 0);

  const nuevoMonto = Math.round((comisionBruta - totalSuspendido) * 100) / 100;

  await pool.query(
    `UPDATE liquidaciones SET monto_comision = $1 WHERE id = $2`,
    [Math.max(nuevoMonto, 0), liquidacionId]
  );
}

module.exports = router;
