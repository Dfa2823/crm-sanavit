# 🐛 Registro de Bugs y Errores — CRM Sanavit Ecuador

> Este archivo es la memoria de desarrollo. Se actualiza continuamente con cada error encontrado y su solución.

---

## ✅ RESUELTOS

### [001] React Router v7 warnings en consola
- **Fecha:** 2026-03-10
- **Síntoma:** Warnings en consola: `React Router Future Flag Warning: v7_startTransition` y `v7_relativeSplatPath`
- **Causa:** React Router v6 requiere declarar explícitamente los flags de compatibilidad con v7
- **Solución:** Agregar `future={{ v7_startTransition: true, v7_relativeSplatPath: true }}` al `<BrowserRouter>` en `App.jsx`
- **Archivo:** `frontend/src/App.jsx`

### [002] PostgreSQL no instalado localmente
- **Fecha:** 2026-03-10
- **Síntoma:** `createdb: command not found` y `ECONNREFUSED 127.0.0.1:5432`
- **Causa:** El equipo de desarrollo no tiene PostgreSQL instalado localmente
- **Solución:** Usar directamente la base de datos de Railway (DATABASE_PUBLIC_URL) en el `.env` local. Conectar desde local a Railway PostgreSQL.
- **Archivo:** `backend/.env`

### [003] `&&` no funciona en PowerShell para encadenar comandos
- **Fecha:** 2026-03-10
- **Síntoma:** Error al intentar `cd backend && npm install && npm run seed`
- **Causa:** PowerShell no soporta el operador `&&` de bash
- **Solución:** Ejecutar cada comando por separado, o usar `;` para secuenciar (sin validación de errores)
- **Entorno:** Windows PowerShell

---

## 🔄 EN INVESTIGACIÓN

### [004] VITE_API_URL en Railway frontend con referencia de servicio
- **Fecha:** 2026-03-10
- **Síntoma:** El valor `https://${{crm-sanavit.RAILWAY_PUBLIC_DOMAIN}}` puede no resolverse correctamente en tiempo de build de Vite (las variables de entorno de Vite se inyectan en build-time, no en runtime)
- **Causa:** Vite reemplaza `import.meta.env.VITE_API_URL` en tiempo de compilación. Si Railway no resuelve la referencia antes del build, quedará como string literal.
- **Solución pendiente:** Verificar en el build log de Railway si la variable se resuelve. Si no, usar la URL directa del backend una vez que esté desplegado.
- **Archivo:** Railway Variables → `reasonable-hope` service

### [005] Nombre del servicio frontend en Railway es `reasonable-hope`
- **Fecha:** 2026-03-10
- **Síntoma:** Railway asignó nombre aleatorio `reasonable-hope` en lugar de `crm-sanavit-frontend`
- **Causa:** Railway genera nombres aleatorios para servicios creados sin nombre explícito
- **Solución pendiente:** Renombrar el servicio en Railway Settings a `crm-frontend` para que la URL sea más limpia
- **Impacto:** La URL del frontend será `reasonable-hope.up.railway.app` en lugar de algo más descriptivo

---

## ✅ RESUELTOS (sesión 2026-03-10 continuación)

### [006] FRONTEND_URL en backend apunta a URL incorrecta
- **Fecha:** 2026-03-10
- **Síntoma:** El backend tenía `FRONTEND_URL=https://crm-sanavit-frontend.up.railway.app` (URL inexistente)
- **Solución:** Actualizado en Railway Variables → `crm-sanavit` a `https://reasonable-hope-production.up.railway.app`

### [007] El seed de producción
- **Fecha:** 2026-03-10
- **Solución:** El seed se ejecutó localmente apuntando a Railway PostgreSQL. DB tiene todos los datos de prueba.

### [008] Backend "Unexposed service" — sin dominio público
- **Fecha:** 2026-03-10
- **Síntoma:** El backend no tenía dominio público, era inaccesible desde internet
- **Solución:** Generado dominio en Railway Settings → Networking → Generate Domain (puerto 3001) → `crm-sanavit-production.up.railway.app`

