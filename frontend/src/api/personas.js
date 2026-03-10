import client from './client'

export const apiPersonas = {
  buscar: (q) =>
    client.get('/api/personas', { params: { q } }).then(r => r.data),

  obtener: (id) =>
    client.get(`/api/personas/${id}`).then(r => r.data),

  crear: (data) =>
    client.post('/api/personas', data).then(r => r.data),

  actualizar: (id, data) =>
    client.patch(`/api/personas/${id}`, data).then(r => r.data),
}
