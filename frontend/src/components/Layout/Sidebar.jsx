import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'

// Catalogo completo de modulos — usado para permisos personalizados
const TODOS_LOS_MODULOS = {
  kpis:          { label: 'Dashboard KPIs',    path: '/kpis',                   icon: '📊', section: 'OPERACION' },
  premanifiesto: { label: 'Pre-manifiesto',    path: '/mercadeo/premanifiesto', icon: '📋', section: 'OPERACION' },
  recepcion:     { label: 'Recepcion',         path: '/sala/recepcion',         icon: '🏥', section: 'OPERACION' },
  leads:         { label: 'Leads',             path: '/mercadeo/captura',       icon: '📞', section: 'MERCADEO' },
  supervisor:    { label: 'Supervisor CC',     path: '/mercadeo/supervisor',    icon: '🎯', section: 'MERCADEO' },
  calendario:    { label: 'Calendario',        path: '/mercadeo/calendario',    icon: '📅', section: 'MERCADEO' },
  cartera:       { label: 'Cartera',           path: '/cartera',                icon: '💳', section: 'FINANCIERO' },
  ventas:        { label: 'Ventas',            path: '/ventas',                 icon: '💼', section: 'FINANCIERO' },
  reportes:      { label: 'Reportes',          path: '/reportes',               icon: '📈', section: 'FINANCIERO' },
  outsourcing:   { label: 'Outsourcing',       path: '/outsourcing',            icon: '🏢', section: 'OPERACION' },
  comisiones:    { label: 'Comisiones',        path: '/comisiones',             icon: '💰', section: 'FINANCIERO' },
  liquidaciones: { label: 'Liquidaciones',     path: '/liquidaciones',          icon: '✅', section: 'FINANCIERO' },
  sac:           { label: 'SAC / PQR',         path: '/sac',                    icon: '🎫', section: 'OPERACION' },
  inventario:    { label: 'Inventario',        path: '/inventario',             icon: '📦', section: 'OPERACION' },
  alertas:       { label: 'Alertas',           path: '/alertas',                icon: '🔔', section: 'OPERACION' },
  importar:      { label: 'Importar Base',     path: '/importar',               icon: '📥', section: 'ADMINISTRACION' },
  nomina:        { label: 'Nomina',            path: '/nomina',                 icon: '💵', section: 'ADMINISTRACION' },
  metas:         { label: 'Metas',             path: '/metas',                  icon: '🎯', section: 'ADMINISTRACION' },
  consultor_panel: { label: 'Mi Panel',        path: '/consultor',              icon: '📊', section: 'OPERACION' },
  admin:         { label: 'Administracion',    path: '/admin',                  icon: '⚙️', section: 'ADMINISTRACION' },
}

