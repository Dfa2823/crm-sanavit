const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { paginate, paginatedResponse } = require('../utils/pagination');
const { dispararWebhook } = require('../utils/webhook');

const router = express.Router();

// Auto-migrate: agregar columnas de anulación y SAC si no existen
async function initMigrations() {
  try {
    await pool.query(`
      ALTER TABLE contratos ADD COLUMN IF NOT EXISTS sac_asesor_id INTEGER REFERENCES usuarios(id);
      ALTER TABLE contratos ADD COLUMN IF NOT EXISTS anulado_por INTEGER REFERENCES usuarios(id);
      ALTER TABLE contratos ADD COLUMN IF NOT EXISTS fecha_anulacion TIMESTAMPTZ;
      ALTER TABLE contratos ADD COLUMN IF NOT EXISTS motivo_anulacion VARCHAR(255);
    `);
    // Fase 19: firma digital del cliente
    await pool.query(`ALTER TABLE contratos ADD COLUMN IF NOT EXISTS firma_cliente TEXT`);
    // Agregar requiere_referencia a formas_pago si no existe
    await pool.query(`
      ALTER TABLE formas_pago ADD COLUMN IF NOT EXISTS requiere_referencia BOOLEAN DEFAULT false;
    `);
    // Tabla de documentos adjuntos por contrato
    await pool.query(`
      CREATE TABLE IF NOT EXISTS documentos_contrato (
        id SERIAL PRIMARY KEY,
        contrato_id INTEGER REFERENCES contratos(id) NOT NULL,
        persona_id INTEGER REFERENCES personas(id),
        tipo VARCHAR(50) NOT NULL DEFAULT 'otro',
        nombre_archivo VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        uploaded_by INTEGER REFERENCES usuarios(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    // Soporte de pago en recibos
    await pool.query(`
      ALTER TABLE recibos ADD COLUMN IF NOT EXISTS soporte_url TEXT;
      ALTER TABLE recibos ADD COLUMN IF NOT EXISTS soporte_nombre VARCHAR(255);
    `);
    // Intereses en contratos y cuotas
    await pool.query(`
      ALTER TABLE contratos ADD COLUMN IF NOT EXISTS tasa_interes NUMERIC(5,2) DEFAULT 0;
      ALTER TABLE cuotas ADD COLUMN IF NOT EXISTS monto_interes NUMERIC(10,2) DEFAULT 0;
    `);
    // Marcar formas de pago que requieren referencia
    await pool.query(`
      UPDATE formas_pago SET requiere_referencia = true
      WHERE requiere_referencia = false
        AND LOWER(nombre) ~ '(transferencia|deposito|depósito|tarjeta|link de pago|cheque)';
    `);
  } catch (err) {
    console.error('Ventas migrations warning:', err.message);
  }
}
initMigrations();

// Helper: build 360° contract view
async function getVenta360(id) {
  const contrato = await pool.query(`
    SELECT
      c.*,
      p.nombres, p.apellidos, p.telefono, p.email, p.ciudad,
      p.tipo_documento, p.num_documento, p.fecha_nacimiento, p.genero,
      p.estado_civil, p.direccion, p.situacion_laboral, p.edad,
      p.patologia,
      s.nombre AS sala_nombre,
      u.nombre AS consultor_nombre,
      oe.nombre AS outsourcing_nombre
    FROM contratos c
    JOIN personas p ON c.persona_id = p.id
    LEFT JOIN salas s ON c.sala_id = s.id
    LEFT JOIN usuarios u ON c.consultor_id = u.id
    LEFT JOIN outsourcing_empresas oe ON c.outsourcing_empresa_id = oe.id
    WHERE c.id = $1
  `, [id]);

  if (contrato.rows.length === 0) return null;

  const [productos, cuotas, recibos] = await Promise.all([
    pool.query(`
      SELECT vp.*, pr.nombre AS producto_nombre, pr.tipo AS producto_tipo, pr.codigo
      FROM venta_productos vp
      JOIN productos pr ON vp.producto_id = pr.id
      WHERE vp.contrato_id = $1
      ORDER BY vp.id
    `, [id]),
    pool.query(`
      SELECT * FROM cuotas WHERE contrato_id = $1 ORDER BY numero_cuota
    `, [id]),
    pool.query(`
      SELECT r.*, fp.nombre AS forma_pago_nombre, u.nombre AS cajero_nombre
      FROM recibos r
      LEFT JOIN formas_pago fp ON r.forma_pago_id = fp.id
      LEFT JOIN usuarios u ON r.usuario_id = u.id
      WHERE r.contrato_id = $1 AND r.estado = 'activo'
      ORDER BY r.fecha_pago DESC
    `, [id])
  ]);

  const data = contrato.rows[0];
  const montoTotal = parseFloat(data.monto_total || 0);
  const totalPagado = recibos.rows.reduce((s, r) => s + parseFloat(r.valor || 0), 0);
  const porcentajePagado = montoTotal > 0 ? (totalPagado / montoTotal * 100) : 0;

  return {
    contrato: data,
    productos: productos.rows,
    cuotas: cuotas.rows,
    recibos: recibos.rows,
    resumen: {
      monto_total: montoTotal,
      total_pagado: totalPagado,
      saldo_pendiente: montoTotal - totalPagado,
      porcentaje_pagado: Math.round(porcentajePagado * 100) / 100,
      comision_desbloqueada: porcentajePagado >= 30,  // Regla del 30%
      n_cuotas: cuotas.rows.length,
      cuotas_pagadas: cuotas.rows.filter(q => q.estado === 'pagado').length,
      cuotas_vencidas: cuotas.rows.filter(q => q.estado === 'vencido').length,
    }
  };
}

/**
 * @openapi
 * /api/ventas:
 *   get:
 *     tags: [Ventas]
 *     summary: Listar contratos / ventas
 *     description: Retorna contratos con resumen financiero. Soporta paginacion y filtros por sala, estado, fecha, persona y consultor.
 *     parameters:
 *       - in: query
 *         name: sala_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [activo, inactivo, cancelado, suspendido, completado]
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
 *         name: persona_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: consultor_id
 *         schema:
 *           type: integer
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
 *         description: Lista paginada de contratos
 */
router.get('/', auth, async (req, res) => {
  const { sala_id, estado, fecha_inicio, fecha_fin, persona_id, consultor_id, page, limit } = req.query;
  const { rol, sala_id: userSalaId } = req.user;

  try {
    let where = [];
    let params = [];
    let idx = 1;

    // Filtro por sala del usuario
    if (!['admin','director','asesor_cartera'].includes(rol) && userSalaId) {
      where.push(`c.sala_id = $${idx}`); params.push(userSalaId); idx++;
    }
    if (sala_id) { where.push(`c.sala_id = $${idx}`); params.push(sala_id); idx++; }
    if (estado) { where.push(`c.estado = $${idx}`); params.push(estado); idx++; }
    if (fecha_inicio) { where.push(`c.fecha_contrato >= $${idx}`); params.push(fecha_inicio); idx++; }
    if (fecha_fin) { where.push(`c.fecha_contrato <= $${idx}`); params.push(fecha_fin); idx++; }
    if (persona_id) { where.push(`c.persona_id = $${idx}`); params.push(persona_id); idx++; }
    if (consultor_id) { where.push(`c.consultor_id = $${idx}`); params.push(consultor_id); idx++; }

    const whereStr = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    // Contar total
    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT c.id) FROM contratos c JOIN personas p ON c.persona_id = p.id ${whereStr}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Query paginada
    const baseQuery = `
      SELECT
        c.id, c.numero_contrato, c.fecha_contrato, c.tipo_plan,
        c.monto_total, c.n_cuotas, c.estado, c.segunda_venta,
        p.nombres, p.apellidos, p.telefono, p.num_documento,
        s.nombre AS sala_nombre,
        u.nombre AS consultor_nombre,
        COALESCE(SUM(r.valor) FILTER (WHERE r.estado='activo'), 0) AS total_pagado,
        c.monto_total - COALESCE(SUM(r.valor) FILTER (WHERE r.estado='activo'), 0) AS saldo
      FROM contratos c
      JOIN personas p ON c.persona_id = p.id
      LEFT JOIN salas s ON c.sala_id = s.id
      LEFT JOIN usuarios u ON c.consultor_id = u.id
      LEFT JOIN recibos r ON r.contrato_id = c.id
      ${whereStr}
      GROUP BY c.id, p.id, s.id, u.id
      ORDER BY c.fecha_contrato DESC
    `;
    const { paginatedQuery, page: pg, limit: lm } = paginate(baseQuery, { page, limit });
    const result = await pool.query(paginatedQuery, params);

    res.json(paginatedResponse(result.rows, total, pg, lm));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ventas/:id — vista 360°
router.get('/:id', auth, async (req, res) => {
  try {
    const data = await getVenta360(req.params.id);
    if (!data) return res.status(404).json({ error: 'Contrato no encontrado' });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @openapi
 * /api/ventas:
 *   post:
 *     tags: [Ventas]
 *     summary: Crear nuevo contrato / venta
 *     description: Registra un contrato con productos, genera plan de cuotas y consecutivo automatico. Requiere rol consultor, hostess, director o admin.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [persona_id, monto_total]
 *             properties:
 *               persona_id:
 *                 type: integer
 *               sala_id:
 *                 type: integer
 *               consultor_id:
 *                 type: integer
 *               tipo_plan:
 *                 type: string
 *                 example: mensual
 *               monto_total:
 *                 type: number
 *                 example: 3500
 *               cuota_inicial:
 *                 type: number
 *                 example: 500
 *               n_cuotas:
 *                 type: integer
 *                 example: 12
 *               valor_financiado:
 *                 type: number
 *               fecha_primer_pago:
 *                 type: string
 *                 format: date
 *               segunda_venta:
 *                 type: boolean
 *               productos:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     producto_id:
 *                       type: integer
 *                     cantidad:
 *                       type: integer
 *                     precio_unitario:
 *                       type: number
 *     responses:
 *       201:
 *         description: Contrato creado con vista 360
 *       403:
 *         description: Sin permiso para crear contratos
 *       409:
 *         description: Numero de contrato duplicado
 */
router.post('/', auth, async (req, res) => {
  const { rol, id: userId, sala_id: userSalaId } = req.user;
  if (!['admin','director','consultor','hostess'].includes(rol)) {
    return res.status(403).json({ error: 'Sin permiso para crear contratos' });
  }

  const {
    persona_id, sala_id, consultor_id, visita_sala_id,
    tipo_plan, descripcion_plan,
    monto_total, cuota_inicial = 0, forma_pago_inicial_id,
    valor_financiado, n_cuotas = 1, fecha_primer_pago,
    outsourcing_empresa_id, segunda_venta = false, sac_asesor_id, observaciones,
    firma_cliente,
    productos = []   // array de { producto_id, cantidad, precio_unitario }
  } = req.body;

  // Auto-calcular dia_pago: día 1 del mes siguiente a la fecha del contrato
  // Si se envía fecha_primer_pago, usar su día; si no, día 1 del mes siguiente
  const dia_pago = (() => {
    if (fecha_primer_pago) {
      return new Date(fecha_primer_pago).getDate();
    }
    return 1; // primer día del mes siguiente por defecto
  })();

  if (!persona_id || !monto_total) {
    return res.status(400).json({ error: 'persona_id y monto_total son requeridos' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Obtener la sala y generar consecutivo
    const salaId = sala_id || userSalaId;
    const salaResult = await client.query(
      'SELECT prefijo_contrato, serial_contrato FROM salas WHERE id = $1 FOR UPDATE',
      [salaId]
    );
    if (salaResult.rows.length === 0) throw new Error('Sala no encontrada');

    const { prefijo_contrato, serial_contrato } = salaResult.rows[0];
    const nuevoSerial = serial_contrato + 1;
    const numeroContrato = `${prefijo_contrato}-${nuevoSerial}`;

    // Actualizar serial
    await client.query(
      'UPDATE salas SET serial_contrato = $1 WHERE id = $2',
      [nuevoSerial, salaId]
    );

    // IVA (Ecuador 15%, empresa absorbe)
    const valorBruto = parseFloat(monto_total);
    const ivaPorc = 15;
    const valorIva = 0; // empresa absorbe

    // Crear contrato
    const contratoResult = await client.query(`
      INSERT INTO contratos (
        numero_contrato, persona_id, sala_id, consultor_id, visita_sala_id,
        tipo_plan, descripcion_plan,
        monto_total, valor_bruto, iva_porcentaje, valor_iva,
        cuota_inicial, forma_pago_inicial_id,
        monto_cuota, n_cuotas, dia_pago, fecha_primer_pago,
        outsourcing_empresa_id, segunda_venta, sac_asesor_id, observaciones,
        firma_cliente
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
      RETURNING *
    `, [
      numeroContrato, persona_id, salaId, consultor_id || userId, visita_sala_id,
      tipo_plan || 'mensual', descripcion_plan,
      valorBruto, valorBruto, ivaPorc, valorIva,
      cuota_inicial, forma_pago_inicial_id,
      n_cuotas > 0 ? parseFloat(valor_financiado || 0) / n_cuotas : 0,
      n_cuotas, dia_pago, fecha_primer_pago,
      outsourcing_empresa_id, segunda_venta, sac_asesor_id || null, observaciones,
      firma_cliente || null,
    ]);

    const contrato = contratoResult.rows[0];

    // Insertar productos
    for (const p of productos) {
      const precioUnit = parseFloat(p.precio_unitario || 0);
      const cant = parseInt(p.cantidad || 1);
      await client.query(`
        INSERT INTO venta_productos (contrato_id, producto_id, cantidad, precio_unitario, valor_total)
        VALUES ($1, $2, $3, $4, $5)
      `, [contrato.id, p.producto_id, cant, precioUnit, precioUnit * cant]);
    }

    // Generar plan de cuotas si hay financiación
    const montoFinanciado = parseFloat(valor_financiado || 0);
    const TASA_INTERES_DEFAULT = 1.5; // % mensual
    if (n_cuotas > 1 && montoFinanciado > 0) {
      const valorCuota = montoFinanciado / n_cuotas;
      const aplicaInteres = n_cuotas >= 4;
      const tasaInteres = aplicaInteres ? TASA_INTERES_DEFAULT : 0;

      // Guardar tasa de interés en el contrato
      if (aplicaInteres) {
        await client.query(
          'UPDATE contratos SET tasa_interes = $1 WHERE id = $2',
          [tasaInteres, contrato.id]
        );
      }

      // Parsear fecha_primer_pago sin timezone (evitar desfase UTC)
      const fpParts = (fecha_primer_pago || '').split('-').map(Number);
      const fpYear = fpParts[0] || new Date().getFullYear();
      const fpMonth = (fpParts[1] || (new Date().getMonth() + 2)); // mes siguiente por defecto
      const fpDay = fpParts[2] || 1;

      for (let i = 0; i < n_cuotas; i++) {
        let mesTarget = fpMonth + i - 1; // 0-indexed
        let anioTarget = fpYear;
        while (mesTarget > 11) { mesTarget -= 12; anioTarget++; }
        // Último día real del mes target
        const ultimoDia = new Date(anioTarget, mesTarget + 1, 0).getDate();
        const diaFinal = Math.min(fpDay, ultimoDia);
        const mesStr = String(mesTarget + 1).padStart(2, '0');
        const diaStr = String(diaFinal).padStart(2, '0');
        const fechaVenc = `${anioTarget}-${mesStr}-${diaStr}`;

        // Primeras 3 cuotas sin interés, a partir de la 4ta se aplica
        const montoInteres = (aplicaInteres && i >= 3)
          ? Math.round(valorCuota * tasaInteres / 100 * 100) / 100
          : 0;
        const montoEsperado = Math.round((valorCuota + montoInteres) * 100) / 100;

        await client.query(`
          INSERT INTO cuotas (contrato_id, numero_cuota, monto_esperado, monto_interes, fecha_vencimiento, estado)
          VALUES ($1, $2, $3, $4, $5, 'pendiente')
        `, [contrato.id, i + 1, montoEsperado, montoInteres, fechaVenc]);
      }
    }

    await client.query('COMMIT');

    // Audit trail
    req.audit('crear_contrato', 'contratos', contrato.id, { numero_contrato: numeroContrato, monto_total: valorBruto, persona_id, productos: productos.length });

    // Retornar vista 360° del contrato creado
    const vista = await getVenta360(contrato.id);
    res.status(201).json(vista);

    // Webhook: nueva_venta (fire-and-forget)
    dispararWebhook('nueva_venta', {
      contrato_id: contrato.id,
      numero_contrato: numeroContrato,
      persona_id,
      monto_total: valorBruto,
      productos: productos.length,
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    if (err.code === '23505') return res.status(409).json({ error: 'Número de contrato duplicado' });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH /api/ventas/:id/anular — anulación por caída en mesa (mismo día)
router.patch('/:id/anular', auth, async (req, res) => {
  const { rol, id: userId } = req.user;
  if (!['admin', 'director', 'hostess', 'confirmador', 'consultor'].includes(rol)) {
    return res.status(403).json({ error: 'Sin permiso para anular contratos' });
  }

  const { motivo } = req.body;
  const contratoId = parseInt(req.params.id, 10);

  try {
    // Verificar que el contrato existe y está activo
    const check = await pool.query(
      `SELECT id, estado, fecha_contrato FROM contratos WHERE id = $1`,
      [contratoId]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Contrato no encontrado' });
    const c = check.rows[0];
    if (c.estado !== 'activo') return res.status(400).json({ error: 'Solo se pueden anular contratos activos' });

    // Hostess/confirmador/consultor solo pueden anular si fue creado hoy
    if (['hostess', 'confirmador', 'consultor'].includes(rol)) {
      const hoy = new Date().toISOString().split('T')[0];
      const fechaContrato = new Date(c.fecha_contrato).toISOString().split('T')[0];
      if (fechaContrato !== hoy) {
        return res.status(403).json({ error: 'Solo puedes anular contratos creados hoy (caída en mesa)' });
      }
    }

    const result = await pool.query(
      `UPDATE contratos
       SET estado = 'cancelado',
           motivo_anulacion = $1,
           anulado_por = $2,
           fecha_anulacion = NOW(),
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, numero_contrato, estado, motivo_anulacion`,
      [motivo || 'Caída en mesa', userId, contratoId]
    );

    req.audit('anular_contrato', 'contratos', contratoId, { motivo: motivo || 'Caída en mesa', numero_contrato: result.rows[0]?.numero_contrato });

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    // Columnas de anulación pueden no existir aún, usar fallback
    try {
      const result = await pool.query(
        `UPDATE contratos SET estado = 'cancelado', updated_at = NOW()
         WHERE id = $1 RETURNING id, numero_contrato, estado`,
        [contratoId]
      );
      res.json(result.rows[0]);
    } catch (err2) {
      res.status(500).json({ error: err.message });
    }
  }
});

// PATCH /api/ventas/:id/estado
router.patch('/:id/estado', auth, async (req, res) => {
  const { rol } = req.user;
  if (!['admin','director'].includes(rol)) return res.status(403).json({ error: 'Sin permiso' });

  const { estado, motivo } = req.body;
  const estadosValidos = ['activo','inactivo','cancelado','suspendido','completado'];
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ error: `Estado debe ser uno de: ${estadosValidos.join(', ')}` });
  }

  try {
    const result = await pool.query(
      `UPDATE contratos SET estado = $1, observaciones = COALESCE($2, observaciones), updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [estado, motivo, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contrato no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/ventas/productos/:id/despachar — marcar línea de producto como despachada
router.patch('/productos/:id/despachar', auth, async (req, res) => {
  const { rol } = req.user;
  if (!['admin', 'director', 'inventario', 'hostess'].includes(rol)) {
    return res.status(403).json({ error: 'Sin permiso para registrar despachos' });
  }
  try {
    const result = await pool.query(
      `UPDATE venta_productos SET despacho_estado = 'despachado' WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Ítem no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/ventas/:id/notas — actualizar observaciones del contrato
router.patch('/:id/notas', auth, async (req, res) => {
  const { rol } = req.user;
  if (!['admin','director','consultor','hostess'].includes(rol)) {
    return res.status(403).json({ error: 'Sin permiso' });
  }
  const { texto } = req.body;
  try {
    const result = await pool.query(
      `UPDATE contratos SET observaciones = $1, updated_at = NOW() WHERE id = $2 RETURNING id, observaciones`,
      [texto !== undefined ? texto : null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contrato no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DOCUMENTOS POR CONTRATO ─────────────────────────────────────────────────

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads/documentos');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `doc_${req.params.id}_${Date.now()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// GET /api/ventas/:id/documentos
router.get('/:id/documentos', auth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, u.nombre AS uploaded_by_nombre
      FROM documentos_contrato d
      LEFT JOIN usuarios u ON d.uploaded_by = u.id
      WHERE d.contrato_id = $1
      ORDER BY d.created_at DESC
    `, [req.params.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ventas/:id/documentos
router.post('/:id/documentos', auth, upload.single('archivo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });

  const { tipo = 'otro' } = req.body;
  const contratoId = req.params.id;
  const url = `/uploads/documentos/${req.file.filename}`;

  try {
    // Obtener persona_id del contrato
    const cRes = await pool.query('SELECT persona_id FROM contratos WHERE id = $1', [contratoId]);
    const personaId = cRes.rows[0]?.persona_id || null;

    const result = await pool.query(`
      INSERT INTO documentos_contrato (contrato_id, persona_id, tipo, nombre_archivo, url, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [contratoId, personaId, tipo, req.file.originalname, url, req.user.id]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/ventas/:id/documentos/:docId
router.delete('/:id/documentos/:docId', auth, async (req, res) => {
  if (!['admin', 'director'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Solo admin puede eliminar documentos' });
  }
  try {
    const result = await pool.query(
      'DELETE FROM documentos_contrato WHERE id = $1 AND contrato_id = $2 RETURNING *',
      [req.params.docId, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Documento no encontrado' });

    // Eliminar archivo físico
    const filePath = path.join(__dirname, '../..', result.rows[0].url);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/ventas/:id/condonar-intereses — condonar intereses por pago anticipado
router.patch('/:id/condonar-intereses', auth, async (req, res) => {
  const { rol, id: userId, nombre: userName } = req.user;
  if (!['admin', 'director', 'asesor_cartera', 'sac'].includes(rol)) {
    return res.status(403).json({ error: 'Sin permiso para condonar intereses' });
  }

  const contratoId = parseInt(req.params.id, 10);
  const { motivo } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar que el contrato existe y está activo
    const check = await client.query(
      'SELECT id, numero_contrato, estado FROM contratos WHERE id = $1',
      [contratoId]
    );
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Contrato no encontrado' });
    }
    if (check.rows[0].estado !== 'activo') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Solo se pueden condonar intereses en contratos activos' });
    }

    // Obtener cuotas pendientes con interés > 0
    const cuotasRes = await client.query(
      `SELECT id, numero_cuota, monto_esperado, monto_interes
       FROM cuotas
       WHERE contrato_id = $1 AND estado IN ('pendiente', 'parcial') AND monto_interes > 0
       ORDER BY numero_cuota`,
      [contratoId]
    );

    if (cuotasRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No hay cuotas pendientes con intereses para condonar' });
    }

    let totalInteresCondonado = 0;
    const cuotasActualizadas = [];

    for (const cuota of cuotasRes.rows) {
      const interes = parseFloat(cuota.monto_interes);
      const nuevoMonto = Math.round((parseFloat(cuota.monto_esperado) - interes) * 100) / 100;
      totalInteresCondonado += interes;

      await client.query(
        `UPDATE cuotas SET monto_interes = 0, monto_esperado = $1 WHERE id = $2`,
        [nuevoMonto, cuota.id]
      );

      cuotasActualizadas.push({
        cuota_id: cuota.id,
        numero_cuota: cuota.numero_cuota,
        interes_condonado: interes,
        nuevo_monto: nuevoMonto,
      });
    }

    // Registrar en audit_log
    await client.query(
      `INSERT INTO audit_log (usuario_id, username, accion, tabla, registro_id, datos_despues)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        userName || 'unknown',
        'condonar_intereses',
        'contratos',
        contratoId,
        JSON.stringify({
          motivo: motivo || 'Pago anticipado',
          total_interes_condonado: Math.round(totalInteresCondonado * 100) / 100,
          cuotas_afectadas: cuotasActualizadas,
        }),
      ]
    );

    await client.query('COMMIT');

    res.json({
      ok: true,
      numero_contrato: check.rows[0].numero_contrato,
      total_interes_condonado: Math.round(totalInteresCondonado * 100) / 100,
      cuotas_afectadas: cuotasActualizadas.length,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error condonar intereses:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
