import client from './client'

export const getLiquidaciones  = (params)     => client.get('/api/liquidaciones', { params }).then(r => r.data)
export const calcularMes       = (data)        => client.post('/api/liquidaciones/calcular', data).then(r => r.data)
export const actualizarEstado  = (id, data)    => client.patch(`/api/liquidaciones/${id}`, data).then(r => r.data)
export const getDetalleLiquidacion = (id)      => client.get(`/api/liquidaciones/${id}/detalle`).then(r => r.data)
export const suspenderComision = (id, data)    => client.patch(`/api/liquidaciones/${id}/suspender`, data).then(r => r.data)
export const reactivarComision = (id, data)    => client.patch(`/api/liquidaciones/${id}/reactivar`, data).then(r => r.data)
