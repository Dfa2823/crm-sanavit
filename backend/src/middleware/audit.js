const pool = require('../db');

/**
 * Registra una acción en audit_log
 * @param {object} params - { usuario_id, username, accion, tabla, registro_id, datos_despues, ip }
 */
async function auditLog({ usuario_id, username, accion, tabla, registro_id, datos_despues, ip }) {
  try {
    await pool.query(
      `INSERT INTO audit_log (usuario_id, username, accion, tabla, registro_id, datos_despues, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [usuario_id, username, accion, tabla, registro_id,
       datos_despues ? JSON.stringify(datos_despues) : null, ip]
    );
  } catch (e) {
    console.error('[AUDIT] Error:', e.message);
  }
}

/**
 * Middleware Express que agrega req.audit() como helper
 */
function auditMiddleware(req, res, next) {
  req.audit = (accion, tabla, registro_id, datos_despues) => {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    return auditLog({
      usuario_id: req.user?.id,
      username: req.user?.username || 'sistema',
      accion, tabla, registro_id, datos_despues, ip
    });
  };
  next();
}

module.exports = { auditLog, auditMiddleware };
