import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getVentas } from '../../api/ventas'
import { getSalas } from '../../api/admin'
import { useAuth } from '../../context/AuthContext'

const ESTADO_CONFIG = {
  activo:     { label: 'Activo',     cls: 'bg-green-100 text-green-700' },
  inactivo:   { label: 'Inactivo',   cls: 'bg-red-100 text-red-700' },
  cancelado:  { label: 'Cancelado',  cls: 'bg-gray-100 text-gray-600' },
  completado: { label: 'Completado', cls: 'bg-blue-100 text-blue-700' },
  suspendido: { label: 'Suspendido', cls: 'bg-yellow-100 text-yellow-700' },
}

function BadgeEstado({ estado }) {
  const cfg = ESTADO_CONFIG[estado] || { label: estado || '—', cls: 'bg-gray-100 text-gray-600' }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
}

function fmt(val) {
  if (val === null || val === undefined) return '—'
  return `$${Number(val).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function VentasPage() {
  const { usuario } = useAuth()
  const navigate = useNavigate()

  const [ventas, setVentas]       = useState([])
  const [salas, setSalas]         = useState([])
  const [salaId, setSalaId]       = useState(usuario?.sala_id || '')
  const [estado, setEstado]       = useState('activo')
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [busqueda, setBusqueda]   = useState('')
  const [pagina, setPagina]       = useState(1)
  const POR_PAGINA = 50

  const cargar = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [dataVentas, dataSalas] = await Promise.all([
        getVentas({ sala_id: salaId || undefined, estado: estado || undefined }),
        getSalas(),
      ])
      setVentas(Array.isArray(dataVentas) ? dataVentas : [])
      setSalas(Array.isArray(dataSalas) ? dataSalas : [])
    } catch (err) {
      setError('Error al cargar ventas: ' + (err.response?.data?.error || err.message))
    } finally {
      setLoading(false)
    }
  }, [salaId, estado])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { setPagina(1) }, [busqueda, salaId, estado])

  const totalMonto  = ventas.reduce((s, v) => s + parseFloat(v.monto_total || 0), 0)
  const totalPagado = ventas.reduce((s, v) => s + parseFloat(v.total_pagado || 0), 0)
  const porcentaje  = totalMonto > 0 ? Math.round(totalPagado / totalMonto * 100) : 0

  // Filtro de texto local (sin llamada extra al backend)
  const ventasFiltradas = busqueda.trim().length < 2
    ? ventas
    : ventas.filter(v => {
        const q = busqueda.toLowerCase()
        return (
          (v.nombres + ' ' + v.apellidos).toLowerCase().includes(q) ||
          (v.numero_contrato || '').toLowerCase().includes(q) ||
          (v.telefono || '').includes(q) ||
          (v.num_documento || '').includes(q) ||
          (v.consultor_nombre || '').toLowerCase().includes(q)
        )
      })

  const totalPaginas  = Math.ceil(ventasFiltradas.length / POR_PAGINA)
  const ventasPagina  = ventasFiltradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Contratos de Venta</h1>
        <button
          onClick={() => navigate('/ventas/nueva')}
          className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
        >
          + Nueva Venta
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap items-center gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Sala</label>
          <select className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={salaId} onChange={e => setSalaId(e.target.value)}>
            <option value="">Todas las salas</option>
            {salas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
          <select className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={estado} onChange={e => setEstado(e.target.value)}>
            <option value="">Todos</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
            <option value="completado">Completado</option>
            <option value="cancelado">Cancelado</option>
            <option value="suspendido">Suspendido</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Buscar</label>
          <input
            type="text"
            placeholder="Nombre, N° contrato, teléfono, cédula..."
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>
        <div className="mt-4">
          <button onClick={cargar} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex justify-between">
          {error} <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">×</button>
        </div>
      )}

      {loading ? <Spinner /> : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border bg-teal-50 border-teal-200 p-4">
              <p className="text-xs font-semibold uppercase text-teal-600 opacity-70">Contratos</p>
              <p className="text-3xl font-bold text-teal-700 mt-1">{ventasFiltradas.length}</p>
            </div>
            <div className="rounded-xl border bg-blue-50 border-blue-200 p-4">
              <p className="text-xs font-semibold uppercase text-blue-600 opacity-70">Cartera Total</p>
              <p className="text-2xl font-bold text-blue-700 mt-1">{fmt(totalMonto)}</p>
            </div>
            <div className="rounded-xl border bg-green-50 border-green-200 p-4">
              <p className="text-xs font-semibold uppercase text-green-600 opacity-70">Total Cobrado</p>
              <p className="text-2xl font-bold text-green-700 mt-1">{fmt(totalPagado)}</p>
            </div>
            <div className="rounded-xl border bg-orange-50 border-orange-200 p-4">
              <p className="text-xs font-semibold uppercase text-orange-600 opacity-70">% Cobrado</p>
              <p className="text-3xl font-bold text-orange-700 mt-1">{porcentaje}%</p>
            </div>
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-700">Detalle de contratos</h2>
              <span className="text-sm text-gray-400">{ventasFiltradas.length} registros</span>

            </div>
            {ventasFiltradas.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <div className="text-4xl mb-3">💼</div>
                <p className="font-medium">No hay contratos para esta selección</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">N° Contrato</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Cliente</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Consultor</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Sala</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Pagado</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Saldo</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-600">Estado</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-600">Fecha</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventasPagina.map((v, i) => (
                      <tr key={v.id}
                        className={`border-b border-gray-50 hover:bg-gray-50 cursor-pointer ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                        onClick={() => navigate(`/ventas/${v.id}`)}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-teal-700 font-bold">{v.numero_contrato || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{v.nombres} {v.apellidos}</div>
                          {v.telefono && <div className="text-xs text-gray-400 font-mono">{v.telefono}</div>}
                          {v.segunda_venta && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-medium">2da venta</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{v.consultor_nombre || '—'}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{v.sala_nombre || '—'}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-800">{fmt(v.monto_total)}</td>
                        <td className="px-4 py-3 text-right text-green-600">{fmt(v.total_pagado)}</td>
                        <td className="px-4 py-3 text-right text-orange-600 font-medium">{fmt(v.saldo)}</td>
                        <td className="px-4 py-3 text-center"><BadgeEstado estado={v.estado} /></td>
                        <td className="px-4 py-3 text-center text-xs text-gray-500">
                          {v.fecha_contrato ? new Date(v.fecha_contrato).toLocaleDateString('es-EC') : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={e => { e.stopPropagation(); navigate(`/ventas/${v.id}`) }}
                            className="text-teal-600 hover:text-teal-800 text-xs font-medium"
                          >
                            Ver →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* Paginación */}
            {totalPaginas > 1 && (
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Mostrando {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, ventasFiltradas.length)} de {ventasFiltradas.length}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPagina(p => Math.max(1, p - 1))}
                    disabled={pagina === 1}
                    className="px-3 py-1 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >‹ Anterior</button>
                  {Array.from({ length: Math.min(totalPaginas, 7) }, (_, i) => {
                    let p = i + 1
                    if (totalPaginas > 7) {
                      if (pagina <= 4) p = i + 1
                      else if (pagina >= totalPaginas - 3) p = totalPaginas - 6 + i
                      else p = pagina - 3 + i
                    }
                    return (
                      <button key={p} onClick={() => setPagina(p)}
                        className={`px-3 py-1 rounded-lg border text-sm ${p === pagina ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                        {p}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                    disabled={pagina === totalPaginas}
                    className="px-3 py-1 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >Siguiente ›</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
