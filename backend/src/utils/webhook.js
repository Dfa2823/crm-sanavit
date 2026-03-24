const pool = require('../db');

// ── Auto-migrate: tabla webhooks ──────────────────────────────
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id SERIAL PRIMARY KEY,
        evento VARCHAR(50) NOT NULL,
        url TEXT NOT NULL,
        secreto VARCHAR(100),
        activo BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_webhooks_evento ON webhooks(evento)`);
    console.log('  ✓ webhooks table ready');
  } catch (err) {
    console.error('Webhook migration warning:', err.message);
  }
})();

// Eventos soportados
const EVENTOS_VALIDOS = [
  'nueva_venta',
  'pago_registrado',
  'lead_creado',
  'tour_registrado',
];

/**
 * Dispara webhooks activos para un evento dado.
 * Fire-and-forget: no bloquea el flujo principal.
 *
 * @param {string} evento - Nombre del evento (e.g. 'nueva_venta')
 * @param {object} payload - Datos a enviar en el body del POST
 */
async function dispararWebhook(evento, payload) {
  try {
    const result = await pool.query(
      'SELECT url, secreto FROM webhooks WHERE evento = $1 AND activo = true',
      [evento]
    );

    if (result.rows.length === 0) return;

    for (const wh of result.rows) {
      // Fire-and-forget: no esperamos la respuesta
      fetch(wh.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(wh.secreto ? { 'X-Webhook-Secret': wh.secreto } : {}),
        },
        body: JSON.stringify({
          evento,
          timestamp: new Date().toISOString(),
          data: payload,
        }),
      }).catch((err) => {
        console.error(`[WEBHOOK] Error enviando ${evento} a ${wh.url}:`, err.message);
      });
    }
  } catch (err) {
    console.error('[WEBHOOK] Error consultando webhooks:', err.message);
  }
}

module.exports = { dispararWebhook, EVENTOS_VALIDOS };
