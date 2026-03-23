import client from './client'

export const getTMKStats = (params) =>
  client.get('/api/supervisor/tmk', { params }).then(r => r.data)

export const getResumenDia = (params) =>
  client.get('/api/supervisor/resumen', { params }).then(r => r.data)

export const getRankingMensual = (params) =>
  client.get('/api/supervisor/ranking', { params }).then(r => r.data)

// ── Asignaciones TMK ↔ Confirmador ────────────────────────
export const getAsignaciones = (params) =>
  client.get('/api/supervisor/asignaciones', { params }).then(r => r.data)

export const crearAsignacion = (data) =>
  client.post('/api/supervisor/asignaciones', data).then(r => r.data)

export const eliminarAsignacion = (tmkId) =>
  client.delete(`/api/supervisor/asignaciones/${tmkId}`).then(r => r.data)

export const getConfirmadores = (params) =>
  client.get('/api/supervisor/confirmadores', { params }).then(r => r.data)

export const getTmksDisponibles = (params) =>
  client.get('/api/supervisor/tmks-disponibles', { params }).then(r => r.data)
