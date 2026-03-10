import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

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
  ],
  supervisor_cc: [
    { label: 'Mi Equipo TMK', path: '/mercadeo/supervisor', icon: '🎯' },
    { label: 'Pre-manifiesto', path: '/mercadeo/premanifiesto', icon: '📋' },
    { label: 'Leads del equipo', path: '/mercadeo/captura', icon: '📞' },
    { label: 'Calendario', path: '/mercadeo/calendario', icon: '📅' },
    { label: 'Reportes', path: '/reportes', icon: '📈' },
    { label: 'Outsourcing', path: '/outsourcing', icon: '🏢' },
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

export default function Sidebar() {
  const { usuario } = useAuth()
  const menuItems = MENU_POR_ROL[usuario?.rol] || []

  return (
    <aside className="w-60 min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-500 rounded-lg flex items-center justify-center font-bold text-lg">
            S
          </div>
          <div>
            <div className="font-bold text-sm tracking-wide">SANAVIT</div>
            <div className="text-xs text-slate-400">CRM Ecuador</div>
          </div>
        </div>
      </div>

      {/* Sala */}
      {usuario?.sala_nombre && (
        <div className="px-6 py-3 bg-slate-800 text-xs text-slate-400 border-b border-slate-700">
          📍 {usuario.sala_nombre}
        </div>
      )}

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors
              ${isActive
                ? 'bg-teal-600 text-white font-medium'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Próximamente */}
      <div className="px-3 py-3 border-t border-slate-700">
        <p className="text-xs text-slate-500 px-3 mb-2 font-semibold uppercase tracking-wide">
          Próximamente
        </p>
        {[
          { label: 'WhatsApp', icon: '💬' },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-600 cursor-not-allowed"
          >
            <span>{item.icon}</span>
            {item.label}
          </div>
        ))}
      </div>
    </aside>
  )
}
