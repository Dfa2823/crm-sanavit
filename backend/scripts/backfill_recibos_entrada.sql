-- ═══════════════════════════════════════════════════════════════════════════
-- BACKFILL: recibos de entrada (cuota inicial) para contratos existentes
-- ═══════════════════════════════════════════════════════════════════════════
-- Problema: hasta jun/2026 la cuota inicial se guardaba en contratos.cuota_inicial
-- pero NUNCA generaba recibo → "total pagado" salía $0 y el saldo incluía la
-- entrada ya pagada. El código nuevo crea el recibo automáticamente (tipo='entrada');
-- este script crea los recibos retroactivos de los contratos anteriores.
--
-- USO:
--   1. ANTES: backup →  pg_dump "$DATABASE_URL" -Fc -t recibos -t cuotas -t contratos -t salas -f backup_pre_backfill.dump
--   2. Ejecutar con psql. El script corre en UNA transacción: revisa los reportes
--      de candidatos/excluidos que imprime y, si no cuadran, hacer ROLLBACK.
--   3. Idempotente: re-ejecutarlo deja 0 candidatos (NOT EXISTS tipo='entrada').
--
-- Notas de diseño:
--   * Consecutivos: usa el contador real salas.serial_recibo → los retroactivos
--     toman los números siguientes de la serie (sin colisión con el UNIQUE y sin
--     romper el backfill-regex de recibos.js). No quedan en orden cronológico
--     número/fecha: el consecutivo es identificador interno, no comprobante SRI.
--   * fecha_pago = fecha_contrato (la entrada se paga al firmar).
--   * usuario_id = NULL (no inventar cajero); la observación documenta el backfill.
--   * cuota_id = NULL (la entrada no pertenece al plan de cuotas).
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- FASE 0: columnas idempotentes (las mismas que crean las auto-migraciones del código)
ALTER TABLE recibos ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) DEFAULT 'abono';
ALTER TABLE salas   ADD COLUMN IF NOT EXISTS serial_recibo INTEGER DEFAULT 0;

-- FASE 1: lock de salas — serializa con la app (los POST de recibos/ventas también
-- hacen FOR UPDATE sobre salas antes de emitir consecutivo). Correr en horario valle.
SELECT id, nombre, prefijo_contrato, serial_recibo FROM salas ORDER BY id FOR UPDATE;

-- FASE 2a: REPORTE de candidatos (revisar a ojo antes del COMMIT)
SELECT c.id, c.numero_contrato, c.fecha_contrato::date, c.estado, c.monto_total,
       c.cuota_inicial, COALESCE(r.total, 0) AS recibos_activos_actuales
FROM contratos c
LEFT JOIN (SELECT contrato_id, SUM(valor) AS total FROM recibos
           WHERE estado = 'activo' GROUP BY contrato_id) r ON r.contrato_id = c.id
WHERE c.cuota_inicial > 0
  AND c.estado <> 'cancelado'
  AND c.sala_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM recibos x WHERE x.contrato_id = c.id
                  AND x.estado = 'activo' AND x.tipo = 'entrada')
  AND COALESCE(r.total, 0) + c.cuota_inicial <= c.monto_total + 0.01
ORDER BY c.id;

-- FASE 2b: EXCLUIDOS → quedan para revisión manual (NO se les crea recibo)
SELECT c.id, c.numero_contrato, c.estado, c.monto_total, c.cuota_inicial,
       COALESCE(r.total, 0) AS recibos_activos_actuales,
       CASE WHEN c.estado = 'cancelado' THEN 'cancelado (posible devolución)'
            WHEN c.sala_id IS NULL      THEN 'sin sala (sin prefijo de consecutivo)'
            ELSE 'recibos existentes + entrada > monto_total (¿entrada ya registrada a mano?)'
       END AS motivo
FROM contratos c
LEFT JOIN (SELECT contrato_id, SUM(valor) AS total FROM recibos
           WHERE estado = 'activo' GROUP BY contrato_id) r ON r.contrato_id = c.id
WHERE c.cuota_inicial > 0
  AND NOT EXISTS (SELECT 1 FROM recibos x WHERE x.contrato_id = c.id
                  AND x.estado = 'activo' AND x.tipo = 'entrada')
  AND (c.estado = 'cancelado' OR c.sala_id IS NULL
       OR COALESCE(r.total, 0) + c.cuota_inicial > c.monto_total + 0.01);

-- FASE 3: INSERT de recibos retroactivos + avance del contador, atómico
WITH candidatos AS (
  SELECT c.id, c.numero_contrato, c.persona_id, c.sala_id, c.forma_pago_inicial_id,
         c.cuota_inicial, c.fecha_contrato,
         ROW_NUMBER() OVER (PARTITION BY c.sala_id ORDER BY c.fecha_contrato, c.id) AS rn
  FROM contratos c
  LEFT JOIN (SELECT contrato_id, SUM(valor) AS total FROM recibos
             WHERE estado = 'activo' GROUP BY contrato_id) r ON r.contrato_id = c.id
  WHERE c.cuota_inicial > 0
    AND c.estado <> 'cancelado'
    AND c.sala_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM recibos x WHERE x.contrato_id = c.id
                    AND x.estado = 'activo' AND x.tipo = 'entrada')
    AND COALESCE(r.total, 0) + c.cuota_inicial <= c.monto_total + 0.01
),
ins AS (
  INSERT INTO recibos (consecutivo, contrato_id, cuota_id, persona_id, sala_id,
                       forma_pago_id, valor, fecha_pago, usuario_id, estado, observacion, tipo)
  SELECT s.prefijo_contrato || '-RC-' || (s.serial_recibo + cd.rn),
         cd.id, NULL, cd.persona_id, cd.sala_id, cd.forma_pago_inicial_id,
         cd.cuota_inicial, cd.fecha_contrato, NULL, 'activo',
         'Cuota inicial contrato ' || cd.numero_contrato || ' (backfill 2026-06)', 'entrada'
  FROM candidatos cd
  JOIN salas s ON s.id = cd.sala_id
  RETURNING sala_id
)
UPDATE salas s SET serial_recibo = s.serial_recibo + agg.n
FROM (SELECT sala_id, COUNT(*)::int AS n FROM ins GROUP BY sala_id) agg
WHERE s.id = agg.sala_id;

-- FASE 4: verificaciones (todas deben cuadrar ANTES del COMMIT)
-- 4.1 total de recibos de entrada creados (debe coincidir con candidatos de 2a)
SELECT COUNT(*) AS recibos_entrada_total FROM recibos WHERE tipo = 'entrada';
-- 4.2 ningún contrato con pagos activos > monto_total (debe devolver 0 filas)
SELECT c.id, c.numero_contrato, c.monto_total, SUM(r.valor) AS pagado
FROM contratos c
JOIN recibos r ON r.contrato_id = c.id AND r.estado = 'activo'
GROUP BY c.id HAVING SUM(r.valor) > c.monto_total + 0.01;
-- 4.3 consecutivos duplicados (debe devolver 0 filas)
SELECT consecutivo FROM recibos WHERE consecutivo IS NOT NULL
GROUP BY consecutivo HAVING COUNT(*) > 1;

COMMIT;
-- Si algo no cuadra: sustituir COMMIT por ROLLBACK.
-- Rollback de emergencia post-COMMIT (quirúrgico):
--   DELETE FROM recibos WHERE tipo='entrada' AND observacion LIKE '%backfill 2026-06%';
--   (no hace falta bajar serial_recibo: dejar huecos es seguro, el backfill-regex solo sube)
