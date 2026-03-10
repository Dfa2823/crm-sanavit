import client from './client';

export const getMiPerfil = () => client.get('/api/perfil/me').then(r => r.data);
export const cambiarPassword = (data) => client.patch('/api/perfil/cambiar-password', data).then(r => r.data);
