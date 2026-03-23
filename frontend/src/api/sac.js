import client from './client'

// ─── PQR Tickets ──────────────────────────────────────────
export const getTickets    = (params) => client.get('/api/sac/tickets', { params }).then(r => r.data)
export const createTicket  = (data)   => client.post('/api/sac/tickets', data).then(r => r.data)
export const getTicket     = (id)     => client.get(`/api/sac/tickets/${id}`).then(r => r.data)
export const updateTicket  = (id, data) => client.patch(`/api/sac/tickets/${id}`, data).then(r => r.data)
export const getSACStats   = ()       => client.get('/api/sac/stats').then(r => r.data)

// ─── Control de Calidad ───────────────────────────────────
export const getCalidad       = (params) => client.get('/api/sac/calidad', { params }).then(r => r.data)
export const activarContrato  = (contratoId, data) => client.post(`/api/sac/calidad/${contratoId}/activar`, data).then(r => r.data)

// ─── Fidelizacion ─────────────────────────────────────────
export const getFidelizacion     = (params) => client.get('/api/sac/fidelizacion', { params }).then(r => r.data)
export const agendarRevisita     = (contratoId, data) => client.post(`/api/sac/fidelizacion/${contratoId}/agendar`, data).then(r => r.data)
