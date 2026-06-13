// Control de acceso por SALA para endpoints que reciben un :id de recurso.
// Cierra los IDOR (un usuario de una sala leyendo/modificando recursos de otra).
//
// Regla: admin/director (y los roles "globales" propios de cada módulo, p.ej.
// cartera o sac que operan centralizadamente sobre todas las salas) ven todo;
// el resto solo puede tocar recursos de SU sala (usuarios.sala_id). El sala_id
// viaja en el JWT (auth.js lo firma en el payload del login).
const pool = require('../db');

function esGlobal(user, rolesVenTodo = ['admin', 'director']) {
  return !!user && rolesVenTodo.includes(user.rol);
}

// ¿Puede el usuario acceder a este contrato? (por sala, salvo roles globales del módulo)
async function puedeAccederContrato(user, contratoId, rolesVenTodo = ['admin', 'director']) {
  if (!user) return false;
  if (esGlobal(user, rolesVenTodo)) return true;
  if (!user.sala_id) return false;
  const r = await pool.query('SELECT 1 FROM contratos WHERE id = $1 AND sala_id = $2', [contratoId, user.sala_id]);
  return r.rows.length > 0;
}

// ¿Puede el usuario acceder a esta persona? Solo si tiene algún lead, visita o
// contrato en SU sala (las personas no tienen sala propia; se deriva de sus
// registros). Los roles que operan cross-sala (sac, cartera, supervisor) ven todo.
async function puedeAccederPersona(user, personaId, rolesVenTodo = ['admin', 'director', 'sac', 'supervisor_cc', 'cartera', 'asesor_cartera']) {
  if (!user) return false;
  if (esGlobal(user, rolesVenTodo)) return true;
  if (!user.sala_id) return false;
  const r = await pool.query(`
    SELECT 1 WHERE
         EXISTS (SELECT 1 FROM leads        WHERE persona_id = $1 AND sala_id = $2)
      OR EXISTS (SELECT 1 FROM visitas_sala WHERE persona_id = $1 AND sala_id = $2)
      OR EXISTS (SELECT 1 FROM contratos    WHERE persona_id = $1 AND sala_id = $2)
  `, [personaId, user.sala_id]);
  return r.rows.length > 0;
}

// Acceso a una entidad genérica (para comentarios: contrato | pqr_ticket | lead).
// Cada tipo tiene su tabla y sus roles globales.
const ENTIDAD_SALA = {
  contrato:   { tabla: 'contratos',   rolesVenTodo: ['admin', 'director', 'asesor_cartera', 'cartera', 'sac'] },
  pqr_ticket: { tabla: 'pqr_tickets', rolesVenTodo: ['admin', 'director', 'sac'] },
  lead:       { tabla: 'leads',       rolesVenTodo: ['admin', 'director', 'supervisor_cc'] },
};
async function puedeAccederEntidad(user, entidadTipo, entidadId) {
  const cfg = ENTIDAD_SALA[entidadTipo];
  if (!cfg || !user) return false;
  if (esGlobal(user, cfg.rolesVenTodo)) return true;
  if (!user.sala_id) return false;
  const r = await pool.query(`SELECT 1 FROM ${cfg.tabla} WHERE id = $1 AND sala_id = $2`, [entidadId, user.sala_id]);
  return r.rows.length > 0;
}

module.exports = { esGlobal, puedeAccederContrato, puedeAccederPersona, puedeAccederEntidad };
