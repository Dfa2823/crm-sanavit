import client from './client'

export const previewImport = (formData) =>
  client.post('/api/importar/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)

export const ejecutarImport = (formData) =>
  client.post('/api/importar/ejecutar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 5 * 60 * 1000, // 5 minutos para bases grandes
  }).then(r => r.data)

export const descargarDuplicados = (duplicados_bd_detalle, duplicados_internos_detalle) =>
  client.post('/api/importar/duplicados/descargar',
    { duplicados_bd_detalle, duplicados_internos_detalle },
    { responseType: 'blob' }
  ).then(r => r.data)

export const getHistorialImportaciones = () =>
  client.get('/api/importar/historial').then(r => r.data)

export const eliminarImportacion = (id) =>
  client.delete(`/api/importar/${id}`).then(r => r.data)

// Distribucion de tipificaciones/estados/avance por TMK de una base importada
export const getTipificacionImportacion = (id) =>
  client.get(`/api/importar/${id}/tipificacion`).then(r => r.data)
