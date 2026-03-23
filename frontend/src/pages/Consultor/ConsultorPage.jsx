import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getMisClientes, getResumen, getComisiones } from '../../api/consultor'

function fmt(val) {
  if (!val && val !== 0) return '$0.00'
  return `$${Number(val).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

const ESTADO_CLS = {
  activo:     'bg-green-100 text-green-700',
  cancelado:  'bg-red-100 text-red-700',
  suspendido: 'bg-yellow-100 text-yellow-700',
  completado: 'bg-blue-100 text-blue-700',
  inactivo:   'bg-gray-100 text-gray-500',
}

const COMISION_CLS = {
  desbloqueada: 'bg-green-100 text-green-700',
  bloqueada:    'bg-red-100 text-red-700',
}

export default function ConsultorPage() {
  const { usuario } = useAuth()
  const navigate = useNavigate()

  const [clientes, setClientes]       = useState([])
  const [comisiones, setComisiones]    = useState([])
  const [resumen, setResumen]          = useState(null)
  const [loading, setLoading]          = useState(true)
  const [error, setError]              = useState('')

  // Filtros
  const [mes, setMes]                  = useState(new Date().toISOString().slice(0, 7))
  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [tab, setTab]                  = useState('clientes') // clientes | comisiones

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = { mes }
      if (estadoFiltro) params.estado = estadoFiltro

      const [dataClientes, dataResumen, dataComisiones] = await Promise.all([
        getMisClientes(params),
        getResumen({ mes }),
        getComisiones({ mes }),
      ])

      setClientes(Array.isArray(dataClientes) ? dataClientes : [])
      setResumen(dataResumen || {})
      setComisiones(Array.isArray(dataComisiones) ? dataComisiones : [])
    } catch (err) {
      setError('Error al cargar datos: ' + (err.response?.data?.error || err.message))
    } finally {
      setLoading(false)
    }
  }, [mes, estadoFiltro])

  useEffect(() => { cargar() }, [cargar])

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">

      {/* Header + Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Mi Panel de Consultor</h1>
          <p className="text-sm text-gray-400 mt-0.5">Bienvenido, {usuario?.nombre || 'Consultor'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Mes</label>
            <input
              type="month"
              value={mes}
              onChange={e => setMes(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
            <select
              value={estadoFiltro}
              onChange={e => setEstadoFiltro(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Todos</option>
              <option value="activo">Activo</option>
              <option value="cancelado">Cancelado</option>
              <option value="suspendido">Suspendido</option>
              <option value="completado">Completado</option>
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
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex justify-between items-start">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 ml-4">&times;</button>
        </div>
      )}

      {loading ? <Spinner /> : (
        <>
          {/* 4 KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">Ventas del mes</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{resumen?.ventas_mes || 0}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Tours del mes</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{resumen?.tours_mes || 0}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Comisiones pendientes</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">
                {resumen?.comisiones_pendientes || 0}
                <span className="text-sm font-normal text-gray-400 ml-1">({fmt(resumen?.monto_comisiones_pendientes)})</span>
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-600">Comisiones aprobadas</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">
                {resumen?.comisiones_aprobadas || 0}
                <span className="text-sm font-normal text-gray-400 ml-1">({fmt(resumen?.monto_comisiones_aprobadas)})</span>
              </p>
            </div>
          </div>

          {/* Resumen financiero */}
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-5">
            <h3 className="font-semibold text-teal-800 mb-2">Resumen del mes</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-teal-600">Monto vendido</p>
                <p className="font-bold text-teal-800 text-lg">{fmt(resumen?.monto_vendido_mes)}</p>
              </div>
              <div>
                <p className="text-teal-600">Total cobrado</p>
                <p className="font-bold text-green-700 text-lg">{fmt(resumen?.total_cobrado_mes)}</p>
              </div>
              <div>
                <p className="text-teal-600">Comisiones ganadas</p>
                <p className="font-bold text-orange-600 text-lg">{fmt(resumen?.monto_comisiones_aprobadas)}</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            <button
              onClick={() => setTab('clientes')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === 'clientes'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Mis Clientes ({clientes.length})
            </button>
            <button
              onClick={() => setTab('comisiones')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === 'comisiones'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Mis Comisiones ({comisiones.length})
            </button>
          </div>

          {/* Tabla Mis Clientes */}
          {tab === 'clientes' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-700">Mis Clientes</h2>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">
                  {clientes.length} contratos
                </span>
              </div>

              {clientes.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <div className="text-4xl mb-3">📊</div>
                  <p className="font-medium">No tienes contratos en este periodo</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Cliente</th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Contrato</th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Fecha</th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Monto</th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Pagado</th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Saldo</th>
                        <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Estado</th>
                        <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientes.map((c, i) => (
                        <tr
                          key={c.id}
                          className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                        >
                          <td className="py-3 px-4">
                            <div className="font-medium text-gray-800">{c.nombres} {c.apellidos}</div>
                            <div className="text-xs text-gray-400">{c.telefono || '---'}</div>
                          </td>
                          <td className="py-3 px-4 font-mono text-xs text-teal-700 font-bold">{c.numero_contrato}</td>
                          <td className="py-3 px-4 text-sm text-gray-500">
                            {c.fecha_contrato ? new Date(c.fecha_contrato).toLocaleDateString('es-EC') : '---'}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-gray-800">{fmt(c.monto_total)}</td>
                          <td className="py-3 px-4 text-right text-green-700 font-medium">{fmt(c.total_pagado)}</td>
                          <td className="py-3 px-4 text-right text-red-600 font-medium">{fmt(c.saldo)}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${ESTADO_CLS[c.estado] || 'bg-gray-100 text-gray-600'}`}>
                              {c.estado}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center gap-2 justify-center">
                              <button
                                onClick={() => navigate(`/ventas/${c.id}`)}
                                className="text-teal-600 hover:text-teal-800 text-xs font-medium"
                              >
                                Ver
                              </button>
                              {c.telefono && (
                                <a
                                  href={`https://wa.me/593${c.telefono?.replace(/^0/, '').replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-green-500 hover:text-green-700 text-xs"
                                  title="WhatsApp"
                                >
                                  WA
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tabla Mis Comisiones */}
          {tab === 'comisiones' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-700">Mis Comisiones -- {mes}</h2>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">
                  {comisiones.length} contratos
                </span>
              </div>

              {comisiones.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <div className="text-4xl mb-3">💰</div>
                  <p className="font-medium">No hay comisiones para este periodo</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Tipo</th>
                        <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Referencia</th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Monto contrato</th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Cobrado</th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">% Pagado</th>
                        <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Comision ({comisiones[0]?.pct_comision || 10}%)</th>
                        <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Periodo</th>
                        <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comisiones.map((c, i) => (
                        <tr
                          key={c.id}
                          className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                        >
                          <td className="py-3 px-4 text-gray-700 font-medium text-xs">{c.tipo_comision}</td>
                          <td className="py-3 px-4">
                            <div className="font-mono text-xs text-teal-700 font-bold">{c.numero_contrato}</div>
                            <div className="text-xs text-gray-400">{c.nombres} {c.apellidos}</div>
                          </td>
                          <td className="py-3 px-4 text-right text-gray-700">{fmt(c.monto_total)}</td>
                          <td className="py-3 px-4 text-right text-green-600 font-medium">{fmt(c.total_cobrado)}</td>
                          <td className="py-3 px-4 text-right">
                            <span className={`font-semibold ${parseFloat(c.pct_pagado) >= (c.pct_desbloqueo || 30) ? 'text-green-600' : 'text-orange-500'}`}>
                              {parseFloat(c.pct_pagado || 0).toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-teal-700">{fmt(c.monto_comision)}</td>
                          <td className="py-3 px-4 text-center text-xs text-gray-500">{c.periodo}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${COMISION_CLS[c.estado_comision] || 'bg-gray-100 text-gray-500'}`}>
                              {c.estado_comision === 'desbloqueada' ? 'Desbloqueada' : 'Bloqueada'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t border-gray-200">
                      <tr>
                        <td colSpan={5} className="py-3 px-4 text-right font-semibold text-gray-700 text-sm">
                          Total comisiones:
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-teal-700 text-sm">
                          {fmt(comisiones.reduce((s, c) => s + parseFloat(c.monto_comision || 0), 0))}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
