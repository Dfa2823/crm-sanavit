/**
 * Formatea una fecha ISO en hora Ecuador (America/Guayaquil, UTC-5).
 * Evita el desfase de timezone que ocurre al usar new Date() sin timezone explícito.
 */

export function formatFechaEC(fecha, opciones) {
  if (!fecha) return '—'
  const defaults = {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Guayaquil',
  }
  return new Date(fecha).toLocaleString('es-EC', { ...defaults, ...opciones })
}

export function formatFechaCorta(fecha) {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleString('es-EC', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Guayaquil',
  })
}

export function formatHoraEC(fecha) {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleTimeString('es-EC', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Guayaquil',
  })
}

export function formatFechaSoloFecha(fecha) {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleDateString('es-EC', {
    day: '2-digit',
    month: 'short',
    timeZone: 'America/Guayaquil',
  })
}

export function formatFechaSemana(fecha) {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleString('es-EC', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Guayaquil',
  })
}
