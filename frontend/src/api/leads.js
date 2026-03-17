import client from './client'

export const apiLeads = {
  listar: (params = {}) =>
    client.get('/api/leads', { params }).then(r => r.data),

  obtener: (id) =>
    client.get(`/api/leads/${id}`).then(r => r.data),

  calendario: (params = {}) =>
    client.get('/api/leads/calendario', { params }).then(r => r.data),

  citasCalendario: (params = {}) =>
    client.get('/api/leads/citas', { params }).then(r => r.data),

  configuracion: () =>
    client.get('/api/leads/configuracion').then(r => r.data),

  crear: (data) =>
    client.post('/api/leads', data).then(r => r.data),

  actualizar: (id, data) =>
    client.patch(`/api/leads/${id}`, data).then(r => r.data),
}
