import client from './client';

export const getVentas = (params) => client.get('/api/ventas', { params }).then(r => r.data);
export const getVenta360 = (id) => client.get(`/api/ventas/${id}`).then(r => r.data);
export const createVenta = (data) => client.post('/api/ventas', data).then(r => r.data);
export const updateEstadoVenta = (id, data) => client.patch(`/api/ventas/${id}/estado`, data).then(r => r.data);
export const updateNotasVenta = (id, texto) => client.patch(`/api/ventas/${id}/notas`, { texto }).then(r => r.data);
export const despacharProducto = (id) => client.patch(`/api/ventas/productos/${id}/despachar`).then(r => r.data);
export const anularVenta = (id, motivo) => client.patch(`/api/ventas/${id}/anular`, { motivo }).then(r => r.data);
export const condonarIntereses = (id, motivo) => client.patch(`/api/ventas/${id}/condonar-intereses`, { motivo }).then(r => r.data);
