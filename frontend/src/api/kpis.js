import client from './client'

export const apiKpis = {
  obtener: (params = {}) =>
    client.get('/api/kpis', { params }).then(r => r.data),
}
