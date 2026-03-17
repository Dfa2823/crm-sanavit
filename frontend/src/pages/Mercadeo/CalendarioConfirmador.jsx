import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiLeads } from '../../api/leads'
import { apiUsuarios } from '../../api/usuarios'
import { useToast } from '../../context/ToastContext'

export default function CalendarioConfirmador() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [pendientes, setPendientes] = useState([])
  const [tmks, setTmks] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // { tipo: 'confirmar'|'reasignar', lead }
  const [formConfirmar, setFormConfirmar] = useState({ fecha_cita: '', hora_cita: '' })
  const [formReasignar, setFormReasignar] = useState({ tmk_id: '' })
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [pend, usuariosTmk] = await Promise.all([
        apiLeads.calendario(),
        apiUsuarios.listar({ rol: 'tmk' }),
      ])
      setPendientes(pend)
      setTmks(usuariosTmk)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function confirmarCita() {
    if (!formConfirmar.fecha_cita) return
    setGuardando(true)
    try {
      const fecha_cita = `${formConfirmar.fecha_cita}T${formConfirmar.hora_cita || '09:00'}:00`
      await apiLeads.actualizar(modal.lead.id, {
        estado: 'confirmada',
        fecha_cita,
      })
      addToast('Cita confirmada y añadida al pre-manifiesto')
      setModal(null)
      cargar()
    } catch (err) {
      console.error(err)
    } finally {
      setGuardando(false)
    }
  }

  async function reasignarTmk() {
    if (!formReasignar.tmk_id) return
    setGuardando(true)
    try {
      await apiLeads.actualizar(modal.lead.id, {
        tmk_id: Number(formReasignar.tmk_id),
      })
      addToast('TMK reasignado correctamente')
      setModal(null)
      cargar()
    } catch (err) {
      console.error(err)
    } finally {
      setGuardando(false)
    }
  }

  function formatFecha(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('es-EC', {
      weekday: 'short', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <div className="space-y-5">

      {/* Info de contexto */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
        <strong>📅 Calendario del Confirmador:</strong> Prospectos que el TMK tipificó como "Volver a llamar".
        Puedes confirmar la cita (pasa al Pre-manifiesto) o reasignar a otro TMK.
      </div>

      <div className="card overflow-hidden">
        <div className="card-header">
          <h2 className="font-semibold text-gray-700">Pendientes por llamar</h2>
          <div className="flex items-center gap-3">
            <span className="badge-yellow badge">{pendientes.length} pendientes</span>
            <button
              onClick={() => navigate('/mercadeo/premanifiesto')}
              className="btn-secondary btn-sm"
            >
              Ver Pre-manifiesto →
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Cargando...
          </div>
        ) : pendientes.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <div className="text-4xl mb-3">🎉</div>
            <p className="font-medium">Sin pendientes</p>
            <p className="text-sm mt-1">No hay prospectos en el calendario de seguimiento</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Prospecto</th>
                  <th>Teléfono</th>
                  <th>Rellamar el</th>
                  <th>TMK asignado</th>
                  <th>Patología</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pendientes.map(lead => {
                  const vencida = lead.fecha_rellamar && new Date(lead.fecha_rellamar) < new Date()
                  return (
                    <tr key={lead.id}>
                      <td>
                        <div className="font-medium text-gray-800">
                          {lead.nombres} {lead.apellidos}
                        </div>
                        <div className="text-xs text-gray-400">{lead.ciudad}</div>
                      </td>
                      <td className="font-mono text-sm text-gray-600">
                        <a
                          href={`tel:${lead.telefono}`}
                          className="text-blue-600 hover:underline"
                          onClick={e => e.stopPropagation()}
                        >
                          {lead.telefono}
                        </a>
                      </td>
                      <td>
                        <span className={`text-sm font-medium ${vencida ? 'text-red-600' : 'text-gray-700'}`}>
                          {vencida ? '⚠️ ' : ''}{formatFecha(lead.fecha_rellamar)}
                        </span>
                      </td>
                      <td className="text-sm text-gray-600">{lead.tmk_nombre || '—'}</td>
                      <td className="text-sm text-gray-500 max-w-xs truncate">{lead.patologia}</td>
                      <td>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setModal({ tipo: 'confirmar', lead })
                              setFormConfirmar({ fecha_cita: '', hora_cita: '' })
                            }}
                            className="btn-success btn-sm whitespace-nowrap"
                          >
                            ✅ Confirmar cita
                          </button>
                          <button
                            onClick={() => {
                              setModal({ tipo: 'reasignar', lead })
                              setFormReasignar({ tmk_id: '' })
                            }}
                            className="btn-secondary btn-sm whitespace-nowrap"
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
            <p className="text-sm text-gray-500 mb-4">
              {modal.lead.nombres} {modal.lead.apellidos} — {modal.lead.telefono}
            </p>

            <div className="space-y-3">
              <div>
                <label className="label">Fecha de la cita *</label>
                <input
                  type="date" className="input"
                  min={new Date().toISOString().split('T')[0]}
                  value={formConfirmar.fecha_cita}
                  onChange={e => setFormConfirmar(f => ({ ...f, fecha_cita: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Hora de la cita</label>
                <input
                  type="time" className="input"
                  value={formConfirmar.hora_cita}
                  onChange={e => setFormConfirmar(f => ({ ...f, hora_cita: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">
                Cancelar
              </button>
              <button
                onClick={confirmarCita}
                disabled={guardando || !formConfirmar.fecha_cita}
                className="btn-success flex-1 justify-center"
              >
                {guardando ? 'Confirmando...' : 'Confirmar cita'}
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
            <p className="text-sm text-gray-500 mb-4">
              {modal.lead.nombres} {modal.lead.apellidos}
            </p>

            <div>
              <label className="label">Seleccionar nuevo TMK</label>
              <select
                className="input"
                value={formReasignar.tmk_id}
                onChange={e => setFormReasignar({ tmk_id: e.target.value })}
              >
                <option value="">Seleccionar TMK...</option>
                {tmks.map(t => (
                  <option key={t.id} value={t.id}>{t.nombre} — {t.sala_nombre}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1 justify-center">
                Cancelar
              </button>
              <button
                onClick={reasignarTmk}
                disabled={guardando || !formReasignar.tmk_id}
                className="btn-primary flex-1 justify-center"
              >
                {guardando ? 'Guardando...' : 'Reasignar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
