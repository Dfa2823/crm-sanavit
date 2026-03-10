import client from './client'

export const getReportLeads   = (params) => client.get('/api/reportes/leads',   { params }).then(r => r.data)
export const getReportVentas  = (params) => client.get('/api/reportes/ventas',  { params }).then(r => r.data)
export const getReportCartera = (params) => client.get('/api/reportes/cartera', { params }).then(r => r.data)

// Legacy exports kept for backward compatibility with other consumers
export const getReporteLeads       = getReportLeads
export const getReporteAsistencias = (params) => client.get('/api/reportes/asistencias', { params }).then(r => r.data)
export const getReporteTMK         = (params) => client.get('/api/reportes/tmk',         { params }).then(r => r.data)
export const getReporteVentas      = getReportVentas
