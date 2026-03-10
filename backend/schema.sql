-- ============================================================
-- CRM SANAVIT ECUADOR - Schema PostgreSQL
-- Versión: 1.0 (Prototipo)
-- Fecha: 09/03/2026
-- ============================================================

-- Limpiar si existe
DROP TABLE IF EXISTS visitas_sala CASCADE;
DROP TABLE IF EXISTS leads CASCADE;
DROP TABLE IF EXISTS personas CASCADE;
DROP TABLE IF EXISTS tipificaciones CASCADE;
DROP TABLE IF EXISTS fuentes CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS salas CASCADE;

-- ============================================================
-- SALAS
-- ============================================================
CREATE TABLE salas (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  ciudad VARCHAR(100),
  prefijo_contrato VARCHAR(5),
  serial_contrato INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROLES
-- ============================================================
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL
);

-- ============================================================
-- USUARIOS / EMPLEADOS
-- ============================================================
CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  sala_id INTEGER REFERENCES salas(id),
  rol_id INTEGER NOT NULL REFERENCES roles(id),
  nombre VARCHAR(150) NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FUENTES DE LEADS
-- ============================================================
CREATE TABLE fuentes (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) UNIQUE NOT NULL,
  activo BOOLEAN DEFAULT true
);

-- ============================================================
-- TIPIFICACIONES DE LLAMADA
-- ============================================================
CREATE TABLE tipificaciones (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) UNIQUE NOT NULL,
  requiere_fecha_cita BOOLEAN DEFAULT false,
  requiere_fecha_rellamar BOOLEAN DEFAULT false,
  activo BOOLEAN DEFAULT true
);

-- ============================================================
-- PERSONAS / CLIENTES (perfil único compartido)
-- ============================================================
CREATE TABLE personas (
  id SERIAL PRIMARY KEY,
  nombres VARCHAR(150) NOT NULL,
  apellidos VARCHAR(150),
  telefono VARCHAR(30),
  email VARCHAR(150),
  ciudad VARCHAR(100),
  tipo_documento VARCHAR(30),
  num_documento VARCHAR(30),
  fecha_nacimiento DATE,
  genero VARCHAR(20),
  estado_civil VARCHAR(30),
  direccion TEXT,
  situacion_laboral VARCHAR(50),
  tipo_seguridad_social VARCHAR(50),
  edad INTEGER,
  patologia TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LEADS / INTERACCIONES DEL CALL CENTER
-- ============================================================
CREATE TABLE leads (
  id SERIAL PRIMARY KEY,
  persona_id INTEGER NOT NULL REFERENCES personas(id),
  sala_id INTEGER REFERENCES salas(id),
  outsourcing_id INTEGER REFERENCES usuarios(id),
  tmk_id INTEGER REFERENCES usuarios(id),
  fuente_id INTEGER REFERENCES fuentes(id),
  tipificacion_id INTEGER REFERENCES tipificaciones(id),
  patologia TEXT,
  fecha_cita TIMESTAMPTZ,
  fecha_rellamar TIMESTAMPTZ,
  confirmador_id INTEGER REFERENCES usuarios(id),
  estado VARCHAR(30) DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente','confirmada','tentativa','cancelada','inasistencia','tour','no_tour','no_show')),
  observacion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- VISITAS A SALA (completa la Hostess)
-- ============================================================
CREATE TABLE visitas_sala (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id),
  persona_id INTEGER NOT NULL REFERENCES personas(id),
  sala_id INTEGER REFERENCES salas(id),
  hora_cita_agendada TIME,
  hora_llegada TIME,
  calificacion VARCHAR(20)
    CHECK (calificacion IN ('TOUR','NO_TOUR','NO_SHOW')),
  consultor_id INTEGER REFERENCES usuarios(id),
  hostess_id INTEGER REFERENCES usuarios(id),
  acompanante VARCHAR(150),
  outsourcing_indicado INTEGER REFERENCES usuarios(id),
  fecha DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES para performance
-- ============================================================
CREATE INDEX idx_leads_tmk ON leads(tmk_id);
CREATE INDEX idx_leads_sala ON leads(sala_id);
CREATE INDEX idx_leads_estado ON leads(estado);
CREATE INDEX idx_leads_fecha_cita ON leads(fecha_cita);
CREATE INDEX idx_leads_fecha_rellamar ON leads(fecha_rellamar);
CREATE INDEX idx_visitas_fecha ON visitas_sala(fecha);
CREATE INDEX idx_visitas_lead ON visitas_sala(lead_id);
CREATE INDEX idx_personas_telefono ON personas(telefono);
CREATE INDEX idx_personas_doc ON personas(num_documento);
