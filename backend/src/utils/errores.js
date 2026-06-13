// Mensaje de error seguro para el cliente.
// En producción NO exponemos err.message: filtra estructura de BD/SQL,
// nombres de columnas, rutas internas, etc. (mismo criterio que el handler
// central de index.js). En desarrollo sí, para poder depurar.
function msgError(err) {
  if (process.env.NODE_ENV === 'production') return 'Error interno del servidor';
  return (err && err.message) || 'Error interno del servidor';
}

module.exports = { msgError };
