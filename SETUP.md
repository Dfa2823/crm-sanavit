# CRM Sanavit Ecuador — Guía de Setup

## Credenciales de demo (todas usan: `sanavit123`)

| Usuario | Rol | Pantalla inicial |
|---|---|---|
| `director` | Director Comercial | Dashboard KPIs |
| `tmk01` | Teleoperador TMK | Mis Leads de Hoy |
| `confirmador01` | Confirmador | Calendario de Seguimiento |
| `hostess01` | Recepcionista/Hostess | Recepción del día |
| `consultor01` | Consultor de Ventas | Clientes de hoy |
| `admin` | Administrador | Dashboard KPIs |
| `lizethe` | Directora Operativa | Dashboard KPIs |

---

## Setup LOCAL (desarrollo)

### Requisitos
- Node.js 18+
- PostgreSQL 14+

### 1. Clonar y configurar

```bash
# Desde la carpeta del proyecto
cd backend
cp .env.example .env
# Editar .env con tu DATABASE_URL local:
# DATABASE_URL=postgresql://postgres:tu_password@localhost:5432/crm_sanavit
```

### 2. Instalar dependencias del backend

```bash
cd backend
npm install
```

### 3. Crear base de datos y cargar datos

```bash
# Crear la base de datos
createdb crm_sanavit

# Ejecutar el seed (crea tablas + datos de prueba)
npm run seed
```

### 4. Arrancar el backend

```bash
npm run dev
# → Corre en http://localhost:3001
# → Test: http://localhost:3001/health
```

### 5. Instalar y arrancar el frontend

```bash
cd ../frontend
npm install
npm run dev
# → Abre http://localhost:5173
```

---

## Setup en RAILWAY

### 1. Crear proyecto en Railway

1. Ve a [railway.app](https://railway.app) → New Project
2. Crea un proyecto vacío: "crm-sanavit"

### 2. Agregar PostgreSQL

1. En el proyecto → **+ New** → Database → **PostgreSQL**
2. Railway crea la DB automáticamente

### 3. Subir el código a GitHub

```bash
cd crm-sanavit
git init
git add .
git commit -m "Initial commit - CRM Sanavit prototipo"
git remote add origin https://github.com/TU_USUARIO/crm-sanavit.git
git push -u origin main
```

### 4. Crear servicio Backend

1. En Railway → **+ New** → GitHub Repo → selecciona tu repo
2. **Root directory:** `backend`
3. Variables de entorno a configurar:
   ```
   DATABASE_URL = (usar la referencia del plugin PostgreSQL)
   JWT_SECRET   = un_secreto_largo_y_seguro_aqui
   NODE_ENV     = production
   FRONTEND_URL = https://crm-frontend.up.railway.app
   ```

### 5. Ejecutar seed en Railway

```bash
# Una sola vez, en la terminal del servicio backend de Railway
npm run seed
```

### 6. Crear servicio Frontend

1. En Railway → **+ New** → GitHub Repo → mismo repo
2. **Root directory:** `frontend`
3. Variables de entorno:
   ```
   VITE_API_URL = https://crm-backend.up.railway.app
   ```
   *(Reemplaza con la URL real del backend en Railway)*

### 7. Verificar

1. Abre la URL del frontend de Railway
2. Inicia sesión con `director` / `sanavit123`
3. ✅ Listo para la demo

---

## Estructura del proyecto

```
crm-sanavit/
├── backend/                 ← Node.js + Express API
│   ├── src/
│   │   ├── index.js         ← Entry point
│   │   ├── db.js            ← Conexión PostgreSQL
│   │   ├── middleware/auth.js ← JWT middleware
│   │   └── routes/          ← auth, leads, citas, personas, kpis, usuarios
│   ├── schema.sql           ← DDL de la base de datos
│   ├── scripts/seed.js      ← Datos de prueba
│   └── railway.json         ← Config de despliegue
│
└── frontend/                ← React 18 + Vite + Tailwind
    ├── src/
    │   ├── App.jsx           ← Router principal
    │   ├── context/          ← AuthContext (JWT)
    │   ├── api/              ← Clientes axios por módulo
    │   ├── components/Layout ← Sidebar + Topbar + AppLayout
    │   └── pages/
    │       ├── Login/        ← LoginPage
    │       ├── Dashboard/    ← Redireccionador por rol
    │       ├── Mercadeo/     ← TMK, Confirmador, Pre-manifiesto
    │       ├── Sala/         ← Recepción, Hoja de vida del cliente
    │       └── KPIs/         ← Dashboard de indicadores
    └── railway.json          ← Config de despliegue
```

---

## Endpoints API disponibles

| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Login con JWT |
| GET | `/api/auth/me` | Verificar token |
| GET | `/api/personas?q=` | Buscar personas |
| POST | `/api/personas` | Crear persona |
| GET | `/api/personas/:id` | Perfil completo |
| PATCH | `/api/personas/:id` | Actualizar datos |
| GET | `/api/leads` | Listar leads |
| GET | `/api/leads/calendario` | Pendientes "Volver a llamar" |
| GET | `/api/leads/configuracion` | Tipificaciones y fuentes |
| POST | `/api/leads` | Crear lead |
| PATCH | `/api/leads/:id` | Actualizar lead |
| GET | `/api/citas/premanifiesto` | Pre-manifiesto por fecha |
| GET | `/api/citas/hoy` | Citas del día actual |
| PATCH | `/api/citas/:id/calificar` | TOUR / NO TOUR / NO SHOW |
| GET | `/api/usuarios` | Lista de usuarios |
| GET | `/api/usuarios/salas` | Lista de salas |
| GET | `/api/kpis` | KPIs calculados |
| GET | `/health` | Health check |
