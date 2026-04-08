import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop'
import { format, parse, startOfWeek, getDay, addHours } from 'date-fns'
import { es } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import './CalendarioVisual.css'
import { apiLeads } from '../../api/leads'
import client from '../../api/client'
import { apiPersonas } from '../../api/personas'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { formatFechaSemana, formatFechaCorta, toEcuadorISO, hoyEC, fechaLocalEC } from '../../utils/formatFechaEC'

// ─── react-big-calendar config ───────────────────────────────────────────────

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales: { es },
})

const DnDCalendar = withDragAndDrop(Calendar)

const MESSAGES = {
  allDay: 'Todo el día',
  previous: '‹',
  next: '›',
  today: 'Hoy',
  month: 'Mes',
  week: 'Semana',
  day: 'Día',
  agenda: 'Agenda',
  date: 'Fecha',
  time: 'Hora',
  event: 'Evento',
  noEventsInRange: 'Sin citas en este período',
  showMore: (n) => `+${n} más`,
}

const ESTADO = {
  confirmada: { color: '#fff', bg: '#2563eb', label: 'Confirmada' },
  tentativa:  { color: '#fff', bg: '#d97706', label: 'Tentativa'  },
  tour:       { color: '#fff', bg: '#059669', label: 'Tour'       },
  no_tour:    { color: '#fff', bg: '#dc2626', label: 'No Tour'    },
}

// ─── Drawer detalle de cita (estilo LeadDetailDrawer) ────────────────────────

