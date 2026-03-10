import api from './client'

export const getReporteLeads       = (params) => api.get('/api/reportes/leads', { params }).then(r => r.data)
export const getReporteAsistencias = (params) => api.get('/api/reportes/asistencias', { params }).then(r => r.data)
export const getReporteTMK         = (params) => api.get('/api/reportes/tmk', { params }).then(r => r.data)
export const getReporteVentas      = (params) => api.get('/api/ventas', { params }).then(r => r.data)
