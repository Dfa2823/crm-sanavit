import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getVentas } from '../../api/ventas'
import { getSalas } from '../../api/admin'
import { useAuth } from '../../context/AuthContext'

const ESTADO_CONFIG = {
  activo:     { label: 'Activo',     cls: 'badge-green' },
  inactivo:   { label: 'Inactivo',   cls: 'badge-red' },
  cancelado:  { label: 'Cancelado',  cls: 'badge-gray' },
  completado: { label: 'Completado', cls: 'badge-blue' },
  suspendido: { label: 'Suspendido', cls: 'badge-amber' },
}

function BadgeEstado({ estado }) {
  const cfg = ESTADO_CONFIG[estado] || { label: estado || '—', cls: 'badge-gray' }
  return <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
}

function fmt(val) {
  if (val === null || val === undefined) return '—'
  return `$${Number(val).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function Spinner() {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-xl border border-gray-200 p-4">
            <div className="shimmer h-3 w-20 mb-3 rounded" />
            <div className="shimmer h-8 w-16 rounded" />
          </div>
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="shimmer h-12 w-full rounded-t-xl" />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="shimmer h-14 w-full" style={{ animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>
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
      setVentas(Array.isArray(dataVentas) ? dataVentas : dataVentas?.data || [])
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
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-end">
        <button
          onClick={() => navigate('/ventas/nueva')}
          className="btn btn-primary"
        >
          + Nueva Venta
        </button>
      </div>

      {/* Filtros */}
      <div className="card p-4 flex flex-wrap items-center gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Sala</label>
          <select className="input w-auto"
            value={salaId} onChange={e => setSalaId(e.target.value)}>
            <option value="">Todas las salas</option>
            {salas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
          <select className="input w-auto"
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
        <div className="self-end">
          <button onClick={cargar} className="btn btn-secondary">
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
            <div className="rounded-xl border bg-teal-50 border-teal-200 p-4 hover-lift animate-staggerFadeIn" style={{ animationDelay: '0s' }}>
              <p className="text-xs font-semibold uppercase text-teal-600 opacity-70">Contratos</p>
              <p className="text-3xl font-bold text-teal-700 mt-1 animate-countUp">{ventasFiltradas.length}</p>
            </div>
            <div className="rounded-xl border bg-blue-50 border-blue-200 p-4 hover-lift animate-staggerFadeIn" style={{ animationDelay: '0.08s' }}>
              <p className="text-xs font-semibold uppercase text-blue-600 opacity-70">Cartera Total</p>
              <p className="text-2xl font-bold text-blue-700 mt-1 animate-countUp">{fmt(totalMonto)}</p>
            </div>
            <div className="rounded-xl border bg-green-50 border-green-200 p-4 hover-lift animate-staggerFadeIn" style={{ animationDelay: '0.16s' }}>
              <p className="text-xs font-semibold uppercase text-green-600 opacity-70">Total Cobrado</p>
              <p className="text-2xl font-bold text-green-700 mt-1 animate-countUp">{fmt(totalPagado)}</p>
            </div>
            <div className="rounded-xl border bg-orange-50 border-orange-200 p-4 hover-lift animate-staggerFadeIn" style={{ animationDelay: '0.24s' }}>
              <p className="text-xs font-semibold uppercase text-orange-600 opacity-70">% Cobrado</p>
              <p className="text-3xl font-bold text-orange-700 mt-1 animate-countUp">{porcentaje}%</p>
            </div>
          </div>

          {/* Tabla */}
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-700">Detalle de contratos</h2>
              <span className="text-sm text-gray-400">{ventasFiltradas.length} registros</span>

            </div>
            {ventasFiltradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 animate-fadeIn">
                <div className="w-20 h-20 rounded-2xl bg-gray-50 flex items-center justify-center mb-5">
                  <svg className="w-10 h-10 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-500">No hay contratos para esta seleccion</p>
                <p className="text-xs text-gray-400 mt-1.5">Intenta ajustar los filtros o crear una nueva venta</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="crm-table">
                  <thead>
                    <tr>
                      <th className="text-left">N° Contrato</th>
                      <th className="text-left">Cliente</th>
                      <th className="text-left">Consultor</th>
                      <th className="text-left">Sala</th>
                      <th className="text-right">Total</th>
                      <th className="text-right">Pagado</th>
                      <th className="text-right">Saldo</th>
                      <th className="text-center">Estado</th>
                      <th className="text-center">Fecha</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventasPagina.map((v, i) => (
                      <tr key={v.id}
                        className="row-clickable"
                        onClick={() => navigate(`/ventas/${v.id}`)}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-teal-700 font-bold">{v.numero_contrato || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{v.nombres} {v.apellidos}</div>
                          {v.telefono && <div className="text-xs text-gray-400 font-mono">{v.telefono}</div>}
                          {v.segunda_venta && <span className="badge badge-purple">2da venta</span>}
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
