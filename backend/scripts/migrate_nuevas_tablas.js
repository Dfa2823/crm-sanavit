require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  console.log('🔄 Migrando nuevas tablas...');

  const sql = `
    CREATE TABLE IF NOT EXISTS contratos (
      id SERIAL PRIMARY KEY,
      numero_contrato VARCHAR(20) UNIQUE,
      persona_id INTEGER REFERENCES personas(id) NOT NULL,
      sala_id INTEGER REFERENCES salas(id),
      visita_sala_id INTEGER REFERENCES visitas_sala(id),
      consultor_id INTEGER REFERENCES usuarios(id),
      fecha_contrato DATE NOT NULL DEFAULT CURRENT_DATE,
      tipo_plan VARCHAR(50) NOT NULL,
      descripcion_plan TEXT,
      monto_total NUMERIC(10,2) NOT NULL,
      monto_cuota NUMERIC(10,2),
      n_cuotas INTEGER DEFAULT 1,
      dia_pago INTEGER DEFAULT 1,
      fecha_primer_pago DATE,
      estado VARCHAR(30) DEFAULT 'activo',
      observaciones TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS cuotas (
      id SERIAL PRIMARY KEY,
      contrato_id INTEGER REFERENCES contratos(id) NOT NULL,
      numero_cuota INTEGER NOT NULL,
      monto_esperado NUMERIC(10,2) NOT NULL,
      monto_pagado NUMERIC(10,2) DEFAULT 0,
      fecha_vencimiento DATE NOT NULL,
      fecha_pago DATE,
      estado VARCHAR(20) DEFAULT 'pendiente',
      observacion TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS outsourcing_empresas (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(150) NOT NULL,
      contacto_nombre VARCHAR(150),
      contacto_telefono VARCHAR(30),
      contacto_email VARCHAR(150),
      ciudad VARCHAR(100),
      activo BOOLEAN DEFAULT true,
      notas TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS comisiones (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER REFERENCES usuarios(id) NOT NULL,
      sala_id INTEGER REFERENCES salas(id),
      tipo VARCHAR(30) NOT NULL,
      monto NUMERIC(10,2) NOT NULL,
      referencia_id INTEGER,
      referencia_tipo VARCHAR(30),
      periodo VARCHAR(7),
      estado VARCHAR(20) DEFAULT 'pendiente',
      observacion TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Agregar outsourcing_empresa_id a leads si no existe
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS outsourcing_empresa_id INTEGER REFERENCES outsourcing_empresas(id);

    -- Agregar outsourcing_empresa_id a visitas_sala si no existe
    ALTER TABLE visitas_sala ADD COLUMN IF NOT EXISTS outsourcing_empresa_id INTEGER REFERENCES outsourcing_empresas(id);
  `;

  try {
    await pool.query(sql);
    console.log('✅ Tablas creadas exitosamente');

    // Insertar datos de prueba
    await pool.query(`
      INSERT INTO outsourcing_empresas (nombre, contacto_nombre, contacto_telefono, contacto_email, ciudad)
      VALUES
        ('CallCenter Pro Ecuador', 'Roberto Mendez', '0987654321', 'roberto@callcenterpro.ec', 'Quito'),
        ('TeleVentas Sur', 'Patricia Ramos', '0976543210', 'patricia@televentassur.ec', 'Guayaquil'),
        ('ContactCenter Nacional', 'Fernando Lagos', '0965432109', 'fernando@ccnacional.ec', 'Cuenca')
      ON CONFLICT DO NOTHING
    `);
    console.log('✅ Datos outsourcing insertados');

    // Crear contratos de prueba basados en tours
    const tours = await pool.query(`
      SELECT DISTINCT vs.persona_id, vs.sala_id, vs.consultor_id
      FROM visitas_sala vs
      WHERE vs.calificacion = 'TOUR'
      LIMIT 5
    `);

    for (let i = 0; i < tours.rows.length; i++) {
      const t = tours.rows[i];
      const numero = `SQT-${2476 + i}`;
      const tiposPlan = ['mensual', 'trimestral', 'anual'];
      const tipo = tiposPlan[i % 3];
      const montoMap = { mensual: 1200, trimestral: 3600, anual: 14400 };
      const cuotasMap = { mensual: 1, trimestral: 3, anual: 12 };
      const monto = montoMap[tipo];
      const nCuotas = cuotasMap[tipo];

      try {
        const r = await pool.query(`
          INSERT INTO contratos (numero_contrato, persona_id, sala_id, consultor_id, fecha_contrato, tipo_plan, monto_total, monto_cuota, n_cuotas, dia_pago, fecha_primer_pago, estado)
          VALUES ($1,$2,$3,$4, CURRENT_DATE - $5 * INTERVAL '1 day', $6, $7, $8, $9, 15, CURRENT_DATE - INTERVAL '25 days', 'activo')
          ON CONFLICT (numero_contrato) DO NOTHING
          RETURNING id
        `, [numero, t.persona_id, t.sala_id || 1, t.consultor_id, (i + 1) * 7, tipo, monto, monto / nCuotas, nCuotas]);

        if (r.rows.length > 0) {
          const contratoId = r.rows[0].id;
          const fechaBase = new Date();
          fechaBase.setDate(15);

          for (let c = 0; c < nCuotas; c++) {
            const fechaVenc = new Date(fechaBase);
            fechaVenc.setMonth(fechaVenc.getMonth() - (nCuotas - 1 - c));
            const yaVencio = fechaVenc < new Date();
            const pagado = c < nCuotas - 1; // todas pagadas menos la última

            await pool.query(`
              INSERT INTO cuotas (contrato_id, numero_cuota, monto_esperado, monto_pagado, fecha_vencimiento, fecha_pago, estado)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
              contratoId, c + 1, monto / nCuotas,
              pagado ? monto / nCuotas : 0,
              fechaVenc.toISOString().split('T')[0],
              pagado ? fechaVenc.toISOString().split('T')[0] : null,
              pagado ? 'pagado' : (yaVencio ? 'vencido' : 'pendiente'),
            ]);
          }
        }
      } catch (e) {
        console.log('Contrato ya existe o error:', numero, e.message);
      }
    }
    console.log('✅ Contratos y cuotas de prueba creados');

  } catch (err) {
    console.error('❌ Error en migración:', err.message);
  } finally {
    await pool.end();
  }
}

migrate();
