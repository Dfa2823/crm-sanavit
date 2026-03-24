/**
 * Middleware de multi-tenancy.
 *
 * Lee el tenant_id del JWT payload (req.user.tenant_id) o usa 1 por defecto.
 * Inyecta req.tenant_id para que las rutas puedan usarlo en el futuro.
 *
 * Para futuro: podría leer del subdominio (empresa1.crm.com) o de un header.
 */
function tenantMiddleware(req, res, next) {
  // Si hay usuario autenticado con tenant_id, usarlo; sino default 1
  req.tenant_id = (req.user && req.user.tenant_id) ? req.user.tenant_id : 1;
  next();
}

module.exports = tenantMiddleware;
