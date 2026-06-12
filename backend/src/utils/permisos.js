// Control de acceso por módulo honrando los "permisos personalizados".
//
// El sistema tiene un solo rol por usuario (usuarios.rol_id), pero admite
// multi-cargo vía usuarios.permisos (array de módulos, p.ej. ["sac","leads",
// "ventas"]) que ya gobierna el MENÚ del frontend. Este helper extiende ese
// mismo mecanismo a los ENDPOINTS: un usuario tiene acceso a un módulo si
//   1) es admin/director,
//   2) su rol está en la lista base del endpoint, o
//   3) sus permisos personalizados incluyen el módulo.
// Los permisos viajan en el JWT (auth.js los firma en el payload del login).
function tieneAcceso(user, modulo, rolesBase = []) {
  if (!user) return false;
  if (user.rol === 'admin' || user.rol === 'director') return true;
  if (rolesBase.includes(user.rol)) return true;
  return Array.isArray(user.permisos) && user.permisos.includes(modulo);
}

module.exports = { tieneAcceso };
