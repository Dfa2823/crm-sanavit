const express = require('express');
const pool = require('../db');
const { puedeAccederEntidad } = require('../utils/acceso');

const router = express.Router();

// Entidades que aceptan comentarios y su tabla real (para validar que existen)
const ENTIDADES = {
  contrato: { tabla: 'contratos', label: 'contrato' },
  pqr_ticket: { tabla: 'pqr_tickets', label: 'ticket SAC' },
  lead: { tabla: 'leads', label: 'lead' },
};

// Auto-migrate: tabla de comentarios con historial (línea de tiempo).
// Reemplaza el viejo campo único contratos.observaciones que se sobrescribía
// en cada edición. Los comentarios nunca se editan ni borran: solo se agregan.
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comentarios (
        id SERIAL PRIMARY KEY,
        entidad_tipo VARCHAR(20) NOT NULL,
        entidad_id INTEGER NOT NULL,
        usuario_id INTEGER REFERENCES usuarios(id),
        texto TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_comentarios_entidad
      ON comentarios (entidad_tipo, entidad_id, created_at DESC)
    `);
    // Migración una-sola-vez: las observaciones existentes de contratos pasan a
    // ser el primer comentario (autor NULL = "Sistema"), para no perder lo escrito.
    // Idempotente: solo migra contratos que aún no tienen ningún comentario.
    await pool.query(`
      INSERT INTO comentarios (entidad_tipo, entidad_id, usuario_id, texto, created_at)
      SELECT 'contrato', c.id, NULL, c.observaciones, COALESCE(c.updated_at, c.created_at, NOW())
      FROM contratos c
      WHERE c.observaciones IS NOT NULL
        AND TRIM(c.observaciones) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM comentarios x
          WHERE x.entidad_tipo = 'contrato' AND x.entidad_id = c.id
        )
    `);
    console.log('✅ Comentarios: tabla comentarios lista');
  } catch (err) {
    console.error('Comentarios migration warning:', err.message);
  }
})();

// GET /api/comentarios?entidad_tipo=contrato&entidad_id=5
router.get('/', async (req, res) => {
  const { entidad_tipo, entidad_id } = req.query;
  if (!ENTIDADES[entidad_tipo] || !entidad_id) {
    return res.status(400).json({ error: 'entidad_tipo y entidad_id son requeridos' });
  }
  try {
    // Acceso por sala: solo se leen comentarios de entidades de la sala del usuario
    if (!(await puedeAccederEntidad(req.user, entidad_tipo, entidad_id))) {
      return res.status(404).json({ error: 'Recurso no encontrado' });
    }
    const result = await pool.query(`
      SELECT co.id, co.texto, co.created_at,
             u.id AS usuario_id, COALESCE(u.nombre, 'Sistema') AS usuario_nombre,
             r.label AS usuario_rol_label
      FROM comentarios co
      LEFT JOIN usuarios u ON co.usuario_id = u.id
      LEFT JOIN roles r ON u.rol_id = r.id
      WHERE co.entidad_tipo = $1 AND co.entidad_id = $2
      ORDER BY co.created_at DESC, co.id DESC
    `, [entidad_tipo, entidad_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/comentarios  { entidad_tipo, entidad_id, texto }
// Cualquier usuario autenticado con acceso al módulo puede comentar; el
// comentario queda firmado con su usuario y fecha (línea de tiempo inmutable).
router.post('/', async (req, res) => {
  const { entidad_tipo, entidad_id, texto } = req.body;
  if (!ENTIDADES[entidad_tipo] || !entidad_id) {
    return res.status(400).json({ error: 'entidad_tipo y entidad_id son requeridos' });
  }
  if (!texto || !String(texto).trim()) {
    return res.status(400).json({ error: 'El comentario no puede estar vacío' });
  }
  try {
    // Validar que la entidad exista (evita comentarios huérfanos)
    const ent = ENTIDADES[entidad_tipo];
    const existe = await pool.query(`SELECT 1 FROM ${ent.tabla} WHERE id = $1`, [entidad_id]);
    if (existe.rows.length === 0) {
      return res.status(404).json({ error: `No existe el ${ent.label} indicado` });
    }
    // Acceso por sala: solo se comenta en entidades de la sala del usuario
    if (!(await puedeAccederEntidad(req.user, entidad_tipo, entidad_id))) {
      return res.status(404).json({ error: `No existe el ${ent.label} indicado` });
    }

    const result = await pool.query(`
      INSERT INTO comentarios (entidad_tipo, entidad_id, usuario_id, texto)
      VALUES ($1, $2, $3, $4)
      RETURNING id, texto, created_at
    `, [entidad_tipo, entidad_id, req.user.id, String(texto).trim()]);

    req.audit('agregar_comentario', 'comentarios', result.rows[0].id, { entidad_tipo, entidad_id });

    res.status(201).json({
      ...result.rows[0],
      usuario_id: req.user.id,
      usuario_nombre: req.user.nombre,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
