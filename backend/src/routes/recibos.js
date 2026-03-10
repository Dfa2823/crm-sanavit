const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/recibos?contrato_id=X
router.get('/', auth, async (req, res) => {
  const { contrato_id, persona_id, sala_id, fecha_inicio, fecha_fin } = req.query;
  try {
    let where = ['r.estado = \'activo\''];
    let params = [];
    let idx = 1;

    if (contrato_id) { where.push(`r.contrato_id = $${idx}`); params.push(contrato_id); idx++; }
    if (persona_id) { where.push(`r.persona_id = $${idx}`); params.push(persona_id); idx++; }
    if (sala_id) { where.push(`r.sala_id = $${idx}`); params.push(sala_id); idx++; }
    if (fecha_inicio) { where.push(`r.fecha_pago >= $${idx}`); params.push(fecha_inicio); idx++; }
    if (fecha_fin) { where.push(`r.fecha_pago <= $${idx}`); params.push(fecha_fin); idx++; }

    const result = await pool.query(`
      SELECT r.*, fp.nombre AS forma_pago_nombre,
             p.nombres, p.apellidos,
             c.numero_contrato,
             u.nombre AS cajero_nombre
      FROM recibos r
      LEFT JOIN formas_pago fp ON r.forma_pago_id = fp.id
      LEFT JOIN personas p ON r.persona_id = p.id
      LEFT JOIN contratos c ON r.contrato_id = c.id
      LEFT JOIN usuarios u ON r.usuario_id = u.id
      WHERE ${where.join(' AND ')}
      ORDER BY r.fecha_pago DESC, r.id DESC
    `, params);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/recibos — registrar pago
router.post('/', auth, async (req, res) => {
  const { id: userId } = req.user;
  const { contrato_id, cuota_id, persona_id, sala_id, forma_pago_id, valor, fecha_pago, referencia_pago, observacion } = req.body;

  if (!persona_id || !valor) return res.status(400).json({ error: 'persona_id y valor son requeridos' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Obtener consecutivo de recibos para la sala
    const salaId = sala_id || (contrato_id ? (await client.query('SELECT sala_id FROM contratos WHERE id = $1', [contrato_id])).rows[0]?.sala_id : null);

    let consecutivo = null;
    if (salaId) {
      const salaResult = await client.query(
        'SELECT prefijo_contrato, serial_contrato FROM salas WHERE id = $1 FOR UPDATE',
        [salaId]
      );
      if (salaResult.rows.length > 0) {
        const { prefijo_contrato, serial_contrato } = salaResult.rows[0];
        const nuevoSerial = (serial_contrato || 0) + 1;
        // Usamos serial_contrato como base para recibos también (simplificado)
        consecutivo = `${prefijo_contrato}-RC-${nuevoSerial}`;
        // No actualizamos serial_contrato — solo contratos lo hacen
        // En producción debería haber una tabla consecutivos separada
      }
    }

    const result = await client.query(`
      INSERT INTO recibos (consecutivo, contrato_id, cuota_id, persona_id, sala_id, forma_pago_id, valor, fecha_pago, usuario_id, referencia_pago, observacion)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `, [consecutivo, contrato_id, cuota_id, persona_id, salaId, forma_pago_id, valor, fecha_pago || new Date().toISOString().split('T')[0], userId, referencia_pago, observacion]);

    // Si hay cuota_id, actualizar el estado de la cuota
    if (cuota_id) {
      const cuota = await client.query('SELECT * FROM cuotas WHERE id = $1', [cuota_id]);
      if (cuota.rows.length > 0) {
        const q = cuota.rows[0];
        const nuevoMontoPagado = parseFloat(q.monto_pagado || 0) + parseFloat(valor);
        const nuevoEstado = nuevoMontoPagado >= parseFloat(q.monto_esperado) ? 'pagado' : 'parcial';
        await client.query(
          `UPDATE cuotas SET monto_pagado = $1, estado = $2, fecha_pago = $3 WHERE id = $4`,
          [nuevoMontoPagado, nuevoEstado, fecha_pago || new Date().toISOString().split('T')[0], cuota_id]
        );
      }
    }

    await client.query('COMMIT');

    // Retornar recibo con datos completos
    const recibo = await pool.query(`
      SELECT r.*, fp.nombre AS forma_pago_nombre, p.nombres, p.apellidos, c.numero_contrato
      FROM recibos r
      LEFT JOIN formas_pago fp ON r.forma_pago_id = fp.id
      LEFT JOIN personas p ON r.persona_id = p.id
      LEFT JOIN contratos c ON r.contrato_id = c.id
      WHERE r.id = $1
    `, [result.rows[0].id]);

    res.status(201).json(recibo.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH /api/recibos/:id/anular
router.patch('/:id/anular', auth, async (req, res) => {
  const { rol } = req.user;
  if (!['admin','director'].includes(rol)) return res.status(403).json({ error: 'Sin permiso' });

  try {
    const result = await pool.query(
      `UPDATE recibos SET estado = 'anulado' WHERE id = $1 AND estado = 'activo' RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Recibo no encontrado o ya anulado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
