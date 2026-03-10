import client from './client'

export const getCartera      = (params) => client.get('/api/cartera', { params }).then(r => r.data)
export const getCarteraResumen = () => client.get('/api/cartera/resumen').then(r => r.data)
export const updateGestion   = (id, data) => client.patch(`/api/cartera/cuotas/${id}/gestion`, data).then(r => r.data)