### [009] Frontend sin VITE_API_URL configurado
- **Fecha:** 2026-03-10
- **Síntoma:** El frontend se deployó sin VITE_API_URL, todos los API calls fallaban
- **Solución:** Agregado `VITE_API_URL=https://crm-sanavit-production.up.railway.app` en Railway Variables → `reasonable-hope`

### [010] Frontend "Unexposed service" — sin dominio público
- **Fecha:** 2026-03-10
- **Solución:** Generado dominio → `reasonable-hope-production.up.railway.app`

---

## ✅ RESUELTOS (sesión 2026-03-10 continuación 2)

### [011] Seed de producción — verificado
- **Fecha:** 2026-03-10
- **Síntoma:** Verificar que los datos del seed estén presentes en la DB de producción
- **Solución:** ✅ Verificado. Login con `admin/sanavit123` funciona. 15 leads, 8 citas, 13 usuarios en DB.

### [012] Backend `p.cedula` en reportes — columna inexistente
- **Fecha:** 2026-03-10
- **Síntoma:** `GET /api/reportes/leads` y `/api/reportes/asistencias` retornaban 500
- **Causa:** La tabla `personas` no tiene columna `cedula`, tiene `num_documento`
- **Solución:** `p.cedula` → `p.num_documento AS "Cédula"` en `backend/src/routes/reportes.js`
- **Commit:** ceb3249

### [013] Backend `p.cedula` en cartera — columna inexistente
- **Fecha:** 2026-03-10
- **Síntoma:** `GET /api/cartera` retornaba 500
- **Causa:** Mismo bug que [012] — `p.cedula` en query de cartera
- **Solución:** `p.cedula` → `p.num_documento AS cedula` en `backend/src/routes/cartera.js`
- **Commit:** 2b3d4a3

### [014] Backend inicial atascado en "Publishing image" 38 minutos
- **Fecha:** 2026-03-10
- **Síntoma:** El primer deploy del backend quedó bloqueado en la fase "Publishing image" por 38+ minutos
- **Causa:** Issue de infraestructura Railway (congestión en el registro de imágenes)
- **Solución:** Abort del deploy atascado → Railway procesó los deploys en cola automáticamente

---

## ✅ RESUELTOS (sesión 2026-03-10 continuación 3)

### [015] Frontend — COLUMNAS en ReportesPage con keys incorrectas
- **Fecha:** 2026-03-10
- **Síntoma:** La tabla de Reportes mostraba "—" en todas las celdas pese a recibir datos del API
- **Causa:** El objeto `COLUMNAS` usaba keys en snake_case (`nombres`, `telefono`, `tmk_nombre`) pero el API devuelve aliases SQL en español con mayúsculas y tildes (`"Nombre Completo"`, `"Teléfono"`, `"TMK"`)
- **Solución:** Actualizar todas las keys en `COLUMNAS` para que coincidan exactamente con los aliases del SQL en el backend
- **Archivo:** `frontend/src/pages/Reportes/ReportesPage.jsx`
- **Commit:** 40375db

### [017] Frontend — CarteraPage usa campos planos pero API devuelve estructura anidada
- **Fecha:** 2026-03-10
- **Síntoma:** Cartera cargaba sin error pero mostraba Nombre vacío ("—"), estado "Desconocido" y 0 en todos los contadores de mora
- **Causa:** `CarteraPage.jsx` accedía `item.nombres`, `item.numero_contrato`, `item.dias_mora`, `item.estado` pero el API de cartera devuelve estructura anidada: `item.persona.nombres`, `item.contrato.numero`, `item.mora_dias`, `item.estado_mora`. El resumen también usaba nombres distintos (`total_cartera` vs `total_monto`, `al_dia` vs `al_dia_contratos`)
- **Solución:** Actualizar todas las referencias en `CarteraPage.jsx` para usar la estructura real del API
- **Archivo:** `frontend/src/pages/Cartera/CarteraPage.jsx`
- **Commit:** 278f360

