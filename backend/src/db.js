const { Pool, types } = require('pg');

// ── CRÍTICO: Evitar que el driver pg convierta timestamps a UTC ──────
// Sin esto, TIMESTAMPTZ se lee como Date JS → se serializa como UTC (Z)
// Con esto, PostgreSQL devuelve la hora en la timezone de la sesión (Ecuador)
// y Node.js la pasa tal cual al frontend sin conversión
types.setTypeParser(1114, str => str); // TIMESTAMP WITHOUT TZ → string as-is
types.setTypeParser(1184, str => str); // TIMESTAMPTZ → string as-is

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// ── Timezone Ecuador en cada conexión PostgreSQL ─────────────
// Hace que CURRENT_DATE, NOW(), CURRENT_TIMESTAMP devuelvan hora Ecuador.
pool.on('connect', (client) => {
  client.query("SET timezone = 'America/Guayaquil'");
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

// ── Helper: fecha "hoy" en Ecuador (YYYY-MM-DD) ─────────────
function hoyEC() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
}

// ── Helper: "ahora" en Ecuador (YYYY-MM-DDTHH:mm) ───────────
function ahoraEC() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'America/Guayaquil' }).replace(' ', 'T');
}

module.exports = pool;
module.exports.hoyEC = hoyEC;
module.exports.ahoraEC = ahoraEC;
