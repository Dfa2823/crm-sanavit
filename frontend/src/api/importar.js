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
