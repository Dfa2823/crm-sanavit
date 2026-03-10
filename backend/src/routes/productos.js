const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// GET /api/productos — lista de productos activos
router.get('/', auth, async (req, res) => {
  try {
    const { activo, tipo, marca } = req.query;
    let where = [];
    let params = [];
    let idx = 1;

    if (activo !== undefined) {
      where.push(`activo = $${idx}`);
      params.push(activo === 'true' || activo === '1');
      idx++;
    } else {
      where.push(`activo = true`);
    }
    if (tipo) {
      where.push(`tipo = $${idx}`);
      params.push(tipo);
      idx++;
    }
    if (marca) {
      where.push(`marca = $${idx}`);
      params.push(marca);
      idx++;
    }

    const whereStr = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM productos ${whereStr} ORDER BY tipo, nombre`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/productos/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM productos WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/productos — crear producto (solo admin)
router.post('/', auth, async (req, res) => {
  const { rol } = req.user;
  if (!['admin', 'director'].includes(rol)) return res.status(403).json({ error: 'Sin permiso' });

  const { codigo, nombre, tipo = 'servicio', marca = 'SANAVIT', precio_venta = 0, tiene_iva = false, descripcion } = req.body;
  if (!codigo || !nombre) return res.status(400).json({ error: 'codigo y nombre son requeridos' });

  try {
    const result = await pool.query(
      `INSERT INTO productos (codigo, nombre, tipo, marca, precio_venta, tiene_iva, descripcion)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [codigo, nombre, tipo, marca, precio_venta, tiene_iva, descripcion]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Código de producto ya existe' });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/productos/:id
router.patch('/:id', auth, async (req, res) => {
  const { rol } = req.user;
  if (!['admin', 'director'].includes(rol)) return res.status(403).json({ error: 'Sin permiso' });

  const fields = ['nombre','tipo','marca','precio_venta','tiene_iva','descripcion','activo'];
  const updates = [];
  const values = [];
  let idx = 1;

  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = $${idx}`);
      values.push(req.body[f]);
      idx++;
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });
  values.push(req.params.id);

  try {
    const result = await pool.query(
      `UPDATE productos SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
