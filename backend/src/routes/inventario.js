const express = require('express');
const pool    = require('../db');
const auth    = require('../middleware/auth');
const router  = express.Router();

// Auto-crear tabla al iniciar
async function initTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS movimientos_inventario (
      id SERIAL PRIMARY KEY,
      producto_id INTEGER REFERENCES productos(id) NOT NULL,
      tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('entrada','salida','ajuste')),
      cantidad INTEGER NOT NULL,
      stock_anterior INTEGER NOT NULL DEFAULT 0,
      stock_nuevo INTEGER NOT NULL DEFAULT 0,
      usuario_id INTEGER REFERENCES usuarios(id),
      motivo TEXT,
      referencia VARCHAR(100),
      fecha DATE DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}
initTable().catch(console.error);

// Auto-migraciones: campos adicionales en productos
(async () => {
  try {
    await pool.query(`
      ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_compra NUMERIC(10,2) DEFAULT 0;
      ALTER TABLE productos ADD COLUMN IF NOT EXISTS iva_porcentaje NUMERIC(5,2) DEFAULT 15;
      ALTER TABLE productos ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE;
      ALTER TABLE productos ADD COLUMN IF NOT EXISTS lote VARCHAR(50);
      ALTER TABLE productos ADD COLUMN IF NOT EXISTS laboratorio VARCHAR(150);
      ALTER TABLE productos ADD COLUMN IF NOT EXISTS foto_url TEXT;
    `);
  } catch (e) { /* ya existen */ }
})();

// Helper: calcula stock actual de un producto
async function calcularStock(productoId) {
  const res = await pool.query(
    `SELECT COALESCE(SUM(
       CASE tipo
         WHEN 'entrada' THEN cantidad
         WHEN 'salida'  THEN -cantidad
         WHEN 'ajuste'  THEN cantidad
       END
     ), 0)::INTEGER AS stock_actual
     FROM movimientos_inventario
     WHERE producto_id = $1`,
    [productoId]
  );
  return res.rows[0].stock_actual;
}

