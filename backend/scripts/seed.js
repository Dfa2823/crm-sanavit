// ============================================================
// SEED — Datos de prueba para CRM Sanavit Ecuador
// Ejecutar: node scripts/seed.js
// ============================================================
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🔄 Ejecutando schema.sql...');
    const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');
    await client.query(schema);
    console.log('✅ Schema creado');

    // Hash de contraseña
    const hash = await bcrypt.hash('sanavit123', 10);
    console.log('🔐 Password hash generado');

    // ── SALAS ──────────────────────────────────────────────
    await client.query(`
      INSERT INTO salas (nombre, ciudad, prefijo_contrato, serial_contrato) VALUES
        ('Sala Quito', 'Quito', 'SQT', 2475),
        ('Sala Manta', 'Manta', 'SQM', 2088)
    `);

    // ── ROLES ──────────────────────────────────────────────
    await client.query(`
      INSERT INTO roles (nombre, label) VALUES
        ('admin',          'Administrador'),
        ('director',       'Director Comercial'),
        ('supervisor_cc',  'Supervisor Call Center'),
        ('tmk',            'Teleoperador (TMK)'),
        ('confirmador',    'Confirmador'),
        ('hostess',        'Recepcionista / Hostess'),
        ('consultor',      'Consultor de Ventas'),
        ('asesor_cartera', 'Asesor de Cartera'),
        ('sac',            'Agente SAC'),
        ('outsourcing',    'Outsourcing')
    `);

    // ── TIPIFICACIONES (9 aprobadas) ────────────────────────
    await client.query(`
      INSERT INTO tipificaciones (nombre, requiere_fecha_cita, requiere_fecha_rellamar) VALUES
        ('Buzón',              false, false),
        ('Cita',               true,  false),
        ('Dato falso',         false, false),
        ('Enfermedad',         false, false),
        ('Fuera de la ciudad', false, false),
        ('No contesta',        false, false),
        ('No le interesa',     false, false),
        ('Volver a llamar',    false, true),
        ('Ya asistió',         false, false)
    `);

    // ── FUENTES (7 aprobadas) ───────────────────────────────
    await client.query(`
      INSERT INTO fuentes (nombre) VALUES
        ('Referido'),('Base fría'),('Instagram'),('Facebook'),
        ('TikTok'),('Página web'),('Calle')
    `);

    // ── USUARIOS DE PRUEBA ─────────────────────────────────
    // Roles: admin=1, director=2, supervisor_cc=3, tmk=4, confirmador=5,
    //        hostess=6, consultor=7, asesor_cartera=8, sac=9, outsourcing=10
    await client.query(`
      INSERT INTO usuarios (sala_id, rol_id, nombre, username, password_hash) VALUES
        (1, 1, 'Admin Sistema',            'admin',         $1),
        (1, 2, 'Juan Sebastian Gutierrez', 'director',      $1),
        (1, 3, 'Supervisor CC',            'supervisor01',  $1),
        (1, 4, 'María González TMK',       'tmk01',         $1),
        (1, 4, 'Luis Martínez TMK',        'tmk02',         $1),
        (1, 5, 'Carlos Confirmador',       'confirmador01', $1),
        (1, 6, 'Ana Hostess',              'hostess01',     $1),
        (1, 7, 'Pedro Consultor',          'consultor01',   $1),
        (1, 7, 'Sofia Consultora',         'consultor02',   $1),
        (1, 2, 'Lizethe Valdes',           'lizethe',       $1),
        (2, 4, 'Roberto TMK Manta',        'tmk_manta',     $1),
        (2, 6, 'Elena Hostess Manta',      'hostess_manta', $1),
        (null,10, 'Outsourcing Sergio',    'outsourcing01', $1)
    `, [hash]);

    // ── PERSONAS / PROSPECTOS (con datos ecuatorianos reales) ──
    const personas = [
      ['Carmen', 'Suárez Morales',    '0987234561', 'carmen.suarez@gmail.com',    'Quito', 45, 'Empleada privada'],
      ['Roberto', 'Andrade Vega',     '0976543210', 'roberto.andrade@hotmail.com','Quito', 52, 'Independiente'],
      ['Valeria', 'Torres Hidalgo',   '0998765432', 'valeria.torres@gmail.com',   'Quito', 38, 'Empleada pública'],
      ['Miguel', 'Castro Benítez',    '0912345678', 'miguel.castro@yahoo.com',    'Quito', 61, 'Jubilado'],
      ['Patricia', 'Flores León',     '0965432109', 'patricia.flores@gmail.com',  'Quito', 44, 'Empleada privada'],
      ['Fernando', 'Ortiz Zambrano',  '0934567890', 'f.ortiz@gmail.com',          'Quito', 55, 'Independiente'],
      ['Alejandra', 'Reyes Mora',     '0978901234', 'alejandra.reyes@gmail.com',  'Quito', 41, 'Empleada privada'],
      ['Diego', 'Muñoz Paredes',      '0956789012', 'diego.munoz@hotmail.com',    'Quito', 48, 'Empleado privado'],
      ['Gabriela', 'Vargas Espinoza', '0923456789', 'gabriela.vargas@gmail.com',  'Manta', 36, 'Empleada pública'],
      ['Hernán', 'López Cevallos',    '0967890123', 'hernan.lopez@gmail.com',     'Manta', 58, 'Jubilado'],
      ['Lucia', 'Mendoza Carrillo',   '0945678901', 'lucia.mendoza@gmail.com',    'Quito', 42, 'Independiente'],
      ['Carlos', 'Pérez Romero',      '0989012345', 'carlos.perez@gmail.com',     'Quito', 50, 'Empleado privado'],
    ];

    const patologias = [
      'Fatiga crónica y falta de energía',
      'Dolores musculares y articulares',
      'Estrés y ansiedad',
      'Problemas de inmunidad',
      'Recuperación post-enfermedad',
      'Control de peso y metabolismo',
      'Detox y limpieza del organismo',
    ];

    const personaIds = [];
    for (const [nombres, apellidos, telefono, email, ciudad, edad, situacion] of personas) {
      const res = await client.query(`
        INSERT INTO personas (nombres, apellidos, telefono, email, ciudad, edad, situacion_laboral)
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id
      `, [nombres, apellidos, telefono, email, ciudad, edad, situacion]);
      personaIds.push(res.rows[0].id);
    }

    // ── LEADS (15 con distintos estados para la demo) ───────
    // Tipificaciones: Buzón=1, Cita=2, Dato falso=3, Enfermedad=4, Fuera de ciudad=5,
    //                 No contesta=6, No le interesa=7, Volver a llamar=8, Ya asistió=9
    // Fuentes: Referido=1, Base fría=2, Instagram=3, Facebook=4, TikTok=5, Web=6, Calle=7
    // Usuarios: admin=1, director=2, supervisor=3, tmk01=4, tmk02=5, confirmador=6,
    //           hostess=7, consultor01=8, consultor02=9, lizethe=10, tmk_manta=11, ...

    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const mananaStr = manana.toISOString().split('T')[0];

    const hoy = new Date().toISOString().split('T')[0];

    // 5 Confirmadas para mañana
    await client.query(`
      INSERT INTO leads (persona_id, sala_id, tmk_id, fuente_id, tipificacion_id, patologia, fecha_cita, confirmador_id, estado) VALUES
        ($1, 1, 4, 3, 2, 'Fatiga crónica y falta de energía',      $2::timestamptz, 6, 'confirmada'),
        ($3, 1, 4, 1, 2, 'Dolores musculares y articulares',        $4::timestamptz, 6, 'confirmada'),
        ($5, 1, 5, 4, 2, 'Estrés y ansiedad severo',                $6::timestamptz, 6, 'confirmada'),
        ($7, 1, 5, 6, 2, 'Control de peso y metabolismo',           $8::timestamptz, 6, 'confirmada'),
        ($9, 1, 4, 7, 2, 'Detox y limpieza del organismo',          $10::timestamptz,6, 'confirmada')
    `, [
      personaIds[0], `${mananaStr} 09:00:00-05`,
      personaIds[1], `${mananaStr} 09:30:00-05`,
      personaIds[2], `${mananaStr} 10:00:00-05`,
      personaIds[3], `${mananaStr} 10:30:00-05`,
      personaIds[4], `${mananaStr} 11:00:00-05`,
    ]);

    // 3 Tentativas para mañana
    await client.query(`
      INSERT INTO leads (persona_id, sala_id, tmk_id, fuente_id, tipificacion_id, patologia, fecha_cita, confirmador_id, estado) VALUES
        ($1, 1, 4, 5, 2, 'Problemas de inmunidad',           $2::timestamptz, 6, 'tentativa'),
        ($3, 1, 5, 2, 2, 'Recuperación post-enfermedad',     $4::timestamptz, 6, 'tentativa'),
        ($5, 1, 4, 3, 2, 'Fatiga y bajo rendimiento',        $6::timestamptz, 6, 'tentativa')
    `, [
      personaIds[5], `${mananaStr} 11:30:00-05`,
      personaIds[6], `${mananaStr} 12:00:00-05`,
      personaIds[7], `${mananaStr} 14:00:00-05`,
    ]);

    // 2 Canceladas
    await client.query(`
      INSERT INTO leads (persona_id, sala_id, tmk_id, fuente_id, tipificacion_id, patologia, fecha_cita, estado, observacion) VALUES
        ($1, 1, 4, 1, 2, 'Detox iónico', $2::timestamptz, 'cancelada', 'El cliente dijo que no puede ese día'),
        ($3, 1, 5, 6, 2, 'Sueroterapia', $4::timestamptz, 'cancelada', 'Viaje de trabajo imprevisto')
    `, [
      personaIds[8],  `${mananaStr} 09:00:00-05`,
      personaIds[9],  `${mananaStr} 10:00:00-05`,
    ]);

    // 2 Pendientes en el calendario del Confirmador (Volver a llamar)
    const en3dias = new Date();
    en3dias.setDate(en3dias.getDate() + 3);
    const en3diasStr = en3dias.toISOString().split('T')[0];

    const en5dias = new Date();
    en5dias.setDate(en5dias.getDate() + 5);
    const en5diasStr = en5dias.toISOString().split('T')[0];

    await client.query(`
      INSERT INTO leads (persona_id, sala_id, tmk_id, fuente_id, tipificacion_id, patologia, fecha_rellamar, estado, observacion) VALUES
        ($1, 1, 4, 2, 8, 'Dolores articulares', $2::timestamptz, 'pendiente', 'Pide que le llamen la próxima semana por la mañana'),
        ($3, 1, 5, 4, 8, 'Estrés laboral',      $4::timestamptz, 'pendiente', 'Está de vacaciones, regresa el jueves')
    `, [
      personaIds[10], `${en3diasStr} 09:00:00-05`,
      personaIds[11], `${en5diasStr} 10:00:00-05`,
    ]);

    // 3 leads del día de hoy que ya visitaron sala (para KPIs)
    const lead1Res = await client.query(`
      INSERT INTO leads (persona_id, sala_id, tmk_id, fuente_id, tipificacion_id, patologia, fecha_cita, confirmador_id, estado)
      VALUES ($1, 1, 4, 3, 2, 'Sueroterapia rejuvenecimiento', $2::timestamptz, 6, 'tour') RETURNING id
    `, [personaIds[0], `${hoy} 09:00:00-05`]);

    const lead2Res = await client.query(`
      INSERT INTO leads (persona_id, sala_id, tmk_id, fuente_id, tipificacion_id, patologia, fecha_cita, confirmador_id, estado)
      VALUES ($1, 1, 5, 1, 2, 'Biopuntura para dolor', $2::timestamptz, 6, 'no_tour') RETURNING id
    `, [personaIds[2], `${hoy} 10:00:00-05`]);

    const lead3Res = await client.query(`
      INSERT INTO leads (persona_id, sala_id, tmk_id, fuente_id, tipificacion_id, patologia, fecha_cita, confirmador_id, estado)
      VALUES ($1, 1, 4, 5, 2, 'Detox iónico', $2::timestamptz, 6, 'no_show') RETURNING id
    `, [personaIds[4], `${hoy} 11:00:00-05`]);

    // Visitas de hoy (ya registradas por la hostess)
    await client.query(`
      INSERT INTO visitas_sala (lead_id, persona_id, sala_id, hora_cita_agendada, hora_llegada, calificacion, consultor_id, hostess_id, fecha)
      VALUES
        ($1, $2, 1, '09:00', '09:05', 'TOUR',    8, 7, $3::date),
        ($4, $5, 1, '10:00', '10:12', 'NO_TOUR', 9, 7, $3::date),
        ($6, $7, 1, '11:00', NULL,    'NO_SHOW', NULL, 7, $3::date)
    `, [
      lead1Res.rows[0].id, personaIds[0],
      hoy,
      lead2Res.rows[0].id, personaIds[2],
      lead3Res.rows[0].id, personaIds[4],
    ]);

    console.log('✅ Seed completado exitosamente');
    console.log('');
    console.log('📋 Credenciales de prueba (contraseña: sanavit123):');
    console.log('  admin          → Administrador');
    console.log('  director       → Director Comercial (Juan Sebastian)');
    console.log('  tmk01          → Teleoperador TMK');
    console.log('  confirmador01  → Confirmador');
    console.log('  hostess01      → Recepcionista/Hostess');
    console.log('  consultor01    → Consultor de Ventas');
    console.log('  lizethe        → Directora Operativa');
  } catch (err) {
    console.error('❌ Error en seed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
