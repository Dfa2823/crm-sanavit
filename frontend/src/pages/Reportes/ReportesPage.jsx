import { useState, useEffect } from 'react'
import { getReporteLeads, getReporteAsistencias, getReporteTMK, getReporteVentas } from '../../api/reportes'
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
  { key: 'leads',       label: 'Leads',            icon: '📞', desc: 'Todos los leads capturados con tipificación y estado' },
  { key: 'asistencias', label: 'Asistencias/Tours', icon: '🚶', desc: 'Visitas a sala y calificaciones TOUR/NO TOUR/NO SHOW' },
  { key: 'tmk',         label: 'Productividad TMK', icon: '👤', desc: 'Métricas de efectividad individuales por agente TMK' },
  { key: 'ventas',      label: 'Contratos/Ventas',  icon: '💼', desc: 'Contratos firmados con cartera total y saldo pendiente' },
]

// ─────────────────── Columnas por tipo de reporte ────────────────────────────
const COLUMNAS = {
  leads: [
    { key: 'Fecha Creación',   label: 'Fecha' },
    { key: 'Nombre Completo',  label: 'Nombre' },
    { key: 'Teléfono',         label: 'Teléfono' },
    { key: 'Ciudad',           label: 'Ciudad' },
    { key: 'Fuente',           label: 'Fuente' },
    { key: 'Tipificación',     label: 'Tipificación' },
    { key: 'Patología',        label: 'Patología' },
    { key: 'TMK',              label: 'TMK' },
    { key: 'Sala',             label: 'Sala' },
    { key: 'Estado',           label: 'Estado' },
  ],
  asistencias: [
    { key: 'Fecha Visita',      label: 'Fecha' },
    { key: 'Nombre Completo',   label: 'Nombre' },
    { key: 'Teléfono',          label: 'Teléfono' },
    { key: 'Sala',              label: 'Sala' },
    { key: 'TMK',               label: 'TMK' },
    { key: 'Calificación Sala', label: 'Calificación' },
    { key: 'Consultor Sala',    label: 'Consultor' },
    { key: 'Fuente',            label: 'Fuente' },
    { key: 'Hora Llegada',      label: 'Hora llegada' },
    { key: 'Acompañante',       label: 'Acompañante' },
  ],
  tmk: [
    { key: 'TMK',                   label: 'Agente TMK' },
    { key: 'Sala',                  label: 'Sala' },
    { key: 'Total Leads',           label: 'Leads' },
    { key: 'Citas Agendadas',       label: 'Citas' },
    { key: 'Asistencias',           label: 'Asistencias' },
    { key: 'Tours',                 label: 'Tours' },
    { key: 'No Tours',              label: 'No Tours' },
    { key: 'No Shows',              label: 'No Shows' },
    { key: 'Efectividad Datos (%)', label: 'Efect. Datos' },
    { key: 'Conversión Tour (%)',   label: 'Conv. Tour' },
  ],
  ventas: [
    { key: 'numero_contrato',  label: 'N° Contrato' },
    { key: 'nombres',          label: 'Cliente' },
    { key: 'apellidos',        label: 'Apellidos' },
    { key: 'consultor_nombre', label: 'Consultor' },
    { key: 'sala_nombre',      label: 'Sala' },
    { key: 'tipo_plan',        label: 'Plan' },
    { key: 'monto_total',      label: 'Monto Total' },
    { key: 'total_pagado',     label: 'Total Pagado' },
    { key: 'saldo',            label: 'Saldo' },
    { key: 'estado',           label: 'Estado' },
    { key: 'fecha_contrato',   label: 'Fecha' },
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
      return `"${String(val).replace(/"/g, '""')}"`
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

// ─────────────────── Badge de estado ─────────────────────────────────────────
function EstadoBadge({ valor }) {
  if (!valor) return <span className="text-gray-300">—</span>
  const colores = {
    pendiente:  'bg-gray-100 text-gray-700',
    confirmada: 'bg-green-100 text-green-700',
    tentativa:  'bg-yellow-100 text-yellow-700',
    cancelada:  'bg-red-100 text-red-700',
    tour:       'bg-green-200 text-green-800',
    no_tour:    'bg-red-100 text-red-700',
    no_show:    'bg-gray-100 text-gray-600',
    activo:     'bg-green-100 text-green-700',
    completado: 'bg-blue-100 text-blue-700',
    cancelado:  'bg-red-100 text-red-700',
    suspendido: 'bg-yellow-100 text-yellow-700',
    TOUR:       'bg-green-200 text-green-800',
    NO_TOUR:    'bg-red-100 text-red-700',
    NO_SHOW:    'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colores[valor] || 'bg-gray-100 text-gray-700'}`}>
      {valor}
    </span>
  )
}

// ─────────────────── Formato moneda ──────────────────────────────────────────
const fmtMoneda = n => {
  const num = parseFloat(n)
  return isNaN(num) ? '—' : `$${num.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ─────────────────── Valor de celda con formato ───────────────────────────────
function CeldaValor({ valor, colKey }) {
  if (valor === null || valor === undefined) return <span className="text-gray-300">—</span>
  if (['Estado', 'estado', 'Calificación Sala'].includes(colKey)) return <EstadoBadge valor={valor} />
  if (['monto_total', 'total_pagado', 'saldo'].includes(colKey)) return <>{fmtMoneda(valor)}</>
  return <>{String(valor)}</>
}

// ─────────────────── Resumen estadístico del reporte ─────────────────────────
function ResumenReporte({ tipo, datos, meta }) {
  if (!datos || datos.length === 0) return null

  let cards = []

  if (tipo === 'asistencias' && meta) {
    cards = [
      { label: 'Total Asistencias', val: meta.total_asistencias, color: 'bg-blue-50 text-blue-700' },
      { label: 'Tours',             val: meta.total_tours,        color: 'bg-green-50 text-green-700' },
      { label: 'No Tours',          val: meta.total_no_tour,      color: 'bg-red-50 text-red-700' },
      { label: 'Conversión Tour',   val: `${meta.conversion_tour}%`, color: 'bg-teal-50 text-teal-700' },
    ]
  } else if (tipo === 'ventas') {
    const totalMonto  = datos.reduce((s, r) => s + parseFloat(r.monto_total  || 0), 0)
    const totalPagado = datos.reduce((s, r) => s + parseFloat(r.total_pagado || 0), 0)
    const totalSaldo  = datos.reduce((s, r) => s + parseFloat(r.saldo        || 0), 0)
    cards = [
      { label: 'Contratos',      val: datos.length,         color: 'bg-blue-50 text-blue-700' },
      { label: 'Cartera Total',  val: fmtMoneda(totalMonto),  color: 'bg-teal-50 text-teal-700' },
      { label: 'Total Cobrado',  val: fmtMoneda(totalPagado), color: 'bg-green-50 text-green-700' },
      { label: 'Saldo Pendiente',val: fmtMoneda(totalSaldo),  color: 'bg-orange-50 text-orange-700' },
    ]
  } else if (tipo === 'tmk') {
    const totalLeads = datos.reduce((s, r) => s + parseInt(r['Total Leads'] || 0), 0)
    const totalTours = datos.reduce((s, r) => s + parseInt(r['Tours'] || 0), 0)
    const totalCitas = datos.reduce((s, r) => s + parseInt(r['Citas Agendadas'] || 0), 0)
    cards = [
      { label: 'Agentes TMK',  val: datos.length,  color: 'bg-purple-50 text-purple-700' },
      { label: 'Total Leads',  val: totalLeads,     color: 'bg-blue-50 text-blue-700' },
      { label: 'Total Citas',  val: totalCitas,     color: 'bg-teal-50 text-teal-700' },
      { label: 'Total Tours',  val: totalTours,     color: 'bg-green-50 text-green-700' },
    ]
  } else if (tipo === 'leads') {
    const porEstado = datos.reduce((acc, r) => {
      const e = r['Estado'] || 'sin estado'
      acc[e] = (acc[e] || 0) + 1
      return acc
    }, {})
    const tours = (porEstado['tour'] || 0)
    cards = [
      { label: 'Total Leads', val: datos.length, color: 'bg-blue-50 text-blue-700' },
      { label: 'Tours',       val: tours,         color: 'bg-green-50 text-green-700' },
      { label: 'Confirmados', val: porEstado['confirmada'] || 0, color: 'bg-teal-50 text-teal-700' },
      { label: 'Pendientes',  val: porEstado['pendiente'] || 0, color: 'bg-gray-50 text-gray-700' },
    ]
  }

  if (cards.length === 0) return null
  return (
    <div className="grid grid-cols-4 gap-3 mb-1">
      {cards.map(c => (
        <div key={c.label} className={`rounded-lg p-3 ${c.color}`}>
          <p className="text-xs opacity-70">{c.label}</p>
          <p className="text-xl font-bold">{c.val}</p>
        </div>
      ))}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// Página principal
// ═════════════════════════════════════════════════════════════════════════════
export default function ReportesPage() {
  const hoy       = new Date().toISOString().slice(0, 10)
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().slice(0, 10)

  const [tipo,        setTipo]        = useState('leads')
  const [fechaInicio, setFechaInicio] = useState(inicioMes)
  const [fechaFin,    setFechaFin]    = useState(hoy)
  const [salaId,      setSalaId]      = useState('')
  const [salas,       setSalas]       = useState([])
  const [datos,       setDatos]       = useState(null)
  const [meta,        setMeta]        = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  useEffect(() => {
    getSalas().then(s => setSalas(Array.isArray(s) ? s : [])).catch(() => {})
  }, [])

  async function generarReporte() {
    setLoading(true); setError(''); setDatos(null); setMeta(null)
    try {
      const params = {
        fecha_inicio: fechaInicio || undefined,
        fecha_fin:    fechaFin    || undefined,
        sala_id:      salaId      || undefined,
      }
      let result
      switch (tipo) {
        case 'leads':       result = await getReporteLeads(params);       break
        case 'asistencias': result = await getReporteAsistencias(params); break
        case 'tmk':         result = await getReporteTMK(params);         break
        case 'ventas':      result = await getReporteVentas(params);      break
        default:            result = await getReporteLeads(params)
      }
      if (result?.data) { setDatos(result.data); setMeta(result.meta || null) }
      else if (Array.isArray(result)) { setDatos(result) }
      else { setDatos([]) }
    } catch (err) {
      setError('Error al generar reporte: ' + (err.response?.data?.error || err.message))
    } finally {
      setLoading(false)
    }
  }

  const columnas = COLUMNAS[tipo] || []
  const tipoInfo = TIPOS.find(t => t.key === tipo)
  const salaNombre = salaId && salas.find(s => String(s.id) === String(salaId))?.nombre

  return (
    <div className="p-6 space-y-6">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">📊 Reportes</h1>
        <p className="text-sm text-gray-500">Exporta a CSV para análisis en Excel</p>
      </div>

      {/* Panel de filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">

        {/* Selector de tipo */}
        <div className="flex flex-wrap gap-2 mb-4">
          {TIPOS.map(t => (
            <button
              key={t.key}
              onClick={() => { setTipo(t.key); setDatos(null); setMeta(null) }}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                tipo === t.key
                  ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-teal-400 hover:text-teal-600'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tipoInfo && (
          <p className="text-xs text-gray-400 mb-4">ℹ️ {tipoInfo.desc}</p>
        )}

        {/* Filtros de fecha y sala */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Fecha inicio</label>
            <input type="date"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Fecha fin</label>
            <input type="date"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sala</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={salaId} onChange={e => setSalaId(e.target.value)}>
              <option value="">Todas las salas</option>
              {salas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex items-center gap-3 mt-5">
          <button onClick={generarReporte} disabled={loading}
            className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
            {loading
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Generando...</>
              : '▶ Generar Reporte'
            }
          </button>

          {datos && datos.length > 0 && (
            <button
              onClick={() => exportarCSV(columnas, datos, `reporte-${tipo}-${fechaInicio}-${fechaFin}.csv`)}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-2">
              📥 Exportar CSV
            </button>
          )}

          {datos !== null && (
            <span className="text-xs text-gray-400 ml-1">
              {datos.length} registros
            </span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex justify-between">
          {error}
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 ml-4">×</button>
        </div>
      )}

      {/* Resultado */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <Spinner />
        </div>
      ) : datos !== null && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

          {/* Header resultado */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-700">{tipoInfo?.icon} {tipoInfo?.label}</h2>
              <span className="text-sm text-gray-400">
                {fechaInicio} → {fechaFin}
                {salaNombre ? ` · ${salaNombre}` : ' · Todas las salas'}
              </span>
            </div>
            <ResumenReporte tipo={tipo} datos={datos} meta={meta} />
          </div>

          {datos.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <div className="text-4xl mb-3">📭</div>
              <p className="font-medium">No hay datos para el período seleccionado</p>
              <p className="text-sm mt-1">Intenta ampliar el rango de fechas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {columnas.map(col => (
                      <th key={col.key} className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {datos.map((fila, i) => (
                    <tr key={i} className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 !== 0 ? 'bg-gray-50/30' : ''}`}>
                      {columnas.map(col => (
                        <td key={col.key} className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          <CeldaValor valor={fila[col.key]} colKey={col.key} />
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
