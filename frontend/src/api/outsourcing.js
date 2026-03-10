import client from './client';

export const getEmpresas = () => client.get('/api/outsourcing/empresas').then(r => r.data);
export const createEmpresa = (data) => client.post('/api/outsourcing/empresas', data).then(r => r.data);
export const updateEmpresa = (id, data) => client.patch(`/api/outsourcing/empresas/${id}`, data).then(r => r.data);
export const getOutsourcingStats = (params) => client.get('/api/outsourcing/stats', { params }).then(r => r.data);
