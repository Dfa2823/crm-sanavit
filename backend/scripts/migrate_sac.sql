-- ============================================================
-- Migración: Módulo SAC/PQR
-- Ejecutar: psql $DATABASE_URL < backend/scripts/migrate_sac.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS pqr_tickets (
  id SERIAL PRIMARY KEY,
  numero_ticket VARCHAR(20) UNIQUE,           -- SAC-0001
  persona_id INTEGER REFERENCES personas(id),
  contrato_id INTEGER REFERENCES contratos(id), -- opcional
  sala_id INTEGER REFERENCES salas(id),
  tipo VARCHAR(30) NOT NULL DEFAULT 'queja',  -- queja | peticion | reclamo | felicitacion
  categoria VARCHAR(50),                       -- facturacion | servicio | atencion | producto | otro
  descripcion TEXT NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'abierto', -- abierto | en_proceso | resuelto | cerrado
  prioridad VARCHAR(10) DEFAULT 'normal',      -- baja | normal | alta | urgente
  asignado_a INTEGER REFERENCES usuarios(id),  -- agente SAC asignado
  creado_por INTEGER REFERENCES usuarios(id),
  fecha_apertura TIMESTAMPTZ DEFAULT NOW(),
  fecha_cierre TIMESTAMPTZ,
  resolucion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Secuencia para numeración de tickets
CREATE SEQUENCE IF NOT EXISTS pqr_ticket_seq START 1;

-- Índices
CREATE INDEX IF NOT EXISTS idx_pqr_persona ON pqr_tickets(persona_id);
CREATE INDEX IF NOT EXISTS idx_pqr_estado ON pqr_tickets(estado);
CREATE INDEX IF NOT EXISTS idx_pqr_sala ON pqr_tickets(sala_id);
