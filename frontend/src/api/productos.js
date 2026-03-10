import client from './client';

export const getProductos = (params) => client.get('/api/productos', { params }).then(r => r.data);
export const createProducto = (data) => client.post('/api/productos', data).then(r => r.data);
export const updateProducto = (id, data) => client.patch(`/api/productos/${id}`, data).then(r => r.data);
