const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('../db');
const { EVENTOS_VALIDOS } = require('../utils/webhook');

const router = express.Router();

// Auto-migración: columnas permisos y campos salariales
;(async () => {
  try {
    await pool.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS permisos JSONB DEFAULT NULL');
    await pool.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS sueldo_base NUMERIC(10,2) DEFAULT 0');
    await pool.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS pct_comision_venta NUMERIC(5,2) DEFAULT 10.00');
    await pool.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS pct_comision_cobro NUMERIC(5,2) DEFAULT 0');
    await pool.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bono_por_tour NUMERIC(10,2) DEFAULT 0');
    await pool.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bono_por_cita NUMERIC(10,2) DEFAULT 0');
    await pool.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS pct_desbloqueo NUMERIC(5,2) DEFAULT 30.00');
    // Columna para asignar asesor de cartera a un contrato
    await pool.query('ALTER TABLE contratos ADD COLUMN IF NOT EXISTS asesor_cartera_id INTEGER REFERENCES usuarios(id)');

    // ── PARTE 1: Roles nuevos ────────────────────────────────────
    await pool.query(`
      INSERT INTO roles (nombre, label) VALUES
        ('jefe_sala', 'Jefe de Sala'),
        ('sac', 'Servicio al Cliente'),
        ('cartera', 'Asesor de Cartera'),
        ('medico', 'Médico'),
        ('asistente', 'Asistente Operativa'),
        ('oficios_varios', 'Oficios Varios'),
        ('business_manager', 'Business Manager'),
        ('director_operativo', 'Director Operativo')
      ON CONFLICT (nombre) DO NOTHING
    `);

    // ── PARTE 3: Carga de usuarios reales ────────────────────────
    const HASH = bcrypt.hashSync('123456', 10);

    // Helper: obtener rol_id por nombre
    const getRolId = async (nombre) => {
      const r = await pool.query('SELECT id FROM roles WHERE nombre = $1', [nombre]);
      return r.rows[0]?.id || null;
    };

    const rolTmk          = await getRolId('tmk');
    const rolConsultor     = await getRolId('consultor');
    const rolOutsourcing   = await getRolId('outsourcing');
    const rolConfirmador   = await getRolId('confirmador');
    const rolHostess       = await getRolId('hostess');
    const rolSupervisor    = await getRolId('supervisor_cc');
    const rolMedico        = await getRolId('medico');
    const rolOficiosVarios = await getRolId('oficios_varios');
    const rolJefeSala      = await getRolId('jefe_sala');
    const rolBusinessMgr   = await getRolId('business_manager');
    const rolSac           = await getRolId('sac');
    const rolCartera       = await getRolId('cartera') || await getRolId('asesor_cartera');
    const rolAsistente     = await getRolId('asistente');

    const usuariosReales = [
      // ── TMK (sala 1) ──────────────────────────────────────────
      { nombre: 'Victoria Sanchez',              username: 'victoria.sanchez',    rol_id: rolTmk,          sala_id: 1 },
      { nombre: 'Angie Quishpe',                 username: 'angie.quishpe',       rol_id: rolTmk,          sala_id: 1 },
      { nombre: 'Angelica Cabezas',              username: 'angelica.cabezas',    rol_id: rolTmk,          sala_id: 1 },
      { nombre: 'Ximena Vera',                   username: 'ximena.vera',         rol_id: rolTmk,          sala_id: 1 },
      { nombre: 'Joselyn Veloz',                 username: 'joselyn.veloz',       rol_id: rolTmk,          sala_id: 1 },
      { nombre: 'Adriana Mosquera',              username: 'adriana.mosquera',    rol_id: rolTmk,          sala_id: 1 },
      { nombre: 'Alejandra Baquerizo',           username: 'alejandra.baquerizo', rol_id: rolTmk,          sala_id: 1 },
      { nombre: 'Heidy Ramirez',                 username: 'heidy.ramirez',       rol_id: rolTmk,          sala_id: 1 },
      { nombre: 'Pamela Torres',                 username: 'pamela.torres',       rol_id: rolTmk,          sala_id: 1 },
      { nombre: 'Danny Loor',                    username: 'danny.loor',          rol_id: rolTmk,          sala_id: 1 },
      { nombre: 'Keyla Romero',                  username: 'keyla.romero',        rol_id: rolTmk,          sala_id: 1 },
      { nombre: 'Josue Vasconez',                username: 'josue.vasconez',      rol_id: rolTmk,          sala_id: 1 },
      { nombre: 'Alejandro Montufar',            username: 'alejandro.montufar', rol_id: rolTmk,          sala_id: 1 },
      { nombre: 'Jose Acosta',                   username: 'jose.acosta',         rol_id: rolTmk,          sala_id: 1 },
      { nombre: 'Pablo Estrella',                username: 'pablo.estrella',      rol_id: rolTmk,          sala_id: 1 },
      { nombre: 'Dayana Delgado',                username: 'dayana.delgado',      rol_id: rolTmk,          sala_id: 1 },
      // Nuevos TMK (USUARIOS.xlsx - Mar 2026)
      { nombre: 'Waleska Valentina Diaz',        username: 'waleska.diaz',        rol_id: rolTmk,          sala_id: 1 },
      { nombre: 'Angela Rebeca Corella Garcia',  username: 'angela.corella',      rol_id: rolTmk,          sala_id: 1 },
      { nombre: 'Jhon Denver Beltran Granda',    username: 'jhon.beltran',        rol_id: rolTmk,          sala_id: 1 },
      { nombre: 'Bertha Viviana Espinoza Loor',  username: 'bertha.espinoza',     rol_id: rolTmk,          sala_id: 1 },
      { nombre: 'Marilyn Martinez',              username: 'marilyn.martinez',    rol_id: rolTmk,          sala_id: 1 },
      { nombre: 'Camila Yamileth Lara Vilana',   username: 'camila.lara',         rol_id: rolTmk,          sala_id: 1 },
      { nombre: 'Luis Fernando Quinde Cuasatar', username: 'luis.quinde',         rol_id: rolTmk,          sala_id: 1 },
      { nombre: 'Dayana Anabel Coro Hernandez',  username: 'dayana.coro',         rol_id: rolTmk,          sala_id: 1 },
      { nombre: 'Alia Ganchala',                 username: 'alia.ganchala',       rol_id: rolTmk,          sala_id: 1 },
      { nombre: 'Katherine Lizeth Mariscal Pilamunga', username: 'katherine.mariscal', rol_id: rolTmk,    sala_id: 1 },
      { nombre: 'Josselyn Elizabeth Coello Villamar',  username: 'josselyn.coello',    rol_id: rolTmk,    sala_id: 1 },
      { nombre: 'Sharon Celina Toro Merino',     username: 'sharon.toro',         rol_id: rolTmk,          sala_id: 1 },
      { nombre: 'Diana Alexandra Calderon Pinchao', username: 'diana.calderon',   rol_id: rolTmk,          sala_id: 1 },
      { nombre: 'Ana Lucia Neacato Morales',     username: 'ana.neacato',         rol_id: rolTmk,          sala_id: 1 },
      { nombre: 'Andres Javier Ayala Ruiz',      username: 'andres.ayala',        rol_id: rolTmk,          sala_id: 1 },
      { nombre: 'Jaqueline Dolores Silva Aguilar', username: 'jaqueline.silva',   rol_id: rolTmk,          sala_id: 1 },
      { nombre: 'Sonia Yimabel Vernaza',         username: 'sonia.vernaza',       rol_id: rolTmk,          sala_id: 1 },
      // ── CONSULTOR (sala 1) ─────────────────────────────────────
      { nombre: 'Carlos Villacis',               username: 'carlos.villacis',     rol_id: rolConsultor,    sala_id: 1 },
      { nombre: 'Wilmer Paredes',                username: 'wilmer.paredes',      rol_id: rolConsultor,    sala_id: 1 },
      { nombre: 'Samia Mosquera',                username: 'samia.mosquera',      rol_id: rolConsultor,    sala_id: 1 },
      { nombre: 'Darwin Chafla',                 username: 'darwin.chafla',       rol_id: rolConsultor,    sala_id: 1 },
      { nombre: 'Patricia Bravo',                username: 'patricia.bravo',      rol_id: rolConsultor,    sala_id: 1 },
      // Nuevos consultores (USUARIOS.xlsx - Mar 2026)
      { nombre: 'Jhony Cardenas Guaricela',      username: 'jhony.cardenas',      rol_id: rolConsultor,    sala_id: 1 },
      { nombre: 'Leslie Daniela Romo Lopez',     username: 'leslie.romo',         rol_id: rolConsultor,    sala_id: 1 },
      { nombre: 'Fatima Fernanda Bravo Ponce',   username: 'fatima.bravo',        rol_id: rolConsultor,    sala_id: 1 },
      { nombre: 'Jhanny Clarita Moreno Olvera',  username: 'jhanny.moreno',       rol_id: rolConsultor,    sala_id: 1 },
      { nombre: 'Ximena Piedad Vallejo Olalla',  username: 'ximena.vallejo',      rol_id: rolConsultor,    sala_id: 1 },
      { nombre: 'Limber Mosquera Saa',           username: 'limber.mosquera',     rol_id: rolConsultor,    sala_id: 1 },
      // ── OUTSOURCING ────────────────────────────────────────────
      { nombre: 'Sergio Arias',                  username: 'sergio.arias',        rol_id: rolOutsourcing,  sala_id: 1 },
      { nombre: 'Santiago Barona',               username: 'santiago.barona',     rol_id: rolOutsourcing,  sala_id: 1 },
      { nombre: 'Sneider Caamano',               username: 'sneider.caamano',     rol_id: rolOutsourcing,  sala_id: 1 },
      // ── CONFIRMADOR ────────────────────────────────────────────
      { nombre: 'Talia Pucuna',                  username: 'talia.pucuna',        rol_id: rolConfirmador,  sala_id: 1 },
      { nombre: 'Monica Tandazo',                username: 'monica.tandazo',      rol_id: rolConfirmador,  sala_id: 1 },
      { nombre: 'Eddie Antonio Vasquez Marchan', username: 'eddie.vasquez',       rol_id: rolConfirmador,  sala_id: 1 },
      // ── HOSTESS ────────────────────────────────────────────────
      { nombre: 'Elizabeth Perez',               username: 'elizabeth.perez',     rol_id: rolHostess,      sala_id: 1 },
      { nombre: 'Katherine Paola Orbe De La Torre', username: 'katherine.orbe',   rol_id: rolHostess,      sala_id: 1 },
      // ── SUPERVISOR ─────────────────────────────────────────────
      { nombre: 'Joffrey Gutierrez',             username: 'joffrey.gutierrez',  rol_id: rolSupervisor,   sala_id: 1 },
      { nombre: 'Jofren Arias',                  username: 'jofren.arias',       rol_id: rolSupervisor,   sala_id: 1 },
      // ── MEDICO ─────────────────────────────────────────────────
      { nombre: 'Maricela Zapata',               username: 'maricela.zapata',     rol_id: rolMedico,       sala_id: 1 },
      { nombre: 'Yarihany Martinez',             username: 'yarihany.martinez',   rol_id: rolMedico,       sala_id: 1 },
      // ── OFICIOS VARIOS ─────────────────────────────────────────
      { nombre: 'Jose Tipan',                    username: 'jose.tipan',          rol_id: rolOficiosVarios, sala_id: 1 },
      { nombre: 'Wendy Del Pilar Morales Perugachi', username: 'wendy.morales',   rol_id: rolOficiosVarios, sala_id: 1 },
      // ── JEFE SALA ──────────────────────────────────────────────
      { nombre: 'Juan Gutierrez',                username: 'juan.gutierrez',      rol_id: rolJefeSala,     sala_id: 1 },
      { nombre: 'Marianela Pena Angarita',       username: 'marianela.pena',      rol_id: rolJefeSala,     sala_id: 1 },
      // ── SAC ────────────────────────────────────────────────────
      { nombre: 'David Neptali Valarezo Gavilanes', username: 'david.valarezo',   rol_id: rolSac,          sala_id: 1 },
      // ── CARTERA ────────────────────────────────────────────────
      { nombre: 'Thalia Daniela Chillagano',     username: 'thalia.chillagano',   rol_id: rolCartera,      sala_id: 1 },
      // ── ASISTENTE OPERATIVA ────────────────────────────────────
      { nombre: 'Isabella Vargas Valdes',        username: 'isabella.vargas',     rol_id: rolAsistente,    sala_id: 1 },
      // ── BUSINESS MANAGER ───────────────────────────────────────
      { nombre: 'Lizethe Valdes',                username: 'lizethe.valdes',      rol_id: rolBusinessMgr,  sala_id: 1 },
    ];

    for (const u of usuariosReales) {
      if (!u.rol_id) continue; // skip if role not found
      await pool.query(`
        INSERT INTO usuarios (nombre, username, password_hash, rol_id, sala_id, activo)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (username) DO NOTHING
      `, [u.nombre, u.username, HASH, u.rol_id, u.sala_id]);
    }
    console.log('Migration: roles nuevos + usuarios reales OK');
  } catch (e) {
    console.error('Migration usuarios:', e.message);
  }
})();

