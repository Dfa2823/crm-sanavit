import { useState, useEffect, useCallback } from 'react'
import { apiCitas } from '../../api/citas'
import { apiUsuarios } from '../../api/usuarios'

const TABS = [
  { key: 'confirmadas',  label: 'Confirmadas',  icon: '✅', color: 'green' },
  { key: 'tentativas',   label: 'Tentativas',   icon: '📋', color: 'yellow' },
  { key: 'canceladas',   label: 'Canceladas',   icon: '❌', color: 'red' },
  { key: 'inasistencias',label: 'Inasistencias',icon: '🚫', color: 'gray' },
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
                  ? new Date(item.fecha_cita).toLocaleTimeString('es-EC', {
                      hour: '2-digit', minute: '2-digit'
                    })
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

export default function Premanifiesto() {
  const [data, setData] = useState(null)
  const [salas, setSalas] = useState([])
  const [filtros, setFiltros] = useState({
    sala_id: '',
    fecha: (() => {
      const m = new Date()
      m.setDate(m.getDate() + 1)
      return m.toISOString().split('T')[0]
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

        <div className="mt-5">
          <button onClick={cargar} className="btn-secondary btn-sm">
            🔄 Actualizar
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
