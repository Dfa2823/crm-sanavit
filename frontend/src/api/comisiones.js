import client from './client';

export const getComisiones = (params) => client.get('/comisiones', { params }).then(r => r.data);
export const getComisionesResumen = (params) => client.get('/comisiones/resumen', { params }).then(r => r.data);
