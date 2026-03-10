import api from './client'

export const getReporteLeads       = (params) => api.get('/api/reportes/leads', { params }).then(r => r.data)
export const getReporteAsistencias = (params) => api.get('/api/reportes/asistencias', { params }).then(r => r.data)