### [016] Frontend — Prefijo `/api/` faltante en outsourcing.js y comisiones.js
- **Fecha:** 2026-03-10
- **Síntoma:** Páginas Outsourcing y Comisiones mostraban "Error al cargar empresas" / "Error al cargar comisiones" inmediatamente al cargar
- **Causa:** `api/outsourcing.js` llamaba `/outsourcing/empresas` y `api/comisiones.js` llamaba `/comisiones` — sin el prefijo `/api/`. El backend registra las rutas bajo `/api/outsourcing` y `/api/comisiones`
- **Solución:** Agregar `/api/` al inicio de todas las rutas en ambos archivos
- **Archivos:** `frontend/src/api/outsourcing.js`, `frontend/src/api/comisiones.js`
- **Commit:** 3210848

---

## 📋 PENDIENTES / POR REVISAR

---

## 🗂️ MÓDULOS IMPLEMENTADOS

### Backend — Fase 2 (commit b0c43fa)
- [x] `GET/POST/PATCH/DELETE /api/admin/usuarios` — CRUD completo con bcrypt
- [x] `GET/POST/PATCH /api/admin/salas`, `/tipificaciones`, `/fuentes`, `/roles`
- [x] `GET/POST/PATCH /api/admin/formas-pago` — CRUD formas de pago ✅ Fase 3
- [x] `GET /api/cartera` — Cartera real (tabla contratos/cuotas) con fallback a mock
- [x] `GET /api/cartera/resumen` — Stats mora 30/60/90
- [x] `GET /api/reportes/leads` — Reporte leads exportable CSV
- [x] `GET /api/reportes/asistencias` — Reporte asistencias/tours
- [x] `GET /api/reportes/tmk` — Productividad por agente TMK ✅ Fase 3
- [x] `GET /api/outsourcing/empresas` — CRUD empresas outsourcing
- [x] `GET /api/outsourcing/stats` — Métricas por empresa (leads, tours, efectividad)
- [x] `GET /api/comisiones` — Listado de comisiones del período
- [x] `GET /api/comisiones/resumen` — Cálculo automático por colaborador

### Backend — Fase 3 (commit 17ef1da + 8d02f9c)
- [x] Schema v2: tablas `formas_pago`, `productos`, `bodegas`, `venta_productos`, `despachos`, `recibos`, `refinanciaciones`, `comision_config`, `pqr`, `audit_log`
- [x] Extensión tabla `contratos`: 11 nuevas columnas (valor_bruto, iva_porcentaje, segunda_venta, etc.)
- [x] Migración `telefono2` y `notas_internas` en tabla `personas`
- [x] `GET/POST/PATCH /api/productos` — Catálogo de productos/servicios Sanavit
- [x] `GET /api/ventas` — Lista contratos con total pagado y saldo calculado
- [x] `GET /api/ventas/:id` — Vista 360° con regla 30% comisión
- [x] `POST /api/ventas` — Crear contrato (transaccional: serial + productos + plan cuotas)
- [x] `PATCH /api/ventas/:id/estado` — Cambiar estado contrato
- [x] `GET/POST /api/recibos` — Registrar pagos con actualización cuotas
- [x] `PATCH /api/recibos/:id/anular` — Anular recibo
- [x] `GET/POST/PATCH /api/personas` — Soporte completo telefono2, búsqueda por tel2

### Frontend — Fase 2 (commit b0c43fa — E2E ✅)
- [x] Dashboard KPIs `/kpis` — Tours/No Tours/No Shows, funnel, efectividad ✅
- [x] Pre-manifiesto `/premanifiesto` — 4 tabs (confirmadas/tentativas/canceladas/inasistencias) ✅
- [x] Recepción `/recepcion` — lista citas del día, registrar llegada ✅
- [x] Leads `/leads` — captura, tipificación, búsqueda persona ✅
- [x] Cartera `/cartera` — contratos reales, mora 30/60/90, estructura anidada ✅
- [x] Reportes `/reportes` — CSV export, leads/asistencias, aliases SQL correctos ✅
- [x] Outsourcing `/outsourcing` — CRUD empresas, estadísticas por empresa ✅
- [x] Comisiones `/comisiones` — cálculo automático por período ($250 en demo) ✅
- [x] Panel de Administración `/admin` — usuarios, salas, tipificaciones, fuentes ✅

