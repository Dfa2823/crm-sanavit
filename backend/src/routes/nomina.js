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

// Auto-migraciones: columnas avanzadas de nómina
(async () => {
  try {
    await pool.query(`
      ALTER TABLE nomina_mensual ADD COLUMN IF NOT EXISTS comision_venta_recurrente NUMERIC(10,2) DEFAULT 0;
      ALTER TABLE nomina_mensual ADD COLUMN IF NOT EXISTS comision_abonos_cartera NUMERIC(10,2) DEFAULT 0;
      ALTER TABLE nomina_mensual ADD COLUMN IF NOT EXISTS comision_reactivaciones NUMERIC(10,2) DEFAULT 0;
      ALTER TABLE nomina_mensual ADD COLUMN IF NOT EXISTS comisiones_suspendidas JSONB DEFAULT '[]';
      ALTER TABLE nomina_mensual ADD COLUMN IF NOT EXISTS dias_trabajados INTEGER DEFAULT 0;
      ALTER TABLE nomina_mensual ADD COLUMN IF NOT EXISTS dias_laborables INTEGER DEFAULT 0;
      ALTER TABLE nomina_mensual ADD COLUMN IF NOT EXISTS garantizado NUMERIC(10,2) DEFAULT 0;
      ALTER TABLE nomina_mensual ADD COLUMN IF NOT EXISTS comision_arrastre_tmk NUMERIC(10,2) DEFAULT 0;
      ALTER TABLE nomina_mensual ADD COLUMN IF NOT EXISTS desglose_semanal_tmk JSONB DEFAULT NULL;
    `);

    // Tabla de escalas de comisión TMK por tours semanales
    await pool.query(`
      CREATE TABLE IF NOT EXISTS escalas_tmk (
        id SERIAL PRIMARY KEY,
        tours_min INTEGER NOT NULL,
        tours_max INTEGER NOT NULL,
        bono_por_tour NUMERIC(10,2) NOT NULL,
        bono_semanal NUMERIC(10,2) DEFAULT 0,
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Seed data si la tabla está vacía
    const countRes = await pool.query('SELECT COUNT(*)::integer AS total FROM escalas_tmk');
    if (parseInt(countRes.rows[0].total) === 0) {
      await pool.query(`
        INSERT INTO escalas_tmk (tours_min, tours_max, bono_por_tour, bono_semanal) VALUES
          (1, 2, 5.00, 0.00),
          (3, 4, 8.00, 15.00),
          (5, 6, 10.00, 30.00),
          (7, 999, 12.00, 50.00)
      `);
      console.log('Seed: escalas_tmk insertadas');
    }

    // Tabla de asistencia
    await pool.query(`
      CREATE TABLE IF NOT EXISTS asistencia (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) NOT NULL,
        sala_id INTEGER REFERENCES salas(id),
        fecha DATE NOT NULL,
        hora_entrada TIME,
        hora_salida TIME,
        estado VARCHAR(20) DEFAULT 'presente'
          CHECK (estado IN ('presente','ausente','tardanza','permiso','vacacion')),
        justificacion TEXT,
        registrado_por INTEGER REFERENCES usuarios(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(usuario_id, fecha)
      )
    `);
    // ─── Auto-migración: tipo_liquidacion para nómina quincenal ─────────
    await pool.query(`
      ALTER TABLE nomina_mensual ADD COLUMN IF NOT EXISTS tipo_liquidacion VARCHAR(20) DEFAULT 'completa';
    `);
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE nomina_mensual DROP CONSTRAINT IF EXISTS nomina_mensual_usuario_id_mes_key;
        ALTER TABLE nomina_mensual ADD CONSTRAINT nomina_mensual_usuario_mes_tipo_key UNIQUE(usuario_id, mes, tipo_liquidacion);
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);
  } catch (e) { /* ya existen */ }
})();

function requireAdminOrDirector(req, res, next) {
  if (!['admin', 'director'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'No autorizado. Se requiere rol admin o director.' });
  }
  next();
}

// ─── GET /api/nomina ─────────────────────────────────────────────────────────
// ?mes=YYYY-MM&sala_id=X&estado=borrador&tipo_liquidacion=completa
// Admin/director: ve todo. Otros roles: solo su propio registro
router.get('/', async (req, res) => {
  const { mes, sala_id, estado, tipo_liquidacion } = req.query;
  const mesFiltro = mes || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' }).slice(0, 7);
  const { rol, id: userId } = req.user;

  try {
    const params = [mesFiltro];
    const conds = [];
    let idx = 2;

    if (sala_id)          { conds.push(`n.sala_id = $${idx++}`);          params.push(sala_id); }
    if (estado)           { conds.push(`n.estado = $${idx++}`);           params.push(estado); }
    if (tipo_liquidacion) { conds.push(`n.tipo_liquidacion = $${idx++}`); params.push(tipo_liquidacion); }

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

/**
 * @openapi
 * /api/nomina/calcular:
 *   post:
 *     tags: [Nomina]
 *     summary: Calcular nomina mensual
 *     description: Calcula la nomina de todos los empleados para un mes dado. Incluye sueldo base, comisiones, bonos y deducciones. Solo admin o director.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mes]
 *             properties:
 *               mes:
 *                 type: string
 *                 example: '2026-03'
 *                 description: Periodo en formato YYYY-MM
 *               sala_id:
 *                 type: integer
 *               tipo_liquidacion:
 *                 type: string
 *                 enum: [garantizado, comisiones, completa]
 *                 default: completa
 *     responses:
 *       200:
 *         description: Nomina calculada para todos los empleados del periodo
 *       403:
 *         description: Sin permiso
 */
router.post('/calcular', requireAdminOrDirector, async (req, res) => {
  const { mes, sala_id, tipo_liquidacion: tipoLiq = 'completa' } = req.body;

  if (!['garantizado', 'comisiones', 'completa'].includes(tipoLiq)) {
    return res.status(400).json({ error: 'tipo_liquidacion debe ser: garantizado, comisiones o completa' });
  }

  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).json({ error: 'El campo mes es requerido con formato YYYY-MM' });
  }

  const salaParam = sala_id ? parseInt(sala_id, 10) : null;

  try {
    // 1. Obtener todos los usuarios activos del período
    const usuariosRes = await pool.query(`
      SELECT u.id, u.nombre, u.sala_id,
        COALESCE(u.sueldo_base, 0)::numeric        AS sueldo_base,
        COALESCE(u.pct_comision_venta, 10)::numeric AS pct_comision_venta,
        COALESCE(u.pct_comision_cobro, 0)::numeric  AS pct_comision_cobro,
        COALESCE(u.bono_por_tour, 0)::numeric       AS bono_por_tour,
        COALESCE(u.bono_por_cita, 0)::numeric       AS bono_por_cita,
        COALESCE(u.pct_desbloqueo, 30)::numeric     AS pct_desbloqueo,
        ro.nombre AS rol_nombre
      FROM usuarios u
      JOIN roles ro ON u.rol_id = ro.id
      WHERE u.activo = true
        AND ($1::integer IS NULL OR u.sala_id = $1)
    `, [salaParam]);

    // Cargar escalas TMK activas (ordenadas por tours_min)
    const escalasRes = await pool.query(
      'SELECT * FROM escalas_tmk WHERE activo = true ORDER BY tours_min ASC'
    );
    const escalasTmk = escalasRes.rows;

    const resultados = [];

    for (const u of usuariosRes.rows) {
      // 2a. Comisión por ventas (si es consultor con contratos del mes)
      // REQ2: Comisión sobre monto BASE (sin intereses). Se resta monto_interes de cuotas pagadas.
      const cvRes = await pool.query(`
        SELECT
          COALESCE(SUM(CASE
            WHEN COALESCE(pagado.total, 0) / NULLIF(c.monto_total, 0) * 100 >= $3
            THEN COALESCE(pagado.total_base, 0) * $4 / 100
            ELSE 0
          END), 0)::numeric AS comision_ventas,
          COUNT(CASE
            WHEN COALESCE(pagado.total, 0) / NULLIF(c.monto_total, 0) * 100 >= $3
            THEN 1
          END)::integer AS contratos_desbloqueados
        FROM contratos c
        LEFT JOIN (
          SELECT r.contrato_id,
                 SUM(r.valor) AS total,
                 SUM(r.valor) - COALESCE((SELECT SUM(COALESCE(cu.monto_interes, 0)) FROM cuotas cu WHERE cu.contrato_id = r.contrato_id AND cu.estado = 'pagado'), 0) AS total_base
          FROM recibos r WHERE r.estado = 'activo'
          GROUP BY r.contrato_id
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

      // 2f. Asistencia — calcular días trabajados y garantizado
      const asistRes = await pool.query(`
        SELECT COUNT(*)::integer AS dias_trabajados
        FROM asistencia
        WHERE usuario_id = $1 AND TO_CHAR(fecha, 'YYYY-MM') = $2
          AND estado IN ('presente', 'tardanza')
      `, [u.id, mes]);
      const dias_trabajados = parseInt(asistRes.rows[0]?.dias_trabajados) || 0;

      // Días laborables del mes (L-V aproximado)
      const [anio, mesNum] = mes.split('-').map(Number);
      const diasEnMes = new Date(anio, mesNum, 0).getDate();
      let dias_laborables = 0;
      for (let d = 1; d <= diasEnMes; d++) {
        const dow = new Date(anio, mesNum - 1, d).getDay();
        if (dow !== 0 && dow !== 6) dias_laborables++;
      }

      // 2g. Comisión por abonos a cartera de meses anteriores (consultor)
      // REQ2: Comisión sobre monto base (sin intereses). Se descuenta la porción de interés
      // proporcional a los pagos del período sobre contratos de meses anteriores.
      const abonosRes = await pool.query(`
        SELECT COALESCE(
          SUM(r.valor) - COALESCE((
            SELECT SUM(COALESCE(cu.monto_interes, 0))
            FROM cuotas cu
            WHERE cu.contrato_id IN (
              SELECT DISTINCT r2.contrato_id FROM recibos r2
              JOIN contratos c2 ON r2.contrato_id = c2.id
              WHERE c2.consultor_id = $1
                AND TO_CHAR(r2.fecha_pago, 'YYYY-MM') = $2
                AND TO_CHAR(c2.fecha_contrato, 'YYYY-MM') != $2
                AND r2.estado = 'activo'
                AND c2.estado NOT IN ('cancelado')
            )
            AND cu.estado = 'pagado'
            AND TO_CHAR(cu.updated_at, 'YYYY-MM') = $2
          ), 0)
        , 0) * $3 / 100 AS comision_abonos
        FROM recibos r
        JOIN contratos c ON r.contrato_id = c.id
        WHERE c.consultor_id = $1
          AND TO_CHAR(r.fecha_pago, 'YYYY-MM') = $2
          AND TO_CHAR(c.fecha_contrato, 'YYYY-MM') != $2
          AND r.estado = 'activo'
          AND c.estado NOT IN ('cancelado')
      `, [u.id, mes, u.pct_comision_venta]);

      // 2g-bis. Arrastre de cartera para TMK: recibos pagados en el período
      // sobre contratos de meses anteriores cuyo lead original pertenecía a este TMK.
      // Traza: recibos → contratos → visita_sala → leads → tmk_id
      // Solo se paga si el usuario tiene pct_comision_cobro > 0 y está activo.
      const arrastreTmkRes = await pool.query(`
        SELECT COALESCE(SUM(r.valor), 0) * $3 / 100 AS comision_arrastre_tmk
        FROM recibos r
        JOIN contratos c ON r.contrato_id = c.id
        LEFT JOIN visitas_sala vs ON c.visita_sala_id = vs.id
        LEFT JOIN leads l ON vs.lead_id = l.id
        WHERE l.tmk_id = $1
          AND TO_CHAR(r.fecha_pago, 'YYYY-MM') = $2
          AND TO_CHAR(c.fecha_contrato, 'YYYY-MM') != $2
          AND r.estado = 'activo'
          AND c.estado NOT IN ('cancelado')
      `, [u.id, mes, u.pct_comision_cobro]);

      // 2h. Comisión por ventas reactivadas en el período
      const reactivRes = await pool.query(`
        SELECT COALESCE(SUM(COALESCE(pagado.total, 0)) * $3 / 100, 0) AS comision_react
        FROM contratos c
        LEFT JOIN (SELECT contrato_id, SUM(valor) AS total FROM recibos WHERE estado='activo' GROUP BY contrato_id) pagado ON pagado.contrato_id = c.id
        WHERE c.consultor_id = $1
          AND TO_CHAR(c.updated_at, 'YYYY-MM') = $2
          AND TO_CHAR(c.fecha_contrato, 'YYYY-MM') != $2
          AND c.estado = 'activo'
      `, [u.id, mes, u.pct_comision_venta]);

      // 3. Calcular totales
      const sueldo_base_cfg      = parseFloat(u.sueldo_base);
      // Garantizado: proporcional a días trabajados (si hay asistencia registrada)
      const garantizado          = dias_trabajados > 0
        ? parseFloat((sueldo_base_cfg * dias_trabajados / Math.max(dias_laborables, 1)).toFixed(2))
        : sueldo_base_cfg; // Si no hay asistencia registrada, paga completo
      const comision_venta_recurrente = parseFloat(cvRes.rows[0].comision_ventas) || 0;
      const comision_abonos_cartera   = parseFloat(abonosRes.rows[0]?.comision_abonos) || 0;
      const comision_reactivaciones   = parseFloat(reactivRes.rows[0]?.comision_react) || 0;
      const comision_ventas      = comision_venta_recurrente + comision_abonos_cartera + comision_reactivaciones;
      const contratos_desbloq    = parseInt(cvRes.rows[0].contratos_desbloqueados) || 0;
      // Cobros de cartera: asesor_cartera + arrastre TMK (pagos de clientes viejos en este corte)
      const comision_cobros_asesor = parseFloat(ccRes.rows[0].comision_cobros) || 0;
      const comision_arrastre_tmk  = parseFloat(arrastreTmkRes.rows[0]?.comision_arrastre_tmk) || 0;
      const comision_cobros        = parseFloat((comision_cobros_asesor + comision_arrastre_tmk).toFixed(2));
      const tours_count          = parseInt(tourRes.rows[0].tours_count) || 0;
      const citas_count          = parseInt(citaRes.rows[0].citas_count) || 0;

      // ─── Cálculo de bono_tours: escalas semanales para TMK ─────────────
      let bono_tours = 0;
      let desglose_semanal_tmk = null;

      if (u.rol_nombre === 'tmk' && escalasTmk.length > 0) {
        const [anioM, mesM] = mes.split('-').map(Number);
        const diasMes = new Date(anioM, mesM, 0).getDate();

        // Agrupar días del mes en semanas (lunes a domingo)
        const semanas = {};
        for (let d = 1; d <= diasMes; d++) {
          const fecha = new Date(anioM, mesM - 1, d);
          const dow = fecha.getDay();
          const diffToMon = dow === 0 ? -6 : 1 - dow;
          const lunes = new Date(fecha);
          lunes.setDate(fecha.getDate() + diffToMon);
          const semKey = lunes.toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
          if (!semanas[semKey]) {
            semanas[semKey] = { inicio: semKey, tours: 0 };
          }
        }

        // Contar tours TMK por semana
        const toursSemRes = await pool.query(`
          SELECT vs.fecha::date AS fecha_tour
          FROM leads l
          JOIN visitas_sala vs ON vs.lead_id = l.id
          WHERE l.tmk_id = $1
            AND TO_CHAR(vs.fecha, 'YYYY-MM') = $2
            AND vs.calificacion = 'TOUR'
        `, [u.id, mes]);

        for (const row of toursSemRes.rows) {
          const ft = new Date(row.fecha_tour);
          const dow = ft.getDay();
          const diffToMon = dow === 0 ? -6 : 1 - dow;
          const lunes = new Date(ft);
          lunes.setDate(ft.getDate() + diffToMon);
          const semKey = lunes.toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
          if (semanas[semKey]) {
            semanas[semKey].tours++;
          } else {
            semanas[semKey] = { inicio: semKey, tours: 1 };
          }
        }

        // Aplicar escalas y calcular desglose
        const desglose = [];
        for (const [semKey, sem] of Object.entries(semanas).sort()) {
          if (sem.tours === 0) continue;
          let escala = escalasTmk.find(e => sem.tours >= e.tours_min && sem.tours <= e.tours_max);
          if (!escala) escala = escalasTmk[escalasTmk.length - 1];
          const bonoToursSem = escala ? parseFloat((sem.tours * parseFloat(escala.bono_por_tour)).toFixed(2)) : 0;
          const bonoSemanal = escala ? parseFloat(escala.bono_semanal) : 0;
          const totalSem = parseFloat((bonoToursSem + bonoSemanal).toFixed(2));
          bono_tours += totalSem;
          desglose.push({
            semana_inicio: semKey,
            tours: sem.tours,
            bono_por_tour: escala ? parseFloat(escala.bono_por_tour) : 0,
            bono_tours_sem: bonoToursSem,
            bono_semanal: bonoSemanal,
            total_semana: totalSem,
          });
        }
        bono_tours = parseFloat(bono_tours.toFixed(2));
        desglose_semanal_tmk = desglose.length > 0 ? desglose : null;
      } else {
        bono_tours = parseFloat((tours_count * parseFloat(u.bono_por_tour)).toFixed(2));
      }

      const bono_citas           = parseFloat((citas_count * parseFloat(u.bono_por_cita)).toFixed(2));

      // ─── Filtrar según tipo de liquidación ─────────────────────────
      let calc_garantizado, calc_comision_ventas, calc_comision_cobros, calc_bono_tours, calc_bono_citas, calc_bono_meta, calc_aporte_iess;

      if (tipoLiq === 'garantizado') {
        // 1er viernes: primera quincena del garantizado (mitad del sueldo base proporcional)
        // IESS se aplica completo aquí (sobre el sueldo base total, no sobre la mitad)
        calc_garantizado = parseFloat((garantizado / 2).toFixed(2));
        calc_comision_ventas = 0;
        calc_comision_cobros = 0;
        calc_bono_tours = 0;
        calc_bono_citas = 0;
        calc_bono_meta = 0;
        calc_aporte_iess = parseFloat((garantizado * 0.0945).toFixed(2));
      } else if (tipoLiq === 'comisiones') {
        // 3er viernes: segunda quincena del garantizado + comisiones + bonos + arrastre
        calc_garantizado = parseFloat((garantizado / 2).toFixed(2));
        calc_comision_ventas = comision_ventas;
        calc_comision_cobros = comision_cobros;
        calc_bono_tours = bono_tours;
        calc_bono_citas = bono_citas;
        calc_bono_meta = bono_meta;
        calc_aporte_iess = 0; // IESS ya se descontó en la primera quincena
      } else {
        // completa: todo junto
        calc_garantizado = garantizado;
        calc_comision_ventas = comision_ventas;
        calc_comision_cobros = comision_cobros;
        calc_bono_tours = bono_tours;
        calc_bono_citas = bono_citas;
        calc_bono_meta = bono_meta;
        calc_aporte_iess = parseFloat((garantizado * 0.0945).toFixed(2));
      }

      const aporte_iess          = calc_aporte_iess;
      const total_ingresos       = parseFloat((calc_garantizado + calc_comision_ventas + calc_comision_cobros + calc_bono_tours + calc_bono_citas + calc_bono_meta).toFixed(2));
      const total_deducciones    = aporte_iess;
      const neto_a_pagar         = parseFloat((total_ingresos - total_deducciones).toFixed(2));

      resultados.push({
        usuario_id: u.id, sala_id: u.sala_id, mes,
        tipo_liquidacion: tipoLiq,
        sueldo_base_config: sueldo_base_cfg,
        pct_comision_venta_config: parseFloat(u.pct_comision_venta),
        pct_desbloqueo_config: parseFloat(u.pct_desbloqueo),
        sueldo_base: calc_garantizado, comision_ventas: calc_comision_ventas, comision_cobros: calc_comision_cobros,
        comision_venta_recurrente: tipoLiq === 'garantizado' ? 0 : comision_venta_recurrente,
        comision_abonos_cartera: tipoLiq === 'garantizado' ? 0 : comision_abonos_cartera,
        comision_reactivaciones: tipoLiq === 'garantizado' ? 0 : comision_reactivaciones,
        comision_arrastre_tmk: tipoLiq === 'garantizado' ? 0 : comision_arrastre_tmk,
        bono_tours: calc_bono_tours, bono_citas: calc_bono_citas, bono_meta: calc_bono_meta,
        contratos_desbloqueados: contratos_desbloq,
        tours_count, citas_count,
        dias_trabajados, dias_laborables, garantizado,
        aporte_iess, total_ingresos, total_deducciones, neto_a_pagar,
        desglose_semanal_tmk: tipoLiq === 'garantizado' ? null : desglose_semanal_tmk,
      });
    }

    // 4. INSERT o UPDATE si estado = 'borrador'
    for (const r of resultados) {
      await pool.query(`
        INSERT INTO nomina_mensual (
          usuario_id, sala_id, mes, tipo_liquidacion,
          sueldo_base_config, pct_comision_venta_config, pct_desbloqueo_config,
          sueldo_base, comision_ventas, comision_cobros, bono_tours, bono_citas, bono_meta,
          comision_venta_recurrente, comision_abonos_cartera, comision_reactivaciones,
          comision_arrastre_tmk,
          contratos_desbloqueados, tours_count, citas_count,
          dias_trabajados, dias_laborables, garantizado,
          aporte_iess, total_ingresos, total_deducciones, neto_a_pagar,
          desglose_semanal_tmk
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
        ON CONFLICT (usuario_id, mes, tipo_liquidacion) DO UPDATE SET
          sala_id                     = EXCLUDED.sala_id,
          sueldo_base_config          = EXCLUDED.sueldo_base_config,
          pct_comision_venta_config   = EXCLUDED.pct_comision_venta_config,
          pct_desbloqueo_config       = EXCLUDED.pct_desbloqueo_config,
          sueldo_base                 = EXCLUDED.sueldo_base,
          comision_ventas             = EXCLUDED.comision_ventas,
          comision_cobros             = EXCLUDED.comision_cobros,
          bono_tours                  = EXCLUDED.bono_tours,
          bono_citas                  = EXCLUDED.bono_citas,
          bono_meta                   = EXCLUDED.bono_meta,
          comision_venta_recurrente   = EXCLUDED.comision_venta_recurrente,
          comision_abonos_cartera     = EXCLUDED.comision_abonos_cartera,
          comision_reactivaciones     = EXCLUDED.comision_reactivaciones,
          comision_arrastre_tmk       = EXCLUDED.comision_arrastre_tmk,
          contratos_desbloqueados     = EXCLUDED.contratos_desbloqueados,
          tours_count                 = EXCLUDED.tours_count,
          citas_count                 = EXCLUDED.citas_count,
          dias_trabajados             = EXCLUDED.dias_trabajados,
          dias_laborables             = EXCLUDED.dias_laborables,
          garantizado                 = EXCLUDED.garantizado,
          aporte_iess                 = EXCLUDED.aporte_iess,
          total_ingresos              = EXCLUDED.total_ingresos,
          total_deducciones           = EXCLUDED.total_deducciones,
          neto_a_pagar                = EXCLUDED.neto_a_pagar,
          desglose_semanal_tmk        = EXCLUDED.desglose_semanal_tmk,
          updated_at                  = NOW()
        WHERE nomina_mensual.estado = 'borrador'
      `, [
        r.usuario_id, r.sala_id, r.mes, r.tipo_liquidacion,
        r.sueldo_base_config, r.pct_comision_venta_config, r.pct_desbloqueo_config,
        r.sueldo_base, r.comision_ventas, r.comision_cobros, r.bono_tours, r.bono_citas, r.bono_meta,
        r.comision_venta_recurrente, r.comision_abonos_cartera, r.comision_reactivaciones,
        r.comision_arrastre_tmk,
        r.contratos_desbloqueados, r.tours_count, r.citas_count,
        r.dias_trabajados, r.dias_laborables, r.garantizado,
        r.aporte_iess, r.total_ingresos, r.total_deducciones, r.neto_a_pagar,
        r.desglose_semanal_tmk ? JSON.stringify(r.desglose_semanal_tmk) : null,
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
        AND n.tipo_liquidacion = $3
      ORDER BY u.nombre
    `, [mes, salaParam, tipoLiq]);

    req.audit('calcular_nomina', 'nomina_mensual', null, { mes, tipo_liquidacion: tipoLiq, sala_id: salaParam, empleados: resultados.length });

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

// ─── GET /api/nomina/:id ────────────────────────────────────────────────────
// NOTA: Esta ruta debe estar DESPUÉS de /asistencia, /reporte-validacion, etc.
router.get('/:id(\\d+)', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT n.*, u.nombre, r.nombre as rol
       FROM nomina_mensual n
       JOIN usuarios u ON n.usuario_id = u.id
       JOIN roles r ON u.rol_id = r.id
       WHERE n.id = $1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});

// ─── PATCH /api/nomina/:id ───────────────────────────────────────────────────
// Ajustes manuales + cambio de estado
router.patch('/:id(\\d+)', requireAdminOrDirector, async (req, res) => {
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

    if (estado) {
      req.audit('cambiar_estado_nomina', 'nomina_mensual', id, { estado, usuario_id: reg.usuario_id, mes: reg.mes });
    }

    res.json(updated.rows[0]);
  } catch (err) {
    console.error('Error en PATCH /api/nomina/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── ASISTENCIA ─────────────────────────────────────────────────────────────

// GET /api/nomina/asistencia?mes=YYYY-MM&sala_id=X
router.get('/asistencia', async (req, res) => {
  const { mes, sala_id } = req.query;
  if (!mes) return res.status(400).json({ error: 'mes requerido (YYYY-MM)' });
  try {
    const params = [mes];
    let salaFilter = '';
    if (sala_id) { params.push(sala_id); salaFilter = `AND a.sala_id = $${params.length}`; }

    const result = await pool.query(`
      SELECT a.*, u.nombre AS usuario_nombre, r.nombre AS rol
      FROM asistencia a
      JOIN usuarios u ON a.usuario_id = u.id
      JOIN roles r ON u.rol_id = r.id
      WHERE TO_CHAR(a.fecha, 'YYYY-MM') = $1 ${salaFilter}
      ORDER BY a.fecha DESC, u.nombre
    `, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/nomina/asistencia — registrar asistencia
router.post('/asistencia', async (req, res) => {
  const { usuario_id, fecha, hora_entrada, hora_salida, estado = 'presente', justificacion, sala_id } = req.body;
  if (!usuario_id || !fecha) return res.status(400).json({ error: 'usuario_id y fecha requeridos' });

  // Solo admin, director, hostess, supervisor_cc pueden registrar
  const allowed = ['admin', 'director', 'hostess', 'supervisor_cc'];
  if (!allowed.includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso para registrar asistencia' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO asistencia (usuario_id, sala_id, fecha, hora_entrada, hora_salida, estado, justificacion, registrado_por)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (usuario_id, fecha) DO UPDATE SET
        hora_entrada = EXCLUDED.hora_entrada,
        hora_salida = EXCLUDED.hora_salida,
        estado = EXCLUDED.estado,
        justificacion = EXCLUDED.justificacion,
        registrado_por = EXCLUDED.registrado_por
      RETURNING *
    `, [usuario_id, sala_id || req.user.sala_id, fecha, hora_entrada || null, hora_salida || null, estado, justificacion || null, req.user.id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/nomina/asistencia/resumen?usuario_id=X&mes=YYYY-MM
router.get('/asistencia/resumen', async (req, res) => {
  const { usuario_id, mes } = req.query;
  if (!usuario_id || !mes) return res.status(400).json({ error: 'usuario_id y mes requeridos' });
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE estado = 'presente')  AS dias_presente,
        COUNT(*) FILTER (WHERE estado = 'ausente')   AS dias_ausente,
        COUNT(*) FILTER (WHERE estado = 'tardanza')  AS dias_tardanza,
        COUNT(*) FILTER (WHERE estado = 'permiso')   AS dias_permiso,
        COUNT(*) FILTER (WHERE estado = 'vacacion')  AS dias_vacacion,
        COUNT(*) FILTER (WHERE estado IN ('presente','tardanza')) AS dias_trabajados
      FROM asistencia
      WHERE usuario_id = $1 AND TO_CHAR(fecha, 'YYYY-MM') = $2
    `, [usuario_id, mes]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/nomina/asistencia/bulk — registrar asistencia masiva del día
router.post('/asistencia/bulk', async (req, res) => {
  const { fecha, registros } = req.body;
  // registros: [{ usuario_id, estado, justificacion, sala_id }]
  if (!fecha || !Array.isArray(registros) || registros.length === 0) {
    return res.status(400).json({ error: 'fecha y registros[] requeridos' });
  }

  const allowed = ['admin', 'director', 'hostess', 'supervisor_cc'];
  if (!allowed.includes(req.user.rol)) {
    return res.status(403).json({ error: 'Sin permiso para registrar asistencia' });
  }

  try {
    const results = [];
    for (const r of registros) {
      const result = await pool.query(`
        INSERT INTO asistencia (usuario_id, sala_id, fecha, estado, justificacion, registrado_por)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (usuario_id, fecha) DO UPDATE SET
          estado = EXCLUDED.estado,
          justificacion = EXCLUDED.justificacion,
          registrado_por = EXCLUDED.registrado_por,
          sala_id = EXCLUDED.sala_id
        RETURNING *
      `, [
        r.usuario_id,
        r.sala_id || req.user.sala_id,
        fecha,
        r.estado || 'presente',
        r.justificacion || null,
        req.user.id,
      ]);
      results.push(result.rows[0]);
    }
    res.status(201).json(results);
  } catch (err) {
    console.error('Error en POST /api/nomina/asistencia/bulk:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/nomina/asistencia/resumen-mensual?mes=YYYY-MM&sala_id=X
// Resumen mensual de todos los usuarios (para la vista de admin/hostess)
router.get('/asistencia/resumen-mensual', async (req, res) => {
  const { mes, sala_id } = req.query;
  if (!mes) return res.status(400).json({ error: 'mes requerido (YYYY-MM)' });

  try {
    const params = [mes];
    let salaFilter = '';
    if (sala_id) { params.push(sala_id); salaFilter = `AND u.sala_id = $${params.length}`; }

    // Calcular días laborables del mes (L-V)
    const [anio, mesNum] = mes.split('-').map(Number);
    const diasEnMes = new Date(anio, mesNum, 0).getDate();
    let dias_laborables = 0;
    for (let d = 1; d <= diasEnMes; d++) {
      const dow = new Date(anio, mesNum - 1, d).getDay();
      if (dow !== 0 && dow !== 6) dias_laborables++;
    }

    const result = await pool.query(`
      SELECT
        u.id AS usuario_id,
        u.nombre AS usuario_nombre,
        ro.label AS rol_label,
        s.nombre AS sala_nombre,
        COUNT(a.id) FILTER (WHERE a.estado = 'presente')  AS dias_presente,
        COUNT(a.id) FILTER (WHERE a.estado = 'ausente')   AS dias_ausente,
        COUNT(a.id) FILTER (WHERE a.estado = 'tardanza')  AS dias_tardanza,
        COUNT(a.id) FILTER (WHERE a.estado = 'permiso')   AS dias_permiso,
        COUNT(a.id) FILTER (WHERE a.estado = 'vacacion')  AS dias_vacacion,
        COUNT(a.id) FILTER (WHERE a.estado IN ('presente','tardanza')) AS dias_trabajados,
        COUNT(a.id) AS total_registros
      FROM usuarios u
      JOIN roles ro ON u.rol_id = ro.id
      LEFT JOIN salas s ON u.sala_id = s.id
      LEFT JOIN asistencia a ON a.usuario_id = u.id AND TO_CHAR(a.fecha, 'YYYY-MM') = $1
      WHERE u.activo = true ${salaFilter}
      GROUP BY u.id, u.nombre, ro.label, s.nombre
      ORDER BY u.nombre
    `, params);

    res.json({ dias_laborables, usuarios: result.rows });
  } catch (err) {
    console.error('Error en GET /api/nomina/asistencia/resumen-mensual:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/nomina/asistencia/dia?fecha=YYYY-MM-DD&sala_id=X
// Asistencia de un día específico con lista de usuarios activos
router.get('/asistencia/dia', async (req, res) => {
  const { fecha, sala_id } = req.query;
  if (!fecha) return res.status(400).json({ error: 'fecha requerida (YYYY-MM-DD)' });

  try {
    const params = [fecha];
    let salaFilter = '';
    if (sala_id) { params.push(sala_id); salaFilter = `AND u.sala_id = $${params.length}`; }

    const result = await pool.query(`
      SELECT
        u.id AS usuario_id,
        u.nombre AS usuario_nombre,
        ro.label AS rol_label,
        ro.nombre AS rol,
        s.nombre AS sala_nombre,
        u.sala_id,
        a.id AS asistencia_id,
        a.estado,
        a.justificacion,
        a.registrado_por,
        reg.nombre AS registrado_por_nombre
      FROM usuarios u
      JOIN roles ro ON u.rol_id = ro.id
      LEFT JOIN salas s ON u.sala_id = s.id
      LEFT JOIN asistencia a ON a.usuario_id = u.id AND a.fecha = $1
      LEFT JOIN usuarios reg ON a.registrado_por = reg.id
      WHERE u.activo = true ${salaFilter}
      ORDER BY u.nombre
    `, params);

    res.json(result.rows);
  } catch (err) {
    console.error('Error en GET /api/nomina/asistencia/dia:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/nomina/reporte-validacion/:mes ────────────────────────────────
// Reporte detallado por empleado con desglose de contratos para validación de nómina
router.get('/reporte-validacion/:mes', requireAdminOrDirector, async (req, res) => {
  const { mes } = req.params;
  const { sala_id } = req.query;
  const salaParam = sala_id ? parseInt(sala_id, 10) : null;

  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
    return res.status(400).json({ error: 'Formato de mes inválido. Usar YYYY-MM' });
  }

  try {
    // 1. Obtener nóminas del mes
    const nominaRes = await pool.query(`
      SELECT n.*, u.nombre AS usuario_nombre, u.username, u.email,
        COALESCE(u.sueldo_base, 0)::numeric AS sueldo_base_usuario,
        COALESCE(u.pct_comision_venta, 10)::numeric AS pct_comision_venta,
        COALESCE(u.pct_desbloqueo, 30)::numeric AS pct_desbloqueo,
        COALESCE(u.pct_comision_cobro, 0)::numeric AS pct_comision_cobro,
        ro.nombre AS rol, ro.label AS rol_label,
        s.nombre AS sala_nombre
      FROM nomina_mensual n
      JOIN usuarios u ON n.usuario_id = u.id
      JOIN roles ro ON u.rol_id = ro.id
      LEFT JOIN salas s ON n.sala_id = s.id
      WHERE n.mes = $1 AND ($2::integer IS NULL OR n.sala_id = $2)
      ORDER BY u.nombre
    `, [mes, salaParam]);

    if (nominaRes.rows.length === 0) {
      return res.json([]);
    }

    // Cargar escalas TMK activas
    const escalasRes = await pool.query(
      'SELECT * FROM escalas_tmk WHERE activo = true ORDER BY tours_min ASC'
    );
    const escalasTmk = escalasRes.rows;

    const reporte = [];

    for (const nom of nominaRes.rows) {
      const uid = nom.usuario_id;

      // 2. Obtener contratos del mes con detalle de pagos + estado de suspensión
      const contratosRes = await pool.query(`
        SELECT
          c.id, c.numero_contrato, c.monto_total, c.estado AS contrato_estado,
          c.fecha_contrato,
          COALESCE(cl.nombre, 'Sin cliente') AS cliente_nombre,
          COALESCE(pagado.total, 0)::numeric AS monto_pagado,
          COALESCE(pagado.total_base, 0)::numeric AS monto_base_pagado,
          CASE
            WHEN c.monto_total > 0
            THEN ROUND(COALESCE(pagado.total, 0) / c.monto_total * 100, 2)
            ELSE 0
          END AS pct_pagado,
          CASE
            WHEN cs.id IS NOT NULL THEN 'suspendida'
            WHEN c.monto_total > 0 AND COALESCE(pagado.total, 0) / c.monto_total * 100 >= $3
            THEN 'desbloqueada'
            WHEN c.estado = 'suspendido' THEN 'suspendida'
            ELSE 'bloqueada'
          END AS estado_comision,
          CASE
            WHEN cs.id IS NOT NULL THEN 0
            WHEN c.monto_total > 0 AND COALESCE(pagado.total, 0) / c.monto_total * 100 >= $3
            THEN ROUND(COALESCE(pagado.total_base, 0) * $4 / 100, 2)
            ELSE 0
          END AS comision_calculada,
          COALESCE(pagado.total_base, 0)::numeric AS monto_base,
          cs.id AS suspension_id,
          cs.motivo AS motivo_suspension
        FROM contratos c
        LEFT JOIN (
          SELECT l.id, l.nombre FROM leads l
        ) cl ON cl.id = c.lead_id
        LEFT JOIN (
          SELECT r.contrato_id,
                 SUM(r.valor) AS total,
                 SUM(r.valor) - COALESCE((
                   SELECT SUM(COALESCE(cu.monto_interes, 0))
                   FROM cuotas cu WHERE cu.contrato_id = r.contrato_id AND cu.estado = 'pagado'
                 ), 0) AS total_base
          FROM recibos r WHERE r.estado = 'activo'
          GROUP BY r.contrato_id
        ) pagado ON pagado.contrato_id = c.id
        LEFT JOIN comisiones_suspendidas cs ON cs.contrato_id = c.id AND cs.usuario_id = $1 AND cs.activo = true
        WHERE c.consultor_id = $1
          AND TO_CHAR(c.fecha_contrato, 'YYYY-MM') = $2
          AND c.estado NOT IN ('cancelado')
        ORDER BY c.fecha_contrato
      `, [uid, mes, parseFloat(nom.pct_desbloqueo), parseFloat(nom.pct_comision_venta)]);

      // 3. Contratos de arrastre (meses anteriores con pagos en este mes)
      const arrastresRes = await pool.query(`
        SELECT
          c.id, c.numero_contrato, c.monto_total, c.estado AS contrato_estado,
          c.fecha_contrato,
          COALESCE(cl.nombre, 'Sin cliente') AS cliente_nombre,
          COALESCE(pagos_mes.total_mes, 0)::numeric AS monto_pagado_mes,
          COALESCE(pagos_mes.total_base_mes, 0)::numeric AS monto_base_pagado_mes,
          ROUND(COALESCE(pagos_mes.total_base_mes, 0) * $3 / 100, 2) AS comision_arrastre
        FROM contratos c
        LEFT JOIN (
          SELECT l.id, l.nombre FROM leads l
        ) cl ON cl.id = c.lead_id
        LEFT JOIN (
          SELECT r.contrato_id,
                 SUM(r.valor) AS total_mes,
                 SUM(r.valor) - COALESCE((
                   SELECT SUM(COALESCE(cu.monto_interes, 0))
                   FROM cuotas cu
                   WHERE cu.contrato_id = r.contrato_id
                     AND cu.estado = 'pagado'
                     AND TO_CHAR(cu.updated_at, 'YYYY-MM') = $2
                 ), 0) AS total_base_mes
          FROM recibos r
          WHERE r.estado = 'activo'
            AND TO_CHAR(r.fecha_pago, 'YYYY-MM') = $2
          GROUP BY r.contrato_id
        ) pagos_mes ON pagos_mes.contrato_id = c.id
        WHERE c.consultor_id = $1
          AND TO_CHAR(c.fecha_contrato, 'YYYY-MM') != $2
          AND c.estado NOT IN ('cancelado')
          AND COALESCE(pagos_mes.total_mes, 0) > 0
        ORDER BY c.fecha_contrato
      `, [uid, mes, parseFloat(nom.pct_comision_venta)]);

      // 4. Desglose semanal TMK (ya almacenado en nomina)
      let desglose_semanal = nom.desglose_semanal_tmk;
      if (typeof desglose_semanal === 'string') {
        try { desglose_semanal = JSON.parse(desglose_semanal); } catch { desglose_semanal = null; }
      }

      // 5. Armar registro de reporte
      reporte.push({
        nomina_id: nom.id,
        usuario_id: uid,
        usuario_nombre: nom.usuario_nombre,
        username: nom.username,
        email: nom.email,
        rol: nom.rol,
        rol_label: nom.rol_label,
        sala_nombre: nom.sala_nombre,
        mes: nom.mes,
        estado_nomina: nom.estado,

        // Datos de sueldo
        sueldo_base_config: Number(nom.sueldo_base_config),
        dias_trabajados: Number(nom.dias_trabajados || 0),
        dias_laborables: Number(nom.dias_laborables || 0),
        garantizado: Number(nom.garantizado || nom.sueldo_base),

        // Comisiones detalle
        pct_comision_venta: Number(nom.pct_comision_venta),
        pct_desbloqueo: Number(nom.pct_desbloqueo),
        contratos_del_mes: contratosRes.rows.map(c => ({
          id: c.id,
          numero_contrato: c.numero_contrato || `C-${c.id}`,
          cliente: c.cliente_nombre,
          monto_total: Number(c.monto_total),
          monto_pagado: Number(c.monto_pagado),
          pct_pagado: Number(c.pct_pagado),
          monto_base: Number(c.monto_base),
          comision_calculada: Number(c.comision_calculada),
          estado: c.estado_comision,
          suspendida: !!c.suspension_id,
          motivo_suspension: c.motivo_suspension || null,
        })),
        comision_venta_recurrente: Number(nom.comision_venta_recurrente || 0),

        // Arrastre de cartera
        contratos_arrastre: arrastresRes.rows.map(c => ({
          id: c.id,
          numero_contrato: c.numero_contrato || `C-${c.id}`,
          cliente: c.cliente_nombre,
          fecha_contrato: c.fecha_contrato,
          monto_total: Number(c.monto_total),
          monto_pagado_mes: Number(c.monto_pagado_mes),
          monto_base_pagado_mes: Number(c.monto_base_pagado_mes),
          comision_arrastre: Number(c.comision_arrastre),
        })),
        comision_abonos_cartera: Number(nom.comision_abonos_cartera || 0),
        comision_reactivaciones: Number(nom.comision_reactivaciones || 0),
        comision_arrastre_tmk: Number(nom.comision_arrastre_tmk || 0),

        // Bonos
        bono_tours: Number(nom.bono_tours || 0),
        tours_count: Number(nom.tours_count || 0),
        desglose_semanal_tmk: desglose_semanal,
        bono_citas: Number(nom.bono_citas || 0),
        citas_count: Number(nom.citas_count || 0),
        bono_meta: Number(nom.bono_meta || 0),

        // Cobros
        comision_ventas: Number(nom.comision_ventas || 0),
        comision_cobros: Number(nom.comision_cobros || 0),

        // Otros
        otros_ingresos: Number(nom.otros_ingresos || 0),
        observaciones: nom.observaciones,

        // Totales
        total_ingresos: Number(nom.total_ingresos || 0),
        aporte_iess: Number(nom.aporte_iess || 0),
        anticipo: Number(nom.anticipo || 0),
        otras_deducciones: Number(nom.otras_deducciones || 0),
        total_deducciones: Number(nom.total_deducciones || 0),
        neto_a_pagar: Number(nom.neto_a_pagar || 0),
      });
    }

    res.json(reporte);
  } catch (err) {
    console.error('Error en GET /api/nomina/reporte-validacion/:mes:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/nomina/notificar/:nomina_id ──────────────────────────────────
// Placeholder para envío de notificación de liquidación por email
// TODO: Configurar SMTP (nodemailer o similar) para envío real de emails
// TODO: Agregar tabla de configuración de email en admin
router.post('/notificar/:nomina_id', requireAdminOrDirector, async (req, res) => {
  const { nomina_id } = req.params;

  try {
    // Verificar que la nómina existe y está aprobada o pagada
    const nominaRes = await pool.query(`
      SELECT n.*, u.nombre AS usuario_nombre, u.email
      FROM nomina_mensual n
      JOIN usuarios u ON n.usuario_id = u.id
      WHERE n.id = $1
    `, [nomina_id]);

    if (!nominaRes.rows.length) {
      return res.status(404).json({ error: 'Registro de nómina no encontrado' });
    }

    const nom = nominaRes.rows[0];

    if (!['aprobada', 'pagada'].includes(nom.estado)) {
      return res.status(400).json({ error: 'Solo se puede notificar nóminas aprobadas o pagadas' });
    }

    // TODO: Aquí iría el envío real del email con nodemailer
    // const transporter = nodemailer.createTransport({ host, port, auth });
    // await transporter.sendMail({
    //   to: nom.email,
    //   subject: `Liquidación ${nom.mes} - SANAVIT`,
    //   html: `<p>Hola ${nom.usuario_nombre}, tu liquidación del período ${nom.mes} es de $${Number(nom.neto_a_pagar).toFixed(2)}. Genera tu factura por este valor.</p>`
    // });

    res.json({
      success: true,
      message: 'Notificación generada (email pendiente de configurar)',
      preview: {
        destinatario: nom.usuario_nombre,
        email: nom.email || '(sin email registrado)',
        asunto: `Liquidación ${nom.mes} - SANAVIT`,
        mensaje: `Hola ${nom.usuario_nombre}, tu liquidación del período ${nom.mes} es de $${Number(nom.neto_a_pagar).toFixed(2)}. Genera tu factura por este valor.`,
      }
    });
  } catch (err) {
    console.error('Error en POST /api/nomina/notificar/:nomina_id:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/nomina/suspender-comision ─────────────────────────────────────
// Suspender comisión de un contrato para un usuario en un mes dado
router.post('/suspender-comision', requireAdminOrDirector, async (req, res) => {
  const { usuario_id, contrato_id, motivo, mes } = req.body;

  if (!usuario_id || !contrato_id || !mes) {
    return res.status(400).json({ error: 'usuario_id, contrato_id y mes son requeridos' });
  }

  try {
    // Insertar en comisiones_suspendidas
    await pool.query(`
      INSERT INTO comisiones_suspendidas (usuario_id, contrato_id, motivo, suspendido_por, activo)
      VALUES ($1, $2, $3, $4, true)
      ON CONFLICT (usuario_id, contrato_id) WHERE activo = true
      DO UPDATE SET motivo = EXCLUDED.motivo, suspendido_por = EXCLUDED.suspendido_por, updated_at = NOW()
    `, [usuario_id, contrato_id, motivo || 'Sin motivo', req.user.id]).catch(async () => {
      // Si no existe la constraint parcial, intentar insert normal
      await pool.query(`
        INSERT INTO comisiones_suspendidas (usuario_id, contrato_id, motivo, suspendido_por, activo)
        VALUES ($1, $2, $3, $4, true)
      `, [usuario_id, contrato_id, motivo || 'Sin motivo', req.user.id]);
    });

    // Recalcular nómina del usuario: actualizar comisiones_suspendidas JSONB en nomina_mensual
    const suspRes = await pool.query(`
      SELECT cs.contrato_id, cs.motivo, c.numero_contrato
      FROM comisiones_suspendidas cs
      LEFT JOIN contratos c ON cs.contrato_id = c.id
      WHERE cs.usuario_id = $1 AND cs.activo = true
    `, [usuario_id]);

    await pool.query(`
      UPDATE nomina_mensual SET comisiones_suspendidas = $1, updated_at = NOW()
      WHERE usuario_id = $2 AND mes = $3 AND estado = 'borrador'
    `, [JSON.stringify(suspRes.rows), usuario_id, mes]);

    req.audit('suspender_comision', 'comisiones_suspendidas', null, { contrato_id, usuario_id, motivo: motivo || 'Sin motivo', mes });

    res.json({ success: true, message: 'Comision suspendida correctamente', suspendidas: suspRes.rows });
  } catch (err) {
    console.error('Error en POST /api/nomina/suspender-comision:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/nomina/reactivar-comision ─────────────────────────────────────
// Reactivar una comisión previamente suspendida
router.post('/reactivar-comision', requireAdminOrDirector, async (req, res) => {
  const { usuario_id, contrato_id, mes } = req.body;

  if (!usuario_id || !contrato_id || !mes) {
    return res.status(400).json({ error: 'usuario_id, contrato_id y mes son requeridos' });
  }

  try {
    // Desactivar la suspensión
    await pool.query(`
      UPDATE comisiones_suspendidas SET activo = false, updated_at = NOW()
      WHERE usuario_id = $1 AND contrato_id = $2 AND activo = true
    `, [usuario_id, contrato_id]);

    // Actualizar JSONB en nomina_mensual
    const suspRes = await pool.query(`
      SELECT cs.contrato_id, cs.motivo, c.numero_contrato
      FROM comisiones_suspendidas cs
      LEFT JOIN contratos c ON cs.contrato_id = c.id
      WHERE cs.usuario_id = $1 AND cs.activo = true
    `, [usuario_id]);

    await pool.query(`
      UPDATE nomina_mensual SET comisiones_suspendidas = $1, updated_at = NOW()
      WHERE usuario_id = $2 AND mes = $3 AND estado = 'borrador'
    `, [JSON.stringify(suspRes.rows), usuario_id, mes]);

    res.json({ success: true, message: 'Comision reactivada correctamente', suspendidas: suspRes.rows });
  } catch (err) {
    console.error('Error en POST /api/nomina/reactivar-comision:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
