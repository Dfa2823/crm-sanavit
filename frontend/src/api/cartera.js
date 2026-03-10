import api from './client'

export const getCartera        = (sala_id) => api.get('/api/cartera', { params: { sala_id } }).then(r => r.data)
export const getCarteraResumen = (sala_id) => api.get('/api/cartera/resumen', { params: { sala_id } }).then(r => r.data)
