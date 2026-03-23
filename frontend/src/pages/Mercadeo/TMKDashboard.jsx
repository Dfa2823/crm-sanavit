import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { apiLeads } from '../../api/leads'
import { apiPersonas } from '../../api/personas'
import client from '../../api/client'
import CapturarLead from './CapturarLead'

const ESTADO_BADGE = {
  pendiente:   'badge-gray',
  confirmada:  'badge-green',
  tentativa:   'badge-yellow',
  cancelada:   'badge-red',
  inasistencia:'badge-red',
  tour:        'badge-green',
  no_tour:     'badge-yellow',
}

const ESTADO_LABEL = {
  pendiente:   'Pendiente',
  confirmada:  'Confirmada',
  tentativa:   'Tentativa',
  cancelada:   'Cancelada',
  inasistencia:'Inasistencia',
  tour:        'TOUR',
  no_tour:     'NO TOUR',
}

// ── Drawer de detalle / edicion del lead ────────────────────
function LeadDetailDrawer({ leadId, tipificaciones, onClose, onActualizado }) {
  const [lead, setLead] = useState(null)
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('detalle') // detalle | historial
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [obsNueva, setObsNueva] = useState('')
  const [tipObs, setTipObs] = useState('')
  const [editandoPersona, setEditandoPersona] = useState(false)
  const [formPersona, setFormPersona] = useState({})
  const [guardandoPersona, setGuardandoPersona] = useState(false)

  useEffect(() => {
    if (!leadId) return
    setLoading(true)
    Promise.all([
      apiLeads.obtener(leadId),
      apiLeads.historial(leadId),
    ]).then(([leadData, hist]) => {
      setLead(leadData)
      setHistorial(hist)
      setEditandoPersona(false)
      setFormPersona({
        nombres:   leadData.nombres   || '',
        apellidos: leadData.apellidos  || '',
        telefono:  leadData.telefono   || '',
        telefono2: leadData.telefono2  || '',
        ciudad:    leadData.ciudad     || '',
        edad:      leadData.edad       || '',
        email:     leadData.email      || '',
        patologia: leadData.patologia  || '',
      })
      setForm({
        estado: leadData.estado || '',
        tipificacion_id: leadData.tipificacion_id || '',
        patologia: leadData.patologia || '',
        fecha_cita: leadData.fecha_cita ? leadData.fecha_cita.slice(0, 16) : '',
        fecha_rellamar: leadData.fecha_rellamar ? leadData.fecha_rellamar.slice(0, 16) : '',
        observacion: leadData.observacion || '',
        confirmador_id: leadData.confirmador_id || '',
        sala_id: leadData.sala_id || '',
      })
    }).catch(console.error).finally(() => setLoading(false))
  }, [leadId])

  async function guardarCambios() {
    setGuardando(true)
    try {
      const payload = {}
      // Solo enviar campos que cambiaron (excepto tmk_id y fuente_id que son readonly)
      if (form.estado !== (lead.estado || '')) payload.estado = form.estado
      if (String(form.tipificacion_id) !== String(lead.tipificacion_id || '')) payload.tipificacion_id = form.tipificacion_id || null
      if (form.patologia !== (lead.patologia || '')) payload.patologia = form.patologia
      if (form.fecha_cita !== (lead.fecha_cita ? lead.fecha_cita.slice(0, 16) : '')) payload.fecha_cita = form.fecha_cita || null
      if (form.fecha_rellamar !== (lead.fecha_rellamar ? lead.fecha_rellamar.slice(0, 16) : '')) payload.fecha_rellamar = form.fecha_rellamar || null
      if (form.observacion !== (lead.observacion || '')) payload.observacion = form.observacion
      if (String(form.sala_id) !== String(lead.sala_id || '')) payload.sala_id = form.sala_id || null

      if (Object.keys(payload).length > 0) {
        const updated = await apiLeads.actualizar(leadId, payload)
        setLead(updated)
        onActualizado(updated)
      }
      setEditando(false)
    } catch (err) {
      console.error(err)
    } finally {
      setGuardando(false)
    }
  }

  async function guardarDatosPersona() {
    if (!lead?.persona_id) return
    setGuardandoPersona(true)
    try {
      await client.patch(`/api/personas/${lead.persona_id}`, formPersona)
      // Actualizar lead local con los nuevos datos
      const updated = { ...lead, ...formPersona }
      setLead(updated)
      onActualizado(updated)
      setEditandoPersona(false)
    } catch (err) {
      console.error(err)
    } finally {
      setGuardandoPersona(false)
    }
  }

  async function guardarObsHistorial() {
    if (!obsNueva.trim()) return
    try {
      await apiLeads.guardarObservacion(leadId, {
        observacion: obsNueva,
        tipificacion_id: tipObs || lead.tipificacion_id || null,
      })
      setObsNueva('')
      setTipObs('')
      // Recargar historial
      const hist = await apiLeads.historial(leadId)
      setHistorial(hist)
      // Actualizar lead local
      setLead(prev => ({ ...prev, observacion: obsNueva }))
      onActualizado({ ...lead, observacion: obsNueva })
    } catch (err) {
      console.error(err)
    }
  }

  if (!leadId) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white sticky top-0">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">
              {lead ? `${lead.nombres} ${lead.apellidos}` : 'Cargando...'}
            </h2>
            <p className="text-xs text-gray-400">
              Lead #{leadId} {lead?.telefono ? `- ${lead.telefono}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6 bg-gray-50">
          <button
            onClick={() => setTab('detalle')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'detalle'
                ? 'border-teal-500 text-teal-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Detalle
          </button>
          <button
            onClick={() => setTab('historial')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'historial'
                ? 'border-teal-500 text-teal-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Historial ({historial.length})
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tab === 'detalle' ? (
            <div className="space-y-4">
              {/* Datos del cliente — editables */}
              <div className="p-4 bg-blue-50 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-blue-800 text-sm">Datos del cliente</h3>
                  {!editandoPersona ? (
                    <button onClick={() => setEditandoPersona(true)} className="text-xs text-blue-600 font-medium hover:underline">
                      Editar
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => setEditandoPersona(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
                      <button onClick={guardarDatosPersona} disabled={guardandoPersona} className="text-xs text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-lg font-medium">
                        {guardandoPersona ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  )}
                </div>
                {!editandoPersona ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div><span className="text-gray-500">Nombre:</span> <span className="font-medium">{lead.nombres} {lead.apellidos}</span></div>
                    <div><span className="text-gray-500">Tel:</span> <span className="font-mono">{lead.telefono}</span></div>
                    <div><span className="text-gray-500">Tel 2:</span> <span className="font-mono">{lead.telefono2 || '-'}</span></div>
                    <div><span className="text-gray-500">Ciudad:</span> {lead.ciudad || '-'}</div>
                    <div><span className="text-gray-500">Email:</span> {lead.email || '-'}</div>
                    <div><span className="text-gray-500">Edad:</span> {lead.edad || '-'}</div>
                    <div className="col-span-2"><span className="text-gray-500">Patologia:</span> {lead.patologia || '-'}</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <div>
                      <label className="text-xs text-gray-500">Nombres</label>
                      <input className="input text-sm" value={formPersona.nombres}
                        onChange={e => setFormPersona(f => ({ ...f, nombres: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Apellidos</label>
                      <input className="input text-sm" value={formPersona.apellidos}
                        onChange={e => setFormPersona(f => ({ ...f, apellidos: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Telefono</label>
                      <input className="input text-sm" value={formPersona.telefono}
                        onChange={e => setFormPersona(f => ({ ...f, telefono: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Telefono 2</label>
                      <input className="input text-sm" value={formPersona.telefono2}
                        onChange={e => setFormPersona(f => ({ ...f, telefono2: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Ciudad</label>
                      <input className="input text-sm" value={formPersona.ciudad}
                        onChange={e => setFormPersona(f => ({ ...f, ciudad: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Edad</label>
                      <input type="number" className="input text-sm" value={formPersona.edad}
                        onChange={e => setFormPersona(f => ({ ...f, edad: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Email</label>
                      <input type="email" className="input text-sm" value={formPersona.email}
                        onChange={e => setFormPersona(f => ({ ...f, email: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Patologia</label>
                      <input className="input text-sm" value={formPersona.patologia}
                        onChange={e => setFormPersona(f => ({ ...f, patologia: e.target.value }))} />
                    </div>
                  </div>
                )}
              </div>

              {/* Info readonly: TMK + Fuente (no editables) */}
              <div className="p-4 bg-gray-50 rounded-xl space-y-2">
                <h3 className="font-semibold text-gray-700 text-sm">Asignacion (solo lectura)</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <div><span className="text-gray-500">TMK:</span> <span className="font-medium">{lead.tmk_nombre || '-'}</span></div>
                  <div><span className="text-gray-500">Fuente:</span> <span className="badge badge-blue">{lead.fuente_nombre}</span></div>
                  <div><span className="text-gray-500">Sala:</span> {lead.sala_nombre || '-'}</div>
                  <div><span className="text-gray-500">Confirmador:</span> {lead.confirmador_nombre || '-'}</div>
                </div>
              </div>

              {/* Campos editables */}
              <div className="p-4 bg-white border border-gray-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-700 text-sm">Datos editables</h3>
                  {!editando ? (
                    <button onClick={() => setEditando(true)} className="text-xs text-teal-600 font-medium hover:underline">
                      Editar
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => setEditando(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
                      <button onClick={guardarCambios} disabled={guardando} className="text-xs text-white bg-teal-600 hover:bg-teal-700 px-3 py-1 rounded-lg font-medium">
                        {guardando ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Estado</label>
                    <select
                      className="input"
                      value={form.estado}
                      disabled={!editando}
                      onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                    >
                      {Object.entries(ESTADO_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Tipificacion</label>
                    <select
                      className="input"
                      value={form.tipificacion_id}
                      disabled={!editando}
                      onChange={e => setForm(f => ({ ...f, tipificacion_id: e.target.value }))}
                    >
                      <option value="">Sin tipificar</option>
                      {tipificaciones.map(t => (
                        <option key={t.id} value={t.id}>{t.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="label">Patologia</label>
                    <input
                      className="input"
                      value={form.patologia}
                      disabled={!editando}
                      onChange={e => setForm(f => ({ ...f, patologia: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">Fecha cita</label>
                    <input
                      type="datetime-local"
                      className="input"
                      value={form.fecha_cita}
                      disabled={!editando}
                      onChange={e => setForm(f => ({ ...f, fecha_cita: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">Fecha rellamar</label>
                    <input
                      type="datetime-local"
                      className="input"
                      value={form.fecha_rellamar}
                      disabled={!editando}
                      onChange={e => setForm(f => ({ ...f, fecha_rellamar: e.target.value }))}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Observacion</label>
                    <textarea
                      className="input resize-none h-16"
                      value={form.observacion}
                      disabled={!editando}
                      onChange={e => setForm(f => ({ ...f, observacion: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Acceso rapido a observacion + historial */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                <h3 className="font-semibold text-amber-800 text-sm">Agregar nota rapida</h3>
                <div className="flex gap-2">
                  <select
                    className="text-xs border border-amber-300 rounded-lg px-2 py-1.5 bg-white w-36"
                    value={tipObs}
                    onChange={e => setTipObs(e.target.value)}
                  >
                    <option value="">Tipificacion...</option>
                    {tipificaciones.map(t => (
                      <option key={t.id} value={t.id}>{t.nombre}</option>
                    ))}
                  </select>
                  <input
                    className="text-xs border border-amber-300 rounded-lg px-2 py-1.5 flex-1 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                    placeholder="Escribir observacion..."
                    value={obsNueva}
                    onChange={e => setObsNueva(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && guardarObsHistorial()}
                  />
                  <button
                    onClick={guardarObsHistorial}
                    className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-amber-700"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* TAB HISTORIAL */
            <div className="space-y-3">
              {historial.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-3xl mb-2">---</div>
                  <p className="text-sm">Sin observaciones registradas</p>
                </div>
              ) : (
                historial.map(h => (
                  <div key={h.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-700">{h.usuario_nombre}</span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(h.created_at).toLocaleDateString('es-EC', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {h.tipificacion_nombre && (
                      <span className="inline-block text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded mb-1 font-medium">
                        {h.tipificacion_nombre}
                      </span>
                    )}
                    <p className="text-sm text-gray-600">{h.observacion}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Componente principal ────────────────────────────────────
export default function TMKDashboard() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [tipificaciones, setTipificaciones] = useState([])
  const [editandoObs, setEditandoObs] = useState(null)
  const [obsTemp, setObsTemp] = useState('')
  const [editandoRellamar, setEditandoRellamar] = useState(null)
  const [fechaRellamar, setFechaRellamar] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [leadDetalle, setLeadDetalle] = useState(null) // lead.id para drawer detalle

  const hoy = new Date().toISOString().split('T')[0]

  const cargarLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (usuario.rol === 'tmk') params.tmk_id = usuario.id
      const data = await apiLeads.listar(params)
      setLeads(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [usuario])

  useEffect(() => {
    apiLeads.configuracion().then(cfg => {
      if (cfg?.tipificaciones) setTipificaciones(cfg.tipificaciones)
    }).catch(console.error)
  }, [])

  // Cambiar tipificacion inline
  async function cambiarTipificacion(leadId, tipificacionId) {
    try {
      const tip = tipificaciones.find(t => t.id == tipificacionId)
      await apiLeads.actualizar(leadId, { tipificacion_id: tipificacionId })
      setLeads(prev => prev.map(l => l.id === leadId
        ? { ...l, tipificacion_id: tipificacionId, tipificacion_nombre: tip?.nombre }
        : l
      ))
      if (tip?.requiere_fecha_rellamar) {
        setEditandoRellamar(leadId)
        setFechaRellamar('')
      }
    } catch (err) { console.error(err) }
  }

  // Guardar fecha de rellamada
  async function guardarFechaRellamar(leadId) {
    if (!fechaRellamar) return
    try {
      await apiLeads.actualizar(leadId, { fecha_rellamar: fechaRellamar })
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, fecha_rellamar: fechaRellamar } : l))
      setEditandoRellamar(null)
      setFechaRellamar('')
    } catch (err) { console.error(err) }
  }

  // Guardar observacion rapida inline (con historial)
  async function guardarObservacion(leadId) {
    if (!obsTemp.trim()) return
    try {
      const lead = leads.find(l => l.id === leadId)
      await apiLeads.guardarObservacion(leadId, {
        observacion: obsTemp,
        tipificacion_id: lead?.tipificacion_id || null,
      })
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, observacion: obsTemp } : l))
      setEditandoObs(null)
      setObsTemp('')
    } catch (err) { console.error(err) }
  }

  useEffect(() => { cargarLeads() }, [cargarLeads])

  // Separar leads prioritarios
  const leadsPrioridad = leads.filter(l =>
    l.estado === 'pendiente' && l.fecha_rellamar && l.fecha_rellamar.split('T')[0] <= hoy
  )
  const leadsNormales = leads.filter(l =>
    !(l.estado === 'pendiente' && l.fecha_rellamar && l.fecha_rellamar.split('T')[0] <= hoy)
  )

  const leadsFiltrados = [...leadsPrioridad, ...leadsNormales].filter(l => {
    // Filtro de estado
    if (filtroEstado === 'prioridad') {
      if (!(l.estado === 'pendiente' && l.fecha_rellamar && l.fecha_rellamar.split('T')[0] <= hoy)) return false
    } else if (filtroEstado !== 'todos') {
      if (l.estado !== filtroEstado) return false
    }
    // Filtro de busqueda
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (
      l.nombres?.toLowerCase().includes(q) ||
      l.apellidos?.toLowerCase().includes(q) ||
      l.telefono?.includes(q) ||
      l.observacion?.toLowerCase().includes(q)
    )
  })

  // Auto-refresh cada 2 minutos
  useEffect(() => {
    const interval = setInterval(() => { cargarLeads() }, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [cargarLeads])

  // Stats
  const leadsHoy = leads.filter(l => l.created_at?.startsWith(hoy))
  const citasAgendadas = leads.filter(l => ['confirmada','tentativa'].includes(l.estado))
  const pendientes = leads.filter(l => l.estado === 'pendiente')
  const llamarHoy = leadsPrioridad.length
  const mesActual = hoy.substring(0, 7)
  const toursMes = leads.filter(l => l.estado === 'tour' && l.created_at?.startsWith(mesActual))

  // Callback cuando se actualiza lead desde drawer
  function onLeadActualizado(updated) {
    setLeads(prev => prev.map(l => l.id === updated.id ? { ...updated } : l))
  }

  return (
    <div className="space-y-5">

      {/* Stats rapidos */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <button onClick={() => setFiltroEstado('todos')} className={`card p-4 text-center transition-shadow hover:shadow-md ${filtroEstado === 'todos' ? 'ring-2 ring-teal-400' : ''}`}>
          <div className="text-2xl font-bold text-blue-600">{leadsHoy.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Leads hoy</div>
        </button>
        <button onClick={() => setFiltroEstado('prioridad')} className={`card p-4 text-center transition-shadow hover:shadow-md ${filtroEstado === 'prioridad' ? 'ring-2 ring-amber-400' : ''}`}>
          <div className="text-2xl font-bold text-amber-600">{llamarHoy}</div>
          <div className="text-xs text-gray-500 mt-0.5">Llamar hoy</div>
        </button>
        <button onClick={() => setFiltroEstado('confirmada')} className={`card p-4 text-center transition-shadow hover:shadow-md ${filtroEstado === 'confirmada' ? 'ring-2 ring-green-400' : ''}`}>
          <div className="text-2xl font-bold text-green-600">{citasAgendadas.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Citas agendadas</div>
        </button>
        <button onClick={() => setFiltroEstado('pendiente')} className={`card p-4 text-center transition-shadow hover:shadow-md ${filtroEstado === 'pendiente' ? 'ring-2 ring-yellow-400' : ''}`}>
          <div className="text-2xl font-bold text-yellow-600">{pendientes.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Pendientes</div>
        </button>
        <button onClick={() => setFiltroEstado('tour')} className={`card p-4 text-center transition-shadow hover:shadow-md ${filtroEstado === 'tour' ? 'ring-2 ring-teal-400' : ''}`}>
          <div className="text-2xl font-bold text-teal-600">{toursMes.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Tours del mes</div>
        </button>
      </div>

      {/* Cabecera con buscador + filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          className="input max-w-xs"
          placeholder="Buscar nombre, tel, nota..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <select
          className="input w-auto text-sm"
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
        >
          <option value="todos">Todos los estados</option>
          <option value="prioridad">Llamar hoy</option>
          <option value="pendiente">Pendiente</option>
          <option value="confirmada">Confirmada</option>
          <option value="tentativa">Tentativa</option>
          <option value="cancelada">Cancelada</option>
          <option value="tour">Tour</option>
          <option value="no_tour">No Tour</option>
          <option value="inasistencia">Inasistencia</option>
        </select>
        <div className="flex-1" />
        <button onClick={() => cargarLeads()} className="btn-secondary text-sm" title="Refrescar">
          Refrescar
        </button>
        <button
          onClick={() => setMostrarForm(true)}
          className="btn-primary"
        >
          + Nuevo Lead
        </button>
      </div>

      {/* Tabla de leads */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <h2 className="font-semibold text-gray-700">
            {filtroEstado === 'prioridad' ? 'Leads para llamar hoy' : filtroEstado !== 'todos' ? `Leads: ${ESTADO_LABEL[filtroEstado] || filtroEstado}` : 'Todos los leads'}
          </h2>
          <span className="badge-blue badge">{leadsFiltrados.length} registros</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Cargando...
          </div>
        ) : leadsFiltrados.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <div className="text-4xl mb-3">---</div>
            <p className="font-medium">No hay leads{filtroEstado !== 'todos' ? ` con estado "${ESTADO_LABEL[filtroEstado] || filtroEstado}"` : ''}</p>
            <p className="text-sm mt-1">Haz clic en "+ Nuevo Lead" para comenzar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Telefono</th>
                  <th>Fuente</th>
                  <th>Tipificacion</th>
                  <th>Fecha cita</th>
                  <th>Estado</th>
                  <th>TMK</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {leadsFiltrados.map(lead => {
                  const esPrioridad = lead.estado === 'pendiente' && lead.fecha_rellamar && lead.fecha_rellamar.split('T')[0] <= hoy
                  return (
                  <tr
                    key={lead.id}
                    className={`group ${esPrioridad ? 'bg-amber-50 border-l-4 border-l-amber-400' : 'hover:bg-gray-50'}`}
                  >
                    <td
                      className="cursor-pointer"
                      onClick={() => setLeadDetalle(lead.id)}
                    >
                      <div className="font-medium text-gray-800">
                        {lead.nombres} {lead.apellidos}
                      </div>
                      <div className="text-xs text-gray-400">{lead.ciudad}</div>
                      {esPrioridad && (
                        <span className="inline-block mt-0.5 text-[10px] font-bold text-amber-700 bg-amber-200 px-1.5 py-0.5 rounded">
                          LLAMAR HOY
                        </span>
                      )}
                    </td>
                    <td className="text-gray-600 font-mono whitespace-nowrap">
                      {lead.telefono}
                      {lead.telefono && (
                        <a
                          href={`https://wa.me/593${lead.telefono.replace(/^0/, '').replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="ml-1.5 text-green-500 hover:text-green-600"
                          title="Abrir WhatsApp"
                        >WA</a>
                      )}
                    </td>
                    <td>
                      <span className="badge-blue badge">{lead.fuente_nombre}</span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <select
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-400 bg-white w-full max-w-[140px]"
                        value={lead.tipificacion_id || ''}
                        onChange={e => cambiarTipificacion(lead.id, e.target.value)}
                      >
                        <option value="">Sin tipificar</option>
                        {tipificaciones.map(t => (
                          <option key={t.id} value={t.id}>{t.nombre}</option>
                        ))}
                      </select>
                      {/* Date picker para "Volver a llamar" */}
                      {editandoRellamar === lead.id && (
                        <div className="mt-1 flex gap-1">
                          <input type="datetime-local"
                            className="text-xs border border-amber-300 rounded px-2 py-1 flex-1 focus:outline-none focus:ring-1 focus:ring-amber-400 bg-amber-50"
                            value={fechaRellamar}
                            onChange={e => setFechaRellamar(e.target.value)}
                            autoFocus
                          />
                          <button onClick={() => guardarFechaRellamar(lead.id)} className="text-xs text-amber-700 font-medium">OK</button>
                          <button onClick={() => setEditandoRellamar(null)} className="text-xs text-gray-400">X</button>
                        </div>
                      )}
                      {/* Observacion rapida inline */}
                      {editandoObs === lead.id ? (
                        <div className="mt-1 flex gap-1">
                          <input
                            type="text"
                            className="text-xs border border-gray-200 rounded px-2 py-1 flex-1 focus:outline-none focus:ring-1 focus:ring-teal-400"
                            placeholder="Observacion..."
                            value={obsTemp}
                            onChange={e => setObsTemp(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && guardarObservacion(lead.id)}
                            autoFocus
                          />
                          <button onClick={() => guardarObservacion(lead.id)} className="text-xs text-teal-600 font-medium">OK</button>
                          <button onClick={() => setEditandoObs(null)} className="text-xs text-gray-400">X</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditandoObs(lead.id); setObsTemp(lead.observacion || '') }}
                          className="mt-0.5 text-[10px] text-gray-400 hover:text-teal-600 block truncate max-w-[140px]"
                          title={lead.observacion || 'Agregar observacion'}
                        >
                          {lead.observacion ? `Nota: ${lead.observacion}` : '+ Nota'}
                        </button>
                      )}
                    </td>
                    <td className="text-gray-500 text-sm">
                      {lead.fecha_cita
                        ? new Date(lead.fecha_cita).toLocaleDateString('es-EC', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                          })
                        : lead.fecha_rellamar
                          ? `Rellamar: ${new Date(lead.fecha_rellamar).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })}`
                          : '--'}
                    </td>
                    <td>
                      <span className={`badge ${ESTADO_BADGE[lead.estado] || 'badge-gray'}`}>
                        {ESTADO_LABEL[lead.estado] || lead.estado}
                      </span>
                    </td>
                    <td className="text-gray-500 text-sm">{lead.tmk_nombre}</td>
                    <td>
                      <div className="flex gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setLeadDetalle(lead.id)
                          }}
                          className="text-teal-500 hover:text-teal-700 text-xs font-medium"
                          title="Ver detalle"
                        >
                          Detalle
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/sala/cliente/${lead.persona_id}`)
                          }}
                          className="text-blue-500 hover:text-blue-700 text-xs font-medium"
                          title="Hoja de vida"
                        >
                          HdV
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer: Capturar Lead */}
      {mostrarForm && (
        <CapturarLead
          onClose={() => setMostrarForm(false)}
          onGuardado={() => {
            setMostrarForm(false)
            cargarLeads()
          }}
        />
      )}

      {/* Drawer: Detalle del Lead */}
      {leadDetalle && (
        <LeadDetailDrawer
          leadId={leadDetalle}
          tipificaciones={tipificaciones}
          onClose={() => setLeadDetalle(null)}
          onActualizado={onLeadActualizado}
        />
      )}
    </div>
  )
}
