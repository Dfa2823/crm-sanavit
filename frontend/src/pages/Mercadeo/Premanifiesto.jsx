import { useState, useEffect, useCallback } from 'react'
import { apiCitas } from '../../api/citas'
import { apiUsuarios } from '../../api/usuarios'
import { formatHoraEC } from '../../utils/formatFechaEC'

const TABS = [
  { key: 'confirmadas',  label: 'Confirmadas',  icon: '✅', color: 'green' },
  { key: 'tentativas',   label: 'Tentativas',   icon: '📋', color: 'yellow' },
  { key: 'canceladas',   label: 'Canceladas',   icon: '❌', color: 'red' },
]

const TAB_STYLE = {
  green:  { active: 'border-green-500 text-green-700', badge: 'badge-green' },
  yellow: { active: 'border-yellow-500 text-yellow-700', badge: 'badge-yellow' },
  red:    { active: 'border-red-500 text-red-700', badge: 'badge-red' },
  gray:   { active: 'border-gray-500 text-gray-700', badge: 'badge-gray' },
}

function TablaPremanifiesto({ items }) {
  if (items.length === 0) {
    return (
      <div className="p-12 text-center text-gray-400">
        <p>Sin registros en esta categoría</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="table-base">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Teléfono</th>
            <th>Hora cita</th>
            <th>Tipificación</th>
            <th>TMK</th>
            <th>Call Center</th>
            <th>Patología</th>
            <th>Observación</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td>
                <div className="font-medium text-gray-800">
                  {item.nombres} {item.apellidos}
                </div>
                <div className="text-xs text-gray-400">{item.ciudad}</div>
              </td>
              <td className="font-mono text-sm text-gray-600">
                <a href={`tel:${item.telefono}`} className="text-blue-600 hover:underline">
                  {item.telefono}
                </a>
              </td>
              <td className="text-sm text-gray-700 font-medium">
                {item.fecha_cita
                  ? formatHoraEC(item.fecha_cita)
                  : '—'}
              </td>
              <td className="text-sm text-gray-600">
                {item.tipificacion_nombre
                  ? <span className="badge badge-blue text-xs">{item.tipificacion_nombre}</span>
                  : '—'}
              </td>
              <td className="text-sm text-gray-600">{item.tmk_nombre || '—'}</td>
              <td>
                {item.outsourcing_nombre
                  ? <span className="badge-blue badge text-xs">{item.outsourcing_nombre}</span>
                  : <span className="text-gray-400 text-xs">Interno</span>
                }
              </td>
              <td className="text-sm text-gray-500 max-w-xs truncate">{item.patologia || '—'}</td>
              <td className="text-xs text-gray-400 max-w-xs truncate">{item.observacion || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function exportarPDF(data, filtros) {
  if (!data) return
  const fechaLabel = filtros.fecha
    ? new Date(filtros.fecha + 'T12:00:00').toLocaleDateString('es-EC', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      })
    : ''
  const secciones = TABS.map(tab => {
    const items = data[tab.key] || []
    const filas = items.map(item => `
      <tr>
        <td>${item.nombres || ''} ${item.apellidos || ''}<br><small>${item.ciudad || ''}</small></td>
        <td>${item.telefono || '—'}</td>
        <td>${item.fecha_cita
          ? formatHoraEC(item.fecha_cita)
          : '—'}</td>
        <td>${item.tipificacion_nombre || '—'}</td>
        <td>${item.tmk_nombre || '—'}</td>
        <td>${item.outsourcing_nombre || 'Interno'}</td>
        <td>${item.patologia || '—'}</td>
        <td>${item.observacion || '—'}</td>
      </tr>`).join('')
    return `
      <div class="section">
        <h2>${tab.icon} ${tab.label} (${items.length})</h2>
        ${items.length === 0
          ? '<p class="empty">Sin registros en esta categoría</p>'
          : `<table>
              <thead><tr>
                <th>Cliente</th><th>Teléfono</th><th>Hora</th><th>Tipificación</th>
                <th>TMK</th><th>Call Center</th><th>Patología</th><th>Observación</th>
              </tr></thead>
              <tbody>${filas}</tbody>
            </table>`}
      </div>`
  }).join('')

  const html = `<!DOCTYPE html><html lang="es"><head>
    <meta charset="UTF-8"><title>Pre-manifiesto — ${fechaLabel}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 9px; color: #222; margin: 0; }
      h1 { font-size: 14px; margin: 0 0 2px; }
      h2 { font-size: 11px; margin: 14px 0 5px; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 3px; }
      .sub { color: #6b7280; font-size: 8px; margin: 0 0 10px; }
      .empty { color: #9ca3af; font-style: italic; margin: 4px 0; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #f3f4f6; padding: 4px 5px; font-size: 8px; border: 1px solid #d1d5db; text-align: left; }
      td { padding: 3px 5px; border: 1px solid #e5e7eb; vertical-align: top; }
      tr:nth-child(even) td { background: #f9fafb; }
      small { color: #9ca3af; }
      @page { margin: 1cm; size: A4 landscape; }
    </style></head><body>
    <h1>Pre-manifiesto — ${fechaLabel}</h1>
    <p class="sub">Generado el ${new Date().toLocaleString('es-EC')}</p>
    ${secciones}
  </body></html>`

  const w = window.open('', '_blank', 'width=1100,height=750')
  if (!w) { alert('Permite ventanas emergentes para exportar PDF'); return }
  w.document.write(html); w.document.close(); w.focus()
  setTimeout(() => { w.print(); w.close() }, 600)
}

function exportarCSV(data, filtros) {
  if (!data) return
  const cols = ['Sección', 'Nombres', 'Apellidos', 'Teléfono', 'Ciudad', 'Hora cita', 'Tipificación', 'TMK', 'Call Center', 'Patología', 'Observación']
  const rows = TABS.flatMap(tab =>
    (data[tab.key] || []).map(item => [
      tab.label,
      item.nombres || '',
      item.apellidos || '',
      item.telefono || '',
      item.ciudad || '',
      item.fecha_cita
        ? formatHoraEC(item.fecha_cita)
        : '',
      item.tipificacion_nombre || '',
      item.tmk_nombre || '',
      item.outsourcing_nombre || 'Interno',
      item.patologia || '',
      item.observacion || '',
    ])
  )
  const csv = [cols, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `premanifiesto-${filtros.fecha || 'sin-fecha'}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Premanifiesto() {
  const [data, setData] = useState(null)
  const [salas, setSalas] = useState([])
  const [filtros, setFiltros] = useState({
    sala_id: '',
    fecha: (() => {
      const m = new Date()
      m.setDate(m.getDate() + 1)
      return m.toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' })
    })(),
  })
  const [tabActivo, setTabActivo] = useState('confirmadas')
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [preman, listaSalas] = await Promise.all([
        apiCitas.premanifiesto({ sala_id: filtros.sala_id || undefined, fecha: filtros.fecha }),
        apiUsuarios.salas(),
      ])
      setData(preman)
      setSalas(listaSalas)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [filtros])

  useEffect(() => { cargar() }, [cargar])

  const fechaStr = filtros.fecha
    ? new Date(filtros.fecha + 'T12:00:00').toLocaleDateString('es-EC', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      })
    : ''

  return (
    <div className="space-y-5">

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
          <label className="label text-xs">Fecha</label>
          <input
            type="date" className="input py-1.5 text-sm"
            value={filtros.fecha}
            onChange={e => setFiltros(f => ({ ...f, fecha: e.target.value }))}
          />
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={cargar} className="btn-secondary btn-sm">
            🔄 Actualizar
          </button>
          <button
            onClick={() => exportarPDF(data, filtros)}
            disabled={!data}
            className="btn-sm px-3 py-1.5 text-sm font-medium rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            🖨️ PDF
          </button>
          <button
            onClick={() => exportarCSV(data, filtros)}
            disabled={!data}
            className="btn-sm px-3 py-1.5 text-sm font-medium rounded-lg border border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            📄 CSV
          </button>
        </div>

        <div className="flex-1" />

        {data && (
          <div className="text-right">
            <p className="text-xs text-gray-500 capitalize">{fechaStr}</p>
            <p className="text-sm font-semibold text-gray-700">
              {data.totales.confirmadas + data.totales.tentativas} citas activas
            </p>
          </div>
        )}
      </div>

      {/* Resumen */}
      {data && (
        <div className="grid grid-cols-4 gap-3">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setTabActivo(tab.key)}
              className={`card p-4 text-center transition-all hover:shadow-md
                ${tabActivo === tab.key ? 'ring-2 ring-offset-1 ring-blue-400' : ''}`}
            >
              <div className="text-2xl mb-1">{tab.icon}</div>
              <div className="text-xl font-bold text-gray-800">
                {data.totales[tab.key]}
              </div>
              <div className="text-xs text-gray-500">{tab.label}</div>
            </button>
          ))}
        </div>
      )}

      {/* Tabs + tabla */}
      <div className="card overflow-hidden">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex">
            {TABS.map(tab => {
              const style = TAB_STYLE[tab.color]
              return (
                <button
                  key={tab.key}
                  onClick={() => setTabActivo(tab.key)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors
                    ${tabActivo === tab.key
                      ? `${style.active} border-b-2`
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  {tab.icon} {tab.label}
                  {data && (
                    <span className={`badge text-xs ${tabActivo === tab.key ? style.badge : 'badge-gray'}`}>
                      {data.totales[tab.key]}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Cargando pre-manifiesto...
          </div>
        ) : data ? (
          <TablaPremanifiesto items={data[tabActivo] || []} />
        ) : null}
      </div>
    </div>
  )
}
