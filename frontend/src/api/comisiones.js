import client from './client';

export const getComisiones = (params) => client.get('/api/comisiones', { params }).then(r => r.data);
export const getComisionesResumen = (params) => client.get('/api/comisiones/resumen', { params }).then(r => r.data);
