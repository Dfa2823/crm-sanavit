import { useState, useEffect, useCallback } from 'react'
import { apiKpis } from '../../api/kpis'
import { apiUsuarios } from '../../api/usuarios'
import { useAuth } from '../../context/AuthContext'

function KPICard({ titulo, valor, subtitulo, color = 'blue', icon }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-700 border-blue-200',
    green:  'bg-green-50 text-green-700 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    red:    'bg-red-50 text-red-700 border-red-200',
    teal:   'bg-teal-50 text-teal-700 border-teal-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  }
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{titulo}</p>
          <p className="text-3xl font-bold mt-1">{valor}</p>
          {subtitulo && <p className="text-xs mt-1 opacity-70">{subtitulo}</p>}
        </div>
        {icon && <span className="text-3xl opacity-60">{icon}</span>}
      </div>
    </div>
  )
}

function FunnelBar({ label, valor, max, color = 'blue' }) {
  const pct = max > 0 ? Math.min((valor / max) * 100, 100) : 0
  const colors = {
    blue:   'bg-blue-500',
    green:  'bg-green-500',
    teal:   'bg-teal-500',
    orange: 'bg-orange-500',
  }
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 text-sm text-gray-600 text-right shrink-0">{label}</div>
      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
        <div
          className={`h-4 rounded-full transition-all duration-500 ${colors[color]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-12 text-sm font-bold text-gray-700 text-right shrink-0">{valor}</div>
    </div>
  )
}

export default function KPIsDashboard() {
  const { usuario } = useAuth()
  const [kpis, setKpis] = useState(null)
  const [salas, setSalas] = useState([])
  const [filtros, setFiltros] = useState({
    sala_id: usuario.sala_id || '',
    periodo: new Date().toISOString().slice(0, 7), // YYYY-MM
  })
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [data, listaSalas] = await Promise.all([
        apiKpis.obtener({ sala_id: filtros.sala_id || undefined, periodo: filtros.periodo }),
        apiUsuarios.salas(),
      ])
      setKpis(data)
      setSalas(listaSalas)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [filtros])

  useEffect(() => { cargar() }, [cargar])

  const periodoStr = filtros.periodo
    ? new Date(filtros.periodo + '-01').toLocaleDateString('es-EC', { month: 'long', year: 'numeric' })
    : ''

  return (
    <div className="space-y-6">

      {/* Filtros */}
      <div className="card p-4 flex items-center gap-4">
        <div>
          <label className="label text-xs">Sala</label>
          <select
            className="input py-1.5 text-sm"
            value={filtros.sala_id}
            onChange={e => setFiltros(f => ({ ...f, sala_id: e.target.value }))}
          >
            <option value="">Todas las salas</option>
            {salas.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label text-xs">Período</label>
          <input
            type="month" className="input py-1.5 text-sm"
            value={filtros.periodo}
            onChange={e => setFiltros(f => ({ ...f, periodo: e.target.value }))}
          />
        </div>
        <div className="mt-5">
          <button onClick={cargar} className="btn-secondary btn-sm">🔄 Actualizar</button>
        </div>
        {kpis && (
          <div className="flex-1 text-right">
            <p className="text-sm font-semibold text-gray-700 capitalize">{periodoStr}</p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !kpis ? null : (
        <>
          {/* ── KPIs de Sala ─────────────────────────────── */}
          <div>
            <h2 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
              🏥 Sala de Ventas
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPICard
                titulo="Tours" valor={kpis.sala.tours}
                subtitulo="Clientes calificados" icon="🟢" color="green"
              />
              <KPICard
                titulo="No Tours" valor={kpis.sala.no_tours}
                icon="🔴" color="red"
              />
              <KPICard
                titulo="No Shows" valor={kpis.sala.no_shows}
                icon="⚫" color="yellow"
              />
              <KPICard
                titulo="Efectividad Sala"
                valor={`${kpis.sala.efectividad}%`}
                subtitulo="Tours / Total visitas" icon="📊" color="teal"
              />
            </div>
          </div>

          {/* ── KPIs de Mercadeo ──────────────────────────── */}
          <div>
            <h2 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
              📞 Mercadeo / Call Center
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <KPICard
                titulo="Total Leads" valor={kpis.mercadeo.total_leads}
                icon="📥" color="blue"
              />
              <KPICard
                titulo="Citas Agendadas" valor={kpis.mercadeo.total_citas}
                subtitulo={`${kpis.mercadeo.efectividad_datos}% efectividad`}
                icon="📅" color="teal"
              />
              <KPICard
                titulo="Asistencias" valor={kpis.mercadeo.total_asistencias}
                subtitulo={`${kpis.mercadeo.efectividad_citas}% de las citas`}
                icon="🚶" color="blue"
              />
              <KPICard
                titulo="Tours" valor={kpis.mercadeo.total_tours}
                subtitulo={`${kpis.mercadeo.asist_a_tours}% de asistencias`}
                icon="🏆" color="green"
              />
            </div>

            {/* Funnel visual */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-600 mb-4">Embudo de conversión</h3>
              <div className="space-y-3">
                {[
                  { label: 'Leads', val: kpis.mercadeo.total_leads, color: 'blue' },
                  { label: 'Citas', val: kpis.mercadeo.total_citas, color: 'teal' },
                  { label: 'Asistencias', val: kpis.mercadeo.total_asistencias, color: 'orange' },
                  { label: 'Tours', val: kpis.mercadeo.total_tours, color: 'green' },
                ].map(({ label, val, color }) => (
                  <FunnelBar
                    key={label} label={label} valor={val}
                    max={kpis.mercadeo.total_leads} color={color}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* ── Fuentes de leads ──────────────────────────── */}
          {kpis.fuentes.length > 0 && (
            <div className="grid grid-cols-2 gap-5">
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-600 mb-4">Leads por fuente</h3>
                <div className="space-y-2">
                  {kpis.fuentes.map(f => (
                    <div key={f.fuente} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{f.fuente}</span>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 bg-blue-400 rounded-full"
                          style={{ width: `${Math.min((f.cantidad / kpis.mercadeo.total_leads) * 120, 120)}px` }}
                        />
                        <span className="text-sm font-bold text-gray-800 w-6 text-right">{f.cantidad}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-600 mb-4">Leads por tipificación</h3>
                <div className="space-y-2">
                  {kpis.tipificaciones.map(t => (
                    <div key={t.tipificacion} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{t.tipificacion}</span>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 bg-teal-400 rounded-full"
                          style={{ width: `${Math.min((t.cantidad / kpis.mercadeo.total_leads) * 120, 120)}px` }}
                        />
                        <span className="text-sm font-bold text-gray-800 w-6 text-right">{t.cantidad}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── KPIs por TMK ──────────────────────────────── */}
          {kpis.tmks.length > 0 && (
            <div>
              <h2 className="font-bold text-gray-700 mb-3">📊 Desempeño por TMK</h2>
              <div className="card overflow-hidden">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>TMK</th>
                      <th className="text-center">Leads</th>
                      <th className="text-center">Citas</th>
                      <th className="text-center">Asistencias</th>
                      <th className="text-center">Tours</th>
                      <th className="text-center">Conversión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpis.tmks.map(tmk => (
                      <tr key={tmk.tmk_nombre}>
                        <td className="font-medium text-gray-800">{tmk.tmk_nombre}</td>
                        <td className="text-center text-gray-700">{tmk.total_leads}</td>
                        <td className="text-center text-gray-700">{tmk.citas_agendadas}</td>
                        <td className="text-center text-gray-700">{tmk.asistencias}</td>
                        <td className="text-center">
                          <span className="badge-green badge">{tmk.tours}</span>
                        </td>
                        <td className="text-center font-bold text-teal-700">{tmk.conversion}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Próximamente ──────────────────────────────── */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Cartera', icon: '💳', desc: 'Mora 30/60/90 días' },
              { label: 'Comisiones', icon: '💰', desc: 'Liquidaciones del período' },
              { label: 'NPS', icon: '⭐', desc: 'Net Promoter Score automatizado' },
            ].map(item => (
              <div key={item.label} className="card p-5 opacity-50">
                <div className="text-3xl mb-2">{item.icon}</div>
                <p className="font-semibold text-gray-700">{item.label}</p>
                <p className="text-xs text-gray-400">{item.desc}</p>
                <p className="text-xs text-blue-500 mt-2 font-medium">Próximamente →</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
