import client from './client'

export const getTMKStats = (params) =>
  client.get('/api/supervisor/tmk', { params }).then(r => r.data)

export const getResumenDia = (params) =>
  client.get('/api/supervisor/resumen', { params }).then(r => r.data)

export const getRankingMensual = (params) =>
  client.get('/api/supervisor/ranking', { params }).then(r => r.data)
