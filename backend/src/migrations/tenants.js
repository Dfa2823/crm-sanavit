const pool = require('../db');

/**
 * Migración base para multi-tenancy.
 * - Crea la tabla `tenants`
 * - Agrega `tenant_id` (DEFAULT 1) a las tablas principales
 * - Inserta el tenant por defecto "Sanavit Ecuador"
 *
 * Diseñada para ser idempotente (IF NOT EXISTS / ON CONFLICT).
 */
async function migrateTenants() {
  // 1. Crear tabla tenants
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(150) NOT NULL,
      slug VARCHAR(50) UNIQUE NOT NULL,
      logo_url TEXT,
      config JSONB DEFAULT '{}',
      activo BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // 2. Agregar tenant_id a tablas principales (sin FK por ahora)
  const tablas = [
    'personas',
    'leads',
    'contratos',
    'cuotas',
    'recibos',
    'visitas_sala',
    'comisiones',
    'usuarios',
    'salas',
  ];

  for (const tabla of tablas) {
    try {
      await pool.query(`ALTER TABLE ${tabla} ADD COLUMN IF NOT EXISTS tenant_id INTEGER DEFAULT 1`);
    } catch (e) {
      // La tabla podría no existir aún — no bloquear el arranque
      if (!e.message.includes('does not exist')) {
        console.warn(`[TENANTS] Warning al agregar tenant_id a ${tabla}: ${e.message}`);
      }
    }
  }

  // 3. Seed: tenant por defecto
  await pool.query(`
    INSERT INTO tenants (nombre, slug)
    VALUES ('Sanavit Ecuador', 'sanavit')
    ON CONFLICT (slug) DO NOTHING
  `);

  console.log('[TENANTS] Tabla tenants y columnas tenant_id verificadas');
}

module.exports = migrateTenants;
