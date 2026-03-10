import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getTMKStats, getResumenDia, getRankingMensual } from '../../api/supervisor'
import { apiUsuarios } from '../../api/usuarios'

// ── Helpers ─────────────────────────────────────────────────

function hoyISO() {
  return new Date().toISOString().split('T')[0]
}

function mesActualISO() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function efectividadBadge(pct) {
  if (pct >= 20) return 'bg-green-100 text-green-800'
  if (pct >= 10) return 'bg-yellow-100 text-yellow-800'
  return 'bg-red-100 text-red-700'
}

function medallaEmoji(pos) {
  if (pos === 1) return '🥇'
  if (pos === 2) return '🥈'
  if (pos === 3) return '🥉'
  return `${pos}.`
}

// ── Spinner ──────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// ── Stat Card ────────────────────────────────────────────────

function StatCard({ titulo, valor, color, icon }) {
  const colorMap = {
    blue:   'bg-blue-50 border-blue-200 text-blue-600',
    green:  'bg-green-50 border-green-200 text-green-600',
    teal:   'bg-teal-50 border-teal-200 text-teal-600',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-600',
  }
  const cls = colorMap[color] || colorMap.blue
  return (
    <div className={`bg-white rounded-xl border shadow-sm p-5 ${cls.split(' ')[1]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${cls.split(' ')[2]}`}>
            {titulo}
          </p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{valor}</p>
        </div>
        {icon && <span className="text-2xl opacity-60">{icon}</span>}
      </div>
    </div>
  )
}

// ── Barra de progreso para tipificaciones ────────────────────

