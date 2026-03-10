import client from './client'

export const getTickets  = (params) => client.get('/api/sac/tickets', { params }).then(r => r.data)
export const createTicket = (data)  => client.post('/api/sac/tickets', data).then(r => r.data)
export const getTicket   = (id)     => client.get(`/api/sac/tickets/${id}`).then(r => r.data)
export const updateTicket = (id, data) => client.patch(`/api/sac/tickets/${id}`, data).then(r => r.data)
export const getSACStats = ()       => client.get('/api/sac/stats').then(r => r.data)
