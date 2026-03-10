import { useState, useEffect, useMemo } from 'react'
import client from '../../api/client'
import { getReportLeads, getReportVentas, getReportCartera } from '../../api/reportes'

// ─────────────────────────────── Helpers ────────────────────────────────────

function fechaHoy() {
  return new Date().toISOString().slice(0, 10)
}

function primerDiaMes() {
  const hoy = new Date()
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
}

/** Formatea ISO datetime a DD/MM/YYYY HH:MM o DD/MM/YYYY si no tiene hora */
function formatFecha(val) {
  if (!val) return ''
  // yyyy-mm-dd hh:mm or yyyy-mm-ddThh:mm...
  const m = String(val).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/)
  if (!m) return val
  const base = `${m[3]}/${m[2]}/${m[1]}`
  return m[4] ? `${base} ${m[4]}:${m[5]}` : base
}

const fmtMoneda = (n) => {
  const num = parseFloat(n)
  return isNaN(num) ? '—' : `$${num.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const FECHA_KEYS = [
  'Fecha Contrato', 'Fecha Vencimiento', 'Fecha Creación', 'Última Actualización',
  'Fecha Cita', 'Fecha Rellamar', 'Fecha Visita', 'Fecha Registro',
]
const MONEDA_KEYS = [
  'Monto Total', 'Total Cobrado', 'Saldo', 'Monto Esperado', 'Monto Pagado',
  'Saldo Cuota', 'monto_total', 'total_pagado', 'saldo',
]
const ESTADO_KEYS = ['Estado', 'estado', 'Calificación Sala']

const ESTADO_COLORES = {
  pendiente:  'bg-gray-100 text-gray-700',
  confirmada: 'bg-green-100 text-green-700',
  tentativa:  'bg-yellow-100 text-yellow-700',
  cancelada:  'bg-red-100 text-red-700',
  cancelado:  'bg-red-100 text-red-700',
  tour:       'bg-green-200 text-green-800',
  TOUR:       'bg-green-200 text-green-800',
  no_tour:    'bg-red-100 text-red-700',
  NO_TOUR:    'bg-red-100 text-red-700',
  no_show:    'bg-gray-100 text-gray-600',
  NO_SHOW:    'bg-gray-100 text-gray-600',
  activo:     'bg-green-100 text-green-700',
  completado: 'bg-blue-100 text-blue-700',
  suspendido: 'bg-yellow-100 text-yellow-700',
  vencido:    'bg-red-100 text-red-700',
}

function CeldaValor({ colKey, valor }) {
  if (valor === null || valor === undefined || valor === '') {
    return <span className="text-gray-300">—</span>
  }
  if (ESTADO_KEYS.includes(colKey)) {
    return (
      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORES[valor] || 'bg-gray-100 text-gray-700'}`}>
        {valor}
      </span>
    )
  }
  if (MONEDA_KEYS.includes(colKey)) {
    return <>{fmtMoneda(valor)}</>
  }
  if (FECHA_KEYS.includes(colKey)) {
    return <>{formatFecha(valor)}</>
  }
  return <>{String(valor)}</>
}

// ─────────────────────────────── Spinner ────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center h-32">
      <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// ─────────────────────────── Mini-cards ─────────────────────────────────────

