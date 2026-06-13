// Validación de montos monetarios. parseFloat por sí solo deja pasar NaN,
// Infinity, negativos y strings no numéricos hacia los cálculos de dinero;
// este helper los rechaza de raíz.
//   montoValido(v)            -> número finito en [0, 100M]
//   montoValido(v, {min:0.01}) -> exige > 0
function montoValido(v, { min = 0, max = 100000000 } = {}) {
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= min && n <= max;
}

module.exports = { montoValido };