const MENU_POR_ROL = {
  admin: [
    { label: 'Dashboard KPIs', path: '/kpis', icon: '📊', section: 'OPERACION' },
    { label: 'Pre-manifiesto', path: '/mercadeo/premanifiesto', icon: '📋', section: 'OPERACION' },
    { label: 'Recepcion', path: '/sala/recepcion', icon: '🏥', section: 'OPERACION' },
    { label: 'Leads', path: '/mercadeo/captura', icon: '📞', section: 'MERCADEO' },
    { label: 'Supervisor CC', path: '/mercadeo/supervisor', icon: '🎯', section: 'MERCADEO' },
    { label: 'Calendario', path: '/mercadeo/calendario', icon: '📅', section: 'MERCADEO' },
    { label: 'Panel Consultor', path: '/consultor', icon: '👨‍⚕️', section: 'OPERACION' },
    { label: 'Cartera', path: '/cartera', icon: '💳', section: 'FINANCIERO' },
    { label: 'Ventas', path: '/ventas', icon: '💼', section: 'FINANCIERO' },
    { label: 'Reportes', path: '/reportes', icon: '📈', section: 'FINANCIERO' },
    { label: 'Outsourcing', path: '/outsourcing', icon: '🏢', section: 'OPERACION' },
    { label: 'Comisiones', path: '/comisiones', icon: '💰', section: 'FINANCIERO' },
    { label: 'Liquidaciones', path: '/liquidaciones', icon: '✅', section: 'FINANCIERO' },
    { label: 'SAC / PQR', path: '/sac', icon: '🎫', section: 'OPERACION' },
    { label: 'Inventario', path: '/inventario', icon: '📦', section: 'OPERACION' },
    { label: 'Alertas', path: '/alertas', icon: '🔔', section: 'OPERACION' },
    { label: 'Importar Base', path: '/importar', icon: '📥', section: 'ADMINISTRACION' },
    { label: 'Nomina', path: '/nomina', icon: '💵', section: 'ADMINISTRACION' },
    { label: 'Metas', path: '/metas', icon: '🎯', section: 'ADMINISTRACION' },
    { label: 'Administracion', path: '/admin', icon: '⚙️', section: 'ADMINISTRACION' },
  ],
  director: [
    { label: 'Dashboard KPIs', path: '/kpis', icon: '📊', section: 'OPERACION' },
    { label: 'Pre-manifiesto', path: '/mercadeo/premanifiesto', icon: '📋', section: 'OPERACION' },
    { label: 'Recepcion', path: '/sala/recepcion', icon: '🏥', section: 'OPERACION' },
    { label: 'Leads TMK', path: '/mercadeo/captura', icon: '📞', section: 'MERCADEO' },
    { label: 'Supervisor CC', path: '/mercadeo/supervisor', icon: '🎯', section: 'MERCADEO' },
    { label: 'Calendario', path: '/mercadeo/calendario', icon: '📅', section: 'MERCADEO' },
    { label: 'Panel Consultor', path: '/consultor', icon: '👨‍⚕️', section: 'OPERACION' },
    { label: 'Cartera', path: '/cartera', icon: '💳', section: 'FINANCIERO' },
    { label: 'Ventas', path: '/ventas', icon: '💼', section: 'FINANCIERO' },
    { label: 'Reportes', path: '/reportes', icon: '📈', section: 'FINANCIERO' },
    { label: 'Outsourcing', path: '/outsourcing', icon: '🏢', section: 'OPERACION' },
    { label: 'Comisiones', path: '/comisiones', icon: '💰', section: 'FINANCIERO' },
    { label: 'Liquidaciones', path: '/liquidaciones', icon: '✅', section: 'FINANCIERO' },
    { label: 'SAC / PQR', path: '/sac', icon: '🎫', section: 'OPERACION' },
    { label: 'Inventario', path: '/inventario', icon: '📦', section: 'OPERACION' },
    { label: 'Alertas', path: '/alertas', icon: '🔔', section: 'OPERACION' },
    { label: 'Importar Base', path: '/importar', icon: '📥', section: 'ADMINISTRACION' },
    { label: 'Nomina', path: '/nomina', icon: '💵', section: 'ADMINISTRACION' },
    { label: 'Metas', path: '/metas', icon: '🎯', section: 'ADMINISTRACION' },
    { label: 'Administracion', path: '/admin', icon: '⚙️', section: 'ADMINISTRACION' },
  ],
  supervisor_cc: [
    { label: 'Mi Equipo TMK', path: '/mercadeo/supervisor', icon: '🎯', section: 'MERCADEO' },
    { label: 'Pre-manifiesto', path: '/mercadeo/premanifiesto', icon: '📋', section: 'OPERACION' },
    { label: 'Leads del equipo', path: '/mercadeo/captura', icon: '📞', section: 'MERCADEO' },
    { label: 'Calendario', path: '/mercadeo/calendario', icon: '📅', section: 'MERCADEO' },
    { label: 'Reportes', path: '/reportes', icon: '📈', section: 'FINANCIERO' },
    { label: 'Outsourcing', path: '/outsourcing', icon: '🏢', section: 'OPERACION' },
    { label: 'Importar Base', path: '/importar', icon: '📥', section: 'ADMINISTRACION' },
  ],
  tmk: [
    { label: 'Mis Leads de Hoy', path: '/mercadeo/captura', icon: '📞', section: 'MERCADEO' },
  ],
  confirmador: [
    { label: 'Calendario', path: '/mercadeo/calendario', icon: '📅', section: 'MERCADEO' },
    { label: 'Pre-manifiesto', path: '/mercadeo/premanifiesto', icon: '📋', section: 'OPERACION' },
  ],
  hostess: [
    { label: 'Recepcion', path: '/sala/recepcion', icon: '🏥', section: 'OPERACION' },
    { label: 'Ventas', path: '/ventas', icon: '💼', section: 'FINANCIERO' },
  ],
  consultor: [
    { label: 'Mi Panel', path: '/consultor', icon: '📊', section: 'OPERACION' },
    { label: 'Mis Clientes Hoy', path: '/sala/recepcion', icon: '🏥', section: 'OPERACION' },
    { label: 'Ventas', path: '/ventas', icon: '💼', section: 'FINANCIERO' },
  ],
  asesor_cartera: [
    { label: 'Dashboard KPIs', path: '/kpis', icon: '📊', section: 'OPERACION' },
    { label: 'Cartera', path: '/cartera', icon: '💳', section: 'FINANCIERO' },
    { label: 'Reportes', path: '/reportes', icon: '📈', section: 'FINANCIERO' },
  ],
  sac: [
    { label: 'SAC / PQR', path: '/sac', icon: '🎫', section: 'OPERACION' },
    { label: 'Dashboard KPIs', path: '/kpis', icon: '📊', section: 'OPERACION' },
    { label: 'Reportes', path: '/reportes', icon: '📈', section: 'FINANCIERO' },
  ],
  outsourcing: [
    { label: 'Mis Leads', path: '/mercadeo/captura', icon: '📞', section: 'MERCADEO' },
    { label: 'Pre-manifiesto', path: '/mercadeo/premanifiesto', icon: '📋', section: 'OPERACION' },
  ],
}

