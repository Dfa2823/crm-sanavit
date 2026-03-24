const pool = require('../db');

async function crearIndices() {
  const indices = [
    // Leads
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_created_at ON leads (created_at)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_sala_estado ON leads (sala_id, estado)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_tmk_fecha ON leads (tmk_id, created_at)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_confirmador ON leads (confirmador_id) WHERE confirmador_id IS NOT NULL',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_fecha_cita ON leads (fecha_cita) WHERE fecha_cita IS NOT NULL',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_fecha_rellamar ON leads (fecha_rellamar) WHERE fecha_rellamar IS NOT NULL',

    // Personas
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_personas_telefono ON personas (telefono)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_personas_telefono2 ON personas (telefono2) WHERE telefono2 IS NOT NULL',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_personas_documento ON personas (num_documento) WHERE num_documento IS NOT NULL',
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_personas_nombre ON personas USING gin (to_tsvector('spanish', nombres || ' ' || COALESCE(apellidos, '')))",

    // Cuotas
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cuotas_contrato_estado ON cuotas (contrato_id, estado)',
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cuotas_vencimiento_estado ON cuotas (fecha_vencimiento, estado) WHERE estado != 'pagado'",

    // Contratos
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contratos_consultor ON contratos (consultor_id)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contratos_fecha ON contratos (fecha_contrato)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contratos_sala_estado ON contratos (sala_id, estado)',

    // Recibos
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recibos_contrato_estado ON recibos (contrato_id, estado)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recibos_fecha ON recibos (fecha_pago)',

    // Visitas
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visitas_fecha_sala ON visitas_sala (fecha, sala_id)',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visitas_lead ON visitas_sala (lead_id)',

    // Comisiones
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comisiones_usuario_periodo ON comisiones (usuario_id, periodo)',

    // Nomina
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_nomina_mes ON nomina_mensual (mes)',

    // Asistencia
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_asistencia_usuario_fecha ON asistencia (usuario_id, fecha)',
  ];

  for (const sql of indices) {
    try {
      // CONCURRENTLY no funciona dentro de transaccion, ejecutar uno por uno
      // Railway no soporta CONCURRENTLY sin superuser, se remueve
      await pool.query(sql.replace(' CONCURRENTLY', ''));
    } catch (e) {
      // Indice ya existe o error menor — continuar
      if (!e.message.includes('already exists')) {
        console.warn(`[INDICES] Warning: ${e.message}`);
      }
    }
  }
  console.log('[INDICES] Indices verificados');
}

module.exports = crearIndices;
