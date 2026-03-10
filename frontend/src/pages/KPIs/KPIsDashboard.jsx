import { useState, useEffect } from 'react'
import client from '../../api/client'
import { apiUsuarios } from '../../api/usuarios'
import { useAuth } from '../../context/AuthContext'
import { getCarteraResumen } from '../../api/cartera'

// ── Mini KPI Card ─────────────────────────────────────────────────────────────
function MiniCard({ titulo, valor, icon, borderColor }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border ${borderColor} border-l-4 p-5`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{titulo}</p>
          <p className="text-2xl font-bold mt-1 text-gray-800">{valor}</p>
        </div>
        <span className="text-2xl opacity-70">{icon}</span>
      </div>
    </div>
  )
}

// ── Cartera Card ──────────────────────────────────────────────────────────────
function CarteraCard({ titulo, count, monto, bg, text, icon }) {
  return (
    <div className={`rounded-xl p-5 ${bg}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${text} opacity-80`}>{titulo}</p>
          <p className={`text-2xl font-bold mt-1 ${text}`}>{count} <span className="text-sm font-normal">cuotas</span></p>
          <p className={`text-xs mt-1 ${text} opacity-70`}>${Number(monto).toLocaleString('es-EC', { minimumFractionDigits: 2 })}</p>
        </div>
        <span className="text-2xl opacity-60">{icon}</span>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
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

  // ── Derived values ──────────────────────────────────────────────────────────
  const totalLeads   = kpis?.mercadeo?.total_leads   || 0
  const totalCitas   = kpis?.mercadeo?.total_citas   || 0
  const totalTours   = kpis?.mercadeo?.total_tours   || 0
  const totalNoTour  = kpis?.mercadeo?.total_no_tour || 0
  const totalVentas  = topConsultores.reduce((acc, c) => acc + Number(c.total_contratos), 0)
  const montoTotal   = kpis?.ventas?.monto_total || topConsultores.reduce((acc, c) => acc + Number(c.monto_total), 0)
  const efectividad  = totalLeads > 0 ? ((totalTours / totalLeads) * 100).toFixed(1) : '0.0'

  // Funnel data
  const funnelData = [
    { label: 'Leads captados',    valor: totalLeads,            color: 'bg-blue-500' },
    { label: 'Citas agendadas',   valor: totalCitas,            color: 'bg-indigo-500' },
    { label: 'Asistencias',       valor: totalTours + totalNoTour, color: 'bg-violet-500' },
    { label: 'Tours calificados', valor: totalTours,            color: 'bg-purple-500' },
    { label: 'Ventas cerradas',   valor: kpis?.ventas?.total_contratos || totalVentas, color: 'bg-teal-500' },
  ]
  const funnelMax = funnelData[0]?.valor || 1

  // Tendencia vertical bars
  const maxTend = Math.max(...tendencia.map(t => Number(t.total_contratos)), 1)

  // Top consultores horizontal bars
  const maxContratos = topConsultores.length > 0 ? Number(topConsultores[0].total_contratos) : 1
  const medallas = ['🥇', '🥈', '🥉', '4°', '5°']

  return (
    <div className="bg-gray-50 min-h-screen p-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard KPIs</h1>
          <p className="text-sm text-gray-500 capitalize mt-0.5">{periodoStr}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sala</label>
            <select
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
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
            <label className="block text-xs font-medium text-gray-500 mb-1">Periodo</label>
            <input
              type="month"
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
              value={periodo}
              onChange={e => setPeriodo(e.target.value)}
            />
          </div>
          <div className="mt-5">
            <button
              onClick={cargar}
              className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
            >
              Buscar
            </button>
          </div>
        </div>
      </div>

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !kpis ? (
        <div className="flex items-center justify-center h-64 text-gray-400">
          No hay datos disponibles para el período seleccionado.
        </div>
      ) : (
        <>
          {/* ── Fila 1: 6 Mini-cards ──────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            <MiniCard
              titulo="Leads"
              valor={totalLeads}
              icon="📞"
              borderColor="border-blue-400"
            />
            <MiniCard
              titulo="Citas"
              valor={totalCitas}
              icon="📅"
              borderColor="border-indigo-400"
            />
            <MiniCard
              titulo="Tours"
              valor={totalTours}
              icon="🏥"
              borderColor="border-violet-400"
            />
            <MiniCard
              titulo="Ventas"
              valor={kpis?.ventas?.total_contratos || totalVentas}
              icon="💼"
              borderColor="border-teal-400"
            />
            <MiniCard
              titulo="Monto Total"
              valor={`$${Number(montoTotal).toLocaleString('es-EC', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
              icon="💵"
              borderColor="border-green-400"
            />
            <MiniCard
              titulo="Efectividad"
              valor={`${efectividad}%`}
              icon="🎯"
              borderColor="border-orange-400"
            />
          </div>

          {/* ── Fila 2: Funnel + Top Consultores ─────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

            {/* Funnel Mercadeo */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-700 mb-4">Funnel de Mercadeo</h2>
              {funnelData.map((item, i) => {
                const pct = funnelMax > 0 ? Math.round((item.valor / funnelMax) * 100) : 0
                return (
                  <div key={i} className="mb-2">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>{item.label}</span>
                      <span className="font-semibold">{item.valor}</span>
                    </div>
                    <div className="flex justify-center">
                      <div
                        className={`h-6 rounded ${item.color} transition-all duration-500`}
                        style={{ width: `${pct}%`, minWidth: pct > 0 ? '4px' : '0' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Top Consultores */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-sm font-bold text-gray-700 mb-4">Top 5 Consultores</h2>
              {topConsultores.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Sin datos en este período</p>
              ) : (
                topConsultores.map((c, i) => {
                  const pct = maxContratos > 0 ? Math.round((Number(c.total_contratos) / maxContratos) * 100) : 0
                  return (
                    <div key={c.consultor_id} className="mb-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700">{medallas[i]} {c.consultor}</span>
                        <span className="font-semibold text-teal-600">
                          {c.total_contratos} contratos · ${Number(c.monto_total).toLocaleString('es-EC', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-teal-500 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* ── Fila 3: Tendencia semanal ──────────────────────────────────── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
            <h2 className="text-sm font-bold text-gray-700 mb-4">Tendencia de Ventas — Últimas 8 semanas</h2>
            {tendencia.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Sin datos de tendencia</p>
            ) : (
              <div className="flex items-end gap-2 h-40">
                {tendencia.map((sem, i) => {
                  const contratos = Number(sem.total_contratos)
                  const pct = maxTend > 0 ? Math.round((contratos / maxTend) * 100) : 0
                  const label = `S${i + 1}`
                  const fechaCorta = sem.semana_inicio
                    ? new Date(sem.semana_inicio + 'T12:00:00').toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit' })
                    : label
                  return (
                    <div key={i} className="flex flex-col items-center flex-1 min-w-0">
                      <span className="text-xs font-semibold text-teal-600 mb-1">{contratos}</span>
                      <div
                        className="bg-teal-500 w-full rounded-t transition-all duration-500"
                        style={{ height: `${Math.max(pct, 4)}%` }}
                        title={`Semana del ${sem.semana_inicio}: ${contratos} contratos`}
                      />
                      <span className="text-xs text-gray-500 mt-1 leading-tight text-center">{fechaCorta}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Fila 4: Métricas de Cartera ───────────────────────────────── */}
          <div className="mb-6">
            <h2 className="text-sm font-bold text-gray-700 mb-3">Cartera — Mora por Tramo</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <CarteraCard
                titulo="Mora 30 días"
                count={cartera?.mora_30_count ?? '—'}
                monto={cartera?.mora_30_monto ?? 0}
                bg="bg-yellow-50 border border-yellow-200"
                text="text-yellow-700"
                icon="⚠️"
              />
              <CarteraCard
                titulo="Mora 60 días"
                count={cartera?.mora_60_count ?? '—'}
                monto={cartera?.mora_60_monto ?? 0}
                bg="bg-orange-50 border border-orange-200"
                text="text-orange-700"
                icon="🔶"
              />
              <CarteraCard
                titulo="Mora 90 días"
                count={cartera?.mora_90_count ?? '—'}
                monto={cartera?.mora_90_monto ?? 0}
                bg="bg-red-50 border border-red-200"
                text="text-red-700"
                icon="🔴"
              />
              <CarteraCard
                titulo="Mora +90 días"
                count={cartera?.mora_plus_count ?? '—'}
                monto={cartera?.mora_plus_monto ?? 0}
                bg="bg-rose-100 border border-rose-300"
                text="text-rose-800"
                icon="🚨"
              />
            </div>
          </div>

          {/* ── Fuentes + Tipificaciones ───────────────────────────────────── */}
          {(kpis.fuentes?.length > 0 || kpis.tipificaciones?.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {kpis.fuentes?.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <h2 className="text-sm font-bold text-gray-700 mb-4">Leads por Fuente</h2>
                  <div className="space-y-2">
                    {kpis.fuentes.map(f => {
                      const pct = totalLeads > 0 ? Math.round((Number(f.cantidad) / totalLeads) * 100) : 0
                      return (
                        <div key={f.fuente} className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-28 shrink-0 truncate">{f.fuente}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-3">
                            <div
                              className="bg-blue-400 h-3 rounded-full transition-all duration-500"
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
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                  <h2 className="text-sm font-bold text-gray-700 mb-4">Leads por Tipificación</h2>
                  <div className="space-y-2">
                    {kpis.tipificaciones.map(t => {
                      const pct = totalLeads > 0 ? Math.round((Number(t.cantidad) / totalLeads) * 100) : 0
                      return (
                        <div key={t.tipificacion} className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-28 shrink-0 truncate">{t.tipificacion}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-3">
                            <div
                              className="bg-teal-400 h-3 rounded-full transition-all duration-500"
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

          {/* ── Desempeño por TMK ──────────────────────────────────────────── */}
          {kpis.tmks?.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
              <h2 className="text-sm font-bold text-gray-700 mb-4">Desempeño por TMK</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase">
                      <th className="text-left py-2 pr-4 font-semibold">TMK</th>
                      <th className="text-center py-2 px-2 font-semibold">Leads</th>
                      <th className="text-center py-2 px-2 font-semibold">Citas</th>
                      <th className="text-center py-2 px-2 font-semibold">Asistencias</th>
                      <th className="text-center py-2 px-2 font-semibold">Tours</th>
                      <th className="text-center py-2 px-2 font-semibold">Conversión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpis.tmks.map(tmk => (
                      <tr key={tmk.tmk_nombre} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 pr-4 font-medium text-gray-800">{tmk.tmk_nombre}</td>
                        <td className="py-2 px-2 text-center text-gray-700">{tmk.total_leads}</td>
                        <td className="py-2 px-2 text-center text-gray-700">{tmk.citas_agendadas}</td>
                        <td className="py-2 px-2 text-center text-gray-700">{tmk.asistencias}</td>
                        <td className="py-2 px-2 text-center">
                          <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">{tmk.tours}</span>
                        </td>
                        <td className="py-2 px-2 text-center font-bold text-teal-700">{tmk.conversion}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
