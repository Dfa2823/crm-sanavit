import client from './client';

export const getRecibos = (params) => client.get('/api/recibos', { params }).then(r => r.data);
export const createRecibo = (data) => client.post('/api/recibos', data).then(r => r.data);
export const anularRecibo = (id) => client.patch(`/api/recibos/${id}/anular`).then(r => r.data);