function MiniCards({ tabActivo, meta, data }) {
  if (!data || data.length === 0) return null

  let cards = []

  if (tabActivo === 'leads') {
    const estados = data.reduce((acc, r) => {
      const e = r['Estado'] || 'sin_estado'
      acc[e] = (acc[e] || 0) + 1
      return acc
    }, {})
    const totalCitas = (estados['confirmada'] || 0) + (estados['tentativa'] || 0)
    const totalTours = estados['tour'] || 0
    const efectividad = data.length > 0 ? ((totalTours / data.length) * 100).toFixed(1) : 0
    cards = [
      { label: 'Total Leads',  valor: data.length,      color: 'bg-blue-50 text-blue-700' },
      { label: 'Total Citas',  valor: totalCitas,        color: 'bg-teal-50 text-teal-700' },
      { label: 'Total Tours',  valor: totalTours,        color: 'bg-green-50 text-green-700' },
      { label: 'Efectividad',  valor: `${efectividad}%`, color: 'bg-purple-50 text-purple-700' },
    ]
  } else if (tabActivo === 'ventas') {
    const montoTotal   = meta?.monto_total   ? fmtMoneda(meta.monto_total)   : fmtMoneda(data.reduce((s, r) => s + parseFloat(r['Monto Total'] || 0), 0))
    const cobrado      = meta?.total_cobrado ? fmtMoneda(meta.total_cobrado) : fmtMoneda(data.reduce((s, r) => s + parseFloat(r['Total Cobrado'] || 0), 0))
    const saldoTotal   = fmtMoneda(data.reduce((s, r) => s + parseFloat(r['Saldo'] || 0), 0))
    cards = [
      { label: 'Total Contratos',  valor: data.length,  color: 'bg-blue-50 text-blue-700' },
      { label: 'Monto Total',      valor: montoTotal,   color: 'bg-teal-50 text-teal-700' },
      { label: 'Monto Cobrado',    valor: cobrado,      color: 'bg-green-50 text-green-700' },
      { label: 'Saldo Pendiente',  valor: saldoTotal,   color: 'bg-orange-50 text-orange-700' },
    ]
  } else if (tabActivo === 'cartera') {
    const montoVencido = meta?.monto_vencido ? fmtMoneda(meta.monto_vencido) : fmtMoneda(data.reduce((s, r) => s + parseFloat(r['Saldo Cuota'] || 0), 0))
    const mora30 = meta?.mora_30 ?? data.filter(r => parseInt(r['Días Mora'] || 0) <= 30).length
    const mora60 = meta?.mora_60 ?? data.filter(r => parseInt(r['Días Mora'] || 0) > 30 && parseInt(r['Días Mora'] || 0) <= 60).length
    cards = [
      { label: 'Cuotas Vencidas',  valor: data.length,   color: 'bg-red-50 text-red-700' },
      { label: 'Monto Vencido',    valor: montoVencido,  color: 'bg-orange-50 text-orange-700' },
      { label: 'Mora 1-30 días',   valor: mora30,        color: 'bg-yellow-50 text-yellow-700' },
      { label: 'Mora 31+ días',    valor: (meta?.mora_60 ?? 0) + (meta?.mora_90 ?? mora60), color: 'bg-red-50 text-red-800' },
    ]
  }

  if (cards.length === 0) return null
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      {cards.map(c => (
        <div key={c.label} className={`rounded-lg p-4 ${c.color}`}>
          <p className="text-xs opacity-70 mb-1">{c.label}</p>
          <p className="text-xl font-bold">{c.valor}</p>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────── Export CSV ─────────────────────────────────────

function exportarCSV(tabActivo, data) {
  if (!data?.length) return
  const cols = Object.keys(data[0])
  const header = cols.join(',')
  const rows = data.map(row =>
    cols.map(c => {
      const v = row[c] ?? ''
      return typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\n'))
        ? `"${v.replace(/"/g, '""')}"`
        : v
    }).join(',')
  ).join('\n')
  const csv  = `\uFEFF${header}\n${rows}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href  = url
  link.download = `reporte_${tabActivo}_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// ═════════════════════════════════════════════════════════════════════════════
// Página principal
// ═════════════════════════════════════════════════════════════════════════════

const POR_PAGINA = 50

const TABS = [
  { key: 'leads',   label: 'Leads' },
  { key: 'ventas',  label: 'Ventas' },
  { key: 'cartera', label: 'Cartera' },
]

export default function ReportesPage() {
  const [tabActivo,    setTabActivo]    = useState('leads')
  const [salas,        setSalas]        = useState([])
  const [salaId,       setSalaId]       = useState('')
  const [fechaInicio,  setFechaInicio]  = useState(primerDiaMes())
  const [fechaFin,     setFechaFin]     = useState(fechaHoy())
  const [datos,        setDatos]        = useState(null)   // { meta, data }
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [pagina,       setPagina]       = useState(1)

  // Cargar salas al montar
  useEffect(() => {
    client.get('/api/admin/salas')
      .then(r => setSalas(Array.isArray(r.data) ? r.data : []))
      .catch(console.error)
  }, [])

  async function generar() {
    setLoading(true)
    setError('')
    setDatos(null)
    setPagina(1)
    try {
      const params = {
        sala_id:      salaId      || undefined,
        fecha_inicio: fechaInicio || undefined,
        fecha_fin:    fechaFin    || undefined,
      }
      let resultado
      if (tabActivo === 'leads')   resultado = await getReportLeads(params)
      if (tabActivo === 'ventas')  resultado = await getReportVentas(params)
      if (tabActivo === 'cartera') resultado = await getReportCartera(params)
      setDatos(resultado)
    } catch (err) {
      console.error(err)
      setError('Error al generar el reporte: ' + (err.response?.data?.error || err.message))
    } finally {
      setLoading(false)
    }
  }

  function cambiarTab(tab) {
    setTabActivo(tab)
    setDatos(null)
    setError('')
    setPagina(1)
  }

  // Paginación
  const filas      = datos?.data ?? []
  const totalFilas = filas.length
  const totalPags  = Math.max(1, Math.ceil(totalFilas / POR_PAGINA))
  const filasPage  = useMemo(() => {
    const inicio = (pagina - 1) * POR_PAGINA
    return filas.slice(inicio, inicio + POR_PAGINA)
  }, [filas, pagina])

  const columnas = filas.length > 0 ? Object.keys(filas[0]) : []

  const desde = totalFilas === 0 ? 0 : (pagina - 1) * POR_PAGINA + 1
  const hasta = Math.min(pagina * POR_PAGINA, totalFilas)

  return (
    <div className="bg-gray-50 min-h-screen p-6 space-y-5">

      {/* ── Header ── */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col md:flex-row md:items-end gap-4">

          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-800 mb-1">Reportes</h1>
            <p className="text-sm text-gray-500">Genera y exporta reportes por período y sala</p>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Sala</label>
              <select
                value={salaId}
                onChange={e => setSalaId(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 min-w-[150px]"
              >
                <option value="">Todas las salas</option>
                {salas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={e => setFechaInicio(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
              <input
                type="date"
                value={fechaFin}
                onChange={e => setFechaFin(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <button
              onClick={generar}
              disabled={loading}
              className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
            >
              {loading
                ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generando...</>
                : 'Generar'
              }
            </button>

            <button
              onClick={() => exportarCSV(tabActivo, filas)}
              disabled={!filas.length}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-40 text-sm font-medium flex items-center gap-2"
            >
              Exportar CSV
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white rounded-lg shadow">
        <div className="flex border-b border-gray-200 px-4">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => cambiarTab(t.key)}
              className={`px-5 py-3 text-sm font-medium transition-colors ${
                tabActivo === t.key
                  ? 'border-b-2 border-teal-600 text-teal-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex justify-between items-start">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 ml-4 text-lg leading-none">×</button>
          </div>
        )}

        {/* ── Contenido ── */}
        {loading ? (
          <div className="p-8">
            <Spinner />
          </div>
        ) : datos === null ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-4xl mb-3">📊</p>
            <p className="font-medium text-gray-500">Selecciona un período y presiona Generar</p>
            <p className="text-sm mt-1">Los datos aparecerán aquí</p>
          </div>
        ) : (
          <div className="p-4">

            {/* Mini-cards */}
            <MiniCards tabActivo={tabActivo} meta={datos.meta} data={filas} />

            {filas.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <p className="text-3xl mb-3">📭</p>
                <p className="font-medium">No hay datos para el período seleccionado</p>
                <p className="text-sm mt-1">Intenta ampliar el rango de fechas</p>
              </div>
            ) : (
              <>
                {/* Tabla */}
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {columnas.map(col => (
                          <th
                            key={col}
                            className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap border-b border-gray-200"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filasPage.map((fila, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          {columnas.map(col => (
                            <td key={col} className="px-4 py-3 text-gray-700 whitespace-nowrap">
                              <CeldaValor colKey={col} valor={fila[col]} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer paginación */}
                <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                  <span>
                    Mostrando {desde}–{hasta} de {totalFilas} registros
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPagina(p => Math.max(1, p - 1))}
                      disabled={pagina === 1}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                    >
                      Anterior
                    </button>
                    <span className="px-2">
                      Página {pagina} de {totalPags}
                    </span>
                    <button
                      onClick={() => setPagina(p => Math.min(totalPags, p + 1))}
                      disabled={pagina === totalPags}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
