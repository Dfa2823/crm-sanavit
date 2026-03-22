import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { apiLeads } from '../../api/leads'
import { apiPersonas } from '../../api/personas'
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
  confirmada:  '✅ Confirmada',
  tentativa:   '📋 Tentativa',
  cancelada:   '❌ Cancelada',
  inasistencia:'🚫 Inasistencia',
  tour:        '🟢 TOUR',
  no_tour:     '🔴 NO TOUR',
}

export default function TMKDashboard() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [tipificaciones, setTipificaciones] = useState([])
  const [editandoObs, setEditandoObs] = useState(null) // lead.id que está editando observación
  const [obsTemp, setObsTemp] = useState('')
  const [editandoRellamar, setEditandoRellamar] = useState(null) // lead.id que muestra date picker
  const [fechaRellamar, setFechaRellamar] = useState('')

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

  // Cargar tipificaciones para el dropdown inline
  useEffect(() => {
    apiLeads.configuracion().then(cfg => {
      if (cfg?.tipificaciones) setTipificaciones(cfg.tipificaciones)
    }).catch(console.error)
  }, [])

  // Cambiar tipificación inline
  async function cambiarTipificacion(leadId, tipificacionId) {
    try {
      const tip = tipificaciones.find(t => t.id == tipificacionId)
      await apiLeads.actualizar(leadId, { tipificacion_id: tipificacionId })
      setLeads(prev => prev.map(l => l.id === leadId
        ? { ...l, tipificacion_id: tipificacionId, tipificacion_nombre: tip?.nombre }
        : l
      ))
      // Si la tipificación requiere fecha de rellamada, mostrar date picker
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

  // Guardar observación rápida
  async function guardarObservacion(leadId) {
    try {
      await apiLeads.actualizar(leadId, { observacion: obsTemp })
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, observacion: obsTemp } : l))
      setEditandoObs(null)
      setObsTemp('')
    } catch (err) { console.error(err) }
  }

  useEffect(() => {
    cargarLeads()
  }, [cargarLeads])

  // Separar leads prioritarios (volver a llamar hoy o antes)
  const leadsPrioridad = leads.filter(l =>
    l.estado === 'pendiente' && l.fecha_rellamar && l.fecha_rellamar.split('T')[0] <= hoy
  )
  const leadsNormales = leads.filter(l =>
    !(l.estado === 'pendiente' && l.fecha_rellamar && l.fecha_rellamar.split('T')[0] <= hoy)
  )

  const leadsFiltrados = [...leadsPrioridad, ...leadsNormales].filter(l => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (
      l.nombres?.toLowerCase().includes(q) ||
      l.apellidos?.toLowerCase().includes(q) ||
      l.telefono?.includes(q)
    )
  })

  // Auto-refresh cada 2 minutos
  useEffect(() => {
    const interval = setInterval(() => { cargarLeads() }, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [cargarLeads])

  // Stats del día / mes
  const leadsHoy = leads.filter(l => l.created_at?.startsWith(hoy))
  const citasAgendadas = leads.filter(l => ['confirmada','tentativa'].includes(l.estado))
  const pendientes = leads.filter(l => l.estado === 'pendiente')
  const mesActual = hoy.substring(0, 7) // YYYY-MM
  const toursMes = leads.filter(l => l.estado === 'tour' && l.created_at?.startsWith(mesActual))

  return (
    <div className="space-y-5">

      {/* Stats rápidos */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card p-5 text-center">
          <div className="text-3xl font-bold text-blue-600">{leadsHoy.length}</div>
          <div className="text-sm text-gray-500 mt-1">Leads hoy</div>
        </div>
        <div className="card p-5 text-center">
          <div className="text-3xl font-bold text-green-600">{citasAgendadas.length}</div>
          <div className="text-sm text-gray-500 mt-1">Citas agendadas</div>
        </div>
        <div className="card p-5 text-center">
          <div className="text-3xl font-bold text-yellow-600">{pendientes.length}</div>
          <div className="text-sm text-gray-500 mt-1">Pendientes</div>
        </div>
        <div className="card p-5 text-center">
          <div className="text-3xl font-bold text-teal-600">{toursMes.length}</div>
          <div className="text-sm text-gray-500 mt-1">Tours del mes</div>
        </div>
      </div>

      {/* Cabecera con buscador */}
      <div className="flex items-center gap-4">
        <input
          type="text"
          className="input max-w-sm"
          placeholder="Buscar por nombre o teléfono..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <div className="flex-1" />
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
          <h2 className="font-semibold text-gray-700">Todos los leads</h2>
          <span className="badge-blue badge">{leadsFiltrados.length} registros</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Cargando...
          </div>
        ) : leadsFiltrados.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <div className="text-4xl mb-3">📞</div>
            <p className="font-medium">No hay leads registrados</p>
            <p className="text-sm mt-1">Haz clic en "+ Nuevo Lead" para comenzar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Teléfono</th>
                  <th>Fuente</th>
                  <th>Tipificación</th>
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
                    className={esPrioridad ? 'bg-amber-50 border-l-4 border-l-amber-400' : ''}
                  >
                    <td className="cursor-pointer" onClick={() => navigate(`/sala/cliente/${lead.persona_id}`)}>
                      <div className="font-medium text-gray-800">
                        {lead.nombres} {lead.apellidos}
                      </div>
                      <div className="text-xs text-gray-400">{lead.ciudad}</div>
                      {esPrioridad && (
                        <span className="inline-block mt-0.5 text-[10px] font-bold text-amber-700 bg-amber-200 px-1.5 py-0.5 rounded">
                          PENDIENTE HOY
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
                        >📱</a>
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
                      {/* Observación rápida */}
                      {editandoObs === lead.id ? (
                        <div className="mt-1 flex gap-1">
                          <input
                            type="text"
                            className="text-xs border border-gray-200 rounded px-2 py-1 flex-1 focus:outline-none focus:ring-1 focus:ring-teal-400"
                            placeholder="Observación..."
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
                          title={lead.observacion || 'Agregar observación'}
                        >
                          {lead.observacion ? `💬 ${lead.observacion}` : '+ Nota'}
                        </button>
                      )}
                    </td>
                    <td className="text-gray-500 text-sm">
                      {lead.fecha_cita
                        ? new Date(lead.fecha_cita).toLocaleDateString('es-EC', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                          })
                        : lead.fecha_rellamar
                          ? `📅 ${new Date(lead.fecha_rellamar).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })}`
                          : '—'}
                    </td>
                    <td>
                      <span className={`badge ${ESTADO_BADGE[lead.estado] || 'badge-gray'}`}>
                        {ESTADO_LABEL[lead.estado] || lead.estado}
                      </span>
                    </td>
                    <td className="text-gray-500 text-sm">{lead.tmk_nombre}</td>
                    <td>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/sala/cliente/${lead.persona_id}`)
                        }}
                        className="text-blue-500 hover:text-blue-700 text-xs font-medium"
                      >
                        Ver →
                      </button>
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
    </div>
  )
}
