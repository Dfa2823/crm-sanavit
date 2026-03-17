const express = require('express');
const pool = require('../db');

const router = express.Router();

// Auto-crear tabla nomina_mensual
pool.query(`
  CREATE TABLE IF NOT EXISTS nomina_mensual (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) NOT NULL,
    sala_id INTEGER REFERENCES salas(id),
    mes VARCHAR(7) NOT NULL,
    sueldo_base_config NUMERIC(10,2) DEFAULT 0,
    pct_comision_venta_config NUMERIC(5,2) DEFAULT 0,
    pct_desbloqueo_config NUMERIC(5,2) DEFAULT 30,
    sueldo_base NUMERIC(10,2) DEFAULT 0,
    comision_ventas NUMERIC(10,2) DEFAULT 0,
    comision_cobros NUMERIC(10,2) DEFAULT 0,
    bono_tours NUMERIC(10,2) DEFAULT 0,
    bono_citas NUMERIC(10,2) DEFAULT 0,
    bono_meta NUMERIC(10,2) DEFAULT 0,
    otros_ingresos NUMERIC(10,2) DEFAULT 0,
    contratos_desbloqueados INTEGER DEFAULT 0,
    tours_count INTEGER DEFAULT 0,
    citas_count INTEGER DEFAULT 0,
    aporte_iess NUMERIC(10,2) DEFAULT 0,
    anticipo NUMERIC(10,2) DEFAULT 0,
    otras_deducciones NUMERIC(10,2) DEFAULT 0,
    total_ingresos NUMERIC(10,2) DEFAULT 0,
    total_deducciones NUMERIC(10,2) DEFAULT 0,
    neto_a_pagar NUMERIC(10,2) DEFAULT 0,
    estado VARCHAR(20) DEFAULT 'borrador'
      CHECK (estado IN ('borrador','revision','aprobada','pagada')),
    aprobado_por INTEGER REFERENCES usuarios(id),
    fecha_aprobacion TIMESTAMPTZ,
    fecha_pago TIMESTAMPTZ,
    observaciones TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(usuario_id, mes)
  )
`).catch(console.error);

function requireAdminOrDirector(req, res, next) {
  if (!['admin', 'director'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'No autorizado. Se requiere rol admin o director.' });
  }
  next();
}

