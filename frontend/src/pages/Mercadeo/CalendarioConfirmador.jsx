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
import { apiUsuarios } from '../../api/usuarios'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'

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
  no_show:    { color: '#fff', bg: '#6b7280', label: 'No Show'    },
}

// ─── Drawer detalle de cita ──────────────────────────────────────────────────

function DrawerCita({ lead, onClose, onActualizar }) {
  const navigate  = useNavigate()
  const { addToast } = useToast()
  const { usuario } = useAuth()
  const [editFecha, setEditFecha]  = useState(false)
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [nuevaHora, setNuevaHora]  = useState('')
  const [guardando, setGuardando]  = useState(false)

  const esAdmin = ['admin', 'director', 'supervisor_cc', 'confirmador'].includes(usuario?.rol)

  useEffect(() => {
    if (lead?.fecha_cita) {
      const d = new Date(lead.fecha_cita)
      setNuevaFecha(d.toISOString().split('T')[0])
      setNuevaHora(d.toTimeString().slice(0, 5))
    }
  }, [lead])

  if (!lead) return null

  const est = ESTADO[lead.estado] || { color: '#fff', bg: '#94a3b8', label: lead.estado }

  async function guardarFecha() {
    if (!nuevaFecha) return
    setGuardando(true)
    try {
      await apiLeads.actualizar(lead.id, {
        fecha_cita: `${nuevaFecha}T${nuevaHora || '09:00'}:00`,
      })
      addToast('Cita reprogramada')
      setEditFecha(false)
      onActualizar()
    } catch { addToast('Error al reprogramar', 'error') }
    finally { setGuardando(false) }
  }

  async function confirmar() {
    setGuardando(true)
    try {
      await apiLeads.actualizar(lead.id, { estado: 'confirmada' })
      addToast('Estado actualizado a Confirmada')
      onActualizar()
    } catch { addToast('Error al actualizar', 'error') }
    finally { setGuardando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/30" />
      <div
        className="w-full max-w-sm bg-white shadow-2xl flex flex-col h-full overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h2 className="font-bold text-gray-800 text-base leading-tight">
              {lead.nombres} {lead.apellidos}
            </h2>
            <a href={`tel:${lead.telefono}`} className="text-sm text-teal-600 font-mono hover:underline mt-0.5 block">
              {lead.telefono}
            </a>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-light ml-3">×</button>
        </div>

        <div className="px-5 py-4 space-y-4 flex-1">
          {/* Estado */}
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-semibold px-3 py-1 rounded-full"
              style={{ background: est.bg, color: est.color }}
            >
              {est.label}
            </span>
            {lead.tipificacion_nombre && (
              <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                {lead.tipificacion_nombre}
              </span>
            )}
          </div>

          {/* Fecha cita */}
          <div>
            <p className="text-xs text-gray-500 font-medium mb-1">Fecha y hora de cita</p>
            {editFecha ? (
              <div className="space-y-2">
                <input type="date" value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                <input type="time" value={nuevaHora} onChange={e => setNuevaHora(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                <div className="flex gap-2">
                  <button onClick={guardarFecha} disabled={guardando}
                    className="flex-1 text-xs bg-teal-500 hover:bg-teal-600 text-white rounded-lg py-1.5 font-medium disabled:opacity-50">
                    {guardando ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button onClick={() => setEditFecha(false)}
                    className="flex-1 text-xs border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-800">
                  {lead.fecha_cita
                    ? new Date(lead.fecha_cita).toLocaleString('es-EC', {
                        weekday: 'short', day: '2-digit', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                      })
                    : '—'}
                </p>
                {esAdmin && (
                  <button onClick={() => setEditFecha(true)}
                    className="text-xs text-teal-600 hover:underline font-medium ml-2">
                    Cambiar
                  </button>
                )}
              </div>
            )}
          </div>

          {/* TMK */}
          {lead.tmk_nombre && (
            <div>
              <p className="text-xs text-gray-500 font-medium mb-0.5">TMK asignado</p>
              <p className="text-sm text-gray-700">{lead.tmk_nombre}</p>
            </div>
          )}

          {/* Sala */}
          {lead.sala_nombre && (
            <div>
              <p className="text-xs text-gray-500 font-medium mb-0.5">Sala</p>
              <p className="text-sm text-gray-700">{lead.sala_nombre}</p>
            </div>
          )}

          {/* Ciudad */}
          {lead.ciudad && (
            <div>
              <p className="text-xs text-gray-500 font-medium mb-0.5">Ciudad</p>
              <p className="text-sm text-gray-700">{lead.ciudad}</p>
            </div>
          )}

          {/* Observación */}
          {lead.observacion && (
            <div>
              <p className="text-xs text-gray-500 font-medium mb-0.5">Observación</p>
              <p className="text-sm text-gray-600 leading-relaxed">{lead.observacion}</p>
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-2">
          {lead.persona_id && (
            <button
              onClick={() => navigate(`/sala/cliente/${lead.persona_id}`)}
              className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
            >
              👤 Ver hoja de vida del cliente
            </button>
          )}
          {esAdmin && lead.estado === 'tentativa' && (
            <button
              onClick={confirmar}
              disabled={guardando}
              className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50"
            >
              ✅ Confirmar cita
            </button>
          )}
        </div>
      </div>
    </div>
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
      const eventos = data.map(lead => ({
        id:       lead.id,
        title:    `${lead.nombres} ${lead.apellidos}`,
        start:    new Date(lead.fecha_cita),
        end:      addHours(new Date(lead.fecha_cita), 1),
        resource: lead,
      }))
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
      await apiLeads.actualizar(event.resource.id, {
        fecha_cita: start.toISOString(),
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
  const [tmks, setTmks]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState(null)
  const [formConfirmar, setFormConfirmar] = useState({ fecha_cita: '', hora_cita: '' })
  const [formReasignar, setFormReasignar] = useState({ tmk_id: '' })
  const [guardando, setGuardando]   = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [pend, usuariosTmk] = await Promise.all([
        apiLeads.calendario(),
        apiUsuarios.listar({ rol: 'tmk' }),
      ])
      setPendientes(pend)
      setTmks(usuariosTmk)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function confirmarCita() {
    if (!formConfirmar.fecha_cita) return
    setGuardando(true)
    try {
      await apiLeads.actualizar(modal.lead.id, {
        estado: 'confirmada',
        fecha_cita: `${formConfirmar.fecha_cita}T${formConfirmar.hora_cita || '09:00'}:00`,
      })
      addToast('Cita confirmada y añadida al pre-manifiesto')
      setModal(null)
      cargar()
    } catch (err) { console.error(err) }
    finally { setGuardando(false) }
  }

  async function reasignarTmk() {
    if (!formReasignar.tmk_id) return
    setGuardando(true)
    try {
      await apiLeads.actualizar(modal.lead.id, { tmk_id: Number(formReasignar.tmk_id) })
      addToast('TMK reasignado correctamente')
      setModal(null)
      cargar()
    } catch (err) { console.error(err) }
    finally { setGuardando(false) }
  }

  function formatFecha(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('es-EC', {
      weekday: 'short', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <>
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700 mb-4">
        <strong>📞 Pendientes por llamar:</strong> Prospectos tipificados como "Volver a llamar".
        Confirma la cita (pasa al Pre-manifiesto) o reasigna a otro TMK.
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
                        <p className="font-medium text-gray-800">{lead.nombres} {lead.apellidos}</p>
                        <p className="text-xs text-gray-400">{lead.ciudad}</p>
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
                            onClick={() => { setModal({ tipo: 'confirmar', lead }); setFormConfirmar({ fecha_cita: '', hora_cita: '' }) }}
                            className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium whitespace-nowrap"
                          >
                            ✅ Confirmar cita
                          </button>
                          <button
                            onClick={() => { setModal({ tipo: 'reasignar', lead }); setFormReasignar({ tmk_id: '' }) }}
                            className="text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded-lg whitespace-nowrap"
                          >
                            Reasignar TMK
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
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-gray-800 text-lg mb-1">Confirmar cita</h3>
            <p className="text-sm text-gray-500 mb-4">{modal.lead.nombres} {modal.lead.apellidos} — {modal.lead.telefono}</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de la cita *</label>
                <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                  min={new Date().toISOString().split('T')[0]}
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

      {/* Modal Reasignar TMK */}
      {modal?.tipo === 'reasignar' && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-gray-800 text-lg mb-1">Reasignar TMK</h3>
            <p className="text-sm text-gray-500 mb-4">{modal.lead.nombres} {modal.lead.apellidos}</p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Seleccionar nuevo TMK</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                value={formReasignar.tmk_id}
                onChange={e => setFormReasignar({ tmk_id: e.target.value })}>
                <option value="">Seleccionar TMK…</option>
                {tmks.map(t => <option key={t.id} value={t.id}>{t.nombre} — {t.sala_nombre}</option>)}
              </select>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModal(null)} className="flex-1 text-sm border border-gray-200 rounded-xl py-2.5 hover:bg-gray-50">Cancelar</button>
              <button onClick={reasignarTmk} disabled={guardando || !formReasignar.tmk_id}
                className="flex-1 text-sm bg-teal-500 hover:bg-teal-600 text-white rounded-xl py-2.5 font-medium disabled:opacity-50">
                {guardando ? 'Guardando…' : 'Reasignar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────

export default function CalendarioConfirmador() {
  const [tab, setTab] = useState('calendario')

  return (
    <div className="space-y-4">
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
