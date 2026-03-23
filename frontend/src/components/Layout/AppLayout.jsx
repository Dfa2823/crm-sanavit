import { useState, useEffect, useCallback } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import GlobalSearch from '../GlobalSearch/GlobalSearch'
import { getResumenAlertas } from '../../api/alertas'

const TITULOS = {
  '/mercadeo/captura':      'Leads del Dia — TMK',
  '/mercadeo/calendario':   'Calendario de Seguimiento',
  '/mercadeo/premanifiesto':'Pre-manifiesto',
  '/mercadeo/supervisor':   'Supervisor Call Center',
  '/sala/recepcion':        'Recepcion / Manifiesto del Dia',
  '/kpis':                  'Dashboard de KPIs',
  '/ventas':                'Contratos de Venta',
  '/ventas/nueva':          'Nueva Venta',
  '/cartera':               'Cartera / Cobros',
  '/comisiones':            'Comisiones del Equipo',
  '/liquidaciones':         'Liquidaciones de Comisiones',
  '/reportes':              'Reportes y Analiticas',
  '/outsourcing':           'Gestion de Outsourcing',
  '/sac':                   'SAC / PQR',
  '/inventario':            'Inventario de Productos',
  '/alertas':               'Alertas y Notificaciones',
  '/admin':                 'Administracion del Sistema',
  '/perfil':                'Mi Perfil',
  '/importar':              'Importar Base de Datos',
  '/nomina':                'Nomina Mensual',
  '/metas':                 'Metas Mensuales',
}

export default function AppLayout() {
  const { pathname } = useLocation()
  const navigate     = useNavigate()

  const [alertCount,     setAlertCount]     = useState(0)
  const [prevAlertCount, setPrevAlertCount] = useState(0)
  const [sidebarOpen,    setSidebarOpen]    = useState(true)
  const [mobileOpen,     setMobileOpen]     = useState(false)
  const [searchOpen,     setSearchOpen]     = useState(false)

  /* Solicitar permiso de notificaciones al montar */
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  /* Notificacion push cuando llegan nuevas alertas */
  useEffect(() => {
    if (alertCount > prevAlertCount && prevAlertCount !== 0) {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('CRM Sanavit — Nuevas alertas', {
          body: `Tienes ${alertCount} alerta${alertCount !== 1 ? 's' : ''} pendiente${alertCount !== 1 ? 's' : ''}`,
          icon: '/favicon.ico',
        })
      }
    }
    setPrevAlertCount(alertCount)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertCount])

  /* Cargar conteo de alertas al montar y cada 5 minutos */
  const fetchAlertas = useCallback(() => {
    getResumenAlertas()
      .then(data => setAlertCount(data.total || 0))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchAlertas()
    const interval = setInterval(fetchAlertas, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchAlertas])

  /* Ctrl+K para abrir busqueda global */
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(v => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  /* Cerrar sidebar mobile al cambiar de ruta */
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  let title = TITULOS[pathname]
  if (!title && pathname.startsWith('/sala/cliente/')) title = 'Hoja de Vida del Cliente'
  if (!title && pathname.startsWith('/ventas/') && pathname.endsWith('/acta-entrega')) title = 'Acta de Entrega'
  if (!title && pathname.startsWith('/ventas/') && pathname.endsWith('/imprimir')) title = 'Imprimir Contrato'
  if (!title && pathname.startsWith('/ventas/') && !pathname.endsWith('/imprimir') && !pathname.endsWith('/acta-entrega')) title = 'Vista 360 del Contrato'
  if (!title) title = 'CRM Sanavit Ecuador'

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-slate-900">
      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}

      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(v => !v)}
        isMobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar con badge de alerta integrado */}
        <div className="relative">
          <Topbar
            title={title}
            onToggleSidebar={() => setSidebarOpen(v => !v)}
            onToggleMobile={() => setMobileOpen(v => !v)}
            onOpenSearch={() => setSearchOpen(true)}
          />

          {/* Badge de campana — superpuesto en la esquina derecha del header */}
          <div className="absolute top-0 right-0 h-16 flex items-center pr-28 pointer-events-none">
            <button
              onClick={() => navigate('/alertas')}
              className="relative p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all duration-200 pointer-events-auto"
              title="Notificaciones"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              {alertCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none shadow-sm">
                  {alertCount > 99 ? '99+' : alertCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
