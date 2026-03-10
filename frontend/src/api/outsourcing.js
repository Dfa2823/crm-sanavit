import client from './client';

export const getEmpresas = () => client.get('/outsourcing/empresas').then(r => r.data);
export const createEmpresa = (data) => client.post('/outsourcing/empresas', data).then(r => r.data);
export const updateEmpresa = (id, data) => client.patch(`/outsourcing/empresas/${id}`, data).then(r => r.data);
export const getOutsourcingStats = (params) => client.get('/outsourcing/stats', { params }).then(r => r.data);
