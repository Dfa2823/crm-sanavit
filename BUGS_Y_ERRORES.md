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

### Backend (commit e2ba599 + anteriores)
- [x] `GET/POST/PATCH/DELETE /api/admin/usuarios` — CRUD completo con bcrypt
- [x] `GET/POST/PATCH /api/admin/salas`, `/tipificaciones`, `/fuentes`, `/roles`
- [x] `GET /api/cartera` — Cartera real (tabla contratos/cuotas) con fallback a mock
- [x] `GET /api/cartera/resumen` — Stats mora 30/60/90
- [x] `GET /api/reportes/leads` — Reporte leads exportable CSV
- [x] `GET /api/reportes/asistencias` — Reporte asistencias/tours
- [x] `GET /api/outsourcing/empresas` — CRUD empresas outsourcing
- [x] `GET /api/outsourcing/stats` — Métricas por empresa (leads, tours, efectividad)
- [x] `GET /api/comisiones` — Listado de comisiones del período
- [x] `GET /api/comisiones/resumen` — Cálculo automático por colaborador

### Frontend (commit 3210848 activo)
- [x] Dashboard KPIs `/kpis`
- [x] Pre-manifiesto `/premanifiesto`
- [x] Recepción `/recepcion`
- [x] Leads `/leads`
- [x] Cartera `/cartera` (contratos reales, mora 30/60/90)
- [x] Reportes `/reportes` (CSV export, 3 tipos)
- [x] Outsourcing `/outsourcing` (CRUD empresas, estadísticas)
- [x] Comisiones `/comisiones` (cálculo automático por período)
- [x] Panel de Administración `/admin` (usuarios, salas, tipificaciones, fuentes)

### Pendiente para próxima iteración
- [ ] Módulo SAC/PQR (quejas y reclamos)
- [ ] Integración WhatsApp (notificaciones)
- [ ] Generación de contratos PDF
- [ ] Vista Supervisor Call Center con métricas en tiempo real
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
- **Último commit desplegado:** 3210848 — fix: Agregar prefijo /api/ en outsourcing y comisiones
