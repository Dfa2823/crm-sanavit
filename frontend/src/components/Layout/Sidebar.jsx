import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

// Catálogo completo de módulos — usado para permisos personalizados
const TODOS_LOS_MODULOS = {
  kpis:          { label: 'Dashboard KPIs',    path: '/kpis',                   icon: '📊' },
  premanifiesto: { label: 'Pre-manifiesto',    path: '/mercadeo/premanifiesto', icon: '📋' },
  recepcion:     { label: 'Recepción',         path: '/sala/recepcion',         icon: '🏥' },
  leads:         { label: 'Leads',             path: '/mercadeo/captura',       icon: '📞' },
  supervisor:    { label: 'Supervisor CC',     path: '/mercadeo/supervisor',    icon: '🎯' },
  calendario:    { label: 'Calendario',        path: '/mercadeo/calendario',    icon: '📅' },
  cartera:       { label: 'Cartera',           path: '/cartera',                icon: '💳' },
  ventas:        { label: 'Ventas',            path: '/ventas',                 icon: '💼' },
  reportes:      { label: 'Reportes',          path: '/reportes',               icon: '📈' },
  outsourcing:   { label: 'Outsourcing',       path: '/outsourcing',            icon: '🏢' },
  comisiones:    { label: 'Comisiones',        path: '/comisiones',             icon: '💰' },
  liquidaciones: { label: 'Liquidaciones',     path: '/liquidaciones',          icon: '✅' },
  sac:           { label: 'SAC / PQR',         path: '/sac',                    icon: '🎫' },
  inventario:    { label: 'Inventario',        path: '/inventario',             icon: '📦' },
  alertas:       { label: 'Alertas',           path: '/alertas',                icon: '🔔' },
  importar:      { label: 'Importar Base',     path: '/importar',               icon: '📥' },
  nomina:        { label: 'Nómina',            path: '/nomina',                 icon: '💵' },
  admin:         { label: 'Administración',    path: '/admin',                  icon: '⚙️' },
}

const MENU_POR_ROL = {
  admin: [
    { label: 'Dashboard KPIs', path: '/kpis', icon: '📊' },
    { label: 'Pre-manifiesto', path: '/mercadeo/premanifiesto', icon: '📋' },
    { label: 'Recepción', path: '/sala/recepcion', icon: '🏥' },
    { label: 'Leads', path: '/mercadeo/captura', icon: '📞' },
    { label: 'Supervisor CC', path: '/mercadeo/supervisor', icon: '🎯' },
    { label: 'Cartera', path: '/cartera', icon: '💳' },
    { label: 'Ventas', path: '/ventas', icon: '💼' },
    { label: 'Reportes', path: '/reportes', icon: '📈' },
    { label: 'Outsourcing', path: '/outsourcing', icon: '🏢' },
    { label: 'Comisiones', path: '/comisiones', icon: '💰' },
    { label: 'Liquidaciones', path: '/liquidaciones', icon: '✅' },
    { label: 'SAC / PQR', path: '/sac', icon: '🎫' },
    { label: 'Inventario', path: '/inventario', icon: '📦' },
    { label: 'Alertas', path: '/alertas', icon: '🔔' },
    { label: 'Importar Base', path: '/importar', icon: '📥' },
    { label: 'Nómina', path: '/nomina', icon: '💵' },
    { label: 'Administración', path: '/admin', icon: '⚙️' },
  ],
  director: [
    { label: 'Dashboard KPIs', path: '/kpis', icon: '📊' },
    { label: 'Pre-manifiesto', path: '/mercadeo/premanifiesto', icon: '📋' },
    { label: 'Recepción', path: '/sala/recepcion', icon: '🏥' },
    { label: 'Leads TMK', path: '/mercadeo/captura', icon: '📞' },
    { label: 'Supervisor CC', path: '/mercadeo/supervisor', icon: '🎯' },
    { label: 'Cartera', path: '/cartera', icon: '💳' },
    { label: 'Ventas', path: '/ventas', icon: '💼' },
    { label: 'Reportes', path: '/reportes', icon: '📈' },
    { label: 'Outsourcing', path: '/outsourcing', icon: '🏢' },
    { label: 'Comisiones', path: '/comisiones', icon: '💰' },
    { label: 'Liquidaciones', path: '/liquidaciones', icon: '✅' },
    { label: 'SAC / PQR', path: '/sac', icon: '🎫' },
    { label: 'Inventario', path: '/inventario', icon: '📦' },
    { label: 'Alertas', path: '/alertas', icon: '🔔' },
    { label: 'Importar Base', path: '/importar', icon: '📥' },
    { label: 'Nómina', path: '/nomina', icon: '💵' },
  ],
  supervisor_cc: [
    { label: 'Mi Equipo TMK', path: '/mercadeo/supervisor', icon: '🎯' },
    { label: 'Pre-manifiesto', path: '/mercadeo/premanifiesto', icon: '📋' },
    { label: 'Leads del equipo', path: '/mercadeo/captura', icon: '📞' },
    { label: 'Calendario', path: '/mercadeo/calendario', icon: '📅' },
    { label: 'Reportes', path: '/reportes', icon: '📈' },
    { label: 'Outsourcing', path: '/outsourcing', icon: '🏢' },
    { label: 'Importar Base', path: '/importar', icon: '📥' },
  ],
  tmk: [
    { label: 'Mis Leads de Hoy', path: '/mercadeo/captura', icon: '📞' },
  ],
  confirmador: [
    { label: 'Calendario', path: '/mercadeo/calendario', icon: '📅' },
    { label: 'Pre-manifiesto', path: '/mercadeo/premanifiesto', icon: '📋' },
  ],
  hostess: [
    { label: 'Recepción', path: '/sala/recepcion', icon: '🏥' },
    { label: 'Ventas', path: '/ventas', icon: '💼' },
  ],
  consultor: [
    { label: 'Mis Clientes Hoy', path: '/sala/recepcion', icon: '🏥' },
    { label: 'Ventas', path: '/ventas', icon: '💼' },
  ],
  asesor_cartera: [
    { label: 'Dashboard KPIs', path: '/kpis', icon: '📊' },
    { label: 'Cartera', path: '/cartera', icon: '💳' },
    { label: 'Reportes', path: '/reportes', icon: '📈' },
  ],
  sac: [
    { label: 'SAC / PQR', path: '/sac', icon: '🎫' },
    { label: 'Dashboard KPIs', path: '/kpis', icon: '📊' },
    { label: 'Reportes', path: '/reportes', icon: '📈' },
  ],
  outsourcing: [
    { label: 'Mis Leads', path: '/mercadeo/captura', icon: '📞' },
    { label: 'Pre-manifiesto', path: '/mercadeo/premanifiesto', icon: '📋' },
  ],
}

