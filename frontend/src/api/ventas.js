import client from './client';

export const getVentas = (params) => client.get('/api/ventas', { params }).then(r => r.data);
export const getVenta360 = (id) => client.get(`/api/ventas/${id}`).then(r => r.data);
export const createVenta = (data) => client.post('/api/ventas', data).then(r => r.data);
export const updateEstadoVenta = (id, data) => client.patch(`/api/ventas/${id}/estado`, data).then(r => r.data);