/* Agrupa items del menu por seccion, respetando el orden original */
function groupBySection(items) {
  const groups = []
  const seen = new Set()
  for (const item of items) {
    const sec = item.section || 'GENERAL'
    if (!seen.has(sec)) {
      seen.add(sec)
      groups.push({ section: sec, items: [] })
    }
    groups.find(g => g.section === sec).items.push(item)
  }
  return groups
}

export default function Sidebar({ isOpen = true, onToggle, isMobileOpen = false, onCloseMobile }) {
  const { usuario } = useAuth()
  const { dark, toggle: toggleDark } = useTheme()

  // Si el usuario tiene permisos personalizados (array), usarlos; si no, usar los del rol
  const menuItems = Array.isArray(usuario?.permisos)
    ? usuario.permisos.map(k => TODOS_LOS_MODULOS[k]).filter(Boolean)
    : (MENU_POR_ROL[usuario?.rol] || [])

  const grouped = isOpen ? groupBySection(menuItems) : []

  const sidebarContent = (
    <aside
      className={`
        ${isOpen ? 'w-64' : 'w-16'}
        h-screen bg-[#0a2f2c] text-white flex flex-col
        transition-all duration-300 ease-in-out shrink-0 overflow-hidden
        shadow-lg shadow-black/20
      `}
    >
      {/* ─── Header: Logo ─── */}
      <div className={`${isOpen ? 'px-5' : 'px-2'} py-4 border-b border-white/10 flex items-center justify-between`}>
        <div className={`flex items-center gap-3 ${!isOpen && 'justify-center w-full'}`}>
          <div className="w-9 h-9 bg-gradient-to-br from-teal-400 to-teal-600 rounded-full flex items-center justify-center font-bold text-base text-white shrink-0 shadow-md shadow-teal-500/25">
            S
          </div>
          {isOpen && (
            <div className="min-w-0">
              <div className="font-bold text-sm tracking-widest text-white/95">SANAVIT</div>
              <div className="text-[11px] text-teal-300/60 font-medium">CRM Ecuador</div>
            </div>
          )}
        </div>
        {isOpen && (
          <button
            onClick={onToggle}
            className="text-white/40 hover:text-white hover:bg-white/10 rounded-md p-1.5 transition-all duration-200 shrink-0"
            title="Colapsar menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Boton expandir (solo cuando esta colapsado) */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="flex justify-center py-3 text-white/40 hover:text-white hover:bg-white/10 transition-all duration-200 border-b border-white/10"
          title="Expandir menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Sala */}
      {isOpen && usuario?.sala_nombre && (
        <div className="mx-4 mt-3 px-3 py-2 bg-teal-500/10 border border-teal-500/20 rounded-lg text-xs text-teal-300/80 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 shrink-0 text-teal-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="truncate">{usuario.sala_nombre}</span>
        </div>
      )}
      {!isOpen && usuario?.sala_nombre && (
        <div className="flex justify-center py-2.5 border-b border-white/10" title={usuario.sala_nombre}>
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-teal-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
      )}

      {/* ─── Navegacion ─── */}
      <nav className={`flex-1 min-h-0 ${isOpen ? 'px-3' : 'px-2'} py-3 space-y-0.5 overflow-y-auto`}
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent' }}
      >
        {isOpen ? (
          grouped.map((group, gi) => (
            <div key={group.section} className={gi > 0 ? 'mt-5' : 'mt-1'}>
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">
                {group.section}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition-all duration-200 border-l-[3px]
                      ${isActive
                        ? 'border-teal-400 bg-teal-500/15 text-teal-300 font-medium'
                        : 'border-transparent text-white/60 hover:text-white/90 hover:bg-white/[0.06] hover:border-teal-500/50'
                      }`
                    }
                  >
                    <span className={`text-base shrink-0 transition-opacity duration-200 group-hover:opacity-100`}
                          style={{ opacity: 'var(--icon-opacity, 0.6)' }}
                          ref={el => {
                            if (el) {
                              const link = el.closest('a')
                              if (link && link.classList.contains('border-teal-400')) {
                                el.style.setProperty('--icon-opacity', '1')
                              } else {
                                el.style.setProperty('--icon-opacity', '0.6')
                              }
                            }
                          }}
                    >
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))
        ) : (
          menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              title={item.label}
              className={({ isActive }) =>
                `flex items-center justify-center p-2.5 rounded-lg text-sm transition-all duration-200 border-l-[3px]
                ${isActive
                  ? 'border-teal-400 bg-teal-500/15 text-teal-300'
                  : 'border-transparent text-white/50 hover:text-white/90 hover:bg-white/[0.06] hover:border-teal-500/50'
                }`
              }
            >
              <span className="text-base shrink-0">{item.icon}</span>
            </NavLink>
          ))
        )}
      </nav>

      {/* ─── Footer ─── */}
      <div className="border-t border-white/10">
        {/* Mi Perfil */}
        <div className={`${isOpen ? 'px-3' : 'px-2'} pt-2`}>
          <NavLink
            to="/perfil"
            title={!isOpen ? 'Mi Perfil' : undefined}
            className={({ isActive }) =>
              `flex items-center rounded-lg text-[13px] transition-all duration-200 border-l-[3px]
              ${isOpen ? 'gap-3 px-3 py-2.5' : 'justify-center p-2.5'}
              ${isActive
                ? 'border-teal-400 bg-teal-500/15 text-teal-300 font-medium'
                : 'border-transparent text-white/60 hover:text-white/90 hover:bg-white/[0.06] hover:border-teal-500/50'
              }`
            }
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            {isOpen && 'Mi Perfil'}
          </NavLink>
        </div>

        {/* Toggle modo oscuro */}
        <div className={`${isOpen ? 'px-3' : 'px-2'} py-1`}>
          <button
            onClick={toggleDark}
            title={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            className={`w-full flex items-center rounded-lg text-[13px] transition-all duration-200 text-white/50 hover:text-white/90 hover:bg-white/[0.06]
              ${isOpen ? 'gap-3 px-3 py-2.5' : 'justify-center p-2.5'}`}
          >
            {dark ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            )}
            {isOpen && (dark ? 'Modo claro' : 'Modo oscuro')}
          </button>
        </div>

        {/* Proximamente + Version */}
        <div className={`${isOpen ? 'px-3' : 'px-2'} pb-3 pt-1 border-t border-white/5`}>
          {isOpen && (
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/20">
              Proximamente
            </p>
          )}
          <div
            title={!isOpen ? 'WhatsApp — proximamente' : undefined}
            className={`flex items-center rounded-lg text-[13px] text-white/20 cursor-not-allowed
              ${isOpen ? 'gap-3 px-3 py-2' : 'justify-center p-2.5'}`}
          >
            <span className="shrink-0 opacity-40">💬</span>
            {isOpen && 'WhatsApp'}
          </div>
          {isOpen && (
            <p className="text-center text-[10px] text-white/15 mt-2 select-none">v2.0</p>
          )}
        </div>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block">{sidebarContent}</div>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
            onClick={onCloseMobile}
          />
          {/* Slide-in sidebar */}
          <div className="relative z-50 h-full animate-slide-in-left">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* CSS for slide animation */}
      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); opacity: 0.5; }
          to   { transform: translateX(0);     opacity: 1; }
        }
        .animate-slide-in-left {
          animation: slideInLeft 0.25s ease-out forwards;
        }
      `}</style>
    </>
  )
}