function DrawerCita({ lead, onClose, onActualizar }) {
  const navigate  = useNavigate()
  const { addToast } = useToast()
  const { usuario } = useAuth()

  // Persona data (fetched from API for full fields)
  const [persona, setPersona]     = useState(null)
  const [loadingPersona, setLoadingPersona] = useState(false)
  const [editandoPersona, setEditandoPersona] = useState(false)
  const [formPersona, setFormPersona] = useState({})
  const [guardandoPersona, setGuardandoPersona] = useState(false)

  // Reagendar
  const [editFecha, setEditFecha]  = useState(false)
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [nuevaHora, setNuevaHora]  = useState('')
  const [guardando, setGuardando]  = useState(false)

  // Tipificacion del confirmador
  const [tipificaciones, setTipificaciones] = useState([])
  const [tipSeleccionada, setTipSeleccionada] = useState(lead?.tipificacion_id ? String(lead.tipificacion_id) : '')
  const [obsConfirmador, setObsConfirmador] = useState('')
  const [guardandoTip, setGuardandoTip] = useState(false)

  const esAdmin = ['admin', 'director', 'supervisor_cc', 'confirmador'].includes(usuario?.rol)

  // Cargar tipificaciones
  useEffect(() => {
    apiLeads.configuracion().then(cfg => {
      if (cfg?.tipificaciones) setTipificaciones(cfg.tipificaciones)
    }).catch(console.error)
  }, [])

  // Fetch persona details when drawer opens
  useEffect(() => {
    if (!lead) return
    if (lead.persona_id) {
      setLoadingPersona(true)
      apiPersonas.obtener(lead.persona_id)
        .then(data => {
          setPersona(data)
          setFormPersona({
            nombres:        data.nombres        || '',
            apellidos:      data.apellidos       || '',
            telefono:       data.telefono        || '',
            telefono2:      data.telefono2       || '',
            ciudad:         data.ciudad          || '',
            edad:           data.edad            || '',
            email:          data.email           || '',
            patologia:      data.patologia       || '',
            tipo_documento: data.tipo_documento  || '',
            num_documento:  data.num_documento   || '',
          })
        })
        .catch(() => {
          // Fallback: use lead data
          setPersona(lead)
          setFormPersona({
            nombres: lead.nombres || '', apellidos: lead.apellidos || '',
            telefono: lead.telefono || '', telefono2: '', ciudad: lead.ciudad || '',
            edad: '', email: lead.email || '', patologia: lead.patologia || '',
            tipo_documento: '', num_documento: '',
          })
        })
        .finally(() => setLoadingPersona(false))
    }
    setEditandoPersona(false)
    // Init reagendar fields
    if (lead.fecha_cita) {
      const d = new Date(lead.fecha_cita)
      setNuevaFecha(fechaLocalEC(d))
      setNuevaHora(d.toTimeString().slice(0, 5))
    }
    setEditFecha(false)
    // Init tipificacion con la actual del lead
    setTipSeleccionada(lead.tipificacion_id ? String(lead.tipificacion_id) : '')
    setObsConfirmador('')
  }, [lead])

  async function guardarDatosPersona() {
    if (!lead?.persona_id) return
    setGuardandoPersona(true)
    try {
      await client.patch(`/api/personas/${lead.persona_id}`, formPersona)
      // Update local persona
      setPersona(prev => ({ ...prev, ...formPersona }))
      setEditandoPersona(false)
      addToast('Datos del cliente actualizados')
      onActualizar()
    } catch {
      addToast('Error al guardar datos', 'error')
    } finally {
      setGuardandoPersona(false)
    }
  }

  async function guardarFecha() {
    if (!nuevaFecha) return
    setGuardando(true)
    try {
      await apiLeads.actualizar(lead.id, {
        fecha_cita: toEcuadorISO(`${nuevaFecha}T${nuevaHora || '09:00'}`),
        estado: 'tentativa',
      })
      addToast('Cita reagendada — requiere nueva confirmacion')
      setEditFecha(false)
      onActualizar()
    } catch { addToast('Error al reprogramar', 'error') }
    finally { setGuardando(false) }
  }

  // Guardar tipificacion del confirmador
  async function guardarTipificacion() {
    if (!tipSeleccionada) return
    setGuardandoTip(true)
    try {
      const tip = tipificaciones.find(t => String(t.id) === String(tipSeleccionada))
      const payload = {
        tipificacion_id: tipSeleccionada,
      }
      if (obsConfirmador.trim()) payload.observacion = obsConfirmador

      // Determinar estado segun tipificacion
      if (tip?.requiere_fecha_cita) {
        // "Super tentativa" siempre va como tentativa
        payload.estado = tip?.nombre === 'Super tentativa' ? 'tentativa' : 'confirmada'
      } else if (tip?.nombre === 'No le interesa') {
        payload.estado = 'cancelada'
      }
      // "No contesta", "Buzon" => no cambian estado

      await apiLeads.actualizar(lead.id, payload)

      // Guardar en historial si hay observacion
      if (obsConfirmador.trim()) {
        await apiLeads.guardarObservacion(lead.id, {
          observacion: obsConfirmador,
          tipificacion_id: tipSeleccionada,
        })
      }

      addToast(`Tipificado como: ${tip?.nombre || 'OK'}`)
      setTipSeleccionada('')
      setObsConfirmador('')
      onActualizar()
    } catch {
      addToast('Error al tipificar', 'error')
    } finally {
      setGuardandoTip(false)
    }
  }

  async function confirmar() {
    setGuardando(true)
    try {
      const payload = { estado: 'confirmada' }
      // Si hay tipificacion seleccionada, enviarla tambien
      if (tipSeleccionada) payload.tipificacion_id = tipSeleccionada
      if (obsConfirmador.trim()) payload.observacion = obsConfirmador
      await apiLeads.actualizar(lead.id, payload)
      addToast('Estado actualizado a Confirmada')
      onActualizar()
    } catch { addToast('Error al actualizar', 'error') }
    finally { setGuardando(false) }
  }

  function abrirWhatsApp() {
    const tel = (persona?.telefono || lead.telefono || '').replace(/\D/g, '')
    const num = tel.startsWith('0') ? '593' + tel.slice(1) : tel.startsWith('593') ? tel : '593' + tel
    window.open(`https://wa.me/${num}`, '_blank')
  }

  if (!lead) return null

  const est = ESTADO[lead.estado] || { color: '#fff', bg: '#94a3b8', label: lead.estado }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white sticky top-0">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">
              {persona?.nombres || lead.nombres} {persona?.apellidos || lead.apellidos}
            </h2>
            <p className="text-xs text-gray-400">
              Lead #{lead.id} {(persona?.telefono || lead.telefono) ? ` — ${persona?.telefono || lead.telefono}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {loadingPersona ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* ─── Seccion: Datos del Cliente (editables) ─── */}
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
                    <div><span className="text-gray-500">Nombre:</span> <span className="font-medium">{persona?.nombres || lead.nombres} {persona?.apellidos || lead.apellidos}</span></div>
                    <div><span className="text-gray-500">Tel:</span> <span className="font-mono">{persona?.telefono || lead.telefono || '—'}</span></div>
                    <div><span className="text-gray-500">Tel 2:</span> <span className="font-mono">{persona?.telefono2 || '—'}</span></div>
                    <div><span className="text-gray-500">Ciudad:</span> {persona?.ciudad || lead.ciudad || '—'}</div>
                    <div><span className="text-gray-500">Edad:</span> {persona?.edad || '—'}</div>
                    <div><span className="text-gray-500">Email:</span> {persona?.email || lead.email || '—'}</div>
                    <div className="col-span-2"><span className="text-gray-500">Patologia:</span> {persona?.patologia || lead.patologia || '—'}</div>
                    <div><span className="text-gray-500">Tipo doc:</span> {persona?.tipo_documento || '—'}</div>
                    <div><span className="text-gray-500">Num doc:</span> {persona?.num_documento || '—'}</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 mt-1">
                    <div>
                      <label className="text-xs text-gray-500">Nombres</label>
                      <input className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" value={formPersona.nombres}
                        onChange={e => setFormPersona(f => ({ ...f, nombres: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Apellidos</label>
                      <input className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" value={formPersona.apellidos}
                        onChange={e => setFormPersona(f => ({ ...f, apellidos: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Telefono</label>
                      <input className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" value={formPersona.telefono}
                        onChange={e => setFormPersona(f => ({ ...f, telefono: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Telefono 2</label>
                      <input className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" value={formPersona.telefono2}
                        onChange={e => setFormPersona(f => ({ ...f, telefono2: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Ciudad</label>
                      <input className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" value={formPersona.ciudad}
                        onChange={e => setFormPersona(f => ({ ...f, ciudad: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Edad</label>
                      <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" value={formPersona.edad}
                        onChange={e => setFormPersona(f => ({ ...f, edad: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Email</label>
                      <input type="email" className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" value={formPersona.email}
                        onChange={e => setFormPersona(f => ({ ...f, email: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Patologia</label>
                      <input className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" value={formPersona.patologia}
                        onChange={e => setFormPersona(f => ({ ...f, patologia: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Tipo documento</label>
                      <select className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" value={formPersona.tipo_documento}
                        onChange={e => setFormPersona(f => ({ ...f, tipo_documento: e.target.value }))}>
                        <option value="">— Seleccionar —</option>
                        <option value="cedula">Cedula</option>
                        <option value="pasaporte">Pasaporte</option>
                        <option value="ruc">RUC</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Num documento</label>
                      <input className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" value={formPersona.num_documento}
                        onChange={e => setFormPersona(f => ({ ...f, num_documento: e.target.value }))} />
                    </div>
                  </div>
                )}
              </div>

              {/* ─── Seccion: Datos de la Cita (solo lectura) ─── */}
              <div className="p-4 bg-gray-50 rounded-xl space-y-2">
                <h3 className="font-semibold text-gray-700 text-sm">Datos de la cita</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <div>
                    <span className="text-gray-500">Fecha y hora:</span>
                    <p className="font-medium text-gray-800">
                      {lead.fecha_cita
                        ? formatFechaSemana(lead.fecha_cita)
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Estado:</span>
                    <p>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: est.bg, color: est.color }}>
                        {est.label}
                      </span>
                    </p>
                  </div>
                  <div><span className="text-gray-500">Sala:</span> <span className="font-medium">{lead.sala_nombre || '—'}</span></div>
                  <div><span className="text-gray-500">TMK:</span> <span className="font-medium">{lead.tmk_nombre || '—'}</span></div>
                  <div><span className="text-gray-500">Fuente:</span> <span className="font-medium">{lead.fuente_nombre || '—'}</span></div>
                  {lead.tipificacion_nombre && (
                    <div><span className="text-gray-500">Tipificacion:</span> <span className="font-medium">{lead.tipificacion_nombre}</span></div>
                  )}
                  {lead.observacion && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Observaciones TMK:</span>
                      <p className="text-gray-700 mt-0.5">{lead.observacion}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ─── Seccion: Tipificacion del Confirmador ─── */}
              {esAdmin && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-3">
                  <h3 className="font-semibold text-purple-800 text-sm">Tipificar gestion</h3>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Tipificacion</label>
                    <select
                      className="w-full border border-purple-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
                      value={tipSeleccionada}
                      onChange={e => setTipSeleccionada(e.target.value)}
                    >
                      <option value="">Seleccionar...</option>
                      {tipificaciones.map(t => (
                        <option key={t.id} value={t.id}>{t.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Observacion</label>
                    <textarea
                      className="w-full border border-purple-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white resize-none h-16"
                      placeholder="Escribir observacion..."
                      value={obsConfirmador}
                      onChange={e => setObsConfirmador(e.target.value)}
                    />
                  </div>
                  <button
                    onClick={guardarTipificacion}
                    disabled={guardandoTip || !tipSeleccionada}
                    className="w-full text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-lg py-2 font-medium disabled:opacity-50 transition-colors"
                  >
                    {guardandoTip ? 'Guardando...' : 'Guardar tipificacion'}
                  </button>
                </div>
              )}

              {/* ─── Seccion: Reagendar fecha ─── */}
              {esAdmin && editFecha && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <h3 className="font-semibold text-amber-800 text-sm">Reagendar cita</h3>
                  <p className="text-xs text-amber-600">La cita volvera a estado "Tentativa" y requiere nueva confirmacion.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">Fecha</label>
                      <input type="date" value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)}
                        min={hoyEC()}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Hora</label>
                      <input type="time" value={nuevaHora} onChange={e => setNuevaHora(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={guardarFecha} disabled={guardando}
                      className="flex-1 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-1.5 font-medium disabled:opacity-50">
                      {guardando ? 'Guardando...' : 'Reagendar'}
                    </button>
                    <button onClick={() => setEditFecha(false)}
                      className="flex-1 text-xs border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ─── Acciones rapidas ─── */}
        <div className="px-6 pb-5 border-t border-gray-200 pt-4 space-y-2">
          {/* Confirmar cita */}
          {esAdmin && lead.estado === 'tentativa' && (
            <button
              onClick={confirmar}
              disabled={guardando}
              className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50"
            >
              Confirmar cita
            </button>
          )}

          {/* Reagendar */}
          {esAdmin && !editFecha && (
            <button
              onClick={() => setEditFecha(true)}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
            >
              Reagendar
            </button>
          )}

          {/* WhatsApp */}
          <button
            onClick={abrirWhatsApp}
            className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
          >
            WhatsApp
          </button>

          {/* Ver hoja de vida */}
          {lead.persona_id && (
            <button
              onClick={() => navigate(`/sala/cliente/${lead.persona_id}`)}
              className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-medium py-2.5 rounded-xl transition-colors"
            >
              Ver hoja de vida del cliente
            </button>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Vista Calendario ────────────────────────────────────────────────────────

function CalendarioVista() {
  const { addToast } = useToast()
  const [citas, setCitas]   = useState([])
  const [loading, setLoading] = useState(true)
  const [rango, setRango]   = useState(null)
  const [drawer, setDrawer] = useState(null)

  const fetchCitas = useCallback(async (r) => {
    const rangoActual = r || rango
    setLoading(true)
    try {
      const params = rangoActual
        ? { inicio: rangoActual.inicio, fin: rangoActual.fin }
        : {}
      const data = await apiLeads.citasCalendario(params)
      const eventos = data.map(lead => {
        // Parsear fecha en zona Ecuador para evitar desfase
        const startDate = new Date(lead.fecha_cita)
        return {
          id:       lead.id,
          title:    `${lead.nombres} ${lead.apellidos}`,
          start:    startDate,
          end:      addHours(startDate, 1),
          resource: lead,
        }
      })
      setCitas(eventos)
    } catch { setCitas([]) }
    finally  { setLoading(false) }
  }, [rango])

  useEffect(() => { fetchCitas() }, []) // eslint-disable-line

  const onRangeChange = useCallback((range) => {
    let inicio, fin
    if (Array.isArray(range)) {
      inicio = format(range[0], 'yyyy-MM-dd')
      fin    = format(range[range.length - 1], 'yyyy-MM-dd')
    } else {
      inicio = format(range.start, 'yyyy-MM-dd')
      fin    = format(range.end,   'yyyy-MM-dd')
    }
    const nuevoRango = { inicio, fin }
    setRango(nuevoRango)
    fetchCitas(nuevoRango)
  }, [fetchCitas])

  const onEventDrop = useCallback(async ({ event, start }) => {
    try {
      // Construir fecha con offset Ecuador desde el Date local del navegador
      const pad = (n) => String(n).padStart(2, '0')
      const ecFecha = `${start.getFullYear()}-${pad(start.getMonth()+1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}:00-05:00`
      await apiLeads.actualizar(event.resource.id, {
        fecha_cita: ecFecha,
      })
      addToast('Cita reprogramada')
      fetchCitas()
    } catch {
      addToast('Error al reprogramar', 'error')
    }
  }, [fetchCitas, addToast])

  const eventStyleGetter = useCallback((event) => {
    const est = ESTADO[event.resource?.estado] || { bg: '#94a3b8', color: '#fff' }
    return {
      style: {
        backgroundColor: est.bg,
        color:           est.color,
        borderRadius:    '5px',
        border:          'none',
        fontSize:        '11.5px',
        fontWeight:      500,
      },
    }
  }, [])

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Leyenda */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 flex-wrap">
        {Object.entries(ESTADO).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#374151' }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: v.bg }} />
            {v.label}
          </span>
        ))}
        {loading && (
          <span className="ml-auto text-xs text-gray-400 flex items-center gap-1">
            <span className="w-3 h-3 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
            Cargando…
          </span>
        )}
      </div>

      <div style={{ height: 620 }}>
        <DnDCalendar
          localizer={localizer}
          events={citas}
          culture="es"
          messages={MESSAGES}
          defaultView="month"
          views={['month', 'week', 'day', 'agenda']}
          onRangeChange={onRangeChange}
          onSelectEvent={(event) => setDrawer(event.resource)}
          onEventDrop={onEventDrop}
          eventPropGetter={eventStyleGetter}
          draggableAccessor={() => true}
          resizable={false}
          popup
          style={{ padding: '0' }}
        />
      </div>

      {drawer && (
        <DrawerCita
          lead={drawer}
          onClose={() => setDrawer(null)}
          onActualizar={() => { setDrawer(null); fetchCitas() }}
        />
      )}
    </div>
  )
}

// ─── Vista Pendientes (tabla original) ──────────────────────────────────────

function PendientesVista() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [pendientes, setPendientes] = useState([])
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState(null)
  const [formConfirmar, setFormConfirmar] = useState({ fecha_cita: '', hora_cita: '' })
  const [formReagendar, setFormReagendar] = useState({ fecha_cita: '', hora_cita: '' })
  const [guardando, setGuardando]   = useState(false)
  const [formDatos, setFormDatos]   = useState({})
  const [editDatos, setEditDatos]   = useState(false)
  const [drawerPend, setDrawerPend] = useState(null)

  function initFormDatos(lead) {
    setFormDatos({
      nombres: lead.nombres || '', apellidos: lead.apellidos || '',
      telefono: lead.telefono || '', ciudad: lead.ciudad || '',
      patologia: lead.patologia || '', edad: lead.edad || '',
    })
    setEditDatos(false)
  }

  async function guardarDatosCliente() {
    if (!modal?.lead?.persona_id) return
    try {
      await client.patch(`/api/personas/${modal.lead.persona_id}`, formDatos)
      addToast('Datos del cliente actualizados')
      setEditDatos(false)
      // actualizar el lead local
      modal.lead.nombres = formDatos.nombres
      modal.lead.apellidos = formDatos.apellidos
      modal.lead.telefono = formDatos.telefono
      modal.lead.ciudad = formDatos.ciudad
      modal.lead.patologia = formDatos.patologia
      modal.lead.edad = formDatos.edad
    } catch { addToast('Error al guardar datos', 'error') }
  }

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const pend = await apiLeads.calendario()
      setPendientes(pend)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function confirmarCita() {
    if (!formConfirmar.fecha_cita) return
    setGuardando(true)
    try {
      await apiLeads.actualizar(modal.lead.id, {
        estado: 'confirmada',
        fecha_cita: toEcuadorISO(`${formConfirmar.fecha_cita}T${formConfirmar.hora_cita || '09:00'}`),
      })
      addToast('Cita confirmada y añadida al pre-manifiesto')
      setModal(null)
      cargar()
    } catch (err) { console.error(err) }
    finally { setGuardando(false) }
  }

  async function reagendarCita() {
    if (!formReagendar.fecha_cita) return
    setGuardando(true)
    try {
      await apiLeads.actualizar(modal.lead.id, {
        estado: 'tentativa',
        fecha_cita: toEcuadorISO(`${formReagendar.fecha_cita}T${formReagendar.hora_cita || '09:00'}`),
      })
      addToast('Cita reagendada — requiere nueva confirmación')
      setModal(null)
      cargar()
    } catch (err) { console.error(err) }
    finally { setGuardando(false) }
  }

  function formatFecha(iso) {
    return formatFechaSemana(iso)
  }

  return (
    <>
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 mb-4">
        <strong>Pendientes por llamar:</strong> Prospectos tipificados como "Volver a llamar".
        Confirma la cita (pasa al Pre-manifiesto) o reagenda la fecha/hora.
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-700 text-sm">Pendientes por llamar</h3>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-yellow-100 text-yellow-700 font-semibold px-2 py-0.5 rounded-full">
              {pendientes.length} pendientes
            </span>
            <button
              onClick={() => navigate('/mercadeo/premanifiesto')}
              className="text-xs text-teal-600 hover:underline font-medium"
            >
              Ver Pre-manifiesto →
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : pendientes.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-2">🎉</div>
            <p className="font-medium">Sin pendientes</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Prospecto','Teléfono','Rellamar el','TMK asignado','Acciones'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pendientes.map(lead => {
                  const vencida = lead.fecha_rellamar && new Date(lead.fecha_rellamar) < new Date()
                  return (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <button onClick={() => setDrawerPend(lead)} className="text-left hover:text-teal-600">
                          <p className="font-medium text-gray-800 hover:text-teal-600">{lead.nombres} {lead.apellidos}</p>
                          <p className="text-xs text-gray-400">{lead.ciudad}</p>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <a href={`tel:${lead.telefono}`} className="font-mono text-sm text-blue-600 hover:underline">
                          {lead.telefono}
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-medium ${vencida ? 'text-red-600' : 'text-gray-700'}`}>
                          {vencida ? '⚠️ ' : ''}{formatFecha(lead.fecha_rellamar)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{lead.tmk_nombre || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setModal({ tipo: 'confirmar', lead }); setFormConfirmar({ fecha_cita: '', hora_cita: '' }); initFormDatos(lead) }}
                            className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium whitespace-nowrap"
                          >
                            Confirmar cita
                          </button>
                          <button
                            onClick={() => {
                              const f = lead.fecha_cita ? fechaLocalEC(lead.fecha_cita) : ''
                              const h = lead.fecha_cita ? new Date(lead.fecha_cita).toTimeString().slice(0,5) : ''
                              setFormReagendar({ fecha_cita: f, hora_cita: h })
                              initFormDatos(lead)
                              setModal({ tipo: 'reagendar', lead })
                            }}
                            className="text-xs bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg font-medium whitespace-nowrap"
                          >
                            Reagendar
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

      {/* Modal Confirmar cita */}
      {modal?.tipo === 'confirmar' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 my-4">
            <h3 className="font-bold text-gray-800 text-lg mb-1">Confirmar cita</h3>
            <p className="text-sm text-gray-500 mb-4">{modal.lead.nombres} {modal.lead.apellidos} — {modal.lead.telefono}</p>

            {/* Datos del cliente — verificar/corregir */}
            <div className="border border-gray-100 rounded-xl p-4 mb-4 bg-gray-50/50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase">Verificar datos del cliente</p>
                {!editDatos ? (
                  <button onClick={() => setEditDatos(true)} className="text-xs text-teal-600 hover:underline font-medium">✏️ Corregir</button>
                ) : (
                  <button onClick={guardarDatosCliente} className="text-xs text-green-600 hover:underline font-medium">💾 Guardar cambios</button>
                )}
              </div>
              {editDatos ? (
                <div className="grid grid-cols-2 gap-2">
                  {[{k:'nombres',l:'Nombres'},{k:'apellidos',l:'Apellidos'},{k:'telefono',l:'Teléfono'},{k:'ciudad',l:'Ciudad'},{k:'edad',l:'Edad'},{k:'patologia',l:'Patología'}].map(({k,l})=>(
                    <div key={k} className={k==='patologia'?'col-span-2':''}>
                      <label className="text-xs text-gray-500">{l}</label>
                      <input value={formDatos[k]||''} onChange={e=>setFormDatos(p=>({...p,[k]:e.target.value}))}
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div><span className="text-xs text-gray-400">Nombre</span><p className="text-gray-700 font-medium">{formDatos.nombres} {formDatos.apellidos}</p></div>
                  <div><span className="text-xs text-gray-400">Teléfono</span><p className="text-gray-700">{formDatos.telefono||'—'}</p></div>
                  <div><span className="text-xs text-gray-400">Ciudad</span><p className="text-gray-700">{formDatos.ciudad||'—'}</p></div>
                  <div><span className="text-xs text-gray-400">Edad</span><p className="text-gray-700">{formDatos.edad||'—'}</p></div>
                  <div className="col-span-2"><span className="text-xs text-gray-400">Patología</span><p className="text-gray-700">{formDatos.patologia||'—'}</p></div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de la cita *</label>
                <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  min={hoyEC()}
                  value={formConfirmar.fecha_cita}
                  onChange={e => setFormConfirmar(f => ({ ...f, fecha_cita: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Hora de la cita</label>
                <input type="time" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  value={formConfirmar.hora_cita}
                  onChange={e => setFormConfirmar(f => ({ ...f, hora_cita: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModal(null)} className="flex-1 text-sm border border-gray-200 rounded-xl py-2.5 hover:bg-gray-50">Cancelar</button>
              <button onClick={confirmarCita} disabled={guardando || !formConfirmar.fecha_cita}
                className="flex-1 text-sm bg-green-500 hover:bg-green-600 text-white rounded-xl py-2.5 font-medium disabled:opacity-50">
                {guardando ? 'Confirmando…' : 'Confirmar cita'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reagendar cita */}
      {modal?.tipo === 'reagendar' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 my-4">
            <h3 className="font-bold text-gray-800 text-lg mb-1">Cambiar fecha y hora de cita</h3>
            <p className="text-sm text-gray-500 mb-4">{modal.lead.nombres} {modal.lead.apellidos} — {modal.lead.telefono}</p>

            {/* Datos del cliente — verificar/corregir */}
            <div className="border border-gray-100 rounded-xl p-4 mb-4 bg-gray-50/50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase">Verificar datos del cliente</p>
                {!editDatos ? (
                  <button onClick={() => setEditDatos(true)} className="text-xs text-teal-600 hover:underline font-medium">✏️ Corregir</button>
                ) : (
                  <button onClick={guardarDatosCliente} className="text-xs text-green-600 hover:underline font-medium">💾 Guardar cambios</button>
                )}
              </div>
              {editDatos ? (
                <div className="grid grid-cols-2 gap-2">
                  {[{k:'nombres',l:'Nombres'},{k:'apellidos',l:'Apellidos'},{k:'telefono',l:'Teléfono'},{k:'ciudad',l:'Ciudad'},{k:'edad',l:'Edad'},{k:'patologia',l:'Patología'}].map(({k,l})=>(
                    <div key={k} className={k==='patologia'?'col-span-2':''}>
                      <label className="text-xs text-gray-500">{l}</label>
                      <input value={formDatos[k]||''} onChange={e=>setFormDatos(p=>({...p,[k]:e.target.value}))}
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div><span className="text-xs text-gray-400">Nombre</span><p className="text-gray-700 font-medium">{formDatos.nombres} {formDatos.apellidos}</p></div>
                  <div><span className="text-xs text-gray-400">Teléfono</span><p className="text-gray-700">{formDatos.telefono||'—'}</p></div>
                  <div><span className="text-xs text-gray-400">Ciudad</span><p className="text-gray-700">{formDatos.ciudad||'—'}</p></div>
                  <div><span className="text-xs text-gray-400">Edad</span><p className="text-gray-700">{formDatos.edad||'—'}</p></div>
                  <div className="col-span-2"><span className="text-xs text-gray-400">Patología</span><p className="text-gray-700">{formDatos.patologia||'—'}</p></div>
                </div>
              )}
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 mb-4">
              Al cambiar la fecha/hora, la cita volvera a estado "Tentativa" y debera ser confirmada nuevamente.
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nueva fecha *</label>
                <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  min={hoyEC()}
                  value={formReagendar.fecha_cita}
                  onChange={e => setFormReagendar(f => ({ ...f, fecha_cita: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nueva hora</label>
                <input type="time" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={formReagendar.hora_cita}
                  onChange={e => setFormReagendar(f => ({ ...f, hora_cita: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModal(null)} className="flex-1 text-sm border border-gray-200 rounded-xl py-2.5 hover:bg-gray-50">Cancelar</button>
              <button onClick={reagendarCita} disabled={guardando || !formReagendar.fecha_cita}
                className="flex-1 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-xl py-2.5 font-medium disabled:opacity-50">
                {guardando ? 'Guardando...' : 'Reagendar cita'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawer detalle al hacer clic en nombre */}
      {drawerPend && (
        <DrawerCita
          lead={drawerPend}
          onClose={() => setDrawerPend(null)}
          onActualizar={() => { setDrawerPend(null); cargar() }}
        />
      )}
    </>
  )
}

// ─── Indicador de citas asignadas ───────────────────────────────────────────

function IndicadorCitasAsignadas() {
  const { usuario } = useAuth()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (usuario?.rol !== 'confirmador') return
    const hoy = hoyEC()
    apiLeads.citasCalendario({ inicio: hoy, fin: hoy })
      .then(data => {
        const total = data.length
        const confirmadas = data.filter(c => c.estado === 'confirmada').length
        const tentativas = data.filter(c => c.estado === 'tentativa').length
        setStats({ total, confirmadas, tentativas })
      })
      .catch(() => {})
  }, [usuario])

  if (!stats || usuario?.rol !== 'confirmador') return null

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-gray-700">Tus citas de hoy:</span>
      </div>
      <span className="inline-flex items-center gap-1 text-xs font-semibold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
        {stats.confirmadas} confirmadas
      </span>
      <span className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
        {stats.tentativas} tentativas
      </span>
      <span className="inline-flex items-center gap-1 text-xs font-semibold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
        {stats.total} total asignadas
      </span>
    </div>
  )
}

// ─── Pagina principal ────────────────────────────────────────────────────────

export default function CalendarioConfirmador() {
  const [tab, setTab] = useState('calendario')

  return (
    <div className="space-y-4">
      {/* Indicador de citas asignadas */}
      <IndicadorCitasAsignadas />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { key: 'calendario', icon: '📅', label: 'Calendario de Citas' },
          { key: 'pendientes', icon: '📞', label: 'Pendientes por Llamar' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-white text-teal-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'calendario' ? <CalendarioVista /> : <PendientesVista />}
    </div>
  )
}
