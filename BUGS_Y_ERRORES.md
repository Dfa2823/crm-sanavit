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

## 📋 PENDIENTES / POR REVISAR

### [006] FRONTEND_URL en backend apunta a URL de frontend que aún no existe
- **Fecha:** 2026-03-10
- **Síntoma:** El backend tiene `FRONTEND_URL=https://crm-sanavit-frontend.up.railway.app` pero el frontend real se llama `reasonable-hope`
- **Causa:** Se configuró la variable antes de crear el servicio frontend
- **Solución:** Una vez que el frontend esté desplegado, actualizar `FRONTEND_URL` en el servicio backend con la URL real del frontend
- **Archivo:** Railway Variables → `crm-sanavit` backend service

### [007] El seed de producción no se ha ejecutado en Railway
- **Fecha:** 2026-03-10
- **Síntoma:** La base de datos de Railway tiene tablas pero posiblemente no datos de prueba en producción
- **Causa:** El seed solo se ejecutó en modo local apuntando a Railway DB. Verificar si los datos están presentes.
- **Solución:** Si faltan datos, ejecutar `npm run seed` desde local apuntando a Railway (ya funciona) o desde Railway CLI

---

## 🗂️ MÓDULOS PENDIENTES DE DESARROLLO (del diagnóstico SICC)

Basado en `LEVANTAMIENTO_SICC.md` y `PLAN_CRM_NUEVO.md`, estos módulos **faltan implementar**:

### Backend (APIs faltantes)
- [ ] `POST /api/citas` — Crear visita_sala cuando hostess registra llegada
- [ ] `GET /api/personas/buscar` — Búsqueda por nombre (además de teléfono)
- [ ] `GET /api/leads/hoy` — Leads del día filtrado por sala (para TMK)
- [ ] `POST /api/visitas` — Registrar llegada del cliente a sala
- [ ] `PATCH /api/usuarios/:id` — Actualizar datos de usuario
- [ ] `POST /api/usuarios` — Crear nuevo usuario (admin)
- [ ] Módulo Cartera (deudas, mora 30/60/90)
- [ ] Módulo Comisiones (cálculo por ventas/tours)
- [ ] Módulo SAC/PQR (quejas y reclamos)
- [ ] Integración WhatsApp (notificaciones)
- [ ] Generación de contratos PDF

### Frontend (páginas/funcionalidades faltantes)
- [ ] Panel de Administración (crear/editar usuarios, salas, tipificaciones)
- [ ] Módulo Outsourcing (gestión de call centers externos)
- [ ] Vista Supervisor Call Center
- [ ] Reportes exportables (Excel/PDF)
- [ ] Gestión de Cartera
- [ ] Comisiones
- [ ] Notificaciones en tiempo real

---

## 📝 NOTAS DE ARQUITECTURA

- **Base de datos:** Railway PostgreSQL (centerbeam.proxy.rlwy.net:24683)
- **Backend local:** http://localhost:3001
- **Frontend local:** http://localhost:5173
- **Backend prod:** https://crm-sanavit.up.railway.app (en deploy)
- **Frontend prod:** https://reasonable-hope.up.railway.app (en deploy)
- **GitHub:** https://github.com/Dfa2823/crm-sanavit
- **Railway Project:** passionate-healing (ID: 81338afe-6cb9-48c9-a7bc-fd97b3e5ffab)
