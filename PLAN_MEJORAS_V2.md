# 📋 PLAN DE MEJORAS V2 — CRM Sanavit Ecuador
**Fecha:** 10 de Marzo de 2026
**Basado en:** LEVANTAMIENTO_SICC.md + PLAN_CRM_NUEVO.md + Reunión 09/03/2026 + Estado actual del prototipo
**Estado prototipo actual:** Commit `1c2fb41` — Fase 0 + Fase 2 parcial completos, E2E ✅

---

## 1. ANÁLISIS CRUZADO: SICC vs REUNIÓN vs PROTOTIPO ACTUAL

### 1.1 Módulos SICC vs Estado en el nuevo CRM

| Módulo SICC | Funcionalidad clave | Estado actual | Fase plan |
|---|---|---|---|
| **Mercadeo → Callcenter** | Captura leads, tipificación, 2 teléfonos, patología, supervisor | ✅ Implementado básico | Fase 2 ✅ |
| **Mercadeo → Confirmar** | Calendario pendientes, confirmar cita | ✅ Pre-manifiesto OK | Fase 2 ✅ |
| **Mercadeo → Premanifiesto** | 4 tabs: Confirmadas/Tentativas/Canceladas/Inasistencias | ✅ Implementado | Fase 2 ✅ |
| **Mercadeo → Manifiesto** | Lista consolidada final con outsourcings | ⚠️ Parcial (Recepción) | Fase 2 ✅ |
| **Mercadeo → Leads (tipo=24)** | Gestión de leads con historial | ✅ Implementado | Fase 2 ✅ |
| **Mercadeo → Comisiones** | Períodos de comisión mercadeo | ✅ Implementado básico | Fase 5 🔄 |
| **Salas → Registrar Venta** | Crear contrato con productos + forma de pago + financiación | ❌ **FALTA** | Fase 3 ❌ |
| **Salas → Despachos** | Registro de servicio aplicado al paciente | ❌ **FALTA** | Fase 3 ❌ |
| **Salas → RegFunc** | Registro de funciones/actividades de sala | ❌ **FALTA** | Fase 3 ❌ |
| **Salas → ComSal/ComEcu** | Comisiones de sala (Ecuador activo) | ⚠️ Parcial | Fase 5 🔄 |
| **Ventas → Consultar Venta** | Vista 360°: Cliente/Valores/Productos/Cartera/Pagos/Docs/Historial | ❌ **FALTA** | Fase 3 ❌ |
| **Ventas → Imprimir** | Generación PDF contratos (Acta Entrega, Acta Crédito) | ❌ **FALTA** | Fase 3 ❌ |
| **Ventas → Citas** | Citas de seguimiento post-venta | ❌ **FALTA** | Fase 3 ❌ |
| **Ventas → Modificar Estado** | Cambiar estado contrato (activo/inactivo/anulado) | ❌ **FALTA** | Fase 3/4 ❌ |
| **Ventas → Modificar Valores** | Editar valores comerciales de contrato existente | ❌ **FALTA** | Fase 4 ❌ |
| **Ventas → Bloqueo Comisiones** | Marcar contrato para excluir de comisiones | ❌ **FALTA** | Fase 5 ❌ |
| **Recibos → Registrar** | Registrar pago recibido de cliente | ❌ **FALTA** | Fase 4 ❌ |
| **Recibos → Anular** | Reversión de recibo emitido | ❌ **FALTA** | Fase 4 ❌ |
| **Recibos → Reclasificar** | Cambiar clasificación de pago | ❌ **FALTA** | Fase 4 ❌ |
| **Cartera → Gestión** | Filtros vencimiento 30/60/90/180/360 días, bandas | ⚠️ Básico (3 bandas) | Fase 4 🔄 |
| **Cartera → Distribuir** | Asignar contratos a asesores de cobro | ❌ **FALTA** | Fase 4 ❌ |
| **Cartera → Modificar Vencimientos** | Renegociar fechas cuotas | ❌ **FALTA** | Fase 4 ❌ |
| **Cartera → Refinanciar** | Reestructurar plan de pagos | ❌ **FALTA** | Fase 4 ❌ |
| **Cartera → Extractos** | Cuentas de cobro por cliente | ❌ **FALTA** | Fase 4 ❌ |
| **SAC → PQR** | Registro PQR por contrato | ❌ **FALTA** | Fase post-v1 ❌ |
| **SAC → Encuestas** | NPS / encuestas por tipo | ❌ **FALTA** | Fase post-v1 ❌ |
| **Admin → Documentos** | Templates HTML de contratos y recibos | ❌ **FALTA** | Fase 3 ❌ |
| **Admin → Consecutivos** | Control numeración SQT/SQM con serial actual | ⚠️ En tabla salas | Fase 1 🔄 |
| **Admin → Maestros** | Tablas de configuración (formas de pago, etc.) | ⚠️ Parcial | Fase 1 🔄 |
| **Admin → Rango Comisiones** | Config porcentajes por rol y tipo de venta | ❌ **FALTA** | Fase 5 ❌ |
| **Inventario → Productos** | Catálogo con SKU, tipo, marca, precio, stock | ❌ **FALTA** | Fase 1 ❌ |
| **Inventario → Bodegas** | Ubicaciones (Bodega Terraza, Medizentrum, etc.) | ❌ **FALTA** | Fase 1 ❌ |
| **Inventario → Movimientos** | Entradas/salidas de stock | ❌ **FALTA** | Fase 3 ❌ |
| **Reportes → Ventas (21 filtros)** | Informe exhaustivo de contratos | ⚠️ Solo leads/asistencias | Fase 6 🔄 |
| **Reportes → Cartera** | Reporte vencimiento proyectado | ⚠️ Solo 3 bandas | Fase 6 🔄 |
| **Reportes → Comisiones TMK** | Reporte individual por asesor | ⚠️ Resumen básico | Fase 6 🔄 |
| **Reportes → B2chat** | Integración mensajería | ❌ Fuera de alcance v1 | Fase post-v1 |
| **Logs → Actividad** | Audit trail de acciones (17M+ registros en SICC) | ❌ **FALTA** | Fase 1 🔄 |
| **Sistema → Mensajes** | Mensajería interna entre usuarios | ❌ **FALTA** | Fase post-v1 |

