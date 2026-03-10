import client from './client'

export const getStock            = ()       => client.get('/api/inventario/stock').then(r => r.data)
export const getMovimientos      = (params) => client.get('/api/inventario/movimientos', { params }).then(r => r.data)
export const registrarMovimiento = (data)   => client.post('/api/inventario/movimiento', data).then(r => r.data)
export const actualizarProducto  = (id, data) => client.patch(`/api/inventario/productos/${id}`, data).then(r => r.data)
