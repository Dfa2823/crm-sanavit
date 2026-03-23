import client from './client';

export const getMisClientes = (params) =>
  client.get('/api/consultor/mis-clientes', { params }).then(r => r.data);

export const getResumen = (params) =>
  client.get('/api/consultor/resumen', { params }).then(r => r.data);

export const getComisiones = (params) =>
  client.get('/api/consultor/comisiones', { params }).then(r => r.data);
