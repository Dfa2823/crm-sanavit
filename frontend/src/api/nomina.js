import api from './client'

export const getNomina        = (params = {}) => api.get('/api/nomina', { params }).then(r => r.data)
export const calcularNomina   = (body)        => api.post('/api/nomina/calcular', body).then(r => r.data)
export const getReporteNomina = (mes, params = {}) => api.get(`/api/nomina/reporte/${mes}`, { params }).then(r => r.data)
export const getNominaById    = (id)          => api.get(`/api/nomina/${id}`).then(r => r.data)
export const updateNomina     = (id, body)    => api.patch(`/api/nomina/${id}`, body).then(r => r.data)
