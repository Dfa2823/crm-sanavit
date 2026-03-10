import client from './client';

export const getComisiones = (params) =>
  client.get('/api/comisiones', { params }).then(r => r.data);

export const getComisionDetalle = (consultorId, params) =>
  client.get(`/api/comisiones/detalle/${consultorId}`, { params }).then(r => r.data);