// ─────────────────────────────────────────────────────────────
// GET /api/inventario/stock
// Retorna todos los productos con su stock calculado
// ─────────────────────────────────────────────────────────────
router.get('/stock', auth, async (req, res) => {
  try {
    const { rol } = req.user;
    const esPrivilegiado = ['admin', 'director'].includes(rol);

    // Admins y directores ven todos los productos; el resto solo activos
    const whereClause = esPrivilegiado ? '' : 'WHERE p.activo = true';

    const result = await pool.query(
      `SELECT
         p.id,
         p.codigo,
         p.nombre,
         p.tipo,
         p.precio_venta,
         p.activo,
         COALESCE(SUM(
           CASE m.tipo
             WHEN 'entrada' THEN m.cantidad
             WHEN 'salida'  THEN -m.cantidad
             WHEN 'ajuste'  THEN m.cantidad
           END
         ), 0)::INTEGER AS stock_actual
       FROM productos p
       LEFT JOIN movimientos_inventario m ON m.producto_id = p.id
       ${whereClause}
       GROUP BY p.id, p.codigo, p.nombre, p.tipo, p.precio_venta, p.activo
       ORDER BY p.nombre ASC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/inventario/movimientos
// Historial de movimientos con filtros opcionales
// ─────────────────────────────────────────────────────────────
router.get('/movimientos', auth, async (req, res) => {
  try {
    const { producto_id, tipo, fecha_inicio, fecha_fin } = req.query;

    const conditions = [];
    const params     = [];
    let idx = 1;

    if (producto_id) {
      conditions.push(`m.producto_id = $${idx}`);
      params.push(producto_id);
      idx++;
    }
    if (tipo && ['entrada', 'salida', 'ajuste'].includes(tipo)) {
      conditions.push(`m.tipo = $${idx}`);
      params.push(tipo);
      idx++;
    }
    if (fecha_inicio) {
      conditions.push(`m.fecha >= $${idx}`);
      params.push(fecha_inicio);
      idx++;
    }
    if (fecha_fin) {
      conditions.push(`m.fecha <= $${idx}`);
      params.push(fecha_fin);
      idx++;
    }

    const whereStr = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT
         m.id,
         m.fecha,
         m.tipo,
         m.cantidad,
         m.stock_anterior,
         m.stock_nuevo,
         m.motivo,
         m.referencia,
         m.created_at,
         p.nombre  AS producto_nombre,
         p.codigo  AS producto_codigo,
         u.nombre  AS usuario_nombre
       FROM movimientos_inventario m
       JOIN  productos p ON p.id = m.producto_id
       LEFT JOIN usuarios u ON u.id = m.usuario_id
       ${whereStr}
       ORDER BY m.created_at DESC
       LIMIT 200`,
      params
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/inventario/movimiento
// Registra un nuevo movimiento (solo admin/director)
// ─────────────────────────────────────────────────────────────
router.post('/movimiento', auth, async (req, res) => {
  const { rol, id: usuario_id } = req.user;
  if (!['admin', 'director'].includes(rol)) {
    return res.status(403).json({ error: 'Sin permiso. Solo admin o director.' });
  }

  const { producto_id, tipo, cantidad, motivo, referencia, fecha } = req.body;

  // Validaciones
  if (!producto_id) return res.status(400).json({ error: 'producto_id es requerido' });
  if (!tipo || !['entrada', 'salida', 'ajuste'].includes(tipo)) {
    return res.status(400).json({ error: 'tipo debe ser entrada, salida o ajuste' });
  }
  const cantidadNum = parseInt(cantidad, 10);
  if (!cantidadNum || cantidadNum <= 0) {
    return res.status(400).json({ error: 'cantidad debe ser un entero mayor a 0' });
  }

  try {
    // Verificar que el producto existe
    const prodCheck = await pool.query('SELECT id FROM productos WHERE id = $1', [producto_id]);
    if (prodCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // Calcular stock actual (stock_anterior)
    const stock_anterior = await calcularStock(producto_id);

    // Calcular stock_nuevo según tipo
    let stock_nuevo;
    if (tipo === 'entrada') {
      stock_nuevo = stock_anterior + cantidadNum;
    } else if (tipo === 'salida') {
      stock_nuevo = stock_anterior - cantidadNum;
    } else {
      // ajuste: la cantidad puede ser positiva (se suma) o el campo ya representa el delta
      stock_nuevo = stock_anterior + cantidadNum;
    }

    // Evitar stock negativo en salidas
    if (tipo === 'salida' && stock_nuevo < 0) {
      return res.status(400).json({
        error: `Stock insuficiente. Stock actual: ${stock_anterior}, intentando retirar: ${cantidadNum}`,
      });
    }

    // Insertar movimiento
    const result = await pool.query(
      `INSERT INTO movimientos_inventario
         (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, usuario_id, motivo, referencia, fecha)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        producto_id,
        tipo,
        cantidadNum,
        stock_anterior,
        stock_nuevo,
        usuario_id,
        motivo   || null,
        referencia || null,
        fecha    || new Date().toISOString().split('T')[0],
      ]
    );

    res.status(201).json({ ...result.rows[0], stock_nuevo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/inventario/productos
// Crea un nuevo producto (solo admin/director)
// ─────────────────────────────────────────────────────────────
router.post('/productos', auth, async (req, res) => {
  const { rol } = req.user;
  if (!['admin', 'director'].includes(rol)) {
    return res.status(403).json({ error: 'Sin permiso. Solo admin o director.' });
  }
  const { codigo, nombre, tipo, descripcion, precio_venta, precio_compra, iva_porcentaje, fecha_vencimiento, lote, laboratorio } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre del producto es requerido' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO productos (codigo, nombre, tipo, descripcion, precio_venta, precio_compra, iva_porcentaje, fecha_vencimiento, lote, laboratorio, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
       RETURNING *`,
      [codigo || null, nombre.trim(), tipo || 'servicio', descripcion || null,
       Number(precio_venta) || 0, Number(precio_compra) || 0, Number(iva_porcentaje) || 15,
       fecha_vencimiento || null, lote || null, laboratorio || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un producto con ese código' });
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/inventario/productos/:id
// Actualiza datos de un producto (solo admin)
// ─────────────────────────────────────────────────────────────
router.patch('/productos/:id', auth, async (req, res) => {
  const { rol } = req.user;
  if (!['admin', 'director'].includes(rol)) {
    return res.status(403).json({ error: 'Sin permiso. Solo admin o director.' });
  }

  const allowedFields = ['nombre', 'descripcion', 'precio_venta', 'precio_compra', 'iva_porcentaje', 'fecha_vencimiento', 'lote', 'laboratorio', 'activo', 'codigo'];
  const updates = [];
  const values  = [];
  let idx = 1;

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = $${idx}`);
      values.push(req.body[field]);
      idx++;
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Nada que actualizar' });
  }

  values.push(req.params.id);

  try {
    const result = await pool.query(
      `UPDATE productos SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
