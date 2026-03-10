import api from './client'

export const getUsuarios    = ()         => api.get('/api/admin/usuarios').then(r => r.data)
export const createUsuario  = (data)     => api.post('/api/admin/usuarios', data).then(r => r.data)
export const updateUsuario  = (id, data) => api.patch(`/api/admin/usuarios/${id}`, data).then(r => r.data)

export const getSalas       = ()     => api.get('/api/admin/salas').then(r => r.data)
export const createSala     = (data) => api.post('/api/admin/salas', data).then(r => r.data)

export const getTipificaciones  = ()     => api.get('/api/admin/tipificaciones').then(r => r.data)
export const createTipificacion = (data) => api.post('/api/admin/tipificaciones', data).then(r => r.data)
export const updateTipificacion = (id, data) => api.patch(`/api/admin/tipificaciones/${id}`, data).then(r => r.data)

export const getFuentes     = ()     => api.get('/api/admin/fuentes').then(r => r.data)
export const createFuente   = (data) => api.post('/api/admin/fuentes', data).then(r => r.data)
export const updateFuente   = (id, data) => api.patch(`/api/admin/fuentes/${id}`, data).then(r => r.data)

export const getRoles       = ()     => api.get('/api/admin/roles').then(r => r.data)

export const getFormasPago    = ()         => api.get('/api/admin/formas-pago').then(r => r.data)
export const createFormaPago  = (data)     => api.post('/api/admin/formas-pago', data).then(r => r.data)
export const updateFormaPago  = (id, data) => api.patch(`/api/admin/formas-pago/${id}`, data).then(r => r.data)