### Frontend — Fase 3 (commits cdaf4e0 + c84cb4d + 8d02f9c)
- [x] **Ventas** `/ventas` — lista contratos con stats financieros (cartera/cobrado/saldo) ✅
- [x] **Vista 360° contrato** `/ventas/:id` — 5 tabs: Cliente/Contrato/Productos/Cartera/Pagos + indicador 30% ✅
- [x] Admin `/admin` — nuevos tabs: 💳 Formas de Pago, 📦 Catálogo Productos ✅
- [x] Leads — campo "Teléfono 2" en formulario de captura ✅
- [x] Leads — botón WhatsApp 📱 en columna teléfono (prefijo 593) ✅
- [x] Reportes `/reportes` — 4 tipos: Leads / Asistencias / TMK / Contratos+Ventas ✅
- [x] Reportes — resumen estadístico por tipo (cards financieros, totales) ✅

---

## ✅ RESUELTOS (sesión 2026-03-10 continuación 4 — E2E Fase 3)

### [018] Frontend no rebuildeaba tras push docs-only
- **Fecha:** 2026-03-10
- **Síntoma:** Railway no reconstruyó el frontend después del push de `688d287` (BUGS_Y_ERRORES.md only), pese a que el commit anterior `8d02f9c` tenía cambios en `frontend/`
- **Causa:** Railway detecta cambios por watch path sobre el HEAD del push, no sobre todos los commits del push
- **Solución:** Bump `frontend/package.json` de v1.0.0 → v2.0.0 (commit `fb2ec8d`) para forzar detección de cambio en `frontend/`
- **Bundle resultante:** `index-ObB_-HrQ.js` (nuevo hash confirmado)

### [019] git push cuelga en bash/shell de Claude
- **Fecha:** 2026-03-10
- **Síntoma:** `git push origin main` se cuelga indefinidamente en terminal bash
- **Causa:** Windows Credential Manager (GCM) requiere abrir diálogo GUI del browser para re-autenticar GitHub, lo cual no es posible en terminal no-interactiva
- **Solución:** Usuario ejecuta push manualmente desde PowerShell/CMD donde GCM puede mostrar el diálogo GUI
- **Entorno:** Windows + Git Credential Manager

---

## ✅ E2E FASE 3 — Verificado 2026-03-10

### Frontend Fase 3 (bundle index-ObB_-HrQ.js)
- [x] **Reportes** `/reportes` — 4 chips: Leads / Asistencias/Tours / Productividad TMK / Contratos/Ventas ✅
- [x] **Reportes** — Stats cards por tipo (Total Leads 15, Tours 1, Confirmados 5 en Leads; 2 agentes TMK) ✅
- [x] **Leads** `/mercadeo/captura` — Botón 📱 WhatsApp junto a cada teléfono → `wa.me/593XXXXXXXXX` ✅
- [x] **Leads** — Campo "Teléfono 2 (opcional)" visible en formulario de nueva persona ✅
- [x] **Admin** `/admin` — Tab 💳 Formas de Pago: 8 formas registradas, CRUD funcional ✅
- [x] **Admin** `/admin` — Tab 📦 Productos: 6 productos Sanavit, CRUD funcional ✅
- [x] **Ventas** `/ventas` — Lista contratos con stats financieros ✅
- [x] **Vista 360°** `/ventas/1` — 5 tabs + indicador "⏳ Falta 30.0% para comisión" ✅

### Backend Fase 3 (v2.0.0 en Railway)
- [x] `GET /api/productos` → 6 productos ✅
- [x] `GET /api/ventas` → contrato SQT-2476 ✅
- [x] `GET /api/ventas/1` → Vista 360° con resumen comisión ✅
- [x] `POST /api/recibos` → funcional ✅
- [x] `GET /api/admin/formas-pago` → 8 items ✅
- [x] `GET /api/reportes/tmk` → 2 agentes ✅