// ── Middleware de rol admin/director ──────────────────────────
function requireAdmin(req, res, next) {
  if (req.user.rol !== 'admin' && req.user.rol !== 'director') {
    return res.status(403).json({ error: 'No autorizado' });
  }
  next();
}

// ═══════════════════════════════════════════════════════════════
// USUARIOS
// ═══════════════════════════════════════════════════════════════

/**
 * @openapi
 * /api/admin/usuarios:
 *   get:
 *     tags: [Admin]
 *     summary: Listar usuarios del sistema
 *     description: Retorna todos los usuarios con su rol, sala y configuracion salarial. Solo admin y director.
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   nombre:
 *                     type: string
 *                   username:
 *                     type: string
 *                   activo:
 *                     type: boolean
 *                   rol:
 *                     type: string
 *                   rol_label:
 *                     type: string
 *                   sala_nombre:
 *                     type: string
 *                   sueldo_base:
 *                     type: number
 *       403:
 *         description: Sin permiso de administrador
 */
router.get('/usuarios', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id, u.nombre, u.username, u.activo, u.created_at, u.permisos,
        COALESCE(u.sueldo_base,0)            AS sueldo_base,
        COALESCE(u.pct_comision_venta,10)    AS pct_comision_venta,
        COALESCE(u.pct_comision_cobro,0)     AS pct_comision_cobro,
        COALESCE(u.bono_por_tour,0)          AS bono_por_tour,
        COALESCE(u.bono_por_cita,0)          AS bono_por_cita,
        COALESCE(u.pct_desbloqueo,30)        AS pct_desbloqueo,
        r.id AS rol_id, r.nombre AS rol, r.label AS rol_label,
        s.id AS sala_id, s.nombre AS sala_nombre, s.ciudad AS sala_ciudad
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      LEFT JOIN salas s ON u.sala_id = s.id
      ORDER BY u.activo DESC, r.nombre, u.nombre
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// POST /api/admin/usuarios — crear nuevo usuario
router.post('/usuarios', requireAdmin, async (req, res) => {
  const {
    nombre, username, password, rol_id, sala_id,
    sueldo_base, pct_comision_venta, pct_comision_cobro,
    bono_por_tour, bono_por_cita, pct_desbloqueo,
  } = req.body;

  if (!nombre || !username || !password || !rol_id) {
    return res.status(400).json({ error: 'nombre, username, password y rol_id son requeridos' });
  }

  try {
    // Verificar que el username no exista
    const existing = await pool.query(
      'SELECT id FROM usuarios WHERE username = $1',
      [username]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'El username ya existe' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(`
      INSERT INTO usuarios (
        nombre, username, password_hash, rol_id, sala_id, activo,
        sueldo_base, pct_comision_venta, pct_comision_cobro,
        bono_por_tour, bono_por_cita, pct_desbloqueo
      )
      VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `, [
      nombre, username, password_hash, rol_id, sala_id || null,
      sueldo_base || 0,
      pct_comision_venta !== undefined ? pct_comision_venta : 10,
      pct_comision_cobro || 0,
      bono_por_tour || 0,
      bono_por_cita || 0,
      pct_desbloqueo !== undefined ? pct_desbloqueo : 30,
    ]);

    const newUser = await pool.query(`
      SELECT
        u.id, u.nombre, u.username, u.activo, u.created_at, u.permisos,
        COALESCE(u.sueldo_base,0) AS sueldo_base,
        COALESCE(u.pct_comision_venta,10) AS pct_comision_venta,
        COALESCE(u.pct_comision_cobro,0) AS pct_comision_cobro,
        COALESCE(u.bono_por_tour,0) AS bono_por_tour,
        COALESCE(u.bono_por_cita,0) AS bono_por_cita,
        COALESCE(u.pct_desbloqueo,30) AS pct_desbloqueo,
        r.id AS rol_id, r.nombre AS rol, r.label AS rol_label,
        s.id AS sala_id, s.nombre AS sala_nombre, s.ciudad AS sala_ciudad
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      LEFT JOIN salas s ON u.sala_id = s.id
      WHERE u.id = $1
    `, [result.rows[0].id]);

    req.audit('crear_usuario', 'usuarios', result.rows[0].id, { username, rol_id, sala_id });

    res.status(201).json(newUser.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// PATCH /api/admin/usuarios/:id — actualizar usuario
router.patch('/usuarios/:id', requireAdmin, async (req, res) => {
  const {
    nombre, sala_id, rol_id, activo, password,
    sueldo_base, pct_comision_venta, pct_comision_cobro,
    bono_por_tour, bono_por_cita, pct_desbloqueo,
  } = req.body;

  try {
    const updates = [];
    const params = [];
    let idx = 1;

    if (nombre !== undefined)             { updates.push(`nombre = $${idx++}`);             params.push(nombre); }
    if (sala_id !== undefined)            { updates.push(`sala_id = $${idx++}`);            params.push(sala_id); }
    if (rol_id !== undefined)             { updates.push(`rol_id = $${idx++}`);             params.push(rol_id); }
    if (activo !== undefined)             { updates.push(`activo = $${idx++}`);             params.push(activo); }
    if (sueldo_base !== undefined)        { updates.push(`sueldo_base = $${idx++}`);        params.push(sueldo_base); }
    if (pct_comision_venta !== undefined) { updates.push(`pct_comision_venta = $${idx++}`); params.push(pct_comision_venta); }
    if (pct_comision_cobro !== undefined) { updates.push(`pct_comision_cobro = $${idx++}`); params.push(pct_comision_cobro); }
    if (bono_por_tour !== undefined)      { updates.push(`bono_por_tour = $${idx++}`);      params.push(bono_por_tour); }
    if (bono_por_cita !== undefined)      { updates.push(`bono_por_cita = $${idx++}`);      params.push(bono_por_cita); }
    if (pct_desbloqueo !== undefined)     { updates.push(`pct_desbloqueo = $${idx++}`);     params.push(pct_desbloqueo); }

    if (password !== undefined && password !== '') {
      const password_hash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${idx++}`);
      params.push(password_hash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    params.push(req.params.id);

    await pool.query(`
      UPDATE usuarios SET ${updates.join(', ')} WHERE id = $${idx}
    `, params);

    const updated = await pool.query(`
      SELECT
        u.id, u.nombre, u.username, u.activo, u.created_at, u.permisos,
        COALESCE(u.sueldo_base,0) AS sueldo_base,
        COALESCE(u.pct_comision_venta,10) AS pct_comision_venta,
        COALESCE(u.pct_comision_cobro,0) AS pct_comision_cobro,
        COALESCE(u.bono_por_tour,0) AS bono_por_tour,
        COALESCE(u.bono_por_cita,0) AS bono_por_cita,
        COALESCE(u.pct_desbloqueo,30) AS pct_desbloqueo,
        r.id AS rol_id, r.nombre AS rol, r.label AS rol_label,
        s.id AS sala_id, s.nombre AS sala_nombre, s.ciudad AS sala_ciudad
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      LEFT JOIN salas s ON u.sala_id = s.id
      WHERE u.id = $1
    `, [req.params.id]);

    if (updated.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const cambios = {};
    if (nombre !== undefined) cambios.nombre = nombre;
    if (sala_id !== undefined) cambios.sala_id = sala_id;
    if (rol_id !== undefined) cambios.rol_id = rol_id;
    if (activo !== undefined) cambios.activo = activo;
    if (sueldo_base !== undefined) cambios.sueldo_base = sueldo_base;
    if (password !== undefined && password !== '') cambios.password_changed = true;
    req.audit('modificar_usuario', 'usuarios', req.params.id, cambios);

    res.json(updated.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// DELETE /api/admin/usuarios/:id — soft delete (activo = false)
// Si es TMK con leads pendientes, exige reasignación previa
router.delete('/usuarios/:id', requireAdmin, async (req, res) => {
  try {
    if (Number(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
    }

    // Verificar si es TMK con leads pendientes
    const userRes = await pool.query(
      `SELECT u.id, r.nombre AS rol FROM usuarios u JOIN roles r ON u.rol_id = r.id WHERE u.id = $1`,
      [req.params.id]
    );
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (userRes.rows[0].rol === 'tmk') {
      const leadsRes = await pool.query(
        `SELECT COUNT(*)::integer AS pendientes FROM leads WHERE tmk_id = $1 AND estado IN ('pendiente', 'tentativa', 'confirmada')`,
        [req.params.id]
      );
      const pendientes = leadsRes.rows[0].pendientes;
      if (pendientes > 0) {
        return res.status(409).json({
          error: 'requiere_reasignacion',
          requiere_reasignacion: true,
          leads_pendientes: pendientes,
          message: `Este TMK tiene ${pendientes} leads pendientes. Reasígnelos antes de inactivar.`,
        });
      }
    }

    const result = await pool.query(
      'UPDATE usuarios SET activo = false WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    req.audit('inactivar_usuario', 'usuarios', req.params.id);

    res.json({ message: 'Usuario desactivado correctamente', id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al desactivar usuario' });
  }
});

// POST /api/admin/usuarios/:id/reasignar — reasignar leads de un TMK a otros TMKs activos
router.post('/usuarios/:id/reasignar', requireAdmin, async (req, res) => {
  try {
    const tmkId = req.params.id;
    // Obtener leads pendientes del TMK
    const leadsRes = await pool.query(
      `SELECT id, sala_id FROM leads WHERE tmk_id = $1 AND estado IN ('pendiente', 'tentativa', 'confirmada')`,
      [tmkId]
    );
    if (leadsRes.rows.length === 0) {
      return res.json({ reasignados: 0 });
    }

    // Obtener TMKs activos de la misma sala (o todas las salas)
    const tmkSala = (await pool.query('SELECT sala_id FROM usuarios WHERE id = $1', [tmkId])).rows[0]?.sala_id;
    const tmksRes = await pool.query(
      `SELECT id FROM usuarios u JOIN roles r ON u.rol_id = r.id
       WHERE r.nombre = 'tmk' AND u.activo = true AND u.id != $1
         AND ($2::integer IS NULL OR u.sala_id = $2)`,
      [tmkId, tmkSala]
    );
    if (tmksRes.rows.length === 0) {
      return res.status(400).json({ error: 'No hay otros TMKs activos para reasignar' });
    }

    const tmkIds = tmksRes.rows.map(t => t.id);
    let idx = 0;
    for (const lead of leadsRes.rows) {
      const nuevoTmk = tmkIds[idx % tmkIds.length];
      await pool.query('UPDATE leads SET tmk_id = $1, updated_at = NOW() WHERE id = $2', [nuevoTmk, lead.id]);
      idx++;
    }

    res.json({ reasignados: leadsRes.rows.length, tmks_destino: tmkIds.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/usuarios/:id/reasignar-e-inactivar — reasignar leads + inactivar usuario en un solo paso
router.post('/usuarios/:id/reasignar-e-inactivar', requireAdmin, async (req, res) => {
  try {
    const tmkId = Number(req.params.id);

    if (tmkId === req.user.id) {
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
    }

    // Obtener leads pendientes del TMK
    const leadsRes = await pool.query(
      `SELECT id FROM leads WHERE tmk_id = $1 AND estado IN ('pendiente', 'tentativa', 'confirmada')`,
      [tmkId]
    );

    // Obtener TMKs activos de la misma sala
    const tmkSala = (await pool.query('SELECT sala_id FROM usuarios WHERE id = $1', [tmkId])).rows[0]?.sala_id;
    const tmksRes = await pool.query(
      `SELECT id, nombre FROM usuarios u JOIN roles r ON u.rol_id = r.id
       WHERE r.nombre = 'tmk' AND u.activo = true AND u.id != $1
         AND ($2::integer IS NULL OR u.sala_id = $2)`,
      [tmkId, tmkSala]
    );

    let reasignados = 0;
    const tmkIds = tmksRes.rows.map(t => t.id);

    if (leadsRes.rows.length > 0) {
      if (tmkIds.length === 0) {
        return res.status(400).json({ error: 'No hay otros TMKs activos en la misma sala para reasignar los leads' });
      }

      // Distribuir leads aleatoriamente entre TMKs activos
      let idx = 0;
      for (const lead of leadsRes.rows) {
        const randomIdx = Math.floor(Math.random() * tmkIds.length);
        const nuevoTmk = tmkIds[randomIdx];
        await pool.query('UPDATE leads SET tmk_id = $1, updated_at = NOW() WHERE id = $2', [nuevoTmk, lead.id]);
        idx++;
      }
      reasignados = leadsRes.rows.length;
    }

    // Inactivar el usuario
    await pool.query('UPDATE usuarios SET activo = false WHERE id = $1', [tmkId]);

    res.json({
      message: 'Usuario inactivado correctamente',
      reasignados,
      tmks_destino: tmkIds.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al reasignar e inactivar: ' + err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// SALAS
// ═══════════════════════════════════════════════════════════════

// GET /api/admin/salas — listar todas las salas
router.get('/salas', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM salas ORDER BY activo DESC, nombre ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener salas' });
  }
});

// POST /api/admin/salas — crear sala
router.post('/salas', requireAdmin, async (req, res) => {
  const { nombre, ciudad, direccion } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre de la sala es requerido' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO salas (nombre, ciudad, direccion, activo)
      VALUES ($1, $2, $3, true)
      RETURNING *
    `, [nombre, ciudad || null, direccion || null]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear sala' });
  }
});

// PATCH /api/admin/salas/:id — actualizar sala
router.patch('/salas/:id', requireAdmin, async (req, res) => {
  const { nombre, ciudad, direccion, activo, serial_contrato } = req.body;

  try {
    const updates = [];
    const params = [];
    let idx = 1;

    if (nombre !== undefined)           { updates.push(`nombre = $${idx++}`);           params.push(nombre); }
    if (ciudad !== undefined)           { updates.push(`ciudad = $${idx++}`);           params.push(ciudad); }
    if (direccion !== undefined)        { updates.push(`direccion = $${idx++}`);        params.push(direccion); }
    if (activo !== undefined)           { updates.push(`activo = $${idx++}`);           params.push(activo); }
    if (serial_contrato !== undefined)  { updates.push(`serial_contrato = $${idx++}`); params.push(serial_contrato); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    params.push(req.params.id);

    const result = await pool.query(`
      UPDATE salas SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *
    `, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sala no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar sala' });
  }
});

// ═══════════════════════════════════════════════════════════════
// TIPIFICACIONES
// ═══════════════════════════════════════════════════════════════

// GET /api/admin/tipificaciones — listar todas las tipificaciones
router.get('/tipificaciones', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tipificaciones ORDER BY activo DESC, nombre ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener tipificaciones' });
  }
});

// POST /api/admin/tipificaciones — crear tipificacion
router.post('/tipificaciones', requireAdmin, async (req, res) => {
  const { nombre, requiere_fecha_cita, requiere_fecha_rellamar, color } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre de la tipificación es requerido' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO tipificaciones (nombre, requiere_fecha_cita, requiere_fecha_rellamar, color, activo)
      VALUES ($1, $2, $3, $4, true)
      RETURNING *
    `, [
      nombre,
      requiere_fecha_cita || false,
      requiere_fecha_rellamar || false,
      color || null,
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear tipificación' });
  }
});

// PATCH /api/admin/tipificaciones/:id — actualizar tipificacion
router.patch('/tipificaciones/:id', requireAdmin, async (req, res) => {
  const { nombre, requiere_fecha_cita, requiere_fecha_rellamar, color, activo } = req.body;

  try {
    const updates = [];
    const params = [];
    let idx = 1;

    if (nombre !== undefined)                { updates.push(`nombre = $${idx++}`);                params.push(nombre); }
    if (requiere_fecha_cita !== undefined)   { updates.push(`requiere_fecha_cita = $${idx++}`);   params.push(requiere_fecha_cita); }
    if (requiere_fecha_rellamar !== undefined) { updates.push(`requiere_fecha_rellamar = $${idx++}`); params.push(requiere_fecha_rellamar); }
    if (color !== undefined)                 { updates.push(`color = $${idx++}`);                 params.push(color); }
    if (activo !== undefined)                { updates.push(`activo = $${idx++}`);                params.push(activo); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    params.push(req.params.id);

    const result = await pool.query(`
      UPDATE tipificaciones SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *
    `, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tipificación no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar tipificación' });
  }
});

// ═══════════════════════════════════════════════════════════════
// FUENTES
// ═══════════════════════════════════════════════════════════════

// GET /api/admin/fuentes — listar todas las fuentes
router.get('/fuentes', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM fuentes ORDER BY activo DESC, nombre ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener fuentes' });
  }
});

// POST /api/admin/fuentes — crear fuente
router.post('/fuentes', requireAdmin, async (req, res) => {
  const { nombre, descripcion } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre de la fuente es requerido' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO fuentes (nombre, descripcion, activo)
      VALUES ($1, $2, true)
      RETURNING *
    `, [nombre, descripcion || null]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear fuente' });
  }
});

// PATCH /api/admin/fuentes/:id — actualizar fuente
router.patch('/fuentes/:id', requireAdmin, async (req, res) => {
  const { nombre, descripcion, activo } = req.body;

  try {
    const updates = [];
    const params = [];
    let idx = 1;

    if (nombre !== undefined)      { updates.push(`nombre = $${idx++}`);      params.push(nombre); }
    if (descripcion !== undefined) { updates.push(`descripcion = $${idx++}`); params.push(descripcion); }
    if (activo !== undefined)      { updates.push(`activo = $${idx++}`);      params.push(activo); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    params.push(req.params.id);

    const result = await pool.query(`
      UPDATE fuentes SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *
    `, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fuente no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar fuente' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ROLES
// ═══════════════════════════════════════════════════════════════

// GET /api/admin/roles — listar todos los roles
router.get('/roles', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM roles ORDER BY nombre ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener roles' });
  }
});

// ═══════════════════════════════════════════════════════════════
// FORMAS DE PAGO
// ═══════════════════════════════════════════════════════════════

// GET /api/admin/formas-pago
router.get('/formas-pago', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM formas_pago ORDER BY nombre');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener formas de pago' });
  }
});

// POST /api/admin/formas-pago
router.post('/formas-pago', requireAdmin, async (req, res) => {
  const { nombre, tipo = 'efectivo' } = req.body;
  if (!nombre) return res.status(400).json({ error: 'nombre requerido' });
  try {
    const result = await pool.query(
      'INSERT INTO formas_pago (nombre, tipo) VALUES ($1, $2) RETURNING *',
      [nombre, tipo]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear forma de pago' });
  }
});

// PATCH /api/admin/usuarios/:id/permisos — actualizar permisos modulares
router.patch('/usuarios/:id/permisos', requireAdmin, async (req, res) => {
  const { permisos } = req.body;
  try {
    const valor = permisos === null ? null : JSON.stringify(permisos);
    const result = await pool.query(
      'UPDATE usuarios SET permisos = $1 WHERE id = $2 RETURNING id, permisos',
      [valor, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    req.audit('cambiar_permisos', 'usuarios', req.params.id, { permisos });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar permisos' });
  }
});

// PATCH /api/admin/formas-pago/:id
router.patch('/formas-pago/:id', requireAdmin, async (req, res) => {
  const { nombre, tipo, activo } = req.body;
  try {
    const result = await pool.query(
      'UPDATE formas_pago SET nombre=COALESCE($1,nombre), tipo=COALESCE($2,tipo), activo=COALESCE($3,activo) WHERE id=$4 RETURNING *',
      [nombre, tipo, activo, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'No encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar forma de pago' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ESCALAS TMK
// ═══════════════════════════════════════════════════════════════

// GET /api/admin/escalas-tmk — listar todas las escalas
router.get('/escalas-tmk', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM escalas_tmk ORDER BY tours_min ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener escalas TMK' });
  }
});

// POST /api/admin/escalas-tmk — crear nueva escala
router.post('/escalas-tmk', requireAdmin, async (req, res) => {
  const { tours_min, tours_max, bono_por_tour, bono_semanal } = req.body;

  if (tours_min === undefined || tours_max === undefined || bono_por_tour === undefined) {
    return res.status(400).json({ error: 'tours_min, tours_max y bono_por_tour son requeridos' });
  }

  try {
    const result = await pool.query(`
      INSERT INTO escalas_tmk (tours_min, tours_max, bono_por_tour, bono_semanal)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [tours_min, tours_max, bono_por_tour, bono_semanal || 0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear escala TMK' });
  }
});

// PATCH /api/admin/escalas-tmk/:id — actualizar escala
router.patch('/escalas-tmk/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { tours_min, tours_max, bono_por_tour, bono_semanal, activo } = req.body;

  try {
    const sets = [];
    const params = [id];
    let idx = 2;

    if (tours_min !== undefined)    { sets.push(`tours_min = $${idx++}`);    params.push(tours_min); }
    if (tours_max !== undefined)    { sets.push(`tours_max = $${idx++}`);    params.push(tours_max); }
    if (bono_por_tour !== undefined) { sets.push(`bono_por_tour = $${idx++}`); params.push(bono_por_tour); }
    if (bono_semanal !== undefined)  { sets.push(`bono_semanal = $${idx++}`);  params.push(bono_semanal); }
    if (activo !== undefined)        { sets.push(`activo = $${idx++}`);        params.push(activo); }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'Nada que actualizar' });
    }

    sets.push('updated_at = NOW()');

    const result = await pool.query(
      `UPDATE escalas_tmk SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Escala no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar escala TMK' });
  }
});

// ═══════════════════════════════════════════════════════════════
// WEBHOOKS
// ═══════════════════════════════════════════════════════════════

/**
 * @openapi
 * /api/admin/webhooks:
 *   get:
 *     tags: [Admin]
 *     summary: Listar webhooks configurados
 *     description: Retorna todos los webhooks registrados. Solo admin y director.
 *     responses:
 *       200:
 *         description: Lista de webhooks
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   evento:
 *                     type: string
 *                     enum: [nueva_venta, pago_registrado, lead_creado, tour_registrado]
 *                   url:
 *                     type: string
 *                   secreto:
 *                     type: string
 *                   activo:
 *                     type: boolean
 *                   created_at:
 *                     type: string
 *                     format: date-time
 */
router.get('/webhooks', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM webhooks ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener webhooks' });
  }
});

/**
 * @openapi
 * /api/admin/webhooks:
 *   post:
 *     tags: [Admin]
 *     summary: Crear webhook
 *     description: Registra un nuevo webhook para un evento. Eventos soportados nueva_venta, pago_registrado, lead_creado, tour_registrado.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [evento, url]
 *             properties:
 *               evento:
 *                 type: string
 *                 enum: [nueva_venta, pago_registrado, lead_creado, tour_registrado]
 *               url:
 *                 type: string
 *                 example: https://example.com/webhook
 *               secreto:
 *                 type: string
 *                 description: Secreto enviado en header X-Webhook-Secret
 *     responses:
 *       201:
 *         description: Webhook creado
 *       400:
 *         description: Evento invalido o datos faltantes
 */
router.post('/webhooks', requireAdmin, async (req, res) => {
  const { evento, url, secreto } = req.body;

  if (!evento || !url) {
    return res.status(400).json({ error: 'evento y url son requeridos' });
  }

  if (!EVENTOS_VALIDOS.includes(evento)) {
    return res.status(400).json({
      error: `Evento invalido. Eventos soportados: ${EVENTOS_VALIDOS.join(', ')}`,
    });
  }

  try {
    const result = await pool.query(
      'INSERT INTO webhooks (evento, url, secreto) VALUES ($1, $2, $3) RETURNING *',
      [evento, url, secreto || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear webhook' });
  }
});

/**
 * @openapi
 * /api/admin/webhooks/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Actualizar webhook
 *     description: Actualiza url, secreto o estado activo de un webhook.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               evento:
 *                 type: string
 *               url:
 *                 type: string
 *               secreto:
 *                 type: string
 *               activo:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Webhook actualizado
 *       404:
 *         description: Webhook no encontrado
 */
router.patch('/webhooks/:id', requireAdmin, async (req, res) => {
  const { evento, url, secreto, activo } = req.body;

  try {
    const updates = [];
    const params = [];
    let idx = 1;

    if (evento !== undefined) {
      if (!EVENTOS_VALIDOS.includes(evento)) {
        return res.status(400).json({
          error: `Evento invalido. Eventos soportados: ${EVENTOS_VALIDOS.join(', ')}`,
        });
      }
      updates.push(`evento = $${idx++}`); params.push(evento);
    }
    if (url !== undefined)     { updates.push(`url = $${idx++}`);     params.push(url); }
    if (secreto !== undefined) { updates.push(`secreto = $${idx++}`); params.push(secreto); }
    if (activo !== undefined)  { updates.push(`activo = $${idx++}`);  params.push(activo); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }

    params.push(req.params.id);
    const result = await pool.query(
      `UPDATE webhooks SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar webhook' });
  }
});

/**
 * @openapi
 * /api/admin/webhooks/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Eliminar webhook
 *     description: Elimina permanentemente un webhook.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Webhook eliminado
 *       404:
 *         description: Webhook no encontrado
 */
router.delete('/webhooks/:id', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM webhooks WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook no encontrado' });
    }

    res.json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar webhook' });
  }
});

module.exports = router;
