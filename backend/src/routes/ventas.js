const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

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

// GET /api/ventas — lista de contratos
router.get('/', auth, async (req, res) => {
  const { sala_id, estado, fecha_inicio, fecha_fin, persona_id, consultor_id } = req.query;
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

    const result = await pool.query(`
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
      LIMIT 200
    `, params);

    res.json(result.rows);
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

// POST /api/ventas — crear nuevo contrato
router.post('/', auth, async (req, res) => {
  const { rol, id: userId, sala_id: userSalaId } = req.user;
  if (!['admin','director','consultor','hostess'].includes(rol)) {
    return res.status(403).json({ error: 'Sin permiso para crear contratos' });
  }

  const {
    persona_id, sala_id, consultor_id, visita_sala_id,
    tipo_plan, descripcion_plan,
    monto_total, cuota_inicial = 0, forma_pago_inicial_id,
    valor_financiado, n_cuotas = 1, dia_pago = 1, fecha_primer_pago,
    outsourcing_empresa_id, segunda_venta = false, observaciones,
    productos = []   // array de { producto_id, cantidad, precio_unitario }
  } = req.body;

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
        outsourcing_empresa_id, segunda_venta, observaciones
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *
    `, [
      numeroContrato, persona_id, salaId, consultor_id || userId, visita_sala_id,
      tipo_plan || 'mensual', descripcion_plan,
      valorBruto, valorBruto, ivaPorc, valorIva,
      cuota_inicial, forma_pago_inicial_id,
      n_cuotas > 0 ? parseFloat(valor_financiado || 0) / n_cuotas : 0,
      n_cuotas, dia_pago, fecha_primer_pago,
      outsourcing_empresa_id, segunda_venta, observaciones
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
    if (n_cuotas > 1 && montoFinanciado > 0) {
      const valorCuota = montoFinanciado / n_cuotas;
      const fechaInicio = fecha_primer_pago ? new Date(fecha_primer_pago) : new Date();

      for (let i = 0; i < n_cuotas; i++) {
        const fechaVenc = new Date(fechaInicio);
        fechaVenc.setMonth(fechaVenc.getMonth() + i);
        fechaVenc.setDate(dia_pago);

        await client.query(`
          INSERT INTO cuotas (contrato_id, numero_cuota, monto_esperado, fecha_vencimiento, estado)
          VALUES ($1, $2, $3, $4, 'pendiente')
        `, [contrato.id, i + 1, Math.round(valorCuota * 100) / 100, fechaVenc.toISOString().split('T')[0]]);
      }
    }

    await client.query('COMMIT');

    // Retornar vista 360° del contrato creado
    const vista = await getVenta360(contrato.id);
    res.status(201).json(vista);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    if (err.code === '23505') return res.status(409).json({ error: 'Número de contrato duplicado' });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
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

module.exports = router;