---

### E2E Fase 4 — Formulario Nueva Venta + Registrar Pago ✅ (2026-03-10)
- [x] `/ventas/nueva` carga correctamente (antes daba 404) ✅
- [x] Búsqueda por teléfono → banner "✅ Carmen Suárez Morales" ✅
- [x] Catálogo productos con botón "+" por ítem ✅
- [x] 2 productos en carrito → total auto-calculado $1.200 ✅
- [x] Plan mensual, 6 cuotas, cuota inicial $200 ✅
- [x] Forma pago inicial visible cuando cuota_inicial > 0 ✅
- [x] Submit → SQT-2477 creado → redirige a `/ventas/3` ✅
- [x] Tab Pagos → botón "+ Registrar Pago" visible ✅
- [x] Drawer Registrar Pago → $360 / Transferencia bancaria ✅
- [x] Resumen actualizado: Pagado=$360, Saldo=$840, **30% → "✅ Comisión desbloqueada"** ✅
- [x] Botón "Anular" visible para admin/director ✅

### Bug [020] — serial_contrato desincronizado con contratos del seed
- **Fecha:** 2026-03-10
- **Síntoma:** POST /api/ventas devolvía 409 "Número de contrato duplicado" en el primer intento
- **Causa:** `scripts/seed.js` insertaba SQT-2476 directamente en `contratos` sin actualizar `salas.serial_contrato` (se quedaba en 2475). Al hacer POST, el backend calculaba `2475+1=2476` y colisionaba con el contrato ya existente.
- **Solución:** (1) `admin.js` PATCH /api/admin/salas/:id ahora acepta `serial_contrato`; (2) `seed.js` sincroniza serial tras insertar contratos; (3) Fix en producción via PATCH `{serial_contrato: 2476}` a Sala Quito.
- **Commits:** `4b2f134` — fix: serial_contrato — corrige duplicado al crear contratos

### Pendiente para próxima iteración
- [ ] Módulo SAC/PQR (quejas y reclamos)
- [ ] Generación PDF contratos (Acta Entrega Recepción + Acta Crédito) — pendiente formatos de Juan Sebastian
- [ ] Vista Supervisor Call Center con métricas en tiempo real
- [ ] Config porcentajes comisión por rol (pendiente tabla de Lizethe)
- [ ] Notificaciones en tiempo real (WebSockets)

---

## 📝 NOTAS DE ARQUITECTURA

- **Base de datos:** Railway PostgreSQL (centerbeam.proxy.rlwy.net:24683)
- **Backend local:** http://localhost:3001
- **Frontend local:** http://localhost:5173
- **Backend prod:** https://crm-sanavit-production.up.railway.app (Puerto 3001)
- **Frontend prod:** https://reasonable-hope-production.up.railway.app (Puerto 8080)
- **GitHub:** https://github.com/Dfa2823/crm-sanavit
- **Railway Project:** passionate-healing (ID: 81338afe-6cb9-48c9-a7bc-fd97b3e5ffab)
- **Último commit backend:** 4b2f134 — fix: serial_contrato — corrige duplicado al crear contratos
- **Último commit frontend:** ee2e7a7 — feat: Fase 4 — Formulario Nueva Venta + Registrar Pago/Recibo
- **Backend version:** 2.0.0 — Fase 4 activa en producción ✅
- **Frontend bundle:** index-4unkBS4a.js (rebuildeado 2026-03-10)
- **Schema v2:** aplicado en Railway DB (10 tablas nuevas + extensiones + telefono2)
- **E2E Fase 2:** ✅ Todos los módulos verificados (2026-03-10)
- **E2E Fase 3:** ✅ Todos los módulos verificados (2026-03-10)
- **E2E Fase 4:** ✅ Todos los módulos verificados (2026-03-10)
