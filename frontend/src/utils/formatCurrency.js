/**
 * Formato de moneda consistente para Ecuador: $1,234.56
 * Usar en todas las paginas que muestren valores monetarios.
 */
export function fmt(val) {
  if (val === null || val === undefined) return '\u2014'
  return `$${Number(val).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Formato sin signo $ — para paginas que anteponen el $ manualmente (ej. NominaPage).
 */
export function fmtSinSigno(val) {
  return Number(val || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
