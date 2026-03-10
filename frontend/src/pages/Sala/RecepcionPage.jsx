import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiCitas } from '../../api/citas'
import { apiPersonas } from '../../api/personas'
import { apiUsuarios } from '../../api/usuarios'
import { useAuth } from '../../context/AuthContext'

const CAL_LABEL = {
  TOUR:    { label: '🟢 TOUR',    cls: 'badge-green' },
  NO_TOUR: { label: '🔴 NO TOUR', cls: 'badge-red' },
  NO_SHOW: { label: '⚫ NO SHOW', cls: 'badge-gray' },
}

const ESTADO_LABEL = {
  confirmada:  { label: '✅ Confirmada', cls: 'badge-green' },
  tentativa:   { label: '📋 Tentativa',  cls: 'badge-yellow' },
  tour:        { label: '🟢 TOUR',       cls: 'badge-green' },
  no_tour:     { label: '🔴 NO TOUR',    cls: 'badge-red' },
  no_show:     { label: '⚫ NO SHOW',    cls: 'badge-gray' },
  inasistencia:{ label: '🚫 Inasistencia', cls: 'badge-gray' },
}

export default function RecepcionPage() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [citas, setCitas] = useState([])
  const [consultores, setConsultores] = useState([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [busquedaResultados, setBusquedaResultados] = useState([])
  const [buscandoPersona, setBuscandoPersona] = useState(false)
  const [modalCalificar, setModalCalificar] = useState(null)
  const [formCalificar, setFormCalificar] = useState({
    calificacion: '',
    hora_llegada: new Date().toTimeString().slice(0,5),
    consultor_id: '',
    acompanante: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [citasHoy, listaCons] = await Promise.all([
        apiCitas.hoy({ sala_id: usuario.sala_id }),
        apiUsuarios.listar({ sala_id: usuario.sala_id, rol: 'consultor' }),
      ])
      setCitas(citasHoy)
      setConsultores(listaCons)
    } finally {
      setLoading(false)
    }
  }, [usuario])

  useEffect(() => { cargar() }, [cargar])

  // Búsqueda de persona (buscador de clientes sin cita)
  useEffect(() => {
    if (busqueda.length < 3) { setBusquedaResultados([]); return }
    const t = setTimeout(async () => {
      setBuscandoPersona(true)
      const res = await apiPersonas.buscar(busqueda).catch(() => [])
      setBusquedaResultados(res.slice(0, 5))
      setBuscandoPersona(false)
    }, 400)
    return () => clearTimeout(t)
  }, [busqueda])

  async function handleCalificar() {
    if (!formCalificar.calificacion) return
    setGuardando(true)
    try {
      await apiCitas.calificar(modalCalificar.lead_id, {
        calificacion: formCalificar.calificacion,
        hora_llegada: formCalificar.hora_llegada || null,
        consultor_id: formCalificar.consultor_id || null,
        acompanante: formCalificar.acompanante || null,
      })
      setMensaje(`✅ Cliente calificado como ${formCalificar.calificacion}`)
      setModalCalificar(null)
      cargar()
    } catch (err) {
      console.error(err)
    } finally {
      setGuardando(false)
    }
  }

  const hoyStr = new Date().toLocaleDateString('es-EC', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  const tours    = citas.filter(c => c.calificacion === 'TOUR').length
  const noTours  = citas.filter(c => c.calificacion === 'NO_TOUR').length
  const noShows  = citas.filter(c => c.calificacion === 'NO_SHOW').length
  const sinCal   = citas.filter(c => !c.calificacion).length

  return (
    <div className="space-y-5">

      {/* Stats del día */}
      <div className="grid grid-cols-4 gap-3">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{citas.length}</div>
          <div className="text-xs text-gray-500">Total citas</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{tours}</div>
          <div className="text-xs text-gray-500">TOUR ✅</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{noTours}</div>
          <div className="text-xs text-gray-500">NO TOUR ❌</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">{sinCal}</div>
          <div className="text-xs text-gray-500">Por calificar ⏳</div>
        </div>
      </div>

      {/* Alerta mensaje */}
      {mensaje && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex justify-between">
          {mensaje}
          <button onClick={() => setMensaje('')} className="text-green-500">×</button>
        </div>
      )}

      {/* Buscador de clientes sin cita */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">🔍 Buscar cliente (sin cita previa)</h3>
        <div className="relative max-w-sm">
          <input
            type="text"
            className="input"
            placeholder="Nombre o teléfono..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          {buscandoPersona && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              <span className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin block" />
            </span>
          )}
        </div>
        {busquedaResultados.length > 0 && (
          <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
            {busquedaResultados.map(p => (
              <button
                key={p.id}
                onClick={() => { setBusqueda(''); setBusquedaResultados([]); navigate(`/sala/cliente/${p.id}`) }}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 border-b last:border-0 border-gray-100"
              >
                <span className="font-medium text-gray-800">{p.nombres} {p.apellidos}</span>
                <span className="text-gray-400 ml-2">{p.telefono}</span>
                <span className="text-gray-400 ml-2 text-xs">{p.ciudad}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lista de citas del día */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div>
            <h2 className="font-semibold text-gray-700">Citas de hoy</h2>
            <p className="text-xs text-gray-400 capitalize">{hoyStr}</p>
          </div>
          <button onClick={cargar} className="btn-secondary btn-sm">🔄 Actualizar</button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Cargando...
          </div>
        ) : citas.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <div className="text-4xl mb-3">📭</div>
            <p className="font-medium">Sin citas registradas para hoy</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Hora cita</th>
                  <th>Hora llegada</th>
                  <th>Consultor</th>
                  <th>TMK</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {citas.map(cita => (
                  <tr key={cita.lead_id} onClick={() => navigate(`/sala/cliente/${cita.persona_id}`)}>
                    <td>
                      <div className="font-medium text-gray-800">
                        {cita.nombres} {cita.apellidos}
                      </div>
                      <div className="text-xs text-gray-400">{cita.ciudad} · {cita.edad} años</div>
                    </td>
                    <td className="text-sm font-mono text-gray-700">
                      {cita.fecha_cita
                        ? new Date(cita.fecha_cita).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                    <td className="text-sm font-mono text-gray-600">
                      {cita.hora_llegada || '—'}
                    </td>
                    <td className="text-sm text-gray-600">
                      {cita.consultor_nombre || <span className="text-gray-300">Sin asignar</span>}
                    </td>
                    <td className="text-sm text-gray-500">{cita.tmk_nombre}</td>
                    <td>
                      {cita.calificacion
                        ? <span className={`badge ${CAL_LABEL[cita.calificacion]?.cls}`}>
                            {CAL_LABEL[cita.calificacion]?.label}
                          </span>
                        : <span className={`badge ${ESTADO_LABEL[cita.estado]?.cls || 'badge-gray'}`}>
                            {ESTADO_LABEL[cita.estado]?.label || cita.estado}
                          </span>
                      }
                    </td>
                    <td>
                      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                        {!cita.calificacion && (
                          <button
                            onClick={() => {
                              setModalCalificar(cita)
                              setFormCalificar({
                                calificacion: '',
                                hora_llegada: new Date().toTimeString().slice(0,5),
                                consultor_id: '',
                                acompanante: '',
                              })
                            }}
                            className="btn-primary btn-sm whitespace-nowrap"
                          >
                            Calificar
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/sala/cliente/${cita.persona_id}`)}
                          className="btn-secondary btn-sm"
                        >
                          Ver →
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Calificar visita */}
      {modalCalificar && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-gray-800 text-lg mb-1">Registrar llegada y calificar</h3>
            <p className="text-sm text-gray-500 mb-5">
              {modalCalificar.nombres} {modalCalificar.apellidos}
            </p>

            {/* Calificación — 3 botones grandes */}
            <div className="mb-4">
              <label className="label">Calificación *</label>
              <div className="grid grid-cols-3 gap-3 mt-1">
                {[
                  { val: 'TOUR',    label: 'TOUR',    icon: '🟢', cls: 'border-green-400 bg-green-50 text-green-700' },
                  { val: 'NO_TOUR', label: 'NO TOUR', icon: '🔴', cls: 'border-red-400 bg-red-50 text-red-700' },
                  { val: 'NO_SHOW', label: 'NO SHOW', icon: '⚫', cls: 'border-gray-400 bg-gray-50 text-gray-700' },
                ].map(({ val, label, icon, cls }) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setFormCalificar(f => ({ ...f, calificacion: val }))}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 font-semibold text-sm transition-all
                      ${formCalificar.calificacion === val ? cls + ' ring-2 ring-offset-1 ring-blue-400' : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}
                  >
                    <span className="text-2xl mb-1">{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="label">Hora de llegada</label>
                <input
                  type="time" className="input"
                  value={formCalificar.hora_llegada}
                  onChange={e => setFormCalificar(f => ({ ...f, hora_llegada: e.target.value }))}
                />
              </div>

              <div>
                <label className="label">Consultor asignado</label>
                <select
                  className="input"
                  value={formCalificar.consultor_id}
                  onChange={e => setFormCalificar(f => ({ ...f, consultor_id: e.target.value }))}
                >
                  <option value="">Sin asignar</option>
                  {consultores.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Acompañante (opcional)</label>
                <input
                  type="text" className="input"
                  placeholder="Nombre del acompañante..."
                  value={formCalificar.acompanante}
                  onChange={e => setFormCalificar(f => ({ ...f, acompanante: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setModalCalificar(null)} className="btn-secondary flex-1 justify-center">
                Cancelar
              </button>
              <button
                onClick={handleCalificar}
                disabled={guardando || !formCalificar.calificacion}
                className="btn-primary flex-1 justify-center"
              >
                {guardando ? 'Guardando...' : 'Guardar calificación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
