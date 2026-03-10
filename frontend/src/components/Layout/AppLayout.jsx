import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

const TITULOS = {
  '/mercadeo/captura':      'Leads del Día — TMK',
  '/mercadeo/calendario':   'Calendario de Seguimiento',
  '/mercadeo/premanifiesto':'Pre-manifiesto',
  '/sala/recepcion':        'Recepción / Manifiesto del Día',
  '/kpis':                  'Dashboard de KPIs',
}

export default function AppLayout() {
  const { pathname } = useLocation()

  // Detectar HojaDeVida dinámico
  let title = TITULOS[pathname]
  if (!title && pathname.startsWith('/sala/cliente/')) title = 'Hoja de Vida del Cliente'
  if (!title) title = 'CRM Sanavit Ecuador'

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={title} />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
