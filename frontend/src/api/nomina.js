import api from './client'

export const getNomina        = (params = {}) => api.get('/api/nomina', { params }).then(r => r.data)
export const calcularNomina   = (body)        => api.post('/api/nomina/calcular', body).then(r => r.data)
export const getReporteNomina = (mes, params = {}) => api.get(`/api/nomina/reporte/${mes}`, { params }).then(r => r.data)
export const getNominaById    = (id)          => api.get(`/api/nomina/${id}`).then(r => r.data)
export const updateNomina     = (id, body)    => api.patch(`/api/nomina/${id}`, body).then(r => r.data)

// ─── Reporte de Validación ───────────────────────────────────────────────────
export const getReporteValidacion = (mes, params = {}) => api.get(`/api/nomina/reporte-validacion/${mes}`, { params }).then(r => r.data)

// ─── Notificación (placeholder) ─────────────────────────────────────────────
export const notificarNomina = (nominaId) => api.post(`/api/nomina/notificar/${nominaId}`).then(r => r.data)

// ─── Asistencia ──────────────────────────────────────────────────────────────
export const getAsistencia          = (params = {}) => api.get('/api/nomina/asistencia', { params }).then(r => r.data)
export const getAsistenciaDia       = (params = {}) => api.get('/api/nomina/asistencia/dia', { params }).then(r => r.data)
export const registrarAsistencia    = (data)        => api.post('/api/nomina/asistencia', data).then(r => r.data)
export const registrarAsistenciaBulk = (data)       => api.post('/api/nomina/asistencia/bulk', data).then(r => r.data)
export const getResumenAsistencia   = (params = {}) => api.get('/api/nomina/asistencia/resumen', { params }).then(r => r.data)
export const getResumenMensual      = (params = {}) => api.get('/api/nomina/asistencia/resumen-mensual', { params }).then(r => r.data)
