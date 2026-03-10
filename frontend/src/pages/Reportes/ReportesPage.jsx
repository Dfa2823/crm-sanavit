import { useState, useEffect } from 'react'
import { getReporteLeads, getReporteAsistencias } from '../../api/reportes'
import { getSalas } from '../../api/admin'

// ─────────────────────────────── Spinner ────────────────────────────────────
function Spinner() {
  return (
    <div className="flex items-center justify-center h-32">
      <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// ─────────────────── Tipos de reporte disponibles ────────────────────────────
const TIPOS = [
  { key: 'leads',       label: 'Leads',           icon: '📞' },
  { key: 'asistencias', label: 'Asistencias',      icon: '🚶' },
  { key: 'kpis',        label: 'KPIs Generales',   icon: '📊' },
]

// ─────────────────── Columnas por tipo de reporte ────────────────────────────
const COLUMNAS = {
  leads: [
    { key: 'fecha',            label: 'Fecha' },
    { key: 'nombres',          label: 'Nombre' },
    { key: 'telefono',         label: 'Teléfono' },
    { key: 'ciudad',           label: 'Ciudad' },
    { key: 'fuente',           label: 'Fuente' },
    { key: 'tipificacion',     label: 'Tipificación' },
    { key: 'tmk_nombre',       label: 'TMK' },
    { key: 'sala_nombre',      label: 'Sala' },
    { key: 'estado',           label: 'Estado' },
  ],
  asistencias: [
    { key: 'fecha',            label: 'Fecha' },
    { key: 'nombres',          label: 'Nombre' },
    { key: 'telefono',         label: 'Teléfono' },
    { key: 'sala_nombre',      label: 'Sala' },
    { key: 'tmk_nombre',       label: 'TMK' },
    { key: 'calificacion',     label: 'Calificación' },
    { key: 'consultor_nombre', label: 'Consultor' },
    { key: 'hora_llegada',     label: 'Hora llegada' },
  ],
  kpis: [
    { key: 'sala_nombre',      label: 'Sala' },
    { key: 'periodo',          label: 'Período' },
    { key: 'total_leads',      label: 'Leads' },
    { key: 'total_citas',      label: 'Citas' },
    { key: 'total_asistencias',label: 'Asistencias' },
    { key: 'total_tours',      label: 'Tours' },
    { key: 'efectividad',      label: 'Efectividad %' },
  ],
}

// ─────────────────── Exportar a CSV ──────────────────────────────────────────
function exportarCSV(columnas, filas, nombre) {
  if (!filas || filas.length === 0) return

  const header = columnas.map(c => `"${c.label}"`).join(',')
  const rows   = filas.map(fila =>
    columnas.map(c => {
      const val = fila[c.key]
      if (val === null || val === undefined) return '""'
      const str = String(val).replace(/"/g, '""')
      return `"${str}"`
    }).join(',')
  )

  const csv  = [header, ...rows].join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

// ─────────────────── Valor de celda con formato ───────────────────────────────
function CeldaValor({ valor }) {
  if (valor === null || valor === undefined) return <span className="text-gray-300">—</span>
  return <>{String(valor)}</>
}

// ─────────────────── Página principal ────────────────────────────────────────
export default function ReportesPage() {
  const hoy       = new Date().toISOString().slice(0, 10)
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().slice(0, 10)

  const [tipo, setTipo]           = useState('leads')
  const [fechaInicio, setFechaInicio] = useState(inicioMes)
  const [fechaFin, setFechaFin]   = useState(hoy)
  const [salaId, setSalaId]       = useState('')
  const [salas, setSalas]         = useState([])
  const [datos, setDatos]         = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  // Cargar lista de salas al montar
  useEffect(() => {
    getSalas()
      .then(s => setSalas(Array.isArray(s) ? s : []))
      .catch(err => console.error('Error cargando salas:', err))
  }, [])

  async function generarReporte() {
    setLoading(true)
    setError('')
    setDatos(null)
    try {
      const params = {
        fecha_inicio: fechaInicio || undefined,
        fecha_fin:    fechaFin    || undefined,
        sala_id:      salaId      || undefined,
      }

      let result
      if (tipo === 'leads') {
        result = await getReporteLeads(params)
      } else if (tipo === 'asistencias') {
        result = await getReporteAsistencias(params)
      } else {
        // KPIs Generales: intentamos leads como fallback si no hay endpoint dedicado
        result = await getReporteLeads(params)
      }

      setDatos(Array.isArray(result) ? result : (result?.data ?? []))
    } catch (err) {
      setError('Error al generar reporte: ' + (err.response?.data?.error || err.message))
    } finally {
      setLoading(false)
    }
  }

  const columnas = COLUMNAS[tipo] || []
  const tipoInfo = TIPOS.find(t => t.key === tipo)

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Reportes</h1>

      {/* Panel de filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-700 mb-4">Configurar reporte</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Tipo de reporte */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de reporte</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={tipo}
              onChange={e => { setTipo(e.target.value); setDatos(null) }}
            >
              {TIPOS.map(t => (
                <option key={t.key} value={t.key}>{t.icon} {t.label}</option>
              ))}
            </select>
          </div>

          {/* Fecha inicio */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Fecha inicio</label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={fechaInicio}
              onChange={e => setFechaInicio(e.target.value)}
            />
          </div>

          {/* Fecha fin */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Fecha fin</label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={fechaFin}
              onChange={e => setFechaFin(e.target.value)}
            />
          </div>

          {/* Sala */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sala</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={salaId}
              onChange={e => setSalaId(e.target.value)}
            >
              <option value="">Todas las salas</option>
              {salas.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={generarReporte}
            disabled={loading}
            className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generando...
              </>
            ) : (
              'Generar Reporte'
            )}
          </button>

          {datos && datos.length > 0 && (
            <button
              onClick={() => exportarCSV(
                columnas,
                datos,
                `reporte-${tipo}-${fechaInicio}-${fechaFin}.csv`
              )}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              Exportar Excel (CSV)
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex justify-between">
          {error}
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">×</button>
        </div>
      )}

      {/* Resultado */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <Spinner />
        </div>
      ) : datos !== null && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Header del resultado */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-700">
                {tipoInfo?.icon} {tipoInfo?.label}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {fechaInicio} — {fechaFin}
                {salaId && salas.find(s => String(s.id) === String(salaId))
                  ? ` · ${salas.find(s => String(s.id) === String(salaId)).nombre}`
                  : ' · Todas las salas'}
              </p>
            </div>
            <span className="text-sm text-gray-500 font-medium">
              {datos.length} registros
            </span>
          </div>

          {datos.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <div className="text-4xl mb-3">📭</div>
              <p className="font-medium">No hay datos para el período seleccionado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {columnas.map(col => (
                      <th
                        key={col.key}
                        className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap"
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {datos.map((fila, i) => (
                    <tr
                      key={i}
                      className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                    >
                      {columnas.map(col => (
                        <td key={col.key} className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          <CeldaValor valor={fila[col.key]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
