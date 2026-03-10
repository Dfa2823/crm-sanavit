require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  await pool.query(`
    ALTER TABLE personas ADD COLUMN IF NOT EXISTS telefono2 VARCHAR(30);
    ALTER TABLE personas ADD COLUMN IF NOT EXISTS notas_internas TEXT;
  `);
  console.log('Migration OK: telefono2 y notas_internas agregados a personas');
  process.exit(0);
}
migrate().catch(e => { console.error(e); process.exit(1); });
