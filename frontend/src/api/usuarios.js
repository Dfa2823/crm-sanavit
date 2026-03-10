import client from './client'

export const apiUsuarios = {
  listar: (params = {}) =>
    client.get('/api/usuarios', { params }).then(r => r.data),

  salas: () =>
    client.get('/api/usuarios/salas').then(r => r.data),
}
