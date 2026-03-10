-- =============================================================
-- SCHEMA V2 — CRM Sanavit Ecuador
-- Tablas ADITIVAS — no elimina las existentes
-- Ejecutar con: psql $DATABASE_URL -f backend/schema_v2.sql
-- =============================================================

-- 1. FORMAS DE PAGO
CREATE TABLE IF NOT EXISTS formas_pago (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) UNIQUE NOT NULL,
  tipo VARCHAR(30) DEFAULT 'efectivo',   -- 'efectivo' | 'banco' | 'credito' | 'fintech'
  activo BOOLEAN DEFAULT true
);

-- Seed formas de pago
INSERT INTO formas_pago (nombre, tipo) VALUES
  ('Efectivo', 'efectivo'),
  ('Transferencia bancaria', 'banco'),
  ('Depósito bancario', 'banco'),
  ('Tarjeta de crédito', 'credito'),
  ('Tarjeta de débito', 'credito'),
  ('Link de pago', 'fintech'),
  ('Crédito directo', 'credito'),
  ('Diferido', 'credito')
ON CONFLICT (nombre) DO NOTHING;

-- 2. PRODUCTOS (catálogo de servicios Sanavit)
CREATE TABLE IF NOT EXISTS productos (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(20) UNIQUE NOT NULL,
  nombre VARCHAR(200) NOT NULL,
  tipo VARCHAR(50) DEFAULT 'servicio',   -- 'servicio' | 'producto' | 'obsequio' | 'ajuste'
  marca VARCHAR(50) DEFAULT 'SANAVIT',
  precio_venta NUMERIC(10,2) NOT NULL DEFAULT 0,
  tiene_iva BOOLEAN DEFAULT false,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed productos SANAVIT activos (del SICC)
INSERT INTO productos (codigo, nombre, tipo, marca, precio_venta, descripcion) VALUES
  ('SRV-001', 'Sueroterapia', 'servicio', 'SANAVIT', 0, 'Tratamiento de sueroterapia intravenosa'),
  ('SRV-002', 'Desintoxicación Iónica', 'servicio', 'SANAVIT', 0, 'Detox iónico de pies'),
  ('SRV-003', 'Biopuntura', 'servicio', 'SANAVIT', 0, 'Tratamiento de biopuntura'),
  ('SRV-004', 'Detox Iónico Obsequio', 'obsequio', 'SANAVIT', 0, 'Detox iónico de cortesía'),
  ('SRV-005', 'Consulta Médica', 'servicio', 'SANAVIT', 0, 'Consulta médica inicial'),
  ('SRV-006', 'Saldo a Favor', 'ajuste', 'SANAVIT', 0, 'Ajuste por saldo a favor del cliente')
ON CONFLICT (codigo) DO NOTHING;

-- 3. BODEGAS
CREATE TABLE IF NOT EXISTS bodegas (
  id SERIAL PRIMARY KEY,
  sala_id INTEGER REFERENCES salas(id),
  nombre VARCHAR(100) NOT NULL,
  ubicacion TEXT,
  activo BOOLEAN DEFAULT true
);

-- Seed bodegas Ecuador
INSERT INTO bodegas (sala_id, nombre, ubicacion)
SELECT s.id, 'Bodega Principal', s.ciudad FROM salas s WHERE s.nombre = 'Sala Quito'
ON CONFLICT DO NOTHING;
INSERT INTO bodegas (sala_id, nombre, ubicacion)
SELECT s.id, 'Bodega Terraza', 'Quito - Terraza' FROM salas s WHERE s.nombre = 'Sala Quito'
ON CONFLICT DO NOTHING;
INSERT INTO bodegas (sala_id, nombre, ubicacion)
SELECT s.id, 'Bodega Principal', s.ciudad FROM salas s WHERE s.nombre = 'Sala Manta'
ON CONFLICT DO NOTHING;

-- 4. VENTA_PRODUCTOS (qué lleva cada contrato)
CREATE TABLE IF NOT EXISTS venta_productos (
  id SERIAL PRIMARY KEY,
  contrato_id INTEGER REFERENCES contratos(id) NOT NULL,
  producto_id INTEGER REFERENCES productos(id) NOT NULL,
  cantidad INTEGER DEFAULT 1,
  precio_unitario NUMERIC(10,2) NOT NULL,
  valor_total NUMERIC(10,2) NOT NULL,
  despacho_estado VARCHAR(20) DEFAULT 'pendiente',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. DESPACHOS
CREATE TABLE IF NOT EXISTS despachos (
  id SERIAL PRIMARY KEY,
  contrato_id INTEGER REFERENCES contratos(id) NOT NULL,
  venta_producto_id INTEGER REFERENCES venta_productos(id),
  persona_id INTEGER REFERENCES personas(id) NOT NULL,
  producto_id INTEGER REFERENCES productos(id) NOT NULL,
  bodega_id INTEGER REFERENCES bodegas(id),
  cantidad INTEGER NOT NULL DEFAULT 1,
  lote VARCHAR(50),
  fecha_despacho DATE DEFAULT CURRENT_DATE,
  usuario_id INTEGER REFERENCES usuarios(id),
  observacion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. RECIBOS DE CAJA
CREATE TABLE IF NOT EXISTS recibos (
  id SERIAL PRIMARY KEY,
  consecutivo VARCHAR(20) UNIQUE,
  contrato_id INTEGER REFERENCES contratos(id),
  cuota_id INTEGER REFERENCES cuotas(id),
  persona_id INTEGER REFERENCES personas(id) NOT NULL,
  sala_id INTEGER REFERENCES salas(id),
  forma_pago_id INTEGER REFERENCES formas_pago(id),
  valor NUMERIC(10,2) NOT NULL,
  fecha_pago DATE DEFAULT CURRENT_DATE,
  usuario_id INTEGER REFERENCES usuarios(id),
  estado VARCHAR(20) DEFAULT 'activo',
  referencia_pago VARCHAR(100),
  observacion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. REFINANCIACIONES
CREATE TABLE IF NOT EXISTS refinanciaciones (
  id SERIAL PRIMARY KEY,
  contrato_id INTEGER REFERENCES contratos(id) NOT NULL,
  motivo TEXT,
  cuotas_anteriores_json JSONB,
  cuotas_nuevas_json JSONB,
  usuario_id INTEGER REFERENCES usuarios(id),
  fecha TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. COMISION_CONFIG
CREATE TABLE IF NOT EXISTS comision_config (
  id SERIAL PRIMARY KEY,
  rol VARCHAR(50) NOT NULL,
  tipo_evento VARCHAR(50) NOT NULL,
  monto_fijo NUMERIC(10,2),
  porcentaje NUMERIC(5,2),
  activo BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rol, tipo_evento)
);

-- Seed comisiones actuales (del prototipo existente)
INSERT INTO comision_config (rol, tipo_evento, monto_fijo) VALUES
  ('consultor', 'tour', 50),
  ('tmk', 'tour', 15),
  ('confirmador', 'tour', 10),
  ('consultor', 'contrato', 200),
  ('tmk', 'contrato', 30),
  ('confirmador', 'contrato', 20)
ON CONFLICT (rol, tipo_evento) DO NOTHING;

-- 9. PQR
CREATE TABLE IF NOT EXISTS pqr (
  id SERIAL PRIMARY KEY,
  contrato_id INTEGER REFERENCES contratos(id),
  persona_id INTEGER REFERENCES personas(id) NOT NULL,
  sala_id INTEGER REFERENCES salas(id),
  tipo VARCHAR(50) DEFAULT 'queja',
  medio VARCHAR(50) DEFAULT 'telefono',
  descripcion TEXT NOT NULL,
  estado VARCHAR(30) DEFAULT 'abierto',
  agente_sac_id INTEGER REFERENCES usuarios(id),
  fecha_apertura DATE DEFAULT CURRENT_DATE,
  fecha_cierre DATE,
  respuesta TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. AUDIT LOG
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id),
  username VARCHAR(100),
  accion VARCHAR(50),
  tabla VARCHAR(100),
  registro_id INTEGER,
  datos_despues JSONB,
  ip VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices adicionales
CREATE INDEX IF NOT EXISTS idx_recibos_contrato ON recibos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_recibos_persona ON recibos(persona_id);
CREATE INDEX IF NOT EXISTS idx_venta_productos_contrato ON venta_productos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_despachos_contrato ON despachos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_pqr_contrato ON pqr(contrato_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_tabla ON audit_log(tabla, registro_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_usuario ON audit_log(usuario_id);

-- Extend contratos with missing SICC fields
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS valor_bruto NUMERIC(10,2);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS iva_porcentaje NUMERIC(5,2) DEFAULT 15;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS valor_iva NUMERIC(10,2) DEFAULT 0;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS outsourcing_empresa_id INTEGER REFERENCES outsourcing_empresas(id);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS segunda_venta BOOLEAN DEFAULT false;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS bloqueo_comision BOOLEAN DEFAULT false;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS cuota_inicial NUMERIC(10,2) DEFAULT 0;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS forma_pago_inicial_id INTEGER REFERENCES formas_pago(id);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS asesor_cartera_id INTEGER REFERENCES usuarios(id);
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES usuarios(id);