---

## 2. HALLAZGOS CRÍTICOS DEL CRUCE SICC + REUNIÓN

### 2.1 Datos de negocio confirmados en reunión (09/03/2026)

| Dato | Origen | Valor |
|---|---|---|
| Contratos activos Quito | SICC consecutive | SQT: 2.475 (siguiente: SQT-2476) |
| Contratos activos Manta | SICC consecutive | SQM: 2.088 (siguiente: SQM-2089) |
| Recibos emitidos Quito | SICC consecutive | SQT-RC: 1.439 |
| Recibos emitidos Manta | SICC consecutive | SQM-RC: 1.413 |
| IVA Ecuador | Reunión | 15% — empresa lo absorbe |
| Tipificaciones aprobadas | Reunión | 9 exactas (ver listado) |
| Fuentes de leads | Reunión | 7 exactas |
| Formas de pago | Reunión | 8: Efectivo/Transferencia/Depósito/TC/TD/Link/Crédito Directo/Diferido |
| Comisiones: regla 30% | Reunión | No liquidar hasta 30% del valor pagado acumulado |
| Comisiones: base de cálculo | Reunión | Valor BRUTO antes de IVA |
| Porcentajes de comisión | **PENDIENTE Lizethe** | Sin confirmar → bloquea Fase 5 |
| Plan de incentivos | **PENDIENTE Juan Sebastian** | Metas TOURS + CASH por sala/período |
| Formatos contratos PDF | **PENDIENTE Juan Sebastian** | Acta Entrega Recepción + Acta Crédito |

