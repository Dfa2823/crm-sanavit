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
  no_show:     'badge-gray',
}

const ESTADO_LABEL = {
  pendiente:   'Pendiente',
  confirmada:  '✅ Confirmada',
  tentativa:   '📋 Tentativa',
  cancelada:   '❌ Cancelada',
  inasistencia:'🚫 Inasistencia',
  tour:        '🟢 TOUR',
  no_tour:     '🔴 NO TOUR',
  no_show:     '⚫ NO SHOW',
}

export default function TMKDashboard() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [busqueda, setBusqueda] = useState('')

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
    cargarLeads()
  }, [cargarLeads])

  const leadsFiltrados = leads.filter(l => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (
      l.nombres?.toLowerCase().includes(q) ||
      l.apellidos?.toLowerCase().includes(q) ||
      l.telefono?.includes(q)
    )
  })

  // Stats del día
  const leadsHoy = leads.filter(l => l.created_at?.startsWith(hoy))
  const citasAgendadas = leads.filter(l => ['confirmada','tentativa'].includes(l.estado))
  const pendientes = leads.filter(l => l.estado === 'pendiente')

  return (
    <div className="space-y-5">

      {/* Stats rápidos */}
      <div className="grid grid-cols-3 gap-4">
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
                {leadsFiltrados.map(lead => (
                  <tr
                    key={lead.id}
                    onClick={() => navigate(`/sala/cliente/${lead.persona_id}`)}
                  >
                    <td>
                      <div className="font-medium text-gray-800">
                        {lead.nombres} {lead.apellidos}
                      </div>
                      <div className="text-xs text-gray-400">{lead.ciudad}</div>
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
                    <td className="text-gray-600">{lead.tipificacion_nombre}</td>
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
                ))}
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
