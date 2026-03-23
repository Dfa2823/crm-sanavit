import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  getTickets, createTicket, updateTicket, getSACStats,
  getCalidad, activarContrato,
  getFidelizacion, agendarRevisita,
} from '../../api/sac'
import { apiPersonas } from '../../api/personas'
import client from '../../api/client'

// ─── Configuraciones de badges ────────────────────────────
const TIPO_CONFIG = {
  queja:        { label: 'Queja',        cls: 'bg-red-100 text-red-700' },
  reclamo:      { label: 'Reclamo',      cls: 'bg-orange-100 text-orange-700' },
  peticion:     { label: 'Peticion',     cls: 'bg-blue-100 text-blue-700' },
  felicitacion: { label: 'Felicitacion', cls: 'bg-green-100 text-green-700' },
}

const PRIORIDAD_CONFIG = {
  urgente: { label: 'Urgente', cls: 'bg-red-100 text-red-700 font-semibold' },
  alta:    { label: 'Alta',    cls: 'bg-orange-100 text-orange-700' },
  normal:  { label: 'Normal',  cls: 'bg-gray-100 text-gray-600' },
  baja:    { label: 'Baja',    cls: 'bg-green-50 text-green-600' },
}

const ESTADO_CONFIG = {
  abierto:    { label: 'Abierto',     cls: 'bg-yellow-100 text-yellow-700' },
  en_proceso: { label: 'En Proceso',  cls: 'bg-blue-100 text-blue-700' },
  resuelto:   { label: 'Resuelto',    cls: 'bg-green-100 text-green-700' },
  cerrado:    { label: 'Cerrado',     cls: 'bg-gray-100 text-gray-500' },
}

const CATEGORIA_LABELS = {
  facturacion: 'Facturacion',
  servicio:    'Servicio',
  atencion:    'Atencion',
  producto:    'Producto',
  otro:        'Otro',
}

