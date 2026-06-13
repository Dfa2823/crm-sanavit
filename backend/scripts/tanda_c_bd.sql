-- ============================================================================
-- Tanda C — Mejoras de base de datos (idempotente y revisable)
-- CRM Sanavit Ecuador.
--
-- EJECUTAR:  psql "<conn_string>" -f scripts/tanda_c_bd.sql
--   IMPORTANTE: NO usar --single-transaction. Los CREATE INDEX CONCURRENTLY
--   deben correr en autocommit (no pueden ir dentro de una transacción).
--
-- Preconditions verificadas contra producción el 13-jun-2026 (0 violaciones):
--   - 0 filas violan los CHECK (montos < 0, porcentajes fuera de 0-100).
--   - personas con espacios sobrantes: 299 (TRIM seguro).
--   - leads con fecha_cita absurda: 1 (id 96872, año 2926).
--
-- NO incluye (a propósito):
--   - NOT NULL: el código permite recibos.contrato_id opcional; no se fuerza.
--   - Merge de cédulas duplicadas (7 pares): decisión del cliente.
--   - SQT-12 (~$4.34): dentro de tolerancia de redondeo de intereses.
-- ============================================================================

-- lock_timeout corto: si un CREATE INDEX CONCURRENTLY o un ALTER no consigue
-- su lock breve por tráfico vivo, falla rápido y VISIBLE en vez de colgarse.
SET lock_timeout = '5s';

-- ─────────────────────────────────────────────────────────────────────────
-- PARTE 1 — Índices sobre leads (142k filas; única tabla grande).
-- CONCURRENTLY: NO bloquea escrituras de la tabla. Idempotente (IF NOT EXISTS).
-- El resto de FKs sin índice están en tablas <400 filas: no se indexan
-- (un índice ahí no aporta y añade sobrecarga de escritura).
-- OJO: si un CIC falla a mitad deja un índice INVALID que IF NOT EXISTS NO
-- repara. Verificar indisvalid tras ejecutar (ver bloque de verificación abajo)
-- y, si hay inválidos: DROP INDEX CONCURRENTLY <nombre> y recrear.
-- ─────────────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_persona       ON leads (persona_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_fuente        ON leads (fuente_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_tipificacion  ON leads (tipificacion_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_outsourcing_empresa ON leads (outsourcing_empresa_id) WHERE outsourcing_empresa_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_outsourcing   ON leads (outsourcing_id) WHERE outsourcing_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- PARTE 2 — Resto, transaccional (atómico). Todas tablas pequeñas (<100 filas)
-- salvo el TRIM de personas (299 filas afectadas). Bloqueo despreciable.
-- ─────────────────────────────────────────────────────────────────────────
BEGIN;

-- 2a. Quitar índice redundante. idx_personas_documento (parcial, WHERE NOT NULL)
--     ya cubre los lookups por num_documento; idx_personas_doc es duplicado.
DROP INDEX IF EXISTS idx_personas_doc;

-- 2b. Limpieza de datos
--     TRIM de nombres/apellidos (espacios sobrantes). WHERE => idempotente.
UPDATE personas
   SET nombres   = TRIM(nombres),
       apellidos = TRIM(apellidos)
 WHERE nombres <> TRIM(nombres)
    OR COALESCE(apellidos, '') <> TRIM(COALESCE(apellidos, ''));

--     fecha_cita corrupta (año 2926) -> NULL. Se desconoce la real; NULL no
--     sesga los reportes de "próximas citas". WHERE => idempotente.
UPDATE leads
   SET fecha_cita = NULL
 WHERE fecha_cita > '2100-01-01' OR fecha_cita < '2015-01-01';

-- 2c. CHECK constraints (defensa en profundidad para integridad de dinero).
--     0 violaciones verificadas. DROP IF EXISTS + ADD => idempotente.
ALTER TABLE recibos   DROP CONSTRAINT IF EXISTS chk_recibos_valor_nonneg;
ALTER TABLE recibos   ADD  CONSTRAINT chk_recibos_valor_nonneg     CHECK (valor >= 0);

ALTER TABLE contratos DROP CONSTRAINT IF EXISTS chk_contratos_monto_nonneg;
ALTER TABLE contratos ADD  CONSTRAINT chk_contratos_monto_nonneg   CHECK (monto_total >= 0);

ALTER TABLE contratos DROP CONSTRAINT IF EXISTS chk_contratos_cuotaini_nonneg;
ALTER TABLE contratos ADD  CONSTRAINT chk_contratos_cuotaini_nonneg CHECK (cuota_inicial >= 0);

ALTER TABLE cuotas    DROP CONSTRAINT IF EXISTS chk_cuotas_esperado_nonneg;
ALTER TABLE cuotas    ADD  CONSTRAINT chk_cuotas_esperado_nonneg   CHECK (monto_esperado >= 0);

ALTER TABLE cuotas    DROP CONSTRAINT IF EXISTS chk_cuotas_pagado_nonneg;
ALTER TABLE cuotas    ADD  CONSTRAINT chk_cuotas_pagado_nonneg     CHECK (monto_pagado >= 0);

ALTER TABLE usuarios  DROP CONSTRAINT IF EXISTS chk_usuarios_pct_venta;
ALTER TABLE usuarios  ADD  CONSTRAINT chk_usuarios_pct_venta       CHECK (pct_comision_venta >= 0 AND pct_comision_venta <= 100);

ALTER TABLE usuarios  DROP CONSTRAINT IF EXISTS chk_usuarios_pct_cobro;
ALTER TABLE usuarios  ADD  CONSTRAINT chk_usuarios_pct_cobro       CHECK (pct_comision_cobro >= 0 AND pct_comision_cobro <= 100);

ALTER TABLE usuarios  DROP CONSTRAINT IF EXISTS chk_usuarios_pct_desbloqueo;
ALTER TABLE usuarios  ADD  CONSTRAINT chk_usuarios_pct_desbloqueo  CHECK (pct_desbloqueo >= 0 AND pct_desbloqueo <= 100);

COMMIT;

-- ============================================================================
-- Verificación post-ejecución (correr aparte):
--   -- índices VÁLIDOS (indisvalid debe ser 't' en los 5; pg_indexes NO muestra esto):
--   SELECT c.relname, i.indisvalid FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
--     WHERE c.relname LIKE 'idx_leads_%' ORDER BY 1;
--   SELECT conname FROM pg_constraint WHERE conname LIKE 'chk_%';   -- => 8 filas
--   SELECT count(*) FROM personas WHERE nombres <> TRIM(nombres);   -- => 0
--   SELECT count(*) FROM leads WHERE fecha_cita > '2100-01-01';     -- => 0
-- Si algún índice quedara indisvalid='f': DROP INDEX CONCURRENTLY <nombre>; y recrear.
-- ============================================================================
