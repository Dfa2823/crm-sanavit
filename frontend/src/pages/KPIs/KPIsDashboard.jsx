import { useState, useEffect } from 'react'
import client from '../../api/client'
import { apiUsuarios } from '../../api/usuarios'
import { useAuth } from '../../context/AuthContext'
import { getCarteraResumen } from '../../api/cartera'

// ---------------------------------------------------------------------------
// SVG Icon Components
// ---------------------------------------------------------------------------

function IconPhone({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
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

function IconBriefcase({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
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

function IconTarget({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
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

function IconSearch({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function IconTrophy({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  )
}

function IconFilter({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  )
}

function IconFunnel({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
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

function IconAlert({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
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

function IconTag({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Theme config
// ---------------------------------------------------------------------------

const ICON_THEMES = {
  teal:   { bg: 'bg-teal-50',     ring: 'ring-teal-100',    text: 'text-teal-600'    },
  blue:   { bg: 'bg-blue-50',     ring: 'ring-blue-100',    text: 'text-blue-600'    },
  indigo: { bg: 'bg-indigo-50',   ring: 'ring-indigo-100',  text: 'text-indigo-600'  },
  violet: { bg: 'bg-violet-50',   ring: 'ring-violet-100',  text: 'text-violet-600'  },
  green:  { bg: 'bg-emerald-50',  ring: 'ring-emerald-100', text: 'text-emerald-600' },
  orange: { bg: 'bg-orange-50',   ring: 'ring-orange-100',  text: 'text-orange-600'  },
  red:    { bg: 'bg-red-50',      ring: 'ring-red-100',     text: 'text-red-500'     },
  amber:  { bg: 'bg-amber-50',    ring: 'ring-amber-100',   text: 'text-amber-600'   },
  rose:   { bg: 'bg-rose-50',     ring: 'ring-rose-100',    text: 'text-rose-600'    },
}

// ---------------------------------------------------------------------------
// Premium KPI Card
// ---------------------------------------------------------------------------

function MiniCard({ titulo, valor, icon: Icon, color = 'teal', index = 0 }) {
  const theme = ICON_THEMES[color] || ICON_THEMES.teal
  return (
    <div
      className="group bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-gray-200 transition-all duration-300 hover-lift animate-staggerFadeIn"
      style={{ animationDelay: `${index * 0.08}s` }}
    >
      <div className="flex items-start gap-4">
        <div className={`shrink-0 w-11 h-11 rounded-xl ${theme.bg} ring-1 ${theme.ring} flex items-center justify-center transition-transform duration-300 group-hover:scale-105`}>
          {Icon && <Icon className={`w-5 h-5 ${theme.text}`} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide leading-none">{titulo}</p>
          <p className="text-2xl font-bold text-gray-800 mt-1.5 leading-none truncate animate-countUp">{valor}</p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cartera Card
// ---------------------------------------------------------------------------

function CarteraCard({ titulo, count, monto, color = 'amber', icon: Icon }) {
  const theme = ICON_THEMES[color] || ICON_THEMES.amber
  return (
    <div className="group bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-gray-200 transition-all duration-300 hover-lift">
      <div className="flex items-start gap-4">
        <div className={`shrink-0 w-11 h-11 rounded-xl ${theme.bg} ring-1 ${theme.ring} flex items-center justify-center transition-transform duration-300 group-hover:scale-105`}>
          {Icon && <Icon className={`w-5 h-5 ${theme.text}`} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide leading-none">{titulo}</p>
          <p className="text-2xl font-bold text-gray-800 mt-1.5 leading-none">
            {count} <span className="text-sm font-normal text-gray-400">cuotas</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            ${Number(monto).toLocaleString('es-EC', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({ title, subtitle, icon: Icon, children }) {
  return (
    <div className="mb-8">
      {(title || subtitle) && (
        <div className="mb-4 px-1 flex items-center gap-3">
          {Icon && (
            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
              <Icon className="w-4 h-4 text-gray-400" />
            </div>
          )}
          <div>
            {title && <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">{title}</h2>}
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
      )}
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState({ message = 'No hay datos disponibles', subtitle = '' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 animate-fadeIn">
      <div className="w-20 h-20 rounded-2xl bg-gray-50 dark:bg-slate-800 flex items-center justify-center mb-5">
        <IconChart className="w-10 h-10 text-gray-300 dark:text-gray-600" />
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium text-center">{message}</p>
      {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5 text-center max-w-xs">{subtitle}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function KPIsDashboard() {
  const { usuario } = useAuth()
  const mesActual = new Date().toISOString().slice(0, 7)

  const [salas, setSalas]               = useState([])
  const [salaId, setSalaId]             = useState(usuario?.sala_id ? String(usuario.sala_id) : '')
  const [periodo, setPeriodo]           = useState(mesActual)
  const [kpis, setKpis]                 = useState(null)
  const [topConsultores, setTopConsultores] = useState([])
  const [tendencia, setTendencia]       = useState([])
  const [cartera, setCartera]           = useState(null)
  const [loading, setLoading]           = useState(true)

  // Cargar lista de salas una sola vez
  useEffect(() => {
    apiUsuarios.salas().then(setSalas).catch(() => {})
  }, [])

  async function cargar() {
    setLoading(true)
    try {
      const params = { sala_id: salaId || undefined, periodo }
      const [kpisData, topData, tendData, carteraData] = await Promise.all([
        client.get('/api/kpis', { params }).then(r => r.data),
        client.get('/api/kpis/top-consultores', { params }).then(r => r.data),
        client.get('/api/kpis/tendencia', { params: { sala_id: params.sala_id, semanas: 8 } }).then(r => r.data),
        getCarteraResumen().catch(() => null),
      ])
      setKpis(kpisData)
      setTopConsultores(Array.isArray(topData) ? topData : [])
      setTendencia(Array.isArray(tendData) ? tendData : [])
      setCartera(carteraData)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const periodoStr = periodo
    ? new Date(periodo + '-02').toLocaleDateString('es-EC', { month: 'long', year: 'numeric' })
    : ''

  // Derived values
  const totalLeads   = kpis?.mercadeo?.total_leads   || 0
  const totalCitas   = kpis?.mercadeo?.total_citas   || 0
  const totalTours   = kpis?.mercadeo?.total_tours   || 0
  const totalNoTour  = kpis?.mercadeo?.total_no_tour || 0
  const totalVentas  = topConsultores.reduce((acc, c) => acc + Number(c.total_contratos), 0)
  const montoTotal   = kpis?.ventas?.monto_total || topConsultores.reduce((acc, c) => acc + Number(c.monto_total), 0)
  const efectividad  = totalLeads > 0 ? ((totalTours / totalLeads) * 100).toFixed(1) : '0.0'

  // Funnel data
  const funnelData = [
    { label: 'Leads captados',    valor: totalLeads,                  color: 'bg-blue-500',    lightBg: 'bg-blue-50',    text: 'text-blue-600'    },
    { label: 'Citas agendadas',   valor: totalCitas,                  color: 'bg-indigo-500',  lightBg: 'bg-indigo-50',  text: 'text-indigo-600'  },
    { label: 'Asistencias',       valor: totalTours + totalNoTour,    color: 'bg-violet-500',  lightBg: 'bg-violet-50',  text: 'text-violet-600'  },
    { label: 'Tours calificados', valor: totalTours,                  color: 'bg-purple-500',  lightBg: 'bg-purple-50',  text: 'text-purple-600'  },
    { label: 'Ventas cerradas',   valor: kpis?.ventas?.total_contratos || totalVentas, color: 'bg-teal-500', lightBg: 'bg-teal-50', text: 'text-teal-600' },
  ]
  const funnelMax = funnelData[0]?.valor || 1

  // Tendencia vertical bars
  const maxTend = Math.max(...tendencia.map(t => Number(t.total_contratos)), 1)

  // Top consultores horizontal bars
  const maxContratos = topConsultores.length > 0 ? Number(topConsultores[0].total_contratos) : 1
  const medallas = ['1', '2', '3', '4', '5']

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
                <IconChart className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Dashboard KPIs</h1>
                <p className="text-sm text-gray-400 capitalize mt-0.5">{periodoStr}</p>
              </div>
            </div>
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Sala</label>
              <select
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-shadow shadow-sm min-w-[160px]"
                value={salaId}
                onChange={e => setSalaId(e.target.value)}
              >
                <option value="">Todas las salas</option>
                {salas.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Periodo</label>
              <input
                type="month"
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-shadow shadow-sm"
                value={periodo}
                onChange={e => setPeriodo(e.target.value)}
              />
            </div>
            <button
              onClick={cargar}
              className="flex items-center gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all duration-300 shadow-lg shadow-teal-500/20"
            >
              <IconSearch className="w-4 h-4" />
              Buscar
            </button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-start gap-3">
                  <div className="shimmer w-10 h-10 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="shimmer h-3 w-16 rounded" />
                    <div className="shimmer h-6 w-12 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6"><div className="shimmer h-48 w-full rounded-lg" /></div>
            <div className="card p-6"><div className="shimmer h-48 w-full rounded-lg" /></div>
          </div>
        </div>
      ) : !kpis ? (
        <EmptyState message="No hay datos disponibles para el periodo seleccionado." />
      ) : (
        <>
          {/* Row 1: 6 Mini-cards */}
          <Section title="Metricas principales" subtitle="Resumen general del periodo" icon={IconChart}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <MiniCard titulo="Leads"       valor={totalLeads}    icon={IconPhone}     color="blue"   />
              <MiniCard titulo="Citas"        valor={totalCitas}    icon={IconCalendar}  color="indigo" />
              <MiniCard titulo="Tours"        valor={totalTours}    icon={IconBuilding}  color="violet" />
              <MiniCard titulo="Ventas"       valor={kpis?.ventas?.total_contratos || totalVentas} icon={IconBriefcase} color="teal" />
              <MiniCard
                titulo="Monto Total"
                valor={`$${Number(montoTotal).toLocaleString('es-EC', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                icon={IconDollar}
                color="green"
              />
              <MiniCard titulo="Efectividad" valor={`${efectividad}%`} icon={IconTarget} color="orange" />
            </div>
          </Section>

          {/* Row 2: Funnel + Top Consultores */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

            {/* Funnel Mercadeo */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                  <IconFunnel className="w-4 h-4 text-indigo-500" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-700">Funnel de Mercadeo</h2>
                  <p className="text-xs text-gray-400">Conversion de leads a ventas</p>
                </div>
              </div>
              <div className="space-y-3">
                {funnelData.map((item, i) => {
                  const pct = funnelMax > 0 ? Math.round((item.valor / funnelMax) * 100) : 0
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="font-medium text-gray-600">{item.label}</span>
                        <span className={`font-bold ${item.text}`}>{item.valor}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${item.color} transition-all duration-700 ease-out`}
                          style={{ width: `${pct}%`, minWidth: pct > 0 ? '4px' : '0' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top Consultores */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <IconTrophy className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-700">Top 5 Consultores</h2>
                  <p className="text-xs text-gray-400">Ranking por contratos cerrados</p>
                </div>
              </div>
              {topConsultores.length === 0 ? (
                <EmptyState message="Sin datos de consultores en este periodo" />
              ) : (
                <div className="space-y-4">
                  {topConsultores.map((c, i) => {
                    const pct = maxContratos > 0 ? Math.round((Number(c.total_contratos) / maxContratos) * 100) : 0
                    const medalColors = [
                      'bg-amber-100 text-amber-700 ring-amber-200',
                      'bg-gray-100 text-gray-600 ring-gray-200',
                      'bg-orange-100 text-orange-700 ring-orange-200',
                      'bg-gray-50 text-gray-500 ring-gray-100',
                      'bg-gray-50 text-gray-500 ring-gray-100',
                    ]
                    return (
                      <div key={c.consultor_id}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2.5">
                            <span className={`w-7 h-7 rounded-lg ${medalColors[i]} ring-1 flex items-center justify-center text-xs font-bold`}>
                              {medallas[i]}
                            </span>
                            <span className="text-sm font-medium text-gray-700">{c.consultor}</span>
                          </div>
                          <span className="text-sm font-bold text-teal-600">
                            {c.total_contratos} <span className="text-gray-400 font-normal text-xs">contratos</span>
                            <span className="text-gray-300 mx-1.5">|</span>
                            <span className="text-emerald-600">${Number(c.monto_total).toLocaleString('es-EC', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                          </span>
                        </div>
                        <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Row 3: Tendencia semanal */}
          <Section title="Tendencia semanal" subtitle="Ventas de las ultimas 8 semanas" icon={IconTrendingUp}>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              {tendencia.length === 0 ? (
                <EmptyState message="Sin datos de tendencia" />
              ) : (
                <div className="flex items-end gap-3 h-48">
                  {tendencia.map((sem, i) => {
                    const contratos = Number(sem.total_contratos)
                    const pct = maxTend > 0 ? Math.round((contratos / maxTend) * 100) : 0
                    const fechaCorta = sem.semana_inicio
                      ? new Date(sem.semana_inicio + 'T12:00:00').toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit' })
                      : `S${i + 1}`
                    return (
                      <div key={i} className="flex flex-col items-center flex-1 min-w-0 group">
                        <span className="text-xs font-bold text-teal-600 mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity">{contratos}</span>
                        <div className="w-full flex justify-center">
                          <div
                            className="bg-gradient-to-t from-teal-600 to-emerald-400 w-full max-w-[40px] rounded-t-lg transition-all duration-500 group-hover:from-teal-700 group-hover:to-emerald-500"
                            style={{ height: `${Math.max(pct, 4)}%` }}
                            title={`Semana del ${sem.semana_inicio}: ${contratos} contratos`}
                          />
                        </div>
                        <div className="mt-2 px-1">
                          <span className="text-xs text-gray-400 font-medium leading-tight text-center block">{fechaCorta}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </Section>

          {/* Row 4: Cartera - Mora por Tramo */}
          <Section title="Cartera" subtitle="Distribucion de mora por tramo" icon={IconAlert}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <CarteraCard
                titulo="Mora 30 dias"
                count={cartera?.mora_30_count ?? '--'}
                monto={cartera?.mora_30_monto ?? 0}
                color="amber"
                icon={IconAlert}
              />
              <CarteraCard
                titulo="Mora 60 dias"
                count={cartera?.mora_60_count ?? '--'}
                monto={cartera?.mora_60_monto ?? 0}
                color="orange"
                icon={IconAlert}
              />
              <CarteraCard
                titulo="Mora 90 dias"
                count={cartera?.mora_90_count ?? '--'}
                monto={cartera?.mora_90_monto ?? 0}
                color="red"
                icon={IconAlert}
              />
              <CarteraCard
                titulo="Mora +90 dias"
                count={cartera?.mora_plus_count ?? '--'}
                monto={cartera?.mora_plus_monto ?? 0}
                color="rose"
                icon={IconAlert}
              />
            </div>
          </Section>

          {/* Fuentes + Tipificaciones */}
          {(kpis.fuentes?.length > 0 || kpis.tipificaciones?.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {kpis.fuentes?.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                      <IconFilter className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-gray-700">Leads por Fuente</h2>
                      <p className="text-xs text-gray-400">Origen de captacion</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {kpis.fuentes.map(f => {
                      const pct = totalLeads > 0 ? Math.round((Number(f.cantidad) / totalLeads) * 100) : 0
                      return (
                        <div key={f.fuente} className="flex items-center gap-3">
                          <span className="text-xs font-medium text-gray-600 w-28 shrink-0 truncate">{f.fuente}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-blue-400 to-blue-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-gray-700 w-8 text-right">{f.cantidad}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {kpis.tipificaciones?.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
                      <IconTag className="w-4 h-4 text-teal-500" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-gray-700">Leads por Tipificacion</h2>
                      <p className="text-xs text-gray-400">Clasificacion de leads</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {kpis.tipificaciones.map(t => {
                      const pct = totalLeads > 0 ? Math.round((Number(t.cantidad) / totalLeads) * 100) : 0
                      return (
                        <div key={t.tipificacion} className="flex items-center gap-3">
                          <span className="text-xs font-medium text-gray-600 w-28 shrink-0 truncate">{t.tipificacion}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-teal-400 to-teal-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-gray-700 w-8 text-right">{t.cantidad}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Desempeno por TMK */}
          {kpis.tmks?.length > 0 && (
            <Section title="Desempeno por TMK" subtitle="Rendimiento individual del equipo de call center" icon={IconUsers}>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-100">
                        <th className="text-left py-3.5 pl-6 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">TMK</th>
                        <th className="text-center py-3.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Leads</th>
                        <th className="text-center py-3.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Citas</th>
                        <th className="text-center py-3.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Asistencias</th>
                        <th className="text-center py-3.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tours</th>
                        <th className="text-center py-3.5 px-3 pr-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Conversion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {kpis.tmks.map(tmk => (
                        <tr key={tmk.tmk_nombre} className="hover:bg-gray-50/50 transition-colors duration-150">
                          <td className="py-3.5 pl-6 pr-4 font-medium text-gray-800">{tmk.tmk_nombre}</td>
                          <td className="py-3.5 px-3 text-center text-gray-600">{tmk.total_leads}</td>
                          <td className="py-3.5 px-3 text-center text-gray-600">{tmk.citas_agendadas}</td>
                          <td className="py-3.5 px-3 text-center text-gray-600">{tmk.asistencias}</td>
                          <td className="py-3.5 px-3 text-center">
                            <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full ring-1 ring-emerald-100">
                              {tmk.tours}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 pr-6 text-center">
                            <span className="inline-flex items-center justify-center min-w-[48px] px-2.5 py-0.5 bg-teal-50 text-teal-700 text-xs font-bold rounded-full ring-1 ring-teal-100">
                              {tmk.conversion}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  )
}
