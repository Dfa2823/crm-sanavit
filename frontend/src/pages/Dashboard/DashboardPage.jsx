import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import client from '../../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSaludo() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos dias'
  if (h < 18) return 'Buenas tardes'
  return 'Buenas noches'
}

function getMesActual() {
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  return `${now.getFullYear()}-${mm}`
}

function getFechaLarga() {
  return new Date().toLocaleDateString('es-EC', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// SVG Icon Components (premium look, no emoji)
// ---------------------------------------------------------------------------

function IconLeads({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
      <path d="M12 2a10 10 0 0 1 10 10" opacity="0.3" />
    </svg>
  )
}

function IconTarget({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  )
}

function IconCalendar({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function IconBuilding({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" /><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" /><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" /><path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" />
    </svg>
  )
}

function IconDollar({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  )
}

function IconBriefcase({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  )
}

function IconAlert({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function IconClock({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function IconTicket({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v2" /><path d="M13 17v2" /><path d="M13 11v2" />
    </svg>
  )
}

function IconUsers({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function IconShield({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 12 15 16 10" />
    </svg>
  )
}

function IconChart({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

function IconBell({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function IconPhone({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function IconCheckCircle({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function IconUser({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function IconClipboard({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  )
}

function IconCreditCard({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  )
}

function IconTrendingUp({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  )
}

function IconTrendingDown({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Theme config
// ---------------------------------------------------------------------------

const ICON_THEMES = {
  teal:   { bg: 'bg-teal-50',   ring: 'ring-teal-100',   text: 'text-teal-600'   },
  blue:   { bg: 'bg-blue-50',   ring: 'ring-blue-100',   text: 'text-blue-600'   },
  amber:  { bg: 'bg-amber-50',  ring: 'ring-amber-100',  text: 'text-amber-600'  },
  green:  { bg: 'bg-emerald-50', ring: 'ring-emerald-100', text: 'text-emerald-600' },
  red:    { bg: 'bg-red-50',    ring: 'ring-red-100',    text: 'text-red-500'    },
  orange: { bg: 'bg-orange-50', ring: 'ring-orange-100', text: 'text-orange-600' },
  violet: { bg: 'bg-violet-50', ring: 'ring-violet-100', text: 'text-violet-600' },
}

// ---------------------------------------------------------------------------
// UI primitives (premium redesign)
// ---------------------------------------------------------------------------

function Loading() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-10 h-10 border-[3px] border-teal-200 border-t-teal-600 rounded-full animate-spin" />
      <span className="text-sm text-gray-400 font-medium">Cargando datos...</span>
    </div>
  )
}

function EmptyState({ message = 'No hay datos disponibles', icon: Icon = IconChart }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-300" />
      </div>
      <p className="text-sm text-gray-400 font-medium text-center">{message}</p>
    </div>
  )
}

function KPICard({ label, valor, icon: Icon, color = 'teal', sublabel, trend }) {
  const theme = ICON_THEMES[color] || ICON_THEMES.teal

  return (
    <div className="group bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-gray-200 transition-all duration-300 cursor-default">
      <div className="flex items-start gap-4">
        {/* Icon circle */}
        <div className={`shrink-0 w-11 h-11 rounded-xl ${theme.bg} ring-1 ${theme.ring} flex items-center justify-center transition-transform duration-300 group-hover:scale-105`}>
          {Icon && <Icon className={`w-5 h-5 ${theme.text}`} />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide leading-none">{label}</p>
          <div className="flex items-baseline gap-2 mt-1.5">
            <p className="text-2xl font-bold text-gray-800 leading-none truncate">{valor ?? '--'}</p>
            {/* Trend indicator */}
            {trend != null && trend !== 0 && (
              <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${trend > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {trend > 0
                  ? <IconTrendingUp className="w-3.5 h-3.5" />
                  : <IconTrendingDown className="w-3.5 h-3.5" />
                }
                {Math.abs(trend)}%
              </span>
            )}
          </div>
          {sublabel && <p className="text-xs text-gray-400 mt-1">{sublabel}</p>}
        </div>
      </div>
    </div>
  )
}

function AccesoRapido({ icon: Icon, label, to }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(to)}
      className="group flex flex-col items-center gap-3 p-5 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-teal-200 transition-all duration-300"
    >
      <div className="w-11 h-11 rounded-xl bg-teal-50 ring-1 ring-teal-100 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
        {Icon && <Icon className="w-5 h-5 text-teal-600" />}
      </div>
      <span className="text-xs font-semibold text-gray-600 text-center group-hover:text-teal-700 transition-colors">{label}</span>
    </button>
  )
}

function SaludoHeader({ nombre, subtitulo, rightContent }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
            {getSaludo()},{' '}
            <span className="bg-gradient-to-r from-teal-600 to-emerald-500 bg-clip-text text-transparent">
              {nombre}
            </span>
          </h1>
          {subtitulo && (
            <p className="text-sm text-gray-400 mt-1 capitalize">{subtitulo}</p>
          )}
        </div>
        {rightContent}
      </div>
    </div>
  )
}

function Section({ title, subtitle, badge, children }) {
  return (
    <div className="mb-8">
      {(title || subtitle) && (
        <div className="mb-4 px-1">
          <div className="flex items-center gap-3">
            {title && (
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">{title}</h2>
            )}
            {badge}
          </div>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

function LiveDot({ segsDesde }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 rounded-full border border-emerald-100">
      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      <span className="text-xs font-medium text-emerald-700">En vivo</span>
      {segsDesde !== null && (
        <span className="text-xs text-emerald-500/70">hace {segsDesde}s</span>
      )}
    </span>
  )
}

// ---------------------------------------------------------------------------
// DashboardAdmin / DashboardDirector
// ---------------------------------------------------------------------------

function DashboardAdmin() {
  const { usuario } = useAuth()
  const [kpis, setKpis]       = useState(null)
  const [alertas, setAlertas] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mes, setMes]         = useState(getMesActual())

  // Live data
  const [kpisHoy, setKpisHoy]     = useState(null)
  const [segsDesde, setSegsDesde] = useState(null)

  useEffect(() => {
    setLoading(true)
    const params = mes ? `?periodo=${mes}` : ''
    Promise.all([
      client.get(`/api/kpis${params}`).catch(() => ({ data: null })),
      client.get('/api/alertas/resumen').catch(() => ({ data: null })),
    ]).then(([kpisRes, alertasRes]) => {
      setKpis(kpisRes.data)
      setAlertas(alertasRes.data)
    }).finally(() => setLoading(false))
  }, [mes])

  // Polling live cada 30s
  const fetchHoy = useCallback(() => {
    client.get('/api/kpis/hoy')
      .then(r => { setKpisHoy(r.data); setSegsDesde(0) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchHoy()
    const interval = setInterval(fetchHoy, 30_000)
    return () => clearInterval(interval)
  }, [fetchHoy])

  // Contador de segundos desde ultima actualizacion
  useEffect(() => {
    const timer = setInterval(() => setSegsDesde(s => s !== null ? s + 1 : null), 1_000)
    return () => clearInterval(timer)
  }, [])

  const m  = kpis?.mercadeo  || {}
  const sa = kpis?.sala      || {}
  const ca = kpis?.cartera   || {}
  const ve = kpis?.ventas    || {}
  const al = alertas         || {}

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Saludo + filtros */}
      <SaludoHeader
        nombre={usuario?.nombre || 'Admin'}
        subtitulo={getFechaLarga()}
        rightContent={
          <div className="flex items-center gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Periodo</label>
              <input
                type="month"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-shadow shadow-sm"
              />
            </div>
          </div>
        }
      />

      {loading ? (
        <Loading />
      ) : (
        <>
          {/* Row 0: Live - Resumen del Dia */}
          <Section
            title="Resumen del dia"
            subtitle="Metricas en tiempo real del dia de hoy"
            badge={<LiveDot segsDesde={segsDesde} />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard label="Leads hoy"    valor={kpisHoy?.leads_hoy ?? '--'}    icon={IconTarget}   color="teal"  />
              <KPICard label="Citas pendientes" valor={kpisHoy?.citas_manana ?? '--'} icon={IconCalendar} color="blue"  />
              <KPICard label="Tours hoy"    valor={kpisHoy?.tours_hoy ?? '--'}    icon={IconBuilding} color="green" />
              <KPICard
                label="Cobros del dia"
                valor={kpisHoy?.cobros_dia != null
                  ? `$${Number(kpisHoy.cobros_dia).toLocaleString('es-EC', { maximumFractionDigits: 0 })}`
                  : '--'}
                icon={IconDollar}
                color="green"
              />
            </div>
          </Section>

          {/* Row 1: KPIs de mercadeo */}
          <Section title="KPIs de mercadeo" subtitle={`Resultados del periodo seleccionado`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <KPICard label="Leads"       valor={m.total_leads}       icon={IconTarget}    color="teal"   />
              <KPICard label="Citas"        valor={m.total_citas}       icon={IconCalendar}  color="blue"   />
              <KPICard label="Tours"        valor={m.total_tours}       icon={IconBuilding}  color="green"  />
              <KPICard label="Ventas (mes)" valor={ve.total_contratos}  icon={IconBriefcase} color="teal"   />
              <KPICard
                label="Monto Total"
                valor={ve.monto_total != null ? `$${Number(ve.monto_total).toLocaleString('es-EC')}` : '--'}
                icon={IconDollar}
                color="green"
              />
              <KPICard
                label="Mora 30d+"
                valor={ca.mora_30_dias != null ? ca.mora_30_dias : '--'}
                icon={IconAlert}
                color="red"
                sublabel="clientes en mora"
              />
            </div>
          </Section>

          {/* Row 2: Accesos rapidos */}
          <Section title="Accesos rapidos">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <AccesoRapido icon={IconBriefcase} label="Nueva Venta"   to="/ventas/nueva" />
              <AccesoRapido icon={IconUsers}     label="Ver Cartera"   to="/cartera"      />
              <AccesoRapido icon={IconChart}     label="Reportes"      to="/reportes"     />
              <AccesoRapido icon={IconBell}      label="Alertas"       to="/alertas"      />
            </div>
          </Section>

          {/* Row 3: Estado del sistema */}
          <Section title="Estado del sistema" subtitle="Elementos que requieren atencion inmediata">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KPICard
                label="Cuotas vencidas"
                valor={al.cuotas_vencidas ?? '--'}
                icon={IconAlert}
                color="red"
                sublabel="requieren atencion"
              />
              <KPICard
                label="Tickets urgentes"
                valor={al.tickets_urgentes ?? '--'}
                icon={IconTicket}
                color="orange"
                sublabel="tickets abiertos"
              />
              <KPICard
                label="Proximas a vencer"
                valor={al.proximas_a_vencer ?? '--'}
                icon={IconClock}
                color="amber"
                sublabel="en los proximos 7 dias"
              />
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DashboardConsultor
// ---------------------------------------------------------------------------

function DashboardConsultor() {
  const { usuario } = useAuth()
  const navigate    = useNavigate()
  const [kpis, setKpis]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const mes = getMesActual()
    const salaParam = usuario?.sala_id ? `&sala_id=${usuario.sala_id}` : ''
    client
      .get(`/api/kpis?periodo=${mes}${salaParam}`)
      .then((r) => setKpis(r.data))
      .catch(() => setKpis(null))
      .finally(() => setLoading(false))
  }, [usuario?.sala_id])

  const ve = kpis?.ventas  || {}
  const ca = kpis?.cartera || {}

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <SaludoHeader
        nombre={usuario?.nombre || 'Consultor'}
        subtitulo={`${usuario?.sala_nombre || 'Tu sala'} -- ${getFechaLarga()}`}
      />

      {loading ? (
        <Loading />
      ) : !kpis ? (
        <EmptyState message="No hay datos disponibles para este periodo" />
      ) : (
        <>
          <Section title="Mis estadisticas del mes" subtitle="Rendimiento personal acumulado">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                label="Ventas (mes)"
                valor={ve.total_contratos ?? '--'}
                icon={IconBriefcase}
                color="teal"
                sublabel="contratos"
              />
              <KPICard
                label="Monto ventas"
                valor={
                  ve.monto_total != null
                    ? `$${Number(ve.monto_total).toLocaleString('es-EC', { maximumFractionDigits: 0 })}`
                    : '--'
                }
                icon={IconDollar}
                color="green"
                sublabel="total contratos"
              />
              <KPICard
                label="Tours del mes"
                valor={kpis?.sala?.tours ?? '--'}
                icon={IconBuilding}
                color="blue"
                sublabel="clientes atendidos"
              />
              <KPICard
                label="En mora"
                valor={ca.mora_30_dias ?? '--'}
                icon={IconAlert}
                color="red"
                sublabel="clientes 30d+"
              />
            </div>
          </Section>

          <Section title="Accesos rapidos">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <AccesoRapido icon={IconBuilding}  label="Ir a Recepcion" to="/sala/recepcion" />
              <AccesoRapido icon={IconBriefcase} label="Nueva Venta"    to="/ventas/nueva"  />
              <AccesoRapido icon={IconClipboard} label="Mis Ventas"     to="/ventas"        />
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DashboardTMK
// ---------------------------------------------------------------------------

const FRASES_TMK = [
  'Cada llamada es una oportunidad para cambiar la vida de alguien.',
  'La perseverancia es la clave del exito en ventas.',
  'Un "no" hoy puede ser el "si" de manana. Sigue adelante.',
  'Los grandes logros empiezan con pequenas acciones consistentes.',
  'Tu actitud determina tu altitud. Apunta alto hoy.',
]

function DashboardTMK() {
  const { usuario } = useAuth()
  const navigate    = useNavigate()
  const [kpis, setKpis]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [frase]  = useState(
    () => FRASES_TMK[Math.floor(Math.random() * FRASES_TMK.length)]
  )

  useEffect(() => {
    const mes = getMesActual()
    const salaParam = usuario?.sala_id ? `&sala_id=${usuario.sala_id}` : ''
    client
      .get(`/api/kpis?periodo=${mes}${salaParam}`)
      .then((r) => setKpis(r.data))
      .catch(() => setKpis(null))
      .finally(() => setLoading(false))
  }, [usuario?.sala_id])

  const m = kpis?.mercadeo || {}

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <SaludoHeader
        nombre={usuario?.nombre || 'TMK'}
        subtitulo="Tus estadisticas de hoy"
      />

      {loading ? (
        <Loading />
      ) : !kpis ? (
        <EmptyState message="No hay datos disponibles para este periodo" />
      ) : (
        <>
          <Section title="Estadisticas del mes" subtitle="Tu rendimiento acumulado">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KPICard label="Leads"            valor={m.total_leads}  icon={IconTarget}   color="teal"  />
              <KPICard label="Citas agendadas"  valor={m.total_citas}  icon={IconCalendar} color="blue"  />
              <KPICard label="Tours confirmados" valor={m.total_tours} icon={IconBuilding} color="green" />
            </div>
          </Section>

          <Section>
            <button
              onClick={() => navigate('/mercadeo/captura')}
              className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-semibold py-4 rounded-2xl shadow-lg shadow-teal-500/20 transition-all duration-300 text-base"
            >
              <IconPhone className="w-5 h-5" />
              Ir a Captura de Leads
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </Section>

          <Section title="Frase del dia">
            <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-100 rounded-2xl p-6 text-center">
              <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-teal-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-teal-600" viewBox="0 0 24 24" fill="currentColor"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" /></svg>
              </div>
              <p className="text-teal-700 font-medium text-sm leading-relaxed max-w-md mx-auto">{frase}</p>
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DashboardSupervisor
// ---------------------------------------------------------------------------

function DashboardSupervisor() {
  const { usuario } = useAuth()
  const navigate    = useNavigate()
  const [kpis, setKpis]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const mes = getMesActual()
    const salaParam = usuario?.sala_id ? `&sala_id=${usuario.sala_id}` : ''
    client
      .get(`/api/kpis?periodo=${mes}${salaParam}`)
      .then((r) => setKpis(r.data))
      .catch(() => setKpis(null))
      .finally(() => setLoading(false))
  }, [usuario?.sala_id])

  const m = kpis?.mercadeo || {}

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <SaludoHeader
        nombre={usuario?.nombre || 'Supervisor'}
        subtitulo="Panel de tu equipo"
      />

      {loading ? (
        <Loading />
      ) : !kpis ? (
        <EmptyState message="No hay datos del equipo para este periodo" />
      ) : (
        <>
          <Section title="Estadisticas del equipo (mes)" subtitle="Rendimiento general del equipo">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KPICard label="Leads del equipo" valor={m.total_leads}  icon={IconTarget}   color="teal"  />
              <KPICard label="Citas"             valor={m.total_citas}  icon={IconCalendar} color="blue"  />
              <KPICard label="Tours"             valor={m.total_tours}  icon={IconBuilding} color="green" />
            </div>
          </Section>

          <Section title="Accesos rapidos">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <AccesoRapido icon={IconTarget}    label="Supervisor CC"    to="/mercadeo/premanifiesto" />
              <AccesoRapido icon={IconClipboard} label="Pre-manifiesto"   to="/mercadeo/premanifiesto" />
              <AccesoRapido icon={IconChart}     label="Reportes"         to="/reportes"               />
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DashboardCartera
// ---------------------------------------------------------------------------

function DashboardCartera() {
  const { usuario } = useAuth()
  const navigate    = useNavigate()
  const [kpis, setKpis]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const mes = getMesActual()
    const salaParam = usuario?.sala_id ? `&sala_id=${usuario.sala_id}` : ''
    client
      .get(`/api/kpis?periodo=${mes}${salaParam}`)
      .then((r) => setKpis(r.data))
      .catch(() => setKpis(null))
      .finally(() => setLoading(false))
  }, [usuario?.sala_id])

  const ca = kpis?.cartera || {}

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <SaludoHeader
        nombre={usuario?.nombre || 'Asesor'}
        subtitulo="Estado de cartera"
      />

      {loading ? (
        <Loading />
      ) : !kpis ? (
        <EmptyState message="No hay datos de cartera disponibles" />
      ) : (
        <>
          <Section title="Estado de mora" subtitle="Distribucion de clientes por tramo de mora">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard label="Al dia"    valor={ca.al_dia       ?? '--'} icon={IconCheckCircle} color="green"  sublabel="clientes" />
              <KPICard label="Mora 30d"  valor={ca.mora_30_dias ?? '--'} icon={IconAlert}       color="orange" sublabel="clientes" />
              <KPICard label="Mora 60d"  valor={ca.mora_60_dias ?? '--'} icon={IconAlert}       color="orange" sublabel="clientes" />
              <KPICard label="Mora 90d+" valor={ca.mora_90_dias ?? '--'} icon={IconAlert}       color="red"    sublabel="clientes" />
            </div>
          </Section>

          <Section title="Accesos rapidos">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => navigate('/cartera')}
                className="flex items-center justify-center gap-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-semibold py-3.5 rounded-2xl shadow-lg shadow-teal-500/20 transition-all duration-300"
              >
                <IconCreditCard className="w-5 h-5" />
                Ir a Cartera
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
              <button
                onClick={() => navigate('/reportes')}
                className="flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3.5 rounded-2xl shadow-sm border border-gray-200 hover:border-gray-300 transition-all duration-300"
              >
                <IconChart className="w-5 h-5 text-gray-500" />
                Reportes
              </button>
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DashboardHostess
// ---------------------------------------------------------------------------

function DashboardHostess() {
  const { usuario } = useAuth()
  const navigate    = useNavigate()

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <SaludoHeader
        nombre={usuario?.nombre || 'Hostess'}
        subtitulo="Panel de recepcion"
      />

      <Section title="Accesos principales">
        <div className="flex flex-col gap-4">
          <button
            onClick={() => navigate('/sala/recepcion')}
            className="flex items-center justify-center gap-4 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-semibold py-6 rounded-2xl shadow-lg shadow-teal-500/20 transition-all duration-300 text-lg"
          >
            <IconBuilding className="w-7 h-7" />
            Recepcion de hoy
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
          <button
            onClick={() => navigate('/ventas')}
            className="flex items-center justify-center gap-4 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-5 rounded-2xl shadow-sm border border-gray-200 hover:border-gray-300 transition-all duration-300 text-base"
          >
            <IconBriefcase className="w-6 h-6 text-gray-500" />
            Ventas
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </Section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DashboardGenerico
// ---------------------------------------------------------------------------

function DashboardGenerico() {
  const { usuario } = useAuth()
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-100 flex items-center justify-center mb-6">
        <IconUser className="w-10 h-10 text-teal-500" />
      </div>
      <h2 className="text-2xl font-bold text-gray-800 tracking-tight">
        Bienvenido, {usuario?.nombre}
      </h2>
      <p className="text-gray-400 mt-2 text-center max-w-sm">
        Usa el menu lateral para navegar al modulo que necesitas.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DashboardPage -- router por rol
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { usuario, loading } = useAuth()
  const rol = usuario?.rol

  if (loading) return <Loading />
  if (!usuario) return <Loading />

  if (rol === 'admin' || rol === 'director')    return <DashboardAdmin />
  if (rol === 'consultor')                      return <DashboardConsultor />
  if (rol === 'tmk' || rol === 'outsourcing')   return <DashboardTMK />
  if (rol === 'supervisor_cc')                  return <DashboardSupervisor />
  if (rol === 'asesor_cartera')                 return <DashboardCartera />
  if (rol === 'hostess')                        return <DashboardHostess />
  return <DashboardGenerico />
}
