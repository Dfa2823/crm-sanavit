import { useState, useEffect, useCallback } from 'react'
import { getCartera, getCarteraResumen } from '../../api/cartera'
import { getSalas } from '../../api/admin'
import { useAuth } from '../../context/AuthContext'

// ─────────────────── Badge de estado de mora ────────────────────────────────
const ESTADO_CONFIG = {
  al_dia:   { label: 'Al día',   cls: 'bg-green-100 text-green-700' },
  mora_30:  { label: 'Mora 30d', cls: 'bg-yellow-100 text-yellow-700' },
  mora_60:  { label: 'Mora 60d', cls: 'bg-orange-100 text-orange-700' },
  mora_90:  { label: 'Mora 90d', cls: 'bg-red-100 text-red-700' },
}

function BadgeEstado({ estado }) {
  const cfg = ESTADO_CONFIG[estado] || { label: estado || 'Desconocido', cls: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ─────────────────── Tarjeta de estadística ─────────────────────────────────
function StatCard({ titulo, valor, subtitulo, color }) {
  const colors = {
    teal:   'bg-teal-50 border-teal-200 text-teal-700',
    green:  'bg-green-50 border-green-200 text-green-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    red:    'bg-red-50 border-red-200 text-red-700',
  }
  return (
    <div className={`rounded-xl border p-5 ${colors[color] || colors.teal}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{titulo}</p>
      <p className="text-3xl font-bold mt-1">{valor}</p>
      {subtitulo && <p className="text-xs mt-1 opacity-70">{subtitulo}</p>}
    </div>
  )
}

// ─────────────────── Spinner ─────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// ─────────────────── Formatear moneda ────────────────────────────────────────
function fmt(val) {
  if (val === null || val === undefined) return '—'
  return `$${Number(val).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ─────────────────── Exportar JSON como descarga ─────────────────────────────
function exportarJSON(data, nombre) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

export default function CarteraPage() {
  const { usuario } = useAuth()

  const [cartera, setCartera]     = useState([])
  const [resumen, setResumen]     = useState(null)
  const [salas, setSalas]         = useState([])
  const [salaId, setSalaId]       = useState(usuario?.sala_id || '')
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [dataCartera, dataResumen, dataSalas] = await Promise.all([
        getCartera(salaId || undefined),
        getCarteraResumen(salaId || undefined),
        getSalas(),
      ])
      setCartera(Array.isArray(dataCartera) ? dataCartera : [])
      setResumen(dataResumen)
      setSalas(Array.isArray(dataSalas) ? dataSalas : [])
    } catch (err) {
      setError('Error al cargar cartera: ' + (err.response?.data?.error || err.message))
    } finally {
      setLoading(false)
    }
  }, [salaId])

  useEffect(() => { cargar() }, [cargar])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Cartera</h1>
        <button
          onClick={() => exportarJSON(cartera, `cartera-${new Date().toISOString().slice(0,10)}.json`)}
          disabled={cartera.length === 0}
          className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          Exportar JSON
        </button>
      </div>

      {/* Filtro por sala */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Sala</label>
          <select
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={salaId}
            onChange={e => setSalaId(e.target.value)}
          >
            <option value="">Todas las salas</option>
            {salas.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        </div>
        <div className="mt-4">
          <button
            onClick={cargar}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
          >
            Actualizar
          </button>
        </div>
      </div>

      {/* Mensaje de error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex justify-between">
          {error}
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">×</button>
        </div>
      )}

      {loading ? <Spinner /> : (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard
              titulo="Total Cartera"
              valor={fmt(resumen?.total_cartera)}
              subtitulo={`${resumen?.total_clientes ?? 0} contratos`}
              color="teal"
            />
            <StatCard
              titulo="Al día"
              valor={`${resumen?.al_dia ?? 0}`}
              subtitulo="contratos"
              color="green"
            />
            <StatCard
              titulo="Mora 30d"
              valor={`${resumen?.mora_30 ?? 0}`}
              subtitulo="contratos"
              color="yellow"
            />
            <StatCard
              titulo="Mora 60d"
              valor={`${resumen?.mora_60 ?? 0}`}
              subtitulo="contratos"
              color="orange"
            />
            <StatCard
              titulo="Mora 90d"
              valor={`${resumen?.mora_90 ?? 0}`}
              subtitulo="contratos"
              color="red"
            />
          </div>

          {/* Tabla de cartera */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-700">Detalle de cartera</h2>
              <span className="text-sm text-gray-400">{cartera.length} registros</span>
            </div>

            {cartera.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <div className="text-4xl mb-3">💳</div>
                <p className="font-medium">No hay registros de cartera para esta sala</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Nombre</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Contrato</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Monto Total</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Monto Pagado</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Saldo</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-600">Días Mora</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-600">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cartera.map((item, i) => (
                      <tr
                        key={item.contrato?.id || i}
                        className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">
                            {item.persona?.nombres} {item.persona?.apellidos}
                          </div>
                          {item.persona?.telefono && (
                            <div className="text-xs text-gray-400 font-mono">{item.persona.telefono}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">
                          {item.contrato?.numero || '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-800">
                          {fmt(item.monto_total)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {fmt(item.monto_pagado)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-800">
                          {fmt(item.monto_saldo ?? (item.monto_total || 0) - (item.monto_pagado || 0))}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.mora_dias != null ? (
                            <span className={`font-bold ${item.mora_dias > 90 ? 'text-red-600' : item.mora_dias > 60 ? 'text-orange-500' : item.mora_dias > 30 ? 'text-yellow-600' : 'text-gray-600'}`}>
                              {item.mora_dias}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <BadgeEstado estado={item.estado_mora} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