// ─── Componentes utilitarios ─────────────────────────────
function Badge({ config, value }) {
  const cfg = config[value] || { label: value || '--', cls: 'bg-gray-100 text-gray-500' }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function fmtFecha(val) {
  if (!val) return '--'
  return new Date(val).toLocaleDateString('es-EC', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtFechaCorta(val) {
  if (!val) return '--'
  return new Date(val).toLocaleDateString('es-EC', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  })
}

// ─── Modal Generico ──────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>
          <div className="px-6 py-5">{children}</div>
        </div>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// TAB 1 — CONTROL DE CALIDAD
// ═══════════════════════════════════════════════════════════
function TabControlCalidad() {
  const [contratos, setContratos] = useState([])
  const [loading, setLoading]     = useState(true)
  const [modalData, setModalData] = useState(null)  // contrato seleccionado para activar
  const [observacion, setObservacion] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    getCalidad()
      .then(data => setContratos(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleActivar = async () => {
    if (!modalData) return
    setGuardando(true)
    try {
      await activarContrato(modalData.id, { observacion: observacion.trim() || 'Venta activada correctamente' })
      setContratos(prev => prev.filter(c => c.id !== modalData.id))
      setModalData(null)
      setObservacion('')
    } catch (err) {
      console.error(err)
    } finally {
      setGuardando(false)
    }
  }

  if (loading) return <Spinner />
  if (!contratos.length) {
    return (
      <div className="p-12 text-center text-gray-400">
        <div className="text-4xl mb-3">&#10003;</div>
        <p className="font-medium">No hay ventas pendientes de activar</p>
        <p className="text-sm mt-1">Todas las ventas de los ultimos 15 dias ya fueron verificadas</p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="crm-table">
          <thead>
            <tr>
              <th className="text-left">Cliente</th>
              <th className="text-left">Telefono</th>
              <th className="text-left">Contrato #</th>
              <th className="text-left">Fecha Venta</th>
              <th className="text-center">Dias desde venta</th>
              <th className="text-center">Accion</th>
            </tr>
          </thead>
          <tbody>
            {contratos.map((c, i) => (
              <tr key={c.id} className={`border-b border-gray-50 hover:bg-teal-50/30 ${i % 2 ? 'bg-gray-50/30' : ''}`}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-800">{c.nombres} {c.apellidos}</div>
                </td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{c.telefono || '--'}</td>
                <td className="px-4 py-3 font-mono text-xs text-teal-700 font-bold">{c.numero_contrato}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{fmtFechaCorta(c.fecha_contrato)}</td>
                <td className="px-4 py-3 text-center">
                  <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                    {c.dias_desde_venta}d
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => { setModalData(c); setObservacion('') }}
                    className="bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 text-xs font-medium"
                  >
                    Activar Venta
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de activacion */}
      {modalData && (
        <Modal title="Activar Venta" onClose={() => setModalData(null)}>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-medium text-gray-800">{modalData.nombres} {modalData.apellidos}</p>
              <p className="text-xs text-gray-500 font-mono mt-1">Contrato: {modalData.numero_contrato}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Observacion</label>
              <textarea
                value={observacion}
                onChange={e => setObservacion(e.target.value)}
                rows={3}
                placeholder="Observacion del control de calidad..."
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setModalData(null)}
                className="flex-1 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleActivar}
                disabled={guardando}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
              >
                {guardando ? 'Activando...' : 'Confirmar Activacion'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// TAB 2 — PQR
// ═══════════════════════════════════════════════════════════
function DrawerNuevoTicket({ onClose, onCreated, userSalaId }) {
  const [telefono, setTelefono]           = useState('')
  const [buscando, setBuscando]           = useState(false)
  const [persona, setPersona]             = useState(null)
  const [sugerencias, setSugerencias]     = useState([])
  const [mostrarSug, setMostrarSug]       = useState(false)
  const [nuevaNombres, setNuevaNombres]   = useState('')
  const [nuevaApellidos, setNuevaApellidos] = useState('')
  const [nuevaTelefono, setNuevaTelefono] = useState('')
  const [contratos, setContratos]         = useState([])
  const [contratoId, setContratoId]       = useState('')
  const [tipo, setTipo]         = useState('queja')
  const [categoria, setCategoria] = useState('otro')
  const [prioridad, setPrioridad] = useState('normal')
  const [descripcion, setDescripcion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState('')
  const debounceRef = useRef(null)

  const handleTelefono = (val) => {
    setTelefono(val)
    setPersona(null)
    setSugerencias([])
    setContratos([])
    setContratoId('')
    clearTimeout(debounceRef.current)
    if (val.length < 3) { setMostrarSug(false); return }
    debounceRef.current = setTimeout(async () => {
      setBuscando(true)
      try {
        const data = await apiPersonas.buscar(val)
        setSugerencias(Array.isArray(data) ? data : [])
        setMostrarSug(true)
      } catch {
        setSugerencias([])
      } finally {
        setBuscando(false)
      }
    }, 500)
  }

  const seleccionarPersona = async (p) => {
    setPersona(p)
    setTelefono(`${p.nombres} ${p.apellidos} -- ${p.telefono || ''}`)
    setMostrarSug(false)
    try {
      const data = await client.get('/api/ventas', { params: { persona_id: p.id } }).then(r => r.data)
      setContratos(Array.isArray(data) ? data : [])
    } catch {
      setContratos([])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!descripcion.trim()) { setError('La descripcion es requerida'); return }
    let personaId = persona?.id
    if (!personaId) {
      if (!nuevaTelefono.trim() && !telefono.trim()) {
        setError('Ingresa un telefono o selecciona un cliente')
        return
      }
      try {
        const nueva = await apiPersonas.crear({
          nombres:   nuevaNombres || 'Sin nombre',
          apellidos: nuevaApellidos || '',
          telefono:  nuevaTelefono || telefono,
        })
        personaId = nueva.id
      } catch (err) {
        setError('Error al crear cliente: ' + (err.response?.data?.error || err.message))
        return
      }
    }
    setGuardando(true)
    try {
      const payload = {
        persona_id:  personaId,
        contrato_id: contratoId || undefined,
        sala_id:     userSalaId || undefined,
        tipo, categoria, prioridad,
        descripcion: descripcion.trim(),
      }
      const ticket = await createTicket(payload)
      onCreated(ticket)
      onClose()
    } catch (err) {
      setError('Error al crear ticket: ' + (err.response?.data?.error || err.message))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Nuevo Ticket SAC/PQR</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Buscar cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar cliente por telefono o nombre</label>
            <div className="relative">
              <input
                type="text" value={telefono} onChange={e => handleTelefono(e.target.value)}
                placeholder="Ej: 0999123456"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              {buscando && (
                <div className="absolute right-3 top-2.5">
                  <div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {mostrarSug && sugerencias.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {sugerencias.map(p => (
                    <button key={p.id} type="button" onClick={() => seleccionarPersona(p)}
                      className="w-full text-left px-4 py-2.5 hover:bg-teal-50 text-sm border-b border-gray-50 last:border-0">
                      <span className="font-medium text-gray-800">{p.nombres} {p.apellidos}</span>
                      <span className="text-gray-400 ml-2 font-mono text-xs">{p.telefono}</span>
                    </button>
                  ))}
                </div>
              )}
              {mostrarSug && sugerencias.length === 0 && !buscando && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm text-gray-500">
                  No encontrado -- completa los datos para crear cliente nuevo
                </div>
              )}
            </div>
          </div>

          {/* Nuevo cliente */}
          {!persona && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide">Nuevo cliente</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Nombres</label>
                  <input type="text" value={nuevaNombres} onChange={e => setNuevaNombres(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Apellidos</label>
                  <input type="text" value={nuevaApellidos} onChange={e => setNuevaApellidos(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Telefono</label>
                <input type="text" value={nuevaTelefono} onChange={e => setNuevaTelefono(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
            </div>
          )}

          {/* Cliente encontrado */}
          {persona && (
            <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-teal-800 text-sm">{persona.nombres} {persona.apellidos}</p>
                <p className="text-xs text-teal-600 font-mono">{persona.telefono}</p>
              </div>
              <button type="button" onClick={() => { setPersona(null); setTelefono(''); setContratos([]); setContratoId('') }}
                className="text-teal-400 hover:text-teal-600 text-sm">Cambiar</button>
            </div>
          )}

          {/* Contrato */}
          {contratos.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contrato (opcional)</label>
              <select value={contratoId} onChange={e => setContratoId(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="">Sin contrato</option>
                {contratos.map(c => (
                  <option key={c.id} value={c.id}>{c.numero_contrato} -- {c.tipo_plan} -- {c.estado}</option>
                ))}
              </select>
            </div>
          )}

          {/* Tipo y Categoria */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="queja">Queja</option>
                <option value="reclamo">Reclamo</option>
                <option value="peticion">Peticion</option>
                <option value="felicitacion">Felicitacion</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
              <select value={categoria} onChange={e => setCategoria(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="facturacion">Facturacion</option>
                <option value="servicio">Servicio</option>
                <option value="atencion">Atencion</option>
                <option value="producto">Producto</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>

          {/* Prioridad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
            <select value={prioridad} onChange={e => setPrioridad(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="baja">Baja</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>

          {/* Descripcion */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripcion <span className="text-red-500">*</span>
            </label>
            <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={5}
              placeholder="Describe detalladamente el motivo del ticket..."
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              required />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex justify-between">
              {error}
              <button type="button" onClick={() => setError('')} className="text-red-400 hover:text-red-600 ml-2">x</button>
            </div>
          )}
        </form>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={guardando}
            className="flex-1 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
            {guardando ? 'Guardando...' : 'Guardar Ticket'}
          </button>
        </div>
      </div>
    </>
  )
}

function DrawerVerTicket({ ticket, onClose, onUpdated, usuario, usuariosList }) {
  const [estado, setEstado]       = useState(ticket.estado || 'abierto')
  const [prioridad, setPrioridad] = useState(ticket.prioridad || 'normal')
  const [asignadoA, setAsignadoA] = useState(ticket.asignado_a || '')
  const [resolucion, setResolucion] = useState(ticket.resolucion || '')
  const [categoria, setCategoria] = useState(ticket.categoria || 'otro')
  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState(false)

  const puedeAsignar = ['admin', 'director', 'sac'].includes(usuario?.rol)
  const mostrarResolucion = estado === 'resuelto' || estado === 'cerrado'

  const handleGuardar = async () => {
    setError(''); setSuccess(false)
    setGuardando(true)
    try {
      const payload = { estado, prioridad, categoria }
      if (puedeAsignar) payload.asignado_a = asignadoA || null
      if (mostrarResolucion && resolucion.trim()) payload.resolucion = resolucion.trim()
      const updated = await updateTicket(ticket.id, payload)
      setSuccess(true)
      onUpdated(updated)
      setTimeout(() => setSuccess(false), 2000)
    } catch (err) {
      setError('Error: ' + (err.response?.data?.error || err.message))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">{ticket.numero_ticket}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{fmtFecha(ticket.fecha_apertura)}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Info del cliente */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
            <p className="text-xs font-semibold uppercase text-gray-400 tracking-wide">Cliente</p>
            <p className="font-semibold text-gray-800">{ticket.persona_nombres} {ticket.persona_apellidos}</p>
            {ticket.persona_telefono && <p className="text-sm text-gray-500 font-mono">{ticket.persona_telefono}</p>}
            {ticket.numero_contrato && <p className="text-sm text-teal-600 font-mono">Contrato: {ticket.numero_contrato}</p>}
            {ticket.sala_nombre && <p className="text-sm text-gray-500">Sala: {ticket.sala_nombre}</p>}
          </div>

          {/* Badges */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">Tipo</p>
              <Badge config={TIPO_CONFIG} value={ticket.tipo} />
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">Estado actual</p>
              <Badge config={ESTADO_CONFIG} value={ticket.estado} />
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">Creado por</p>
              <p className="text-xs text-gray-600">{ticket.creado_por_nombre || '--'}</p>
            </div>
          </div>

          {/* Descripcion */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Descripcion</p>
            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-4 py-3 whitespace-pre-wrap">{ticket.descripcion}</p>
          </div>

          <hr className="border-gray-100" />

          {/* Campos editables */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <select value={estado} onChange={e => setEstado(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="abierto">Abierto</option>
                <option value="en_proceso">En Proceso</option>
                <option value="resuelto">Resuelto</option>
                <option value="cerrado">Cerrado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
              <select value={prioridad} onChange={e => setPrioridad(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="baja">Baja</option>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select value={categoria} onChange={e => setCategoria(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="facturacion">Facturacion</option>
              <option value="servicio">Servicio</option>
              <option value="atencion">Atencion</option>
              <option value="producto">Producto</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          {puedeAsignar && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asignado a</label>
              <select value={asignadoA} onChange={e => setAsignadoA(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="">Sin asignar</option>
                {usuariosList.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
            </div>
          )}

          {mostrarResolucion && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Resolucion</label>
              <textarea value={resolucion} onChange={e => setResolucion(e.target.value)} rows={4}
                placeholder="Describe como se resolvio este caso..."
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
            </div>
          )}

          {ticket.resolucion && !mostrarResolucion && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Resolucion</p>
              <p className="text-sm text-gray-700 bg-green-50 rounded-lg px-4 py-3 whitespace-pre-wrap border border-green-100">{ticket.resolucion}</p>
              {ticket.fecha_cierre && <p className="text-xs text-gray-400 mt-1">Cerrado: {fmtFecha(ticket.fecha_cierre)}</p>}
            </div>
          )}

          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
          {success && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">Cambios guardados correctamente</div>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cerrar</button>
          <button onClick={handleGuardar} disabled={guardando}
            className="flex-1 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
            {guardando ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </>
  )
}

function TabPQR({ usuario }) {
  const [tickets, setTickets]     = useState([])
  const [stats, setStats]         = useState(null)
  const [usuarios, setUsuarios]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  const [filtroEstado, setFiltroEstado]       = useState('')
  const [filtroTipo, setFiltroTipo]           = useState('')
  const [filtroPrioridad, setFiltroPrioridad] = useState('')
  const [busqueda, setBusqueda]               = useState('')

  const [drawerNuevo, setDrawerNuevo]               = useState(false)
  const [ticketSeleccionado, setTicketSeleccionado]  = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = {}
      if (filtroEstado)    params.estado    = filtroEstado
      if (filtroTipo)      params.tipo      = filtroTipo
      if (filtroPrioridad) params.prioridad = filtroPrioridad
      if (busqueda.trim()) params.q         = busqueda.trim()

      const [dataTickets, dataStats] = await Promise.all([
        getTickets(params),
        getSACStats(),
      ])
      setTickets(Array.isArray(dataTickets) ? dataTickets : [])
      setStats(dataStats || null)
    } catch (err) {
      setError('Error al cargar tickets: ' + (err.response?.data?.error || err.message))
    } finally {
      setLoading(false)
    }
  }, [filtroEstado, filtroTipo, filtroPrioridad, busqueda])

  useEffect(() => {
    client.get('/api/usuarios').then(r => setUsuarios(Array.isArray(r.data) ? r.data : [])).catch(() => setUsuarios([]))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const handleTicketCreado = (ticket) => {
    setTickets(prev => [ticket, ...prev])
    cargar()
  }

  const handleTicketActualizado = (updated) => {
    setTickets(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t))
    cargar()
  }

  const totalTickets   = stats?.total      ?? tickets.length
  const totalAbiertos  = stats?.abiertos   ?? tickets.filter(t => t.estado === 'abierto').length
  const totalEnProceso = stats?.en_proceso ?? tickets.filter(t => t.estado === 'en_proceso').length
  const totalResueltos = stats?.resueltos  ?? tickets.filter(t => t.estado === 'resuelto').length

  return (
    <>
      {/* Boton nuevo ticket */}
      <div className="flex justify-end mb-4">
        <button onClick={() => setDrawerNuevo(true)}
          className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium flex items-center gap-2">
          + Nuevo Ticket
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase text-gray-400 tracking-wide">Total Tickets</p>
          <p className="text-3xl font-bold text-gray-700 mt-1">{totalTickets}</p>
        </div>
        <div className={`rounded-xl border shadow-sm p-5 ${totalAbiertos > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide ${totalAbiertos > 0 ? 'text-red-500' : 'text-gray-400'}`}>Abiertos</p>
          <p className={`text-3xl font-bold mt-1 ${totalAbiertos > 0 ? 'text-red-600' : 'text-gray-700'}`}>{totalAbiertos}</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl shadow-sm p-5">
          <p className="text-xs font-semibold uppercase text-yellow-600 tracking-wide">En Proceso</p>
          <p className="text-3xl font-bold text-yellow-700 mt-1">{totalEnProceso}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl shadow-sm p-5">
          <p className="text-xs font-semibold uppercase text-green-600 tracking-wide">Resueltos</p>
          <p className="text-3xl font-bold text-green-700 mt-1">{totalResueltos}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-end gap-4 mb-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="">Todos</option>
            <option value="abierto">Abierto</option>
            <option value="en_proceso">En Proceso</option>
            <option value="resuelto">Resuelto</option>
            <option value="cerrado">Cerrado</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="">Todos</option>
            <option value="queja">Queja</option>
            <option value="reclamo">Reclamo</option>
            <option value="peticion">Peticion</option>
            <option value="felicitacion">Felicitacion</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Prioridad</label>
          <select value={filtroPrioridad} onChange={e => setFiltroPrioridad(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="">Todas</option>
            <option value="urgente">Urgente</option>
            <option value="alta">Alta</option>
            <option value="normal">Normal</option>
            <option value="baja">Baja</option>
          </select>
        </div>
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-gray-500 mb-1">Buscar</label>
          <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && cargar()}
            placeholder="N ticket, cliente, telefono..."
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        <div>
          <button onClick={cargar}
            className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Buscar</button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex justify-between mb-4">
          {error}
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">x</button>
        </div>
      )}

      {/* Tabla */}
      {loading ? <Spinner /> : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">Tickets</h2>
            <span className="text-sm text-gray-400">{tickets.length} registros</span>
          </div>

          {tickets.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <p className="font-medium">No hay tickets para esta seleccion</p>
              <p className="text-sm mt-1">Cambia los filtros o crea un nuevo ticket</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th className="text-left">N Ticket</th>
                    <th className="text-left">Cliente</th>
                    <th className="text-left">Tipo</th>
                    <th className="text-left">Categoria</th>
                    <th className="text-left">Prioridad</th>
                    <th className="text-left">Estado</th>
                    <th className="text-left">Asignado</th>
                    <th className="text-left">Fecha</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t, i) => (
                    <tr key={t.id} onClick={() => setTicketSeleccionado(t)}
                      className={`border-b border-gray-50 hover:bg-teal-50/30 cursor-pointer transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                      <td className="px-4 py-3 font-mono text-xs text-teal-700 font-bold whitespace-nowrap">{t.numero_ticket || '--'}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{t.persona_nombres} {t.persona_apellidos}</div>
                        {t.persona_telefono && <div className="text-xs text-gray-400 font-mono">{t.persona_telefono}</div>}
                      </td>
                      <td className="px-4 py-3"><Badge config={TIPO_CONFIG} value={t.tipo} /></td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{CATEGORIA_LABELS[t.categoria] || t.categoria || '--'}</td>
                      <td className="px-4 py-3"><Badge config={PRIORIDAD_CONFIG} value={t.prioridad} /></td>
                      <td className="px-4 py-3"><Badge config={ESTADO_CONFIG} value={t.estado} /></td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{t.asignado_nombre || <span className="text-gray-300 italic">Sin asignar</span>}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{fmtFechaCorta(t.fecha_apertura)}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={e => { e.stopPropagation(); setTicketSeleccionado(t) }}
                          className="text-teal-600 hover:text-teal-800 text-xs font-medium">Ver</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Drawers */}
      {drawerNuevo && (
        <DrawerNuevoTicket onClose={() => setDrawerNuevo(false)} onCreated={handleTicketCreado} userSalaId={usuario?.sala_id} />
      )}
      {ticketSeleccionado && (
        <DrawerVerTicket ticket={ticketSeleccionado} onClose={() => setTicketSeleccionado(null)}
          onUpdated={handleTicketActualizado} usuario={usuario} usuariosList={usuarios} />
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// TAB 3 — FIDELIZACION
// ═══════════════════════════════════════════════════════════
function TabFidelizacion() {
  const [clientes, setClientes]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [modalData, setModalData]   = useState(null)
  const [fechaCita, setFechaCita]   = useState('')
  const [guardando, setGuardando]   = useState(false)

  useEffect(() => {
    getFidelizacion()
      .then(data => setClientes(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleAgendar = async () => {
    if (!modalData || !fechaCita) return
    setGuardando(true)
    try {
      await agendarRevisita(modalData.id, { fecha_cita: fechaCita })
      setClientes(prev => prev.filter(c => c.id !== modalData.id))
      setModalData(null)
      setFechaCita('')
    } catch (err) {
      console.error(err)
    } finally {
      setGuardando(false)
    }
  }

  if (loading) return <Spinner />
  if (!clientes.length) {
    return (
      <div className="p-12 text-center text-gray-400">
        <div className="text-4xl mb-3">&#127919;</div>
        <p className="font-medium">No hay clientes pendientes de re-visita</p>
        <p className="text-sm mt-1">Los clientes de 60-120 dias ya fueron contactados</p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="crm-table">
          <thead>
            <tr>
              <th className="text-left">Cliente</th>
              <th className="text-left">Telefono</th>
              <th className="text-left">Fecha Compra</th>
              <th className="text-center">Dias desde compra</th>
              <th className="text-right">Monto</th>
              <th className="text-center">Accion</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c, i) => (
              <tr key={c.id} className={`border-b border-gray-50 hover:bg-teal-50/30 ${i % 2 ? 'bg-gray-50/30' : ''}`}>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-800">{c.nombres} {c.apellidos}</div>
                </td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{c.telefono || '--'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{fmtFechaCorta(c.fecha_contrato)}</td>
                <td className="px-4 py-3 text-center">
                  <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                    {c.dias_desde_compra}d
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-800">${Number(c.monto_total || 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => { setModalData(c); setFechaCita('') }}
                    className="bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 text-xs font-medium">
                    Agendar Re-visita
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de agendar re-visita */}
      {modalData && (
        <Modal title="Agendar Re-visita" onClose={() => setModalData(null)}>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-medium text-gray-800">{modalData.nombres} {modalData.apellidos}</p>
              <p className="text-xs text-gray-500 font-mono mt-1">{modalData.telefono}</p>
              <p className="text-xs text-teal-600 font-mono mt-1">Contrato: {modalData.numero_contrato}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de la re-visita</label>
              <input
                type="date"
                value={fechaCita}
                onChange={e => setFechaCita(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalData(null)}
                className="flex-1 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleAgendar} disabled={guardando || !fechaCita}
                className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium disabled:opacity-50">
                {guardando ? 'Agendando...' : 'Confirmar Re-visita'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════
// PAGINA PRINCIPAL SAC — 3 TABS
// ═══════════════════════════════════════════════════════════
const SAC_TABS = [
  { key: 'calidad',      label: 'Control de Calidad' },
  { key: 'pqr',          label: 'PQR' },
  { key: 'fidelizacion', label: 'Fidelizacion' },
]

export default function SACPage() {
  const { usuario } = useAuth()
  const [tabActivo, setTabActivo] = useState('calidad')

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Servicio al Cliente</h1>
        <p className="text-sm text-gray-400 mt-0.5">Control de Calidad - PQR - Fidelizacion</p>
      </div>

      {/* Tabs: border-bottom activo en teal */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0 -mb-px">
          {SAC_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setTabActivo(tab.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors
                ${tabActivo === tab.key
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenido del tab activo */}
      {tabActivo === 'calidad' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-700">Ventas pendientes de activar (ultimos 15 dias)</h2>
            <p className="text-xs text-gray-400 mt-0.5">Contratos recientes que no han pasado control de calidad</p>
          </div>
          <TabControlCalidad />
        </div>
      )}

      {tabActivo === 'pqr' && (
        <TabPQR usuario={usuario} />
      )}

      {tabActivo === 'fidelizacion' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-700">Clientes para re-visita (60-120 dias)</h2>
            <p className="text-xs text-gray-400 mt-0.5">Clientes activos entre 60 y 120 dias desde su compra</p>
          </div>
          <TabFidelizacion />
        </div>
      )}
    </div>
  )
}
