import { useState, useEffect, useCallback } from 'react'
import { getDetalleAlertas } from '../../api/alertas'

/* ── constantes de estilo ── */
const PRIORIDAD_CLASS = {
  alta:  'border-l-4 border-red-500 bg-red-50',
  media: 'border-l-4 border-yellow-500 bg-yellow-50',
  baja:  'border-l-4 border-blue-500 bg-blue-50',
}

const PRIORIDAD_BADGE = {
  alta:  'bg-red-200 text-red-800',
  media: 'bg-yellow-200 text-yellow-800',
  baja:  'bg-blue-200 text-blue-800',
}

const TIPO_ICON = {
  cuota_vencida:  '🔴',
  proximo_vencer: '🟡',
  ticket_urgente: '🟠',
}

const FILTROS = [
  { key: 'todos',          label: 'Todos' },
  { key: 'cuota_vencida',  label: 'Cuotas vencidas' },
  { key: 'proximo_vencer', label: 'Próximas a vencer' },
  { key: 'ticket_urgente', label: 'Tickets SAC' },
]

/* ── mini-card de resumen ── */
function MiniCard({ icon, label, count, colorClass }) {
  return (
    <div className={`flex items-center gap-3 rounded-xl p-4 ${colorClass} shadow-sm`}>
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-2xl font-bold leading-none">{count}</p>
        <p className="text-xs mt-0.5 opacity-80">{label}</p>
      </div>
    </div>
  )
}

/* ── tarjeta de alerta individual ── */
function AlertaCard({ alerta: a }) {
  const wa = a.telefono
    ? `https://wa.me/593${a.telefono.replace(/^0/, '')}`
    : null

  return (
    <div className={`${PRIORIDAD_CLASS[a.prioridad]} rounded-lg p-4 mb-2 shadow-sm`}>
      <div className="flex justify-between items-start gap-2">
        {/* Bloque izquierdo */}
        <div className="min-w-0">
          <p className="font-semibold text-sm text-gray-800 truncate">
            {TIPO_ICON[a.tipo]} {a.titulo}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">{a.descripcion}</p>
          {a.sala && (
            <p className="text-xs text-gray-500 mt-0.5">📍 {a.sala}</p>
          )}
          {a.telefono && (
            <p className="text-xs text-gray-500 mt-0.5">📞 {a.telefono}</p>
          )}
        </div>

        {/* Bloque derecho */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORIDAD_BADGE[a.prioridad]}`}
          >
            {a.prioridad.toUpperCase()}
          </span>
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded hover:bg-green-200 transition-colors"
            >
              💬 WhatsApp
            </a>
          )}
        </div>
      </div>

      {/* Fecha */}
      <p className="text-xs text-gray-400 mt-1">
        {a.fecha ? new Date(a.fecha).toLocaleDateString('es-EC') : ''}
      </p>
    </div>
  )
}

/* ── página principal ── */
export default function AlertasPage() {
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [filtro,    setFiltro]    = useState('todos')

  const cargar = useCallback(() => {
    setLoading(true)
    setError(null)
    getDetalleAlertas()
      .then(d => setData(d))
      .catch(e => setError(e.message || 'Error al cargar alertas'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  /* alertas filtradas */
  const alertas = data?.alertas ?? []
  const visibles = filtro === 'todos'
    ? alertas
    : alertas.filter(a => a.tipo === filtro)

  /* conteos para mini-cards */
  const cntVencidas  = alertas.filter(a => a.tipo === 'cuota_vencida').length
  const cntProximas  = alertas.filter(a => a.tipo === 'proximo_vencer').length
  const cntTickets   = alertas.filter(a => a.tipo === 'ticket_urgente').length

  return (
    <div className="max-w-4xl mx-auto">

      {/* ── Header de sección ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            🔔 Alertas y Notificaciones
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {data ? `${data.total} alerta${data.total !== 1 ? 's' : ''} activa${data.total !== 1 ? 's' : ''}` : ' '}
          </p>
        </div>
        <button
          onClick={cargar}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          <span className={loading ? 'animate-spin inline-block' : ''}>🔄</span>
          Actualizar
        </button>
      </div>

      {/* ── Mini-cards de resumen ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <MiniCard
          icon="🔴"
          label="Cuotas vencidas"
          count={cntVencidas}
          colorClass="bg-red-50 text-red-700"
        />
        <MiniCard
          icon="🟡"
          label="Próximas a vencer"
          count={cntProximas}
          colorClass="bg-yellow-50 text-yellow-700"
        />
        <MiniCard
          icon="🟠"
          label="Tickets urgentes"
          count={cntTickets}
          colorClass="bg-orange-50 text-orange-700"
        />
      </div>

      {/* ── Filtros ── */}
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTROS.map(f => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors border
              ${filtro === f.key
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
          >
            {f.label}
            {f.key !== 'todos' && (
              <span className="ml-1 opacity-70">
                ({alertas.filter(a => a.tipo === f.key).length})
              </span>
            )}
            {f.key === 'todos' && (
              <span className="ml-1 opacity-70">({alertas.length})</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Estados: cargando / error / vacío / lista ── */}
      {loading && (
        <div className="flex justify-center items-center py-16 text-gray-400">
          <span className="animate-spin text-2xl mr-3">🔄</span>
          <span className="text-sm">Cargando alertas...</span>
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          <span className="font-semibold">Error:</span> {error}
          <button
            onClick={cargar}
            className="ml-3 underline hover:no-underline"
          >
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && visibles.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-base font-medium text-gray-500">
            {filtro === 'todos'
              ? 'No hay alertas activas'
              : 'No hay alertas en esta categoría'}
          </p>
          <p className="text-xs mt-1">Todo al día por ahora</p>
        </div>
      )}

      {!loading && !error && visibles.length > 0 && (
        <div>
          {visibles.map((a, i) => (
            <AlertaCard key={`${a.tipo}-${a.meta?.id ?? i}-${i}`} alerta={a} />
          ))}
        </div>
      )}
    </div>
  )
}
