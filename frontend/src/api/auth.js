import client from './client'

export const apiAuth = {
  login: async (username, password) => {
    const res = await client.post('/api/auth/login', { username, password })
    return res.data
  },
  me: async () => {
    const res = await client.get('/api/auth/me')
    return res.data
  },
}
