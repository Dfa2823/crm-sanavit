import api from './client'

export const getNomina       = (params = {}) => api.get('/nomina', { params }).then(r => r.data)
export const calcularNomina  = (body)        => api.post('/nomina/calcular', body).then(r => r.data)
export const getReporteNomina = (mes, params = {}) => api.get(`/nomina/reporte/${mes}`, { params }).then(r => r.data)
export const getNominaById   = (id)          => api.get(`/nomina/${id}`).then(r => r.data)
export const updateNomina    = (id, body)    => api.patch(`/nomina/${id}`, body).then(r => r.data)
