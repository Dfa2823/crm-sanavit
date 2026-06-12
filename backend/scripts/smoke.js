/**
 * Smoke test de los flujos críticos del CRM contra un backend corriendo.
 * Uso:  node scripts/smoke.js [URL] [usuario] [password]
 *       (default: http://localhost:3001, requiere un usuario admin)
 * Crea una venta de prueba con entrada, la cobra, anula el recibo (verifica la
 * reversión de la cuota), anula el contrato (caída en mesa) y comenta. Todo
 * queda ANULADO al final — no deja datos activos — pero NO usar en producción
 * con clientes mirando reportes en vivo.
 */
const BASE = process.argv[2] || 'http://localhost:3001';
const USER = process.argv[3] || 'admin';
const PASS = process.argv[4];

if (!PASS) { console.error('Uso: node scripts/smoke.js [URL] [usuario] <password>'); process.exit(1); }

let TOKEN = null;
let fallos = 0;

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

function check(nombre, ok, detalle = '') {
  console.log(`${ok ? '  ✓' : '  ✗ FALLO'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  if (!ok) fallos++;
}

(async () => {
  console.log(`Smoke test contra ${BASE}\n`);

  // 1. Health
  const h = await api('GET', '/health');
  check('health', h.status === 200 && h.data?.status === 'ok');

  // 2. Login
  const login = await api('POST', '/api/auth/login', { username: USER, password: PASS });
  check('login', login.status === 200 && !!login.data?.token);
  if (!login.data?.token) { console.error('\nSin token: abortando.'); process.exit(1); }
  TOKEN = login.data.token;

  // 3. Persona para la venta de prueba
  const personas = await api('GET', '/api/buscar?q=an');
  const persona = personas.data?.personas?.[0];
  check('búsqueda global', personas.status === 200 && !!persona);
  if (!persona) { console.error('\nSin personas: abortando.'); process.exit(1); }

  // 4. Crear venta financiada con entrada
  const venta = await api('POST', '/api/ventas', {
    persona_id: persona.id, sala_id: 1, monto_total: 90, cuota_inicial: 30,
    forma_pago_inicial_id: 1, n_cuotas: 2, fecha_primer_pago: '2030-01-01',
    descripcion_plan: 'SMOKE TEST', productos: [],
  });
  const c = venta.data?.contrato;
  check('crear venta', venta.status === 201 && !!c?.id, c?.numero_contrato);
  check('recibo de entrada automático', venta.data?.recibos?.[0]?.tipo === 'entrada');
  check('resumen: pagado=30 saldo=60',
    Number(venta.data?.resumen?.total_pagado) === 30 && Number(venta.data?.resumen?.saldo_pendiente) === 60);

  // 5. Cobrar una cuota
  const cuota = venta.data?.cuotas?.[0];
  const cobro = await api('POST', '/api/recibos', {
    persona_id: persona.id, contrato_id: c.id, cuota_id: cuota.id,
    valor: 10, forma_pago_id: 1, sala_id: 1, observacion: 'SMOKE abono',
  });
  check('cobrar cuota (abono parcial)', cobro.status === 201 && !!cobro.data?.id);

  // 6. Anular el recibo → la cuota debe revertirse
  const anularRecibo = await api('PATCH', `/api/recibos/${cobro.data.id}/anular`);
  check('anular recibo', anularRecibo.status === 200);
  const v360 = await api('GET', `/api/ventas/${c.id}`);
  const cuotaTras = v360.data?.cuotas?.find(q => q.id === cuota.id);
  check('cuota revertida tras anular', Number(cuotaTras?.monto_pagado) === 0 && cuotaTras?.estado === 'pendiente');

  // 7. Comentario con historial
  const com1 = await api('POST', '/api/comentarios', { entidad_tipo: 'contrato', entidad_id: c.id, texto: 'SMOKE comentario 1' });
  const com2 = await api('POST', '/api/comentarios', { entidad_tipo: 'contrato', entidad_id: c.id, texto: 'SMOKE comentario 2' });
  const lista = await api('GET', `/api/comentarios?entidad_tipo=contrato&entidad_id=${c.id}`);
  check('comentarios acumulan (no se sobrescriben)',
    com1.status === 201 && com2.status === 201 && Array.isArray(lista.data) && lista.data.length >= 2);

  // 8. Búsqueda de ventas por número
  const busq = await api('GET', `/api/ventas?q=${encodeURIComponent(c.numero_contrato)}`);
  check('búsqueda server-side por número', busq.status === 200 && busq.data?.data?.some(v => v.id === c.id));

  // 9. Anular contrato (caída en mesa) → anula recibos
  const anularContrato = await api('PATCH', `/api/ventas/${c.id}/anular`, { motivo: 'SMOKE TEST limpieza' });
  check('anular contrato (caída en mesa)', anularContrato.status === 200 && anularContrato.data?.estado === 'cancelado');
  check('recibos del contrato anulados', Number(anularContrato.data?.recibos_anulados) >= 1);

  console.log(`\n${fallos === 0 ? '✅ TODO OK' : `❌ ${fallos} fallo(s)`}`);
  process.exit(fallos === 0 ? 0 : 1);
})().catch(err => { console.error('Error fatal:', err.message); process.exit(1); });