### 2.2 Reglas de negocio CRÍTICAS (deben implementarse en backend)

| # | Regla | Estado |
|---|---|---|
| RN-01 | Comisión solo se liquida cuando cliente paga ≥30% del total | ❌ No implementada |
| RN-02 | Base de comisión = valor_bruto (sin IVA 15%) | ❌ No implementada |
| RN-03 | Empleado retirado ANTES del 30% = $0 comisión | ❌ No implementada |
| RN-04 | Empleado retirado DESPUÉS del 30% = cobra primera liquidación, no las siguientes | ❌ No implementada |
| RN-05 | Venta inactiva sale del proceso de comisiones | ❌ No implementada |
| RN-06 | "Quien recoge, comisiona" (asesor cartera que cobra, gana comisión) | ❌ No implementada |
| RN-07 | División SAC: si SAC interviene, comisión se divide consultor/agente_SAC | ❌ No implementada |
| RN-08 | Outsourcing: aislamiento total (no ve otros outsourcings ni operación interna) | ✅ Implementada |
| RN-09 | Jefe de sala: solo puede ser jefe de 1 sala | ⚠️ Parcial (validación DB falta) |
| RN-10 | Precio fijo: no hay descuentos (precio = catálogo) | ❌ No validado en backend |
| RN-11 | Consecutivos SQT/SQM continúan desde números actuales del SICC | ⚠️ Hardcodeado en seed |
| RN-12 | num_documento UNIQUE en personas (el SICC no tenía esta restricción — bug heredado) | ✅ Campo existe, no tiene UNIQUE |

---

## 3. GAPS DE SCHEMA — TABLAS FALTANTES

### Prioridad ALTA (bloquean funcionalidad core)