// ─── GET /api/nomina ─────────────────────────────────────────────────────────
// ?mes=YYYY-MM&sala_id=X&estado=borrador
// Admin/director: ve todo. Otros roles: solo su propio registro
router.get('/', async (req, res) => {
  const { mes, sala_id, estado } = req.query;
  const mesFiltro = mes || new Date().toISOString().slice(0, 7);
  const { rol, id: userId } = req.user;

  try {
    const params = [mesFiltro];
    const conds = [];
    let idx = 2;

    if (sala_id) { conds.push(`n.sala_id = $${idx++}`); params.push(sala_id); }
    if (estado)  { conds.push(`n.estado = $${idx++}`);  params.push(estado); }

    if (!['admin', 'director'].includes(rol)) {
      conds.push(`n.usuario_id = $${idx++}`);
      params.push(userId);
    }

    const whereExtra = conds.length ? 'AND ' + conds.join(' AND ') : '';

    const result = await pool.query(`
      SELECT
        n.*,
        u.nombre AS usuario_nombre, u.username,
        ro.nombre AS rol, ro.label AS rol_label,
        s.nombre AS sala_nombre,
        ua.nombre AS aprobado_por_nombre
      FROM nomina_mensual n
      JOIN usuarios u ON n.usuario_id = u.id
      JOIN roles ro ON u.rol_id = ro.id
      LEFT JOIN salas s ON n.sala_id = s.id
      LEFT JOIN usuarios ua ON n.aprobado_por = ua.id
      WHERE n.mes = $1 ${whereExtra}
      ORDER BY u.nombre
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error('Error en GET /api/nomina:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/nomina/calcular ───────────────────────────────────────────────
// Body: { mes: 'YYYY-MM', sala_id?: number }
router.post('/calcular', requireAdminOrDirector, async (req, res) => {
  const { mes, sala_id } = req.body;

  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).json({ error: 'El campo mes es requerido con formato YYYY-MM' });
  }

  const salaParam = sala_id ? parseInt(sala_id, 10) : null;

  try {
    // 1. Obtener todos los usuarios activos del período
    const usuariosRes = await pool.query(`
      SELECT id, nombre, sala_id,
        COALESCE(sueldo_base, 0)::numeric        AS sueldo_base,
        COALESCE(pct_comision_venta, 10)::numeric AS pct_comision_venta,
        COALESCE(pct_comision_cobro, 0)::numeric  AS pct_comision_cobro,
        COALESCE(bono_por_tour, 0)::numeric       AS bono_por_tour,
        COALESCE(bono_por_cita, 0)::numeric       AS bono_por_cita,
        COALESCE(pct_desbloqueo, 30)::numeric     AS pct_desbloqueo
      FROM usuarios
      WHERE activo = true
        AND ($1::integer IS NULL OR sala_id = $1)
    `, [salaParam]);

    const resultados = [];

    for (const u of usuariosRes.rows) {
      // 2a. Comisión por ventas (si es consultor con contratos del mes)
      const cvRes = await pool.query(`
        SELECT
          COALESCE(SUM(CASE
            WHEN COALESCE(pagado.total, 0) / NULLIF(c.monto_total, 0) * 100 >= $3
            THEN COALESCE(pagado.total, 0) * $4 / 100
            ELSE 0
          END), 0)::numeric AS comision_ventas,
          COUNT(CASE
            WHEN COALESCE(pagado.total, 0) / NULLIF(c.monto_total, 0) * 100 >= $3
            THEN 1
          END)::integer AS contratos_desbloqueados
        FROM contratos c
        LEFT JOIN (
          SELECT contrato_id, SUM(valor) AS total
          FROM recibos WHERE estado = 'activo'
          GROUP BY contrato_id
        ) pagado ON pagado.contrato_id = c.id
        WHERE c.consultor_id = $1
          AND TO_CHAR(c.fecha_contrato, 'YYYY-MM') = $2
          AND c.estado NOT IN ('cancelado')
      `, [u.id, mes, u.pct_desbloqueo, u.pct_comision_venta]);

      // 2b. Comisión por cobros de cartera
      const ccRes = await pool.query(`
        SELECT COALESCE(SUM(r.valor), 0) * $3 / 100 AS comision_cobros
        FROM recibos r
        JOIN contratos c ON r.contrato_id = c.id
        WHERE c.asesor_cartera_id = $1
          AND TO_CHAR(r.fecha_pago, 'YYYY-MM') = $2
          AND r.estado = 'activo'
      `, [u.id, mes, u.pct_comision_cobro]);

      // 2c. Bono por tours
      // - Consultor/hostess: visitas donde consultor_id = u.id con calificacion TOUR
      // - TMK: leads donde tmk_id = u.id que tuvieron visita con calificacion TOUR
      const tourRes = await pool.query(`
        SELECT (
          -- Tours como consultor en sala
          (SELECT COUNT(*) FROM visitas_sala
           WHERE TO_CHAR(fecha, 'YYYY-MM') = $2
             AND calificacion = 'TOUR'
             AND consultor_id = $1)
          +
          -- Tours como TMK (lead propio que llegó a sala como TOUR)
          (SELECT COUNT(*) FROM leads l
           JOIN visitas_sala vs ON vs.lead_id = l.id
           WHERE l.tmk_id = $1
             AND TO_CHAR(vs.fecha, 'YYYY-MM') = $2
             AND vs.calificacion = 'TOUR')
        )::integer AS tours_count
      `, [u.id, mes]);

      // 2d. Bono por citas confirmadas (confirmador)
      const citaRes = await pool.query(`
        SELECT COUNT(*)::integer AS citas_count
        FROM leads
        WHERE confirmador_id = $1
          AND TO_CHAR(COALESCE(fecha_cita, created_at), 'YYYY-MM') = $2
          AND estado IN ('confirmada', 'tour', 'venta')
      `, [u.id, mes]);

      // 2e. Verificar meta mensual para bono_meta
      let bono_meta = 0;
      const metaRes = await pool.query(
        `SELECT meta_contratos, meta_ventas_monto, meta_tours, bono_cumplimiento
         FROM metas_mensuales WHERE usuario_id = $1 AND mes = $2`,
        [u.id, mes]
      );
      if (metaRes.rows.length > 0) {
        const meta = metaRes.rows[0];
        const realContratosRes = await pool.query(
          `SELECT COUNT(*)::integer AS total,
                  COALESCE(SUM(monto_total), 0)::numeric AS monto
           FROM contratos
           WHERE consultor_id = $1 AND TO_CHAR(fecha_contrato,'YYYY-MM') = $2 AND estado NOT IN ('cancelado')`,
          [u.id, mes]
        );
        const realTours = parseInt(tourRes.rows[0].tours_count) || 0;
        const realContratos = parseInt(realContratosRes.rows[0].total) || 0;
        const realMonto = parseFloat(realContratosRes.rows[0].monto) || 0;
        const checks = [];
        if (Number(meta.meta_contratos) > 0)    checks.push(realContratos >= Number(meta.meta_contratos));
        if (Number(meta.meta_ventas_monto) > 0)  checks.push(realMonto >= Number(meta.meta_ventas_monto));
        if (Number(meta.meta_tours) > 0)         checks.push(realTours >= Number(meta.meta_tours));
        if (checks.length > 0 && checks.every(Boolean)) {
          bono_meta = parseFloat(meta.bono_cumplimiento) || 0;
        }
      }

      // 3. Calcular totales
      const sueldo_base          = parseFloat(u.sueldo_base);
      const comision_ventas      = parseFloat(cvRes.rows[0].comision_ventas) || 0;
      const contratos_desbloq    = parseInt(cvRes.rows[0].contratos_desbloqueados) || 0;
      const comision_cobros      = parseFloat(ccRes.rows[0].comision_cobros) || 0;
      const tours_count          = parseInt(tourRes.rows[0].tours_count) || 0;
      const citas_count          = parseInt(citaRes.rows[0].citas_count) || 0;
      const bono_tours           = parseFloat((tours_count * parseFloat(u.bono_por_tour)).toFixed(2));
      const bono_citas           = parseFloat((citas_count * parseFloat(u.bono_por_cita)).toFixed(2));
      const aporte_iess          = parseFloat((sueldo_base * 0.0945).toFixed(2));
      const total_ingresos       = parseFloat((sueldo_base + comision_ventas + comision_cobros + bono_tours + bono_citas + bono_meta).toFixed(2));
      const total_deducciones    = aporte_iess;
      const neto_a_pagar         = parseFloat((total_ingresos - total_deducciones).toFixed(2));

      resultados.push({
        usuario_id: u.id, sala_id: u.sala_id, mes,
        sueldo_base_config: sueldo_base,
        pct_comision_venta_config: parseFloat(u.pct_comision_venta),
        pct_desbloqueo_config: parseFloat(u.pct_desbloqueo),
        sueldo_base, comision_ventas, comision_cobros,
        bono_tours, bono_citas, bono_meta,
        contratos_desbloqueados: contratos_desbloq,
        tours_count, citas_count,
        aporte_iess, total_ingresos, total_deducciones, neto_a_pagar,
      });
    }

    // 4. INSERT o UPDATE si estado = 'borrador'
    for (const r of resultados) {
      await pool.query(`
        INSERT INTO nomina_mensual (
          usuario_id, sala_id, mes,
          sueldo_base_config, pct_comision_venta_config, pct_desbloqueo_config,
          sueldo_base, comision_ventas, comision_cobros, bono_tours, bono_citas, bono_meta,
          contratos_desbloqueados, tours_count, citas_count,
          aporte_iess, total_ingresos, total_deducciones, neto_a_pagar
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
        ON CONFLICT (usuario_id, mes) DO UPDATE SET
          sala_id                   = EXCLUDED.sala_id,
          sueldo_base_config        = EXCLUDED.sueldo_base_config,
          pct_comision_venta_config = EXCLUDED.pct_comision_venta_config,
          pct_desbloqueo_config     = EXCLUDED.pct_desbloqueo_config,
          sueldo_base               = EXCLUDED.sueldo_base,
          comision_ventas           = EXCLUDED.comision_ventas,
          comision_cobros           = EXCLUDED.comision_cobros,
          bono_tours                = EXCLUDED.bono_tours,
          bono_citas                = EXCLUDED.bono_citas,
          bono_meta                 = EXCLUDED.bono_meta,
          contratos_desbloqueados   = EXCLUDED.contratos_desbloqueados,
          tours_count               = EXCLUDED.tours_count,
          citas_count               = EXCLUDED.citas_count,
          aporte_iess               = EXCLUDED.aporte_iess,
          total_ingresos            = EXCLUDED.total_ingresos,
          total_deducciones         = EXCLUDED.total_deducciones,
          neto_a_pagar              = EXCLUDED.neto_a_pagar,
          updated_at                = NOW()
        WHERE nomina_mensual.estado = 'borrador'
      `, [
        r.usuario_id, r.sala_id, r.mes,
        r.sueldo_base_config, r.pct_comision_venta_config, r.pct_desbloqueo_config,
        r.sueldo_base, r.comision_ventas, r.comision_cobros, r.bono_tours, r.bono_citas, r.bono_meta,
        r.contratos_desbloqueados, r.tours_count, r.citas_count,
        r.aporte_iess, r.total_ingresos, r.total_deducciones, r.neto_a_pagar,
      ]);
    }

    // 5. Retornar lista actualizada
    const lista = await pool.query(`
      SELECT n.*, u.nombre AS usuario_nombre, u.username,
        ro.nombre AS rol, ro.label AS rol_label, s.nombre AS sala_nombre
      FROM nomina_mensual n
      JOIN usuarios u ON n.usuario_id = u.id
      JOIN roles ro ON u.rol_id = ro.id
      LEFT JOIN salas s ON n.sala_id = s.id
      WHERE n.mes = $1 AND ($2::integer IS NULL OR n.sala_id = $2)
      ORDER BY u.nombre
    `, [mes, salaParam]);

    res.json(lista.rows);
  } catch (err) {
    console.error('Error en POST /api/nomina/calcular:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/nomina/reporte/:mes ────────────────────────────────────────────
router.get('/reporte/:mes', requireAdminOrDirector, async (req, res) => {
  const { mes } = req.params;
  const { sala_id } = req.query;
  const salaParam = sala_id ? parseInt(sala_id, 10) : null;

  try {
    const result = await pool.query(`
      SELECT n.*, u.nombre AS usuario_nombre, u.username,
        ro.nombre AS rol, ro.label AS rol_label, s.nombre AS sala_nombre
      FROM nomina_mensual n
      JOIN usuarios u ON n.usuario_id = u.id
      JOIN roles ro ON u.rol_id = ro.id
      LEFT JOIN salas s ON n.sala_id = s.id
      WHERE n.mes = $1 AND ($2::integer IS NULL OR n.sala_id = $2)
      ORDER BY u.nombre
    `, [mes, salaParam]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error en GET /api/nomina/reporte/:mes:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/nomina/:id ───────────────────────────────────────────────────
// Ajustes manuales + cambio de estado
router.patch('/:id', requireAdminOrDirector, async (req, res) => {
  const { id } = req.params;
  const { estado, otros_ingresos, anticipo, otras_deducciones, observaciones } = req.body;

  try {
    const actual = await pool.query(
      'SELECT * FROM nomina_mensual WHERE id = $1',
      [id]
    );
    if (!actual.rows.length) return res.status(404).json({ error: 'Registro no encontrado' });

    const reg = actual.rows[0];
    if (reg.estado === 'pagada') {
      return res.status(400).json({ error: 'No se puede modificar una nómina pagada' });
    }

    // Calcular nuevos totales con ajustes
    const new_otros     = otros_ingresos !== undefined    ? parseFloat(otros_ingresos)    : parseFloat(reg.otros_ingresos || 0);
    const new_anticipo  = anticipo !== undefined           ? parseFloat(anticipo)           : parseFloat(reg.anticipo || 0);
    const new_otras_ded = otras_deducciones !== undefined  ? parseFloat(otras_deducciones)  : parseFloat(reg.otras_deducciones || 0);

    const total_ingresos = parseFloat((
      parseFloat(reg.sueldo_base) + parseFloat(reg.comision_ventas) +
      parseFloat(reg.comision_cobros) + parseFloat(reg.bono_tours) +
      parseFloat(reg.bono_citas) + parseFloat(reg.bono_meta || 0) + new_otros
    ).toFixed(2));

    const total_deducciones = parseFloat((parseFloat(reg.aporte_iess) + new_anticipo + new_otras_ded).toFixed(2));
    const neto_a_pagar = parseFloat((total_ingresos - total_deducciones).toFixed(2));

    const updates = [
      'otros_ingresos = $2', 'anticipo = $3', 'otras_deducciones = $4',
      'total_ingresos = $5', 'total_deducciones = $6', 'neto_a_pagar = $7',
      'updated_at = NOW()',
    ];
    const params = [id, new_otros, new_anticipo, new_otras_ded, total_ingresos, total_deducciones, neto_a_pagar];
    let pIdx = 8;

    if (observaciones !== undefined) { updates.push(`observaciones = $${pIdx}`); params.push(observaciones); pIdx++; }

    if (estado && ['revision', 'aprobada', 'pagada'].includes(estado)) {
      updates.push(`estado = $${pIdx}`); params.push(estado); pIdx++;
      if (estado === 'aprobada') {
        updates.push('fecha_aprobacion = NOW()');
        updates.push(`aprobado_por = $${pIdx}`); params.push(req.user.id); pIdx++;
      } else if (estado === 'pagada') {
        updates.push('fecha_pago = NOW()');
      }
    }

    await pool.query(`UPDATE nomina_mensual SET ${updates.join(', ')} WHERE id = $1`, params);

    const updated = await pool.query(`
      SELECT n.*, u.nombre AS usuario_nombre, ro.nombre AS rol, ro.label AS rol_label,
        s.nombre AS sala_nombre, ua.nombre AS aprobado_por_nombre
      FROM nomina_mensual n
      JOIN usuarios u ON n.usuario_id = u.id
      JOIN roles ro ON u.rol_id = ro.id
      LEFT JOIN salas s ON n.sala_id = s.id
      LEFT JOIN usuarios ua ON n.aprobado_por = ua.id
      WHERE n.id = $1
    `, [id]);

    res.json(updated.rows[0]);
  } catch (err) {
    console.error('Error en PATCH /api/nomina/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
