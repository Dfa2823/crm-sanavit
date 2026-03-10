import client from './client'

export const apiCitas = {
  premanifiesto: (params = {}) =>
    client.get('/api/citas/premanifiesto', { params }).then(r => r.data),

  hoy: (params = {}) =>
    client.get('/api/citas/hoy', { params }).then(r => r.data),

  calificar: (lead_id, data) =>
    client.patch(`/api/citas/${lead_id}/calificar`, data).then(r => r.data),
}