```sql
-- PRODUCTOS: Catálogo de servicios Sanavit (Sueroterapia, Detox, Biopuntura)
CREATE TABLE productos (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(20) UNIQUE NOT NULL,    -- ej: SRV-001
  nombre VARCHAR(200) NOT NULL,
  tipo VARCHAR(50),                      -- 'servicio' | 'producto' | 'obsequio' | 'ajuste'
  marca VARCHAR(50) DEFAULT 'SANAVIT',   -- SANAVIT | VITHANI | DIVASKIN
  precio_venta NUMERIC(10,2) NOT NULL,
  tiene_iva BOOLEAN DEFAULT false,       -- Ecuador absorbe IVA, mayoría false
  descripcion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FORMAS DE PAGO (tabla maestra)
CREATE TABLE formas_pago (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) UNIQUE NOT NULL,
  tipo VARCHAR(30),   -- 'efectivo' | 'banco' | 'credito' | 'fintech'
  activo BOOLEAN DEFAULT true
);

-- BODEGAS (ubicaciones físicas)
CREATE TABLE bodegas (
  id SERIAL PRIMARY KEY,
  sala_id INTEGER REFERENCES salas(id),
  nombre VARCHAR(100) NOT NULL,
  ubicacion TEXT,
  activo BOOLEAN DEFAULT true
);

-- VENTA_PRODUCTOS (qué productos lleva cada contrato)
CREATE TABLE venta_productos (
  id SERIAL PRIMARY KEY,
  contrato_id INTEGER REFERENCES contratos(id) NOT NULL,
  producto_id INTEGER REFERENCES productos(id) NOT NULL,
  cantidad INTEGER DEFAULT 1,
  precio_unitario NUMERIC(10,2) NOT NULL,
  valor_total NUMERIC(10,2) NOT NULL,
  despacho_estado VARCHAR(20) DEFAULT 'pendiente',  -- pendiente | despachado
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DESPACHOS (registro de servicio aplicado al paciente)
CREATE TABLE despachos (
  id SERIAL PRIMARY KEY,
  contrato_id INTEGER REFERENCES contratos(id) NOT NULL,
  venta_producto_id INTEGER REFERENCES venta_productos(id),
  persona_id INTEGER REFERENCES personas(id) NOT NULL,  -- titular o beneficiario
  producto_id INTEGER REFERENCES productos(id) NOT NULL,
  bodega_id INTEGER REFERENCES bodegas(id),
  cantidad INTEGER NOT NULL,
  lote VARCHAR(50),
  fecha_despacho DATE DEFAULT CURRENT_DATE,
  usuario_id INTEGER REFERENCES usuarios(id),
  observacion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RECIBOS DE CAJA (pagos recibidos)
CREATE TABLE recibos (
  id SERIAL PRIMARY KEY,
  consecutivo VARCHAR(20) UNIQUE,        -- ej: SQT-RC-1440
  contrato_id INTEGER REFERENCES contratos(id),
  cuota_id INTEGER REFERENCES cuotas(id),
  persona_id INTEGER REFERENCES personas(id) NOT NULL,
  sala_id INTEGER REFERENCES salas(id),
  forma_pago_id INTEGER REFERENCES formas_pago(id),
  valor NUMERIC(10,2) NOT NULL,
  fecha_pago DATE DEFAULT CURRENT_DATE,
  usuario_id INTEGER REFERENCES usuarios(id),
  estado VARCHAR(20) DEFAULT 'activo',   -- activo | anulado
  referencia_pago VARCHAR(100),          -- número de transferencia, etc.
  observacion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- REFINANCIACIONES (reestructuración de deuda)
CREATE TABLE refinanciaciones (
  id SERIAL PRIMARY KEY,
  contrato_id INTEGER REFERENCES contratos(id) NOT NULL,
  motivo TEXT,
  cuotas_anteriores_json JSONB,          -- snapshot del plan anterior
  cuotas_nuevas_json JSONB,              -- nuevo plan generado
  usuario_id INTEGER REFERENCES usuarios(id),
  aprobado_por INTEGER REFERENCES usuarios(id),
  fecha TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Prioridad MEDIA (mejoran auditoría y comisiones)

```sql
-- AUDIT LOG (historial de todas las acciones)
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id),
  username VARCHAR(100),
  accion VARCHAR(50),                    -- 'create' | 'update' | 'delete' | 'login'
  tabla VARCHAR(100),
  registro_id INTEGER,
  datos_antes JSONB,
  datos_despues JSONB,
  ip VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- COMISION_CONFIG (porcentajes por rol y tipo)
CREATE TABLE comision_config (
  id SERIAL PRIMARY KEY,
  rol VARCHAR(50) NOT NULL,             -- 'consultor' | 'tmk' | 'confirmador' | 'asesor_cartera'
  tipo_evento VARCHAR(50) NOT NULL,     -- 'tour' | 'contrato' | 'cobro_vencido'
  monto_fijo NUMERIC(10,2),             -- monto fijo (ej: $50 por tour)
  porcentaje NUMERIC(5,2),              -- % sobre valor bruto (ej: 8.5)
  activo BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by INTEGER REFERENCES usuarios(id)
);