export default function Sidebar({ isOpen = true, onToggle }) {
  const { usuario } = useAuth()
  // Si el usuario tiene permisos personalizados (array), usarlos; si no, usar los del rol
  const menuItems = Array.isArray(usuario?.permisos)
    ? usuario.permisos.map(k => TODOS_LOS_MODULOS[k]).filter(Boolean)
    : (MENU_POR_ROL[usuario?.rol] || [])

  return (
    <aside
      className={`
        ${isOpen ? 'w-60' : 'w-16'}
        min-h-screen bg-slate-900 text-white flex flex-col
        transition-all duration-300 ease-in-out shrink-0 overflow-hidden
      `}
    >
      {/* Logo + botón toggle */}
      <div className={`${isOpen ? 'px-6' : 'px-2'} py-5 border-b border-slate-700 flex items-center justify-between`}>
        <div className={`flex items-center gap-3 ${!isOpen && 'justify-center w-full'}`}>
          <div className="w-9 h-9 bg-teal-500 rounded-lg flex items-center justify-center font-bold text-lg shrink-0">
            S
          </div>
          {isOpen && (
            <div>
              <div className="font-bold text-sm tracking-wide">SANAVIT</div>
              <div className="text-xs text-slate-400">CRM Ecuador</div>
            </div>
          )}
        </div>
        {isOpen && (
          <button
            onClick={onToggle}
            className="text-slate-400 hover:text-white hover:bg-slate-700 rounded-md p-1 transition-colors shrink-0"
            title="Colapsar menú"
          >
            ◀
          </button>
        )}
      </div>

      {/* Botón expandir (solo cuando está colapsado) */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="flex justify-center py-3 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors border-b border-slate-700"
          title="Expandir menú"
        >
          ▶
        </button>
      )}

      {/* Sala */}
      {isOpen && usuario?.sala_nombre && (
        <div className="px-6 py-3 bg-slate-800 text-xs text-slate-400 border-b border-slate-700">
          📍 {usuario.sala_nombre}
        </div>
      )}
      {!isOpen && usuario?.sala_nombre && (
        <div className="flex justify-center py-2 border-b border-slate-700" title={usuario.sala_nombre}>
          <span className="text-xs">📍</span>
        </div>
      )}

      {/* Navegación */}
      <nav className={`flex-1 ${isOpen ? 'px-3' : 'px-2'} py-4 space-y-1`}>
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            title={!isOpen ? item.label : undefined}
            className={({ isActive }) =>
              `flex items-center rounded-lg text-sm transition-colors
              ${isOpen ? 'gap-3 px-3 py-2.5' : 'justify-center p-2.5'}
              ${isActive
                ? 'bg-teal-600 text-white font-medium'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <span className="text-base shrink-0">{item.icon}</span>
            {isOpen && item.label}
          </NavLink>
        ))}
      </nav>

      {/* Mi Perfil */}
      <div className={`${isOpen ? 'px-3' : 'px-2'} py-2 border-t border-slate-700`}>
        <NavLink
          to="/perfil"
          title={!isOpen ? 'Mi Perfil' : undefined}
          className={({ isActive }) =>
            `flex items-center rounded-lg text-sm transition-colors
            ${isOpen ? 'gap-3 px-3 py-2.5' : 'justify-center p-2.5'}
            ${isActive
              ? 'bg-teal-600 text-white font-medium'
              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`
          }
        >
          <span className="text-base shrink-0">👤</span>
          {isOpen && 'Mi Perfil'}
        </NavLink>
      </div>

      {/* Próximamente */}
      <div className={`${isOpen ? 'px-3' : 'px-2'} py-3 border-t border-slate-700`}>
        {isOpen && (
          <p className="text-xs text-slate-500 px-3 mb-2 font-semibold uppercase tracking-wide">
            Próximamente
          </p>
        )}
        <div
          title={!isOpen ? 'WhatsApp — próximamente' : undefined}
          className={`flex items-center rounded-lg text-sm text-slate-600 cursor-not-allowed
            ${isOpen ? 'gap-3 px-3 py-2' : 'justify-center p-2.5'}`}
        >
          <span className="shrink-0">💬</span>
          {isOpen && 'WhatsApp'}
        </div>
      </div>
    </aside>
  )
}
