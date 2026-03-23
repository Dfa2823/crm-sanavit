import client from './client'

export const getCartera          = (params) => client.get('/api/cartera', { params }).then(r => r.data)
export const getCarteraResumen   = () => client.get('/api/cartera/resumen').then(r => r.data)
export const updateGestion       = (id, data) => client.patch(`/api/cartera/cuotas/${id}/gestion`, data).then(r => r.data)
export const getTipificaciones   = () => client.get('/api/cartera/tipificaciones').then(r => r.data)
export const registrarGestion    = (cuotaId, data) => client.post(`/api/cartera/cuotas/${cuotaId}/gestion`, data).then(r => r.data)
export const getHistorialContrato = (contratoId) => client.get(`/api/cartera/historial/${contratoId}`).then(r => r.data)
export const getInfoRefinanciacion = (contratoId) => client.get(`/api/cartera/refinanciacion/${contratoId}`).then(r => r.data)
export const refinanciarContrato  = (contratoId, data) => client.post(`/api/cartera/refinanciar/${contratoId}`, data).then(r => r.data)
