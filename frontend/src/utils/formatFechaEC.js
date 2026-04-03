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

/**
 * Convierte una fecha de input datetime-local a ISO con offset Ecuador (-05:00).
 * Input:  "2026-04-01T09:30" (de <input type="datetime-local">)
 * Output: "2026-04-01T09:30:00-05:00"
 */
export function toEcuadorISO(localDateStr) {
  if (!localDateStr) return null
  // Si ya tiene offset, no tocar
  if (localDateStr.includes('-05:00') || localDateStr.includes('+')) return localDateStr
  // Normalizar: si no tiene segundos, agregar :00
  const base = localDateStr.length === 16 ? localDateStr + ':00' : localDateStr
  return base + '-05:00'
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
