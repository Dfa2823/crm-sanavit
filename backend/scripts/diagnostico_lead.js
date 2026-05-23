/**
 * Diagnóstico (SOLO LECTURA) para investigar por qué un lead "no aparece".
 *
 * Uso:
 *   node scripts/diagnostico_lead.js "Collaguazo"
 *   node scripts/diagnostico_lead.js 0991234567
 *
 * Busca personas por nombre/apellido (ILIKE) o por teléfono (telefono / telefono2)
 * e imprime, por cada una, TODOS sus leads con sala, agente outsourcing, TMK,
 * tipificación, estado, fecha_cita y created_at. No modifica nada.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Mismo timezone que la app, para que las fechas se impriman en hora Ecuador.
pool.on('connect', (c) => c.query("SET timezone = 'America/Guayaquil'"));

function normalizarTelefono(val) {
  if (!val && val !== 0) return null;
  let t = String(val).trim().replace(/[\s\-.()]/g, '');
  if (t.startsWith('00593')) t = '0' + t.slice(5);
  if (t.startsWith('+593')) t = '0' + t.slice(4);
  if (t.startsWith('593') && t.length >= 12) t = '0' + t.slice(3);
  if (/^\d{9}$/.test(t)) t = '0' + t;
  return t.length > 0 ? t : null;
}

async function main() {
  const arg = process.argv.slice(2).join(' ').trim();
  if (!arg) {
    console.error('Falta el término de búsqueda. Ej: node scripts/diagnostico_lead.js "Collaguazo"');
    process.exit(1);
  }

  const esTelefono = /^[\d\s\-.()+]+$/.test(arg);
  const telNorm = esTelefono ? normalizarTelefono(arg) : null;

  console.log(`\n🔎 Buscando: "${arg}"${telNorm ? ` (tel normalizado: ${telNorm})` : ' (por nombre/apellido)'}\n`);

  // 1) Personas coincidentes
  const personas = await pool.query(
    `SELECT id, nombres, apellidos, telefono, telefono2, created_at
       FROM personas
      WHERE ($1::text IS NOT NULL AND (telefono = $1 OR telefono2 = $1))
         OR ($2::text IS NOT NULL AND (
               nombres   ILIKE '%' || $2 || '%'
            OR apellidos ILIKE '%' || $2 || '%'
            OR (nombres || ' ' || apellidos) ILIKE '%' || $2 || '%'
         ))
      ORDER BY created_at DESC
      LIMIT 50`,
    [telNorm, esTelefono ? null : arg]
  );

  if (personas.rows.length === 0) {
    console.log('❌ No se encontró ninguna PERSONA con ese criterio.');
    console.log('   → El lead nunca llegó a crear la persona (posible error en la carga o teléfono inválido).\n');
    await pool.end();
    return;
  }

  console.log(`✅ ${personas.rows.length} persona(s) encontrada(s):\n`);

  for (const p of personas.rows) {
    console.log('────────────────────────────────────────────────────────');
    console.log(`PERSONA #${p.id}: ${p.nombres} ${p.apellidos}`);
    console.log(`   tel: ${p.telefono || '—'} | tel2: ${p.telefono2 || '—'} | creada: ${p.created_at}`);

    const leads = await pool.query(
      `SELECT l.id, l.estado, l.fecha_cita, l.fecha_rellamar, l.created_at,
              l.sala_id, s.nombre AS sala_nombre,
              l.outsourcing_id, ou.username AS outsourcing_user, ou.nombre AS outsourcing_nombre,
              l.tmk_id, ut.username AS tmk_user,
              l.tipificacion_id, t.nombre AS tipificacion,
              l.outsourcing_empresa_id, l.observacion
         FROM leads l
         LEFT JOIN salas s            ON l.sala_id = s.id
         LEFT JOIN usuarios ou        ON l.outsourcing_id = ou.id
         LEFT JOIN usuarios ut        ON l.tmk_id = ut.id
         LEFT JOIN tipificaciones t   ON l.tipificacion_id = t.id
        WHERE l.persona_id = $1
        ORDER BY l.created_at DESC`,
      [p.id]
    );

    if (leads.rows.length === 0) {
      console.log('   ⚠️  Esta persona NO tiene leads (existe la persona pero no se creó el lead).');
      continue;
    }

    console.log(`   Leads (${leads.rows.length}):`);
    for (const l of leads.rows) {
      console.log(
        `     • lead #${l.id} | estado=${l.estado} | tipif=${l.tipificacion || l.tipificacion_id || '—'}` +
        ` | fecha_cita=${l.fecha_cita || 'NULL'} | rellamar=${l.fecha_rellamar || 'NULL'}`
      );
      console.log(
        `         sala=${l.sala_nombre || l.sala_id || '—'} | outsourcing=${l.outsourcing_user || '—'} (id ${l.outsourcing_id || '—'})` +
        ` | tmk=${l.tmk_user || '—'} | creado=${l.created_at}`
      );
      if (l.fecha_cita === null) {
        console.log('         🚩 fecha_cita NULL → INVISIBLE en pre-manifiesto / recepción / calendario.');
      }
    }
  }

  console.log('────────────────────────────────────────────────────────\n');
  await pool.end();
}

main().catch((e) => { console.error('Error en diagnóstico:', e); process.exit(1); });