function TipBar({ label, cantidad, max }) {
  const pct = max > 0 ? Math.min((cantidad / max) * 100, 100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-36 text-sm text-gray-600 truncate shrink-0">{label}</div>
      <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
        <div
          className="h-3 rounded-full bg-teal-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="w-8 text-sm font-bold text-gray-700 text-right shrink-0">{cantidad}</div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────

export default function SupervisorDashboard() {
  const { usuario } = useAuth()

  const puedeVerTodasSalas = ['admin', 'director'].includes(usuario?.rol)

  const [fecha, setFecha] = useState(hoyISO())
  const [mes, setMes] = useState(mesActualISO())
  const [salaId, setSalaId] = useState(
    puedeVerTodasSalas ? '' : String(usuario?.sala_id || '')
  )
  const [salas, setSalas] = useState([])

  const [resumen, setResumen] = useState(null)
  const [tmks, setTmks] = useState([])
  const [ranking, setRanking] = useState([])

  const [loadingResumen, setLoadingResumen] = useState(false)
  const [loadingTmks, setLoadingTmks] = useState(false)
  const [loadingRanking, setLoadingRanking] = useState(false)

  const [errorResumen, setErrorResumen] = useState(null)
  const [errorTmks, setErrorTmks] = useState(null)
  const [errorRanking, setErrorRanking] = useState(null)

  // Cargar lista de salas (solo admin/director)
  useEffect(() => {
    if (puedeVerTodasSalas) {
      apiUsuarios.salas()
        .then(data => setSalas(data))
        .catch(err => console.error('Error cargando salas:', err))
    }
  }, [puedeVerTodasSalas])

  const cargarResumen = useCallback(async () => {
    setLoadingResumen(true)
    setErrorResumen(null)
    try {
      const params = { fecha }
      if (salaId) params.sala_id = salaId
      const data = await getResumenDia(params)
      setResumen(data)
    } catch (err) {
      console.error(err)
      setErrorResumen('No se pudo cargar el resumen del día.')
    } finally {
      setLoadingResumen(false)
    }
  }, [fecha, salaId])

  const cargarTmks = useCallback(async () => {
    setLoadingTmks(true)
    setErrorTmks(null)
    try {
      const params = { fecha }
      if (salaId) params.sala_id = salaId
      const data = await getTMKStats(params)
      setTmks(data.tmks || [])
    } catch (err) {
      console.error(err)
      setErrorTmks('No se pudo cargar el desempeño por TMK.')
    } finally {
      setLoadingTmks(false)
    }
  }, [fecha, salaId])

  const cargarRanking = useCallback(async () => {
    setLoadingRanking(true)
    setErrorRanking(null)
    try {
      const params = { mes }
      if (salaId) params.sala_id = salaId
      const data = await getRankingMensual(params)
      setRanking(data.ranking || [])
    } catch (err) {
      console.error(err)
      setErrorRanking('No se pudo cargar el ranking mensual.')
    } finally {
      setLoadingRanking(false)
    }
  }, [mes, salaId])

  const actualizarTodo = useCallback(() => {
    cargarResumen()
    cargarTmks()
    cargarRanking()
  }, [cargarResumen, cargarTmks, cargarRanking])

  useEffect(() => {
    actualizarTodo()
  }, [actualizarTodo])

  // Mes formateado para el encabezado del ranking
  const mesLabel = mes
    ? new Date(mes + '-01').toLocaleDateString('es-EC', { month: 'long', year: 'numeric' })
    : ''

  // Máximo de tipificaciones para calcular barras
  const maxTip = resumen?.tipificaciones_distribucion?.length > 0
    ? Math.max(...resumen.tipificaciones_distribucion.map(t => t.cantidad))
    : 1

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">

      {/* ── Header / Filtros ──────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Dashboard Supervisor CC</h1>
            <p className="text-sm text-gray-500 mt-0.5">Métricas del call center en tiempo real</p>
          </div>

          <div className="flex-1" />

          {/* Selector de sala (solo admin/director) */}
          {puedeVerTodasSalas && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Sala
              </label>
              <select
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                value={salaId}
                onChange={e => setSalaId(e.target.value)}
              >
                <option value="">Todas las salas</option>
                {salas.map(s => (
                  <option key={s.id} value={String(s.id)}>{s.nombre}</option>
                ))}
              </select>
            </div>
          )}

          {/* Selector de fecha */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Fecha
            </label>
            <input
              type="date"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
            />
          </div>

          {/* Botón actualizar */}
          <button
            onClick={actualizarTodo}
            disabled={loadingResumen || loadingTmks || loadingRanking}
            className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {(loadingResumen || loadingTmks || loadingRanking) ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                Cargando...
              </span>
            ) : (
              'Actualizar'
            )}
          </button>
        </div>
      </div>

      {/* ── Sección 1: Resumen del día ──────────────────── */}
      <div>
        <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">
          Resumen del día — {new Date(fecha + 'T12:00:00').toLocaleDateString('es-EC', {
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
          })}
        </h2>

        {loadingResumen ? (
          <Spinner />
        ) : errorResumen ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 text-sm">
            {errorResumen}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              titulo="Total Leads Capturados"
              valor={resumen?.total_leads ?? 0}
              color="blue"
              icon="📥"
            />
            <StatCard
              titulo="Citas Agendadas"
              valor={resumen?.total_citas ?? 0}
              color="green"
              icon="📅"
            />
            <StatCard
              titulo="Efectividad"
              valor={`${resumen?.efectividad_pct ?? 0}%`}
              color="teal"
              icon="📊"
            />
            <StatCard
              titulo="Confirmadas"
              valor={resumen?.total_confirmadas ?? 0}
              color="yellow"
              icon="✅"
            />
          </div>
        )}
      </div>

      {/* ── Sección 2: Tabla de desempeño por TMK ──────── */}
      <div>
        <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">
          Desempeño por TMK
        </h2>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loadingTmks ? (
            <Spinner />
          ) : errorTmks ? (
            <div className="p-6 text-red-700 text-sm bg-red-50">{errorTmks}</div>
          ) : tmks.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <div className="text-4xl mb-3">📞</div>
              <p className="font-medium">Sin datos de TMKs para esta fecha</p>
              <p className="text-sm mt-1">Prueba con otra fecha o sala</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      TMK
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Sala
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Leads
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Citas
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      % Efectividad
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Volver a llamar
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      No contacto
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Rechazos
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Datos falsos
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tmks.map(tmk => (
                    <tr
                      key={tmk.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {tmk.nombre}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm">
                        {tmk.sala_nombre}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-blue-700">
                        {tmk.leads_captados}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-green-700">
                        {tmk.citas_agendadas}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${efectividadBadge(tmk.pct_efectividad)}`}>
                          {tmk.pct_efectividad}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {tmk.volver_llamar}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {tmk.no_contacto}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {tmk.rechazos}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {tmk.datos_falsos}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Sección 3 + 4: Ranking y Tipificaciones ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Sección 3: Ranking mensual */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide">
              🏆 Ranking del mes {mesLabel}
            </h2>
            <input
              type="month"
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
              value={mes}
              onChange={e => setMes(e.target.value)}
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {loadingRanking ? (
              <Spinner />
            ) : errorRanking ? (
              <div className="p-6 text-red-700 text-sm bg-red-50">{errorRanking}</div>
            ) : ranking.length === 0 ? (
              <div className="p-10 text-center text-gray-400">
                <div className="text-4xl mb-3">🏆</div>
                <p className="font-medium">Sin datos para este mes</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-10">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        TMK
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Sala
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Leads
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Citas
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Efectividad
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {ranking.map(item => (
                      <tr
                        key={item.id}
                        className={`hover:bg-gray-50 transition-colors ${item.posicion <= 3 ? 'font-medium' : ''}`}
                      >
                        <td className="px-4 py-3 text-center text-base">
                          {medallaEmoji(item.posicion)}
                        </td>
                        <td className="px-4 py-3 text-gray-800">
                          {item.nombre}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {item.sala_nombre}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700">
                          {item.leads_captados}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-green-700">
                          {item.citas_agendadas}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${efectividadBadge(item.pct_efectividad)}`}>
                            {item.pct_efectividad}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sección 4: Distribución por tipificación */}
        <div>
          <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wide mb-3">
            Distribución por tipificación (hoy)
          </h2>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            {loadingResumen ? (
              <Spinner />
            ) : errorResumen ? (
              <div className="text-red-700 text-sm">{errorResumen}</div>
            ) : !resumen?.tipificaciones_distribucion?.length ? (
              <div className="py-10 text-center text-gray-400">
                <div className="text-4xl mb-3">📋</div>
                <p className="font-medium">Sin tipificaciones registradas hoy</p>
              </div>
            ) : (
              <div className="space-y-4">
                {resumen.tipificaciones_distribucion.map(tip => (
                  <TipBar
                    key={tip.tipificacion}
                    label={tip.tipificacion}
                    cantidad={tip.cantidad}
                    max={maxTip}
                  />
                ))}

                {/* Totales de referencia */}
                <div className="pt-3 border-t border-gray-100 flex justify-between text-xs text-gray-400">
                  <span>Top 5 tipificaciones</span>
                  <span>
                    Total: {resumen.tipificaciones_distribucion.reduce((s, t) => s + t.cantidad, 0)} leads
                  </span>
                </div>

                {/* Fuente y tipificación más frecuente del día */}
                {(resumen.top_fuente || resumen.top_tipificacion) && (
                  <div className="pt-1 grid grid-cols-2 gap-3">
                    {resumen.top_fuente && (
                      <div className="bg-blue-50 rounded-lg p-3">
                        <p className="text-xs text-blue-500 font-semibold uppercase tracking-wide mb-1">
                          Top fuente
                        </p>
                        <p className="text-sm font-bold text-blue-800">{resumen.top_fuente}</p>
                      </div>
                    )}
                    {resumen.top_tipificacion && (
                      <div className="bg-teal-50 rounded-lg p-3">
                        <p className="text-xs text-teal-500 font-semibold uppercase tracking-wide mb-1">
                          Top tipificación
                        </p>
                        <p className="text-sm font-bold text-teal-800">{resumen.top_tipificacion}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