-- PQR (Peticiones, Quejas y Reclamos)
CREATE TABLE pqr (
  id SERIAL PRIMARY KEY,
  contrato_id INTEGER REFERENCES contratos(id),
  persona_id INTEGER REFERENCES personas(id) NOT NULL,
  sala_id INTEGER REFERENCES salas(id),
  tipo VARCHAR(50),                     -- 'peticion' | 'queja' | 'reclamo' | 'sugerencia' | 'felicitacion'
  medio VARCHAR(50),                    -- 'email' | 'telefono' | 'whatsapp' | 'personal' | 'carta'
  descripcion TEXT NOT NULL,
  estado VARCHAR(30) DEFAULT 'abierto', -- abierto | en_proceso | cerrado
  agente_sac_id INTEGER REFERENCES usuarios(id),
  fecha_apertura DATE DEFAULT CURRENT_DATE,
  fecha_cierre DATE,
  respuesta TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DOCUMENTOS (plantillas de contratos y recibos)
CREATE TABLE documentos_plantillas (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(50) NOT NULL,            -- 'contrato' | 'acta_entrega' | 'acta_credito' | 'recibo'
  sala_id INTEGER REFERENCES salas(id), -- NULL = aplica a todas las salas
  nombre VARCHAR(200) NOT NULL,
  contenido_html TEXT,                  -- template HTML con {{variables}}
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CONSECUTIVOS (separar de tabla salas)
CREATE TABLE consecutivos (
  id SERIAL PRIMARY KEY,
  sala_id INTEGER REFERENCES salas(id),
  tipo VARCHAR(50) NOT NULL,            -- 'contrato' | 'recibo' | 'ajuste'
  prefijo VARCHAR(10) NOT NULL,         -- 'SQT' | 'SQM' | 'SQT-RC' | 'SQM-RC'
  serial_actual INTEGER DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  UNIQUE(sala_id, tipo)
);
```

---

## 4. ENDPOINTS API FALTANTES (FASE 3 + 4)

### 4.1 Productos y Catálogo

```
GET    /api/productos                   ← Lista de productos activos
POST   /api/productos                   ← Crear producto (admin)
PATCH  /api/productos/:id               ← Editar producto
DELETE /api/productos/:id               ← Inactivar (soft delete)
GET    /api/productos/:id               ← Detalle del producto
```

### 4.2 Sala de Ventas — Contratos completos

```
GET    /api/ventas                      ← Lista contratos filtrable (sala, estado, fechas)
POST   /api/ventas                      ← Crear contrato (genera consecutivo SQT/SQM)
GET    /api/ventas/:id                  ← Vista 360° del contrato (JOIN completo)
PATCH  /api/ventas/:id/estado           ← Cambiar estado (activo/inactivo/anulado)
PATCH  /api/ventas/:id/valores          ← Modificar valores comerciales
GET    /api/ventas/:id/timeline         ← Historial de cambios del contrato
```

### 4.3 Recibos de Caja

```
GET    /api/recibos?contrato_id=X       ← Pagos de un contrato
POST   /api/recibos                     ← Registrar pago (genera recibo SQT-RC-N)
PATCH  /api/recibos/:id/anular          ← Anular recibo
GET    /api/recibos/:id                 ← Detalle del recibo
```

### 4.4 Despachos

```
GET    /api/despachos?contrato_id=X     ← Despachos de un contrato
POST   /api/despachos                   ← Registrar despacho (baja stock)
PATCH  /api/despachos/:id               ← Actualizar despacho
```

### 4.5 Formas de Pago

```
GET    /api/admin/formas-pago           ← Lista formas de pago
POST   /api/admin/formas-pago           ← Crear forma de pago
PATCH  /api/admin/formas-pago/:id       ← Editar
```

### 4.6 Cartera — Mejoras

```
GET    /api/cartera/:contrato_id/cuotas ← Cuotas detalle de un contrato
POST   /api/cartera/:contrato_id/recibo ← Registrar pago en cuota específica
PATCH  /api/cartera/:contrato_id/refinanciar ← Refinanciar deuda
GET    /api/cartera/distribuir          ← Contratos sin asesor asignado
POST   /api/cartera/distribuir          ← Asignar a asesor
```

### 4.7 Reportes — Ampliados

```
GET    /api/reportes/ventas             ← Reporte contratos (21 filtros del SICC)
GET    /api/reportes/recibos            ← Reporte recibos por período
GET    /api/reportes/comisiones-tmk     ← Comisiones individuales por asesor
GET    /api/reportes/efectividad-tmk    ← Efectividad por agente TMK
GET    /api/reportes/pqr                ← Reporte PQR
```

---

## 5. MEJORAS VISUALES IDENTIFICADAS

### 5.1 Módulo Leads (TMK Dashboard)

**Actualmente falta vs SICC:**
- [ ] Campo "segundo teléfono" (SICC tiene Tel1 + Tel2)
- [ ] Campo "profesión" del cliente
- [ ] Selector de "programa" (mercadeo, leads, redes, etc.)
- [ ] Asignación de Supervisor TMK y Coordinador
- [ ] Vista de "historial de llamadas" por prospecto (todas las tipificaciones anteriores)
- [ ] Búsqueda más potente: por cédula, nombre, teléfono (SICC busca por Tel/Doc/Nombre)
- [ ] Botón "WhatsApp" directo al cliente (wa.me/número)

### 5.2 Vista 360° del Contrato (NUEVA — CRÍTICA)

SICC tiene el módulo `infctr` con 12 pestañas:
```
Cliente → ValoresComerciales → Productos → Cartera → Historial →
Recibos → Correos → Extractos → Archivos → Seguimiento → SMS → HistNut
```

Para el nuevo CRM (versión mínima):
```
Cliente (datos) → Valores (contrato) → Productos → Cartera → Pagos → Historial
```

### 5.3 Módulo Cartera (mejoras)

**Actualmente:** Solo tabla con 5 columnas y 3 badges de mora
**Falta:**
- [ ] Click en cliente → abre Vista 360° del contrato
- [ ] Columna "Asesor asignado" con opción de reasignar
- [ ] Bandas de vencimiento más granulares (>360, 360, 180, 120, 90, 60, 30, corriente)
- [ ] Botón "Registrar pago" directo desde la tabla
- [ ] Export Excel (no solo JSON)
- [ ] Filtro por estado del contrato (activo/inactivo)
- [ ] Contadores de mora en USD además de cantidad de contratos

### 5.4 KPIs Dashboard (mejoras)

**Actualmente:** Tours/No Tours/No Shows + Leads/Citas/Asistencias
**Falta vs SICC (reunión):**
- [ ] **Efectividad de datos** = Asistencias / Leads (cuántos leads del call center llegaron)
- [ ] **Venta promedio Cash** = Valor cash / Contratos cash
- [ ] **Cobranza** = % cobrado del portafolio
- [ ] **Mora 30/60/90** en montos USD (no solo conteo)
- [ ] **Comparativo por sala** (Quito vs Manta)
- [ ] **Por outsourcing** vs interno
- [ ] Selector de período más granular (semana / mes / trimestre)

### 5.5 Módulo Pre-manifiesto (mejoras)

**Actualmente:** 4 tabs funcionando
**Mejoras:**
- [ ] Mostrar nombre real del outsourcing (no "Interno")
- [ ] Botón "Enviar por email" el manifiesto del día
- [ ] Columna "Patología" visible en confirmadas
- [ ] Conteo total vs cuota diaria de la sala
- [ ] Vista imprimible del manifiesto

### 5.6 Módulo Admin (Panel de Administración)

**Actualmente:** Usuarios, salas, tipificaciones, fuentes
**Falta:**
- [ ] CRUD Formas de Pago
- [ ] CRUD Productos / Catálogo de servicios
- [ ] CRUD Bodegas
- [ ] CRUD Configuración comisiones (porcentajes)
- [ ] Gestión de consecutivos (ver serial actual, corregir)
- [ ] Plantillas de documentos HTML
- [ ] Carga masiva de leads (CSV upload)

---

## 6. MÓDULO DE GESTIÓN DOCUMENTAL (NUEVO)

### 6.1 Requerimiento del cliente

Del SICC: 24 plantillas activas de contratos, recibos y comunicaciones.
De la reunión: Los consultores necesitan generar PDF del contrato firmado en sala.

### 6.2 Diseño propuesto

**Backend:**
```
POST /api/documentos/upload              ← Subir archivo (contrato firmado, cédula, etc.)
GET  /api/documentos?contrato_id=X       ← Listar docs de un contrato
GET  /api/documentos/:id/download        ← Descargar archivo
DELETE /api/documentos/:id               ← Eliminar archivo

GET  /api/plantillas                     ← Listar templates disponibles
GET  /api/plantillas/:id/generar?contrato_id=X  ← Generar PDF desde template
```

**Frontend:**
- Panel "Documentos" en la Vista 360° del contrato
- Drag & drop para subir archivos
- Preview de documentos en pantalla
- Botón "Generar contrato PDF" con plantilla correspondiente

### 6.3 Almacenamiento

- **Desarrollo/Prototipo:** Carpeta local `/uploads/` con referencia en DB
- **Producción:** Railway Volume o S3-compatible (MinIO/Cloudflare R2)

---

## 7. HOJA DE RUTA ACTUALIZADA

### Esta semana (Mar 10-14, 2026)

| # | Tarea | Responsable | Estado |
|---|---|---|---|
| W1 | Demo Fase 0 + Fase 2 con cliente | Diego + Juan Sebastian + Lizethe | 📅 Mañana |
| W2 | Recibir tabla de comisiones de Lizethe | Lizethe Valdes | ⏳ Pendiente |
| W3 | Recibir formatos Acta Entrega y Acta Crédito | Juan Sebastian | ⏳ Pendiente |
| W4 | Recibir plan de incentivos (metas TOURS+CASH) | Juan Sebastian | ⏳ Pendiente |
| W5 | Implementar catálogo de productos | Diego | 🔄 Esta semana |
| W6 | Implementar registro de venta de sala | Diego | 🔄 Esta semana |
| W7 | Vista 360° del contrato | Diego | 🔄 Esta semana |

### Semana Mar 16-27 (FASE 1 pendiente)

| # | Tarea |
|---|---|
| F1.1 | Tabla `consecutivos` separada de `salas` |
| F1.2 | Catálogo completo de productos con SKU |
| F1.3 | CRUD bodegas y formas de pago en admin |
| F1.4 | Audit log implementado en todos los endpoints |
| F1.5 | Validación UNIQUE en `personas.num_documento` |

### Semana Mar 30 - Abr 10 (FASE 3 — Sala de Ventas)

| # | Tarea |
|---|---|
| F3.1 | Registro de venta completo (productos + formas de pago + financiación) |
| F3.2 | Generación automática del plan de cuotas |
| F3.3 | Vista 360° del contrato (12 tabs → 6 tabs mínimos) |
| F3.4 | Generación de PDF (Acta Entrega, Acta Crédito) |
| F3.5 | Despachos por contrato y paciente |
| F3.6 | Registro de cliente sin cita previa (desde Hostess) |

### Semana Abr 13 - May 1 (FASE 4 — Cartera)

| # | Tarea |
|---|---|
| F4.1 | Registro de recibos de caja (consecutivo SQT-RC automático) |
| F4.2 | Anulación de recibos |
| F4.3 | Modificar fechas de vencimiento |
| F4.4 | Refinanciación de deuda |
| F4.5 | Distribución de cartera a asesores |
| F4.6 | Extractos de cuenta |

### Semana May 4-15 (FASE 5 — Comisiones reales)

| # | Tarea | Bloqueado por |
|---|---|---|
| F5.1 | Config porcentajes por rol (tabla comision_config) | Tabla de Lizethe |
| F5.2 | Motor 30% rule (no liquidar hasta acumular 30%) | F5.1 |
| F5.3 | Cálculo sobre valor bruto (antes IVA 15%) | F5.1 |
| F5.4 | Regla empleado retirado | F5.1 |
| F5.5 | División SAC (consultor + agente SAC) | F5.1 |
| F5.6 | Anticipos de comisión | F5.1 |
| F5.7 | Plan de incentivos (metas TOURS + CASH) | Tabla de Juan Sebastian |

---

## 8. MEJORAS TÉCNICAS (DEUDA TÉCNICA)

| # | Mejora | Impacto | Prioridad |
|---|---|---|---|
| T1 | Separar `consecutivos` de tabla `salas` | Integridad datos | 🔴 Alta |
| T2 | Agregar `UNIQUE` en `personas.num_documento` con manejo de duplicados | Seguridad datos | 🔴 Alta |
| T3 | Audit log middleware en todos los endpoints mutantes | Trazabilidad | 🟡 Media |
| T4 | Refresh token JWT (actualmente solo access token) | Seguridad | 🟡 Media |
| T5 | Rate limiting en endpoints de auth | Seguridad | 🟡 Media |
| T6 | Validación Zod/Joi en inputs de todos los endpoints | Seguridad | 🟡 Media |
| T7 | Transacciones SQL en operaciones múltiples (crear venta + cuotas) | Integridad | 🔴 Alta |
| T8 | Indexar `consecutivos.sala_id + tipo` para queries de numeración | Performance | 🟢 Baja |
| T9 | Materializar KPI snapshots cada hora (para dashboards rápidos) | Performance | 🟢 Baja |
| T10 | Paginación en todos los endpoints GET con listas | UX/Performance | 🟡 Media |

---

## 9. MÓDULOS FUERA DE ALCANCE V1 (Para referencia)

Los siguientes módulos del SICC NO se implementarán en v1 del nuevo CRM:
- **Integración Odoo/Shopify** (marcas VITHANI/DIVASKIN inactivas)
- **Integración Wompi/Addi/Banesco/Credismart** (fintechs Colombia)
- **Módulo de ecommerce** (inactivo)
- **SAC → Sueros Vithani** (producto Colombia inactivo)
- **Bodegas internacionales** (USA, España, etc.)
- **Reportes Colombia** (salas inactivas)
- **B2chat** (requiere integración externa)
- **WhatsApp real** (requiere API Business — se empieza con botón manual)
- **NPS automático** (v2 con WhatsApp)
- **Facturación electrónica SRI** (no mencionada en reunión — v2)

---

## 10. PENDING ACTION ITEMS (CLIENTE)

| # | Responsable | Entregable | Bloquea | Fecha límite |
|---|---|---|---|---|
| P1 | **Lizethe Valdes** | Tabla porcentajes comisión por rol y tipo | Fase 5 completa | ASAP |
| P2 | **Lizethe Valdes** | Detalle separación módulo cartera | Fase 4 detalle | ASAP |
| P3 | **Lizethe Valdes** | Lista usuarios outsourcing (nombres + áreas) | Outsourcing real | ASAP |
| P4 | **Juan Sebastian** | Plan de incentivos (metas TOURS + CASH por sala) | Fase 5 incentivos | ASAP |
| P5 | **Juan Sebastian** | Formato Acta Entrega Recepción (HTML/Word/imagen) | Fase 3 PDFs | ASAP |
| P6 | **Juan Sebastian** | Formato Acta Entrega a Crédito | Fase 3 PDFs | ASAP |
| P7 | **Juan Sebastian** | Horarios trabajo call center (para módulo asistencia) | Fase 2 asistencia | ASAP |
| P8 | **Juan Sebastian** | Etiquetas/colores para KPIs | Fase 6 KPIs | Antes demo v2 |
| P9 | **Ambos** | Lista completa de productos SANAVIT con precios actuales | Fase 3 | Semana del 16 |
| P10 | **Ambos** | Acceso dump SQL del SICC o export CSV por módulo | Fase 8 migración | Mayo 2026 |

---

*Documento generado automáticamente el 10/03/2026 cruzando LEVANTAMIENTO_SICC.md + PLAN_CRM_NUEVO.md + estado del prototipo. Se actualiza con cada sesión de desarrollo.*
