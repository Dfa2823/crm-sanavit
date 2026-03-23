import client from './client';

export const getEmpresas = () => client.get('/api/outsourcing/empresas').then(r => r.data);
export const createEmpresa = (data) => client.post('/api/outsourcing/empresas', data).then(r => r.data);
export const updateEmpresa = (id, data) => client.patch(`/api/outsourcing/empresas/${id}`, data).then(r => r.data);
export const getOutsourcingStats = (params) => client.get('/api/outsourcing/stats', { params }).then(r => r.data);
export const getOutsourcingSalas = () => client.get('/api/outsourcing/salas').then(r => r.data);
export const crearLeadOutsourcing = (data) => client.post('/api/outsourcing/lead', data).then(r => r.data);
export const cargaMasivaOutsourcing = (formData) => client.post('/api/outsourcing/carga-masiva', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
  timeout: 120000,
}).then(r => r.data);
export const getMisLeads = (params) => client.get('/api/outsourcing/mis-leads', { params }).then(r => r.data);
export const getMiResumen = (params) => client.get('/api/outsourcing/mi-resumen', { params }).then(r => r.data);
