import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getLiquidaciones, calcularMes, actualizarEstado, getDetalleLiquidacion, suspenderComision, reactivarComision } from '../../api/liquidaciones'
import { getSalas } from '../../api/admin'

// ─── Utilidades ──────────────────────────────────────────────────────────────

function fmt(v) {
  if (v === null || v === undefined) return '—'
  return `$${parseFloat(v).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function mesActual() {
  return new Date().toISOString().slice(0, 7)
}

// ─── Componentes auxiliares ──────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function BadgeEstado({ estado }) {
  const estilos = {
    pendiente: 'bg-yellow-100 text-yellow-800',
    aprobada:  'bg-blue-100 text-blue-800',
    rechazada: 'bg-red-100 text-red-800',
    pagada:    'bg-green-100 text-green-800',
  }
  const etiquetas = {
    pendiente: 'Pendiente',
    aprobada:  'Aprobada',
    rechazada: 'Rechazada',
    pagada:    'Pagada',
  }
  const clase = estilos[estado] || 'bg-gray-100 text-gray-700'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${clase}`}>
      {etiquetas[estado] || estado}
    </span>
  )
}

// ─── Menú de acciones por fila ───────────────────────────────────────────────

function MenuAcciones({ fila, onAccion }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)

  // Cerrar al hacer click fuera
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setAbierto(false)
      }
    }
    if (abierto) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto])

  const opciones = []
  if (fila.estado === 'pendiente') {
    opciones.push({ accion: 'aprobada',  label: 'Aprobar',   icono: '✅' })
    opciones.push({ accion: 'rechazada', label: 'Rechazar',  icono: '❌' })
  } else if (fila.estado === 'aprobada') {
    opciones.push({ accion: 'pagada',    label: 'Marcar como Pagada', icono: '💳' })
    opciones.push({ accion: 'rechazada', label: 'Rechazar',           icono: '❌' })
  } else if (fila.estado === 'rechazada') {
    opciones.push({ accion: 'aprobada',  label: 'Re-aprobar', icono: '✅' })
  }

  if (opciones.length === 0) {
    return <span className="text-xs text-gray-400">—</span>
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setAbierto(v => !v)}
        className="inline-flex items-center gap-1 border border-gray-300 text-gray-600 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
      >
        Accion <span className="text-xs">&#9660;</span>
      </button>
      {abierto && (
        <div className="absolute right-0 mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-30">
          {opciones.map(op => (
            <button
              key={op.accion}
              onClick={() => { setAbierto(false); onAccion(fila, op.accion) }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 first:rounded-t-lg last:rounded-b-lg"
            >
              <span>{op.icono}</span>
              {op.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Modal de confirmacion de accion ─────────────────────────────────────────

function ModalAccion({ modal, observacion, setObservacion, onConfirmar, onCancelar, guardando }) {
  if (!modal) return null

  const titulos = {
    aprobada:  'Aprobar liquidacion',
    rechazada: 'Rechazar liquidacion',
    pagada:    'Marcar como Pagada',
  }
  const colores = {
    aprobada:  'bg-blue-600 hover:bg-blue-700',
    rechazada: 'bg-red-600 hover:bg-red-700',
    pagada:    'bg-green-600 hover:bg-green-700',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancelar} />

      {/* Card */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-base font-bold text-gray-800 mb-1">
          {titulos[modal.accion] || modal.accion}
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Consultor: <span className="font-medium text-gray-700">{modal.fila.consultor_nombre}</span>
          &nbsp;&mdash;&nbsp;Mes: <span className="font-medium text-gray-700">{modal.fila.mes}</span>
        </p>

        <label className="block text-xs font-semibold text-gray-600 mb-1">
          Observacion <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <textarea
          rows={3}
          value={observacion}
          onChange={e => setObservacion(e.target.value)}
          placeholder="Ej. Revisado en reunion del 10/03/2026..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
        />

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancelar}
            disabled={guardando}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={guardando}
            className={`px-4 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50 ${colores[modal.accion] || 'bg-teal-600 hover:bg-teal-700'}`}
          >
            {guardando ? 'Guardando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal de detalle de liquidación (contratos + suspender/reactivar) ────────

function ModalDetalle({ liquidacionId, onClose, esAdmin, onActualizado }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const [suspModal, setSuspModal] = useState(null) // { contrato_id, numero_contrato }
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargarDetalle = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getDetalleLiquidacion(liquidacionId)
      setData(res)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }, [liquidacionId])

  useEffect(() => { cargarDetalle() }, [cargarDetalle])

  async function handleSuspender() {
    if (!suspModal) return
    setGuardando(true)
    try {
      await suspenderComision(liquidacionId, { contrato_id: suspModal.contrato_id, motivo })
      setSuspModal(null)
      setMotivo('')
      await cargarDetalle()
      if (onActualizado) onActualizado()
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function handleReactivar(contrato_id) {
    if (!window.confirm('Reactivar esta comision?')) return
    setGuardando(true)
    try {
      await reactivarComision(liquidacionId, { contrato_id })
      await cargarDetalle()
      if (onActualizado) onActualizado()
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setGuardando(false)
    }
  }

  const esPagada = data?.liquidacion?.estado === 'pagada'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-bold text-gray-800">
              Detalle de Liquidacion
            </h3>
            {data && (
              <p className="text-sm text-gray-500">
                {data.liquidacion.consultor_nombre} — {data.liquidacion.mes}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : data ? (
            <>
              {/* Resumen cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-teal-50 rounded-lg p-3 text-center">
                  <p className="text-xs font-semibold text-teal-600 uppercase">Comision Neta</p>
                  <p className="text-xl font-bold text-teal-800">{fmt(data.resumen.neto_comision)}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3 text-center">
                  <p className="text-xs font-semibold text-red-600 uppercase">Suspendido</p>
                  <p className="text-xl font-bold text-red-800">{fmt(data.resumen.total_suspendido)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs font-semibold text-gray-600 uppercase">Comision Bruta</p>
                  <p className="text-xl font-bold text-gray-800">{fmt(data.resumen.total_comision + data.resumen.total_suspendido)}</p>
                </div>
              </div>

              {/* Tabla de contratos */}
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase py-2.5 px-3">Contrato</th>
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase py-2.5 px-3">Cliente</th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase py-2.5 px-3">Monto</th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase py-2.5 px-3">Pagado</th>
                      <th className="text-center text-xs font-semibold text-gray-500 uppercase py-2.5 px-3">Desbloq.</th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase py-2.5 px-3">Comision</th>
                      <th className="text-center text-xs font-semibold text-gray-500 uppercase py-2.5 px-3">Estado</th>
                      {esAdmin && !esPagada && (
                        <th className="text-center text-xs font-semibold text-gray-500 uppercase py-2.5 px-3">Accion</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.contratos.map((c, i) => (
                      <tr
                        key={c.id}
                        className={`border-b border-gray-50 ${c.suspendido ? 'bg-red-50/40' : i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                      >
                        <td className={`py-2.5 px-3 font-medium ${c.suspendido ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                          {c.numero_contrato}
                        </td>
                        <td className={`py-2.5 px-3 ${c.suspendido ? 'line-through text-gray-400' : 'text-gray-600'}`}>
                          {c.nombres} {c.apellidos}
                        </td>
                        <td className={`py-2.5 px-3 text-right ${c.suspendido ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                          {fmt(c.monto_total)}
                        </td>
                        <td className={`py-2.5 px-3 text-right ${c.suspendido ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                          {fmt(c.total_pagado)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {c.desbloqueado ? (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-800">Si</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-500">No</span>
                          )}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-bold ${c.suspendido ? 'line-through text-gray-400' : 'text-teal-700'}`}>
                          {fmt(c.comision_individual)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {c.suspendido ? (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-800">
                              Suspendida
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800">
                              Activa
                            </span>
                          )}
                        </td>
                        {esAdmin && !esPagada && (
                          <td className="py-2.5 px-3 text-center">
                            {c.suspendido ? (
                              <button
                                onClick={() => handleReactivar(c.id)}
                                disabled={guardando}
                                className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                              >
                                Reactivar
                              </button>
                            ) : c.desbloqueado && c.comision_individual > 0 ? (
                              <button
                                onClick={() => { setSuspModal({ contrato_id: c.id, numero_contrato: c.numero_contrato }); setMotivo('') }}
                                disabled={guardando}
                                className="px-3 py-1 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                              >
                                Suspender
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                    {data.contratos.length === 0 && (
                      <tr>
                        <td colSpan={esAdmin && !esPagada ? 8 : 7} className="py-8 text-center text-gray-400">
                          No hay contratos para este consultor en el periodo
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Info de suspensiones */}
              {data.contratos.filter(c => c.suspendido).length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  <strong>Nota:</strong> Las comisiones suspendidas no se incluyen en el neto a pagar. Si el cliente formaliza, se pueden reactivar en el siguiente corte.
                  {data.contratos.filter(c => c.suspendido).map(c => (
                    <div key={c.id} className="mt-1 text-xs text-amber-700">
                      <strong>{c.numero_contrato}:</strong> {c.suspension?.motivo || 'Sin motivo registrado'} — por {c.suspension?.suspendido_por_nombre || '—'}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 flex justify-end shrink-0">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
            Cerrar
          </button>
        </div>

        {/* Sub-modal: motivo de suspensión */}
        {suspModal && (
          <div className="absolute inset-0 z-60 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30 rounded-xl" onClick={() => setSuspModal(null)} />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
              <h4 className="text-base font-bold text-gray-800 mb-1">Suspender comision</h4>
              <p className="text-sm text-gray-500 mb-3">
                Contrato: <span className="font-medium text-gray-700">{suspModal.numero_contrato}</span>
              </p>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Motivo <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <textarea
                rows={3}
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Ej. Cliente en proceso de retracto, pendiente formalizar..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setSuspModal(null)}
                  disabled={guardando}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSuspender}
                  disabled={guardando}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {guardando ? 'Guardando...' : 'Confirmar suspension'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Pagina principal ─────────────────────────────────────────────────────────

export default function LiquidacionesPage() {
  const { usuario } = useAuth()
  const esAdmin = ['admin', 'director'].includes(usuario?.rol)

  const [mes, setMes]               = useState(mesActual)
  const [salaId, setSalaId]         = useState('')
  const [salas, setSalas]           = useState([])
  const [datos, setDatos]           = useState([])
  const [loading, setLoading]       = useState(false)
  const [calculando, setCalculando] = useState(false)
  const [error, setError]           = useState('')
  const [exito, setExito]           = useState('')

  // Modal de accion
  const [modal, setModal]           = useState(null)  // { fila, accion } | null
  const [observacion, setObservacion] = useState('')
  const [guardando, setGuardando]   = useState(false)

  // Modal de detalle de liquidación
  const [detalleId, setDetalleId]   = useState(null)

  // Cargar salas (solo admin/director)
  useEffect(() => {
    if (!esAdmin) return
    getSalas()
      .then(data => setSalas(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [esAdmin])

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = { mes }
      if (salaId) params.sala_id = salaId
      // Consultor: filtrar sus propias liquidaciones
      if (!esAdmin && usuario?.id) params.consultor_id = usuario.id
      const data = await getLiquidaciones(params)
      setDatos(Array.isArray(data) ? data : [])
    } catch (err) {
      setError('Error al cargar liquidaciones: ' + (err.response?.data?.error || err.message))
    } finally {
      setLoading(false)
    }
  }, [mes, salaId, esAdmin, usuario])

  useEffect(() => { cargar() }, [cargar])

  // ── Calcular mes ────────────────────────────────────────────────────────────
  async function handleCalcular() {
    const confirmado = window.confirm(
      `¿Calcular liquidaciones para ${mes}?\n\nEsto creara o actualizara las liquidaciones pendientes del mes.`
    )
    if (!confirmado) return

    setCalculando(true)
    setError('')
    setExito('')
    try {
      const payload = { mes }
      if (salaId) payload.sala_id = parseInt(salaId, 10)
      const resultado = await calcularMes(payload)
      const cantidad = Array.isArray(resultado) ? resultado.length : 0
      setExito(`Calculo completado: ${cantidad} liquidacion(es) creada(s)/actualizada(s).`)
      await cargar()
    } catch (err) {
      setError('Error al calcular: ' + (err.response?.data?.error || err.message))
    } finally {
      setCalculando(false)
    }
  }

  // ── Abrir modal de accion ───────────────────────────────────────────────────
  function abrirModal(fila, accion) {
    setObservacion('')
    setModal({ fila, accion })
  }

  function cerrarModal() {
    setModal(null)
    setObservacion('')
  }

  // ── Confirmar accion ────────────────────────────────────────────────────────
  async function confirmarAccion() {
    if (!modal) return
    setGuardando(true)
    setError('')
    setExito('')
    try {
      await actualizarEstado(modal.fila.id, { estado: modal.accion, observacion })
      setExito(`Liquidacion de ${modal.fila.consultor_nombre} actualizada a "${modal.accion}".`)
      cerrarModal()
      await cargar()
    } catch (err) {
      setError('Error al actualizar: ' + (err.response?.data?.error || err.message))
      cerrarModal()
    } finally {
      setGuardando(false)
    }
  }

  // ── Cards de resumen ────────────────────────────────────────────────────────
  const totalLiquidar = datos.reduce((s, d) => s + parseFloat(d.monto_comision || 0), 0)
  const countPendiente = datos.filter(d => d.estado === 'pendiente').length
  const countAprobada  = datos.filter(d => d.estado === 'aprobada').length
  const countPagada    = datos.filter(d => d.estado === 'pagada').length

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Liquidaciones de Comisiones</h1>

        <div className="flex flex-wrap items-end gap-3">
          {/* Selector de mes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Mes</label>
            <input
              type="month"
              value={mes}
              onChange={e => setMes(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Selector de sala (solo admin) */}
          {esAdmin && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Sala</label>
              <select
                value={salaId}
                onChange={e => setSalaId(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Todas las salas</option>
                {salas.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
          )}

          {/* Boton Cargar */}
          <button
            onClick={cargar}
            disabled={loading}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? 'Cargando...' : 'Cargar'}
          </button>

          {/* Boton Calcular (solo admin/director) */}
          {esAdmin && (
            <button
              onClick={handleCalcular}
              disabled={calculando || loading}
              className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {calculando ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                  Calculando...
                </>
              ) : (
                'Calcular mes'
              )}
            </button>
          )}
        </div>
      </div>

      {/* Mensajes de error / exito */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex justify-between items-start">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 ml-4 text-lg leading-none">&times;</button>
        </div>
      )}
      {exito && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex justify-between items-start">
          <span>{exito}</span>
          <button onClick={() => setExito('')} className="text-green-400 hover:text-green-600 ml-4 text-lg leading-none">&times;</button>
        </div>
      )}

      {/* Cards de resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-600">Total a Liquidar</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{fmt(totalLiquidar)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-yellow-600">Pendientes</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{countPendiente}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Aprobadas</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{countAprobada}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-600">Pagadas</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{countPagada}</p>
        </div>
      </div>

      {/* Tabla de liquidaciones */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-700">
            Liquidaciones — {mes}
          </h2>
          <span className="text-sm text-gray-400">{datos.length} registros</span>
        </div>

        {loading ? (
          <Spinner />
        ) : datos.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <div className="text-4xl mb-3">💰</div>
            <p className="font-medium text-gray-500">No hay liquidaciones para este periodo</p>
            {esAdmin && (
              <p className="text-sm mt-1 text-gray-400">
                Usa el boton <strong>Calcular mes</strong> para generar las liquidaciones del mes.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Consultor</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Sala</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Contratos</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Comision</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Estado</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Aprobado por</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Fecha Pago</th>
                  {esAdmin && (
                    <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Accion</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {datos.map((d, i) => (
                  <tr
                    key={d.id}
                    className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                  >
                    <td className="py-3 px-4 font-medium text-gray-800">
                      <button
                        onClick={() => setDetalleId(d.id)}
                        className="text-teal-700 hover:text-teal-900 hover:underline text-left"
                        title="Ver detalle de contratos"
                      >
                        {d.consultor_nombre}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{d.sala_nombre || '—'}</td>
                    <td className="py-3 px-4 text-right text-gray-700">{d.contratos_count ?? '—'}</td>
                    <td className="py-3 px-4 text-right font-bold text-teal-700">{fmt(d.monto_comision)}</td>
                    <td className="py-3 px-4 text-center">
                      <BadgeEstado estado={d.estado} />
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">
                      {d.aprobado_por_nombre || '—'}
                      {d.fecha_aprobacion && (
                        <div className="text-gray-400 text-xs mt-0.5">
                          {new Date(d.fecha_aprobacion).toLocaleDateString('es-EC')}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">
                      {d.fecha_pago
                        ? new Date(d.fecha_pago).toLocaleDateString('es-EC')
                        : '—'}
                    </td>
                    {esAdmin && (
                      <td className="py-3 px-4 text-center">
                        <MenuAcciones fila={d} onAccion={abrirModal} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de confirmacion de accion */}
      <ModalAccion
        modal={modal}
        observacion={observacion}
        setObservacion={setObservacion}
        onConfirmar={confirmarAccion}
        onCancelar={cerrarModal}
        guardando={guardando}
      />

      {/* Modal de detalle de liquidación (contratos + suspender/reactivar) */}
      {detalleId && (
        <ModalDetalle
          liquidacionId={detalleId}
          onClose={() => setDetalleId(null)}
          esAdmin={esAdmin}
          onActualizado={cargar}
        />
      )}
    </div>
  )
}
