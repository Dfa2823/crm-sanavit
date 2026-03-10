import client from './client'

export const getResumenAlertas = () =>
  client.get('/api/alertas/resumen').then(r => r.data)

export const getDetalleAlertas = () =>
  client.get('/api/alertas/detalle').then(r => r.data)
