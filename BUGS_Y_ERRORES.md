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

## 📋 PENDIENTES / POR REVISAR

### [011] Seed de producción — verificar datos
- **Fecha:** 2026-03-10
- **Síntoma:** Verificar que los datos del seed estén presentes en la DB de producción
- **Solución pendiente:** Probar login con `admin/sanavit123` en https://reasonable-hope-production.up.railway.app

---

## 🗂️ MÓDULOS IMPLEMENTADOS (sesión 2026-03-10)

### Backend (implementado en este commit: ffaf8b8)
- [x] `GET/POST/PATCH/DELETE /api/admin/usuarios` — CRUD completo con bcrypt
- [x] `GET/POST/PATCH /api/admin/salas` — CRUD salas
- [x] `GET/POST/PATCH /api/admin/tipificaciones` — CRUD tipificaciones
- [x] `GET/POST/PATCH /api/admin/fuentes` — CRUD fuentes
- [x] `GET /api/admin/roles` — listar roles
- [x] `GET /api/cartera?sala_id=X` — Cartera con mock data de visitas_sala
- [x] `GET /api/cartera/resumen?sala_id=X` — Stats mora 30/60/90
- [x] `GET /api/reportes/leads` — Reporte leads con filtros
- [x] `GET /api/reportes/asistencias` — Reporte asistencias/tours
- [x] `GET /api/reportes/tmk` — Productividad por TMK

### Frontend (implementado en este commit: ffaf8b8)
- [x] Panel de Administración `/admin` (usuarios, salas, tipificaciones, fuentes)
- [x] Gestión de Cartera `/cartera` (mora 30/60/90, tabla de deudores)
- [x] Reportes exportables `/reportes` (CSV/Excel, 3 tipos de reporte)
- [x] Sidebar actualizado por rol
- [x] Dashboard redirects actualizados

### Pendiente para próxima iteración
- [ ] Módulo Comisiones (cálculo por ventas/tours)
- [ ] Módulo SAC/PQR (quejas y reclamos)
- [ ] Integración WhatsApp (notificaciones)
- [ ] Generación de contratos PDF
- [ ] Módulo Outsourcing (gestión de call centers externos)
- [ ] Vista Supervisor Call Center con métricas en tiempo real
- [ ] Notificaciones en tiempo real (WebSockets)
- [ ] Tablas reales de cartera (contratos, cuotas, pagos) — actualmente usa mock de visitas_sala

---

## 📝 NOTAS DE ARQUITECTURA

- **Base de datos:** Railway PostgreSQL (centerbeam.proxy.rlwy.net:24683)
- **Backend local:** http://localhost:3001
- **Frontend local:** http://localhost:5173
- **Backend prod:** https://crm-sanavit-production.up.railway.app (Puerto 3001)
- **Frontend prod:** https://reasonable-hope-production.up.railway.app (Puerto 8080)
- **GitHub:** https://github.com/Dfa2823/crm-sanavit
- **Railway Project:** passionate-healing (ID: 81338afe-6cb9-48c9-a7bc-fd97b3e5ffab)
- **Último commit desplegado:** ffaf8b8 — feat: Add Admin Panel, Cartera and Reportes modules
