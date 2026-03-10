import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getComisiones, getComisionDetalle } from '../../api/comisiones'
import { getSalas } from '../../api/admin'

function fmt(v) {
  if (v === null || v === undefined) return '—'
  return `$${parseFloat(v).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function BadgeComision({ estado }) {
  if (estado === 'desbloqueada') {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
        Desbloqueada
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
      Bloqueada
    </span>
  )
}

export default function ComisionesPage() {
  const { usuario } = useAuth()

  const [datos, setDatos]           = useState([])
  const [salas, setSalas]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [mes, setMes]               = useState(new Date().toISOString().slice(0, 7))
  const [salaFiltro, setSalaFiltro] = useState(usuario?.sala_id || '')

  // Drawer de detalle
  const [mostrarDetalle, setMostrarDetalle]       = useState(false)
  const [detalleConsultor, setDetalleConsultor]   = useState(null) // { id, nombre }
  const [detalleData, setDetalleData]             = useState([])
  const [loadingDetalle, setLoadingDetalle]       = useState(false)
  const [errorDetalle, setErrorDetalle]           = useState('')

  const esAdmin = ['admin', 'director'].includes(usuario?.rol)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = { mes }
      if (salaFiltro) params.sala_id = salaFiltro
      const [dataComisiones, dataSalas] = await Promise.all([
        getComisiones(params),
        esAdmin ? getSalas() : Promise.resolve([]),
      ])
      setDatos(Array.isArray(dataComisiones) ? dataComisiones : [])
      setSalas(Array.isArray(dataSalas) ? dataSalas : [])
    } catch (err) {
      setError('Error al cargar comisiones: ' + (err.response?.data?.error || err.message))
    } finally {
      setLoading(false)
    }
  }, [mes, salaFiltro, esAdmin])

  useEffect(() => { cargar() }, [cargar])

  async function abrirDetalle(consultor) {
    setDetalleConsultor(consultor)
    setMostrarDetalle(true)
    setLoadingDetalle(true)
    setErrorDetalle('')
    setDetalleData([])
    try {
      const rows = await getComisionDetalle(consultor.id, { mes })
      setDetalleData(Array.isArray(rows) ? rows : [])
    } catch (err) {
      setErrorDetalle('Error al cargar detalle: ' + (err.response?.data?.error || err.message))
    } finally {
      setLoadingDetalle(false)
    }
  }

  function cerrarDetalle() {
    setMostrarDetalle(false)
    setDetalleConsultor(null)
    setDetalleData([])
    setErrorDetalle('')
  }

  // Stats calculados
  const totalConsultores    = datos.length
  const conDesbloqueadas    = datos.filter(d => parseInt(d.contratos_desbloqueados, 10) > 0).length
  const carteraTotal        = datos.reduce((s, d) => s + parseFloat(d.cartera_total || 0), 0)
  const totalALiquidar      = datos.reduce((s, d) => s + parseFloat(d.comision_calculada || 0), 0)

  // Totales del drawer
  const detalleCartera      = detalleData.reduce((s, c) => s + parseFloat(c.monto_total || 0), 0)
  const detalleCobrado      = detalleData.reduce((s, c) => s + parseFloat(c.total_cobrado || 0), 0)
  const detalleComision     = detalleData.reduce((s, c) => s + parseFloat(c.comision_por_contrato || 0), 0)

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Comisiones</h1>
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
          {esAdmin && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Sala</label>
              <select
                value={salaFiltro}
                onChange={e => setSalaFiltro(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Todas las salas</option>
                {salas.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
          )}
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
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 ml-4">×</button>
        </div>
      )}

      {loading ? <Spinner /> : (
        <>
          {/* 4 Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">Total Consultores</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{totalConsultores}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-600">Con Desbloqueadas</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{conDesbloqueadas}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Cartera Total</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{fmt(carteraTotal)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Total a Liquidar</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{fmt(totalALiquidar)}</p>
            </div>
          </div>

          {/* Tabla de consultores */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-700">Comisiones por consultor — {mes}</h2>
              <span className="text-sm text-gray-400">{datos.length} consultores</span>
            </div>
            {datos.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <div className="text-4xl mb-3">💰</div>
                <p className="font-medium">No hay datos de comisiones para este período</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Consultor</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Sala</th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Contratos</th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Desblq.</th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Cobrado</th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Comisión (10%)</th>
                      <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.map((d, i) => (
                      <tr
                        key={d.consultor_id}
                        className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                      >
                        <td className="py-3 px-4 font-medium text-gray-800">{d.consultor_nombre}</td>
                        <td className="py-3 px-4 text-gray-600 text-xs">{d.sala_nombre || '—'}</td>
                        <td className="py-3 px-4 text-right text-gray-700">{d.total_contratos}</td>
                        <td className="py-3 px-4 text-right">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            parseInt(d.contratos_desbloqueados, 10) > 0
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {d.contratos_desbloqueados}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-green-700 font-medium">{fmt(d.total_cobrado)}</td>
                        <td className="py-3 px-4 text-right font-bold text-teal-700">{fmt(d.comision_calculada)}</td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => abrirDetalle({ id: d.consultor_id, nombre: d.consultor_nombre })}
                            className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium"
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
          </div>
        </>
      )}

      {/* Drawer de detalle */}
      {mostrarDetalle && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={cerrarDetalle}
          />
          {/* Panel lateral */}
          <div className="fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col">
            {/* Header del drawer */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
              <div>
                <h2 className="text-lg font-bold text-gray-800">
                  {detalleConsultor?.nombre}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Contratos del período {mes}</p>
              </div>
              <button
                onClick={cerrarDetalle}
                className="text-gray-400 hover:text-gray-700 text-2xl font-bold leading-none"
              >
                ×
              </button>
            </div>

            {/* Contenido del drawer */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingDetalle ? (
                <Spinner />
              ) : errorDetalle ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  {errorDetalle}
                </div>
              ) : detalleData.length === 0 ? (
                <div className="text-center text-gray-400 py-16">
                  <div className="text-4xl mb-3">📄</div>
                  <p className="font-medium">No hay contratos activos para este período</p>
                </div>
              ) : (
                <>
                  {/* Resumen del drawer */}
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <p className="text-xs text-gray-500 uppercase font-semibold">Cartera</p>
                      <p className="text-base font-bold text-gray-800 mt-0.5">{fmt(detalleCartera)}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                      <p className="text-xs text-green-600 uppercase font-semibold">Cobrado</p>
                      <p className="text-base font-bold text-green-700 mt-0.5">{fmt(detalleCobrado)}</p>
                    </div>
                    <div className="bg-teal-50 rounded-lg p-3 border border-teal-100">
                      <p className="text-xs text-teal-600 uppercase font-semibold">Comisión</p>
                      <p className="text-base font-bold text-teal-700 mt-0.5">{fmt(detalleComision)}</p>
                    </div>
                  </div>

                  {/* Tabla de contratos */}
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">N° Contrato</th>
                          <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Cliente</th>
                          <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Total</th>
                          <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Cobrado</th>
                          <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">%</th>
                          <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Comisión</th>
                          <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalleData.map((c, i) => (
                          <tr
                            key={c.id}
                            className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                          >
                            <td className="py-3 px-4 font-mono text-xs text-teal-700 font-bold">
                              {c.numero_contrato || '—'}
                            </td>
                            <td className="py-3 px-4 text-gray-800 font-medium">
                              {c.nombres} {c.apellidos}
                            </td>
                            <td className="py-3 px-4 text-right text-gray-700">{fmt(c.monto_total)}</td>
                            <td className="py-3 px-4 text-right text-green-600">{fmt(c.total_cobrado)}</td>
                            <td className="py-3 px-4 text-right">
                              <span className={`font-semibold ${parseFloat(c.pct_pagado) >= 30 ? 'text-green-600' : 'text-orange-500'}`}>
                                {parseFloat(c.pct_pagado || 0).toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-teal-700">
                              {fmt(c.comision_por_contrato)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <BadgeComision estado={c.estado_comision} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
