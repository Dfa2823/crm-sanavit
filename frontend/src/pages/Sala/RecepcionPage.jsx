import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiCitas } from '../../api/citas'
import { apiPersonas } from '../../api/personas'
import { apiUsuarios } from '../../api/usuarios'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import LastUpdated from '../../components/UI/LastUpdated'

function exportarManifiestoPDF(citas, hoyStr) {
  if (!citas.length) return
  const filas = citas.map(c => `
    <tr>
      <td>${c.nombres || ''} ${c.apellidos || ''}<br><small>${c.ciudad || ''} · ${c.edad || ''} años</small></td>
      <td>${c.fecha_cita ? new Date(c.fecha_cita).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
      <td>${c.hora_llegada || '—'}</td>
      <td>${c.consultor_nombre || '—'}</td>
      <td>${c.tmk_nombre || '—'}</td>
      <td>${c.outsourcing_nombre || 'Interno'}</td>
      <td>${c.calificacion || c.estado || '—'}</td>
      <td>${c.acompanante || '—'}</td>
    </tr>`).join('')

  const tours   = citas.filter(c => c.calificacion === 'TOUR').length
  const noTours = citas.filter(c => c.calificacion === 'NO_TOUR').length
  const sinCal  = citas.filter(c => !c.calificacion).length

  const html = `<!DOCTYPE html><html lang="es"><head>
    <meta charset="UTF-8"><title>Manifiesto del Día</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 9px; color: #222; margin: 0; }
      h1 { font-size: 14px; margin: 0 0 2px; }
      .sub { color: #6b7280; font-size: 8px; margin: 0 0 6px; }
      .stats { display: flex; gap: 16px; margin-bottom: 10px; font-size: 10px; }
      .stat { font-weight: bold; }
      .stat span { color: #6b7280; font-weight: normal; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #f3f4f6; padding: 4px 5px; font-size: 8px; border: 1px solid #d1d5db; text-align: left; }
      td { padding: 3px 5px; border: 1px solid #e5e7eb; vertical-align: top; }
      tr:nth-child(even) td { background: #f9fafb; }
      small { color: #9ca3af; }
      @page { margin: 1cm; size: A4 landscape; }
    </style></head><body>
    <h1>Manifiesto del Día — ${hoyStr}</h1>
    <p class="sub">Generado el ${new Date().toLocaleString('es-EC')} — ${citas.length} citas</p>
    <div class="stats">
      <div class="stat">${tours} <span>TOUR</span></div>
      <div class="stat">${noTours} <span>NO TOUR</span></div>
      <div class="stat">${sinCal} <span>Por calificar</span></div>
    </div>
    <table>
      <thead><tr>
        <th>Cliente</th><th>Hora cita</th><th>Hora llegada</th>
        <th>Consultor</th><th>TMK</th><th>Call Center</th><th>Calificación</th><th>Acompañante</th>
      </tr></thead>
      <tbody>${filas}</tbody>
    </table>
  </body></html>`

  const w = window.open('', '_blank', 'width=1100,height=750')
  if (!w) { alert('Permite ventanas emergentes para exportar PDF'); return }
  w.document.write(html); w.document.close(); w.focus()
  setTimeout(() => { w.print(); w.close() }, 600)
}

function exportarManifiestoCSV(citas) {
  if (!citas.length) return
  const cols = ['Nombres', 'Apellidos', 'Teléfono', 'Ciudad', 'Edad', 'Hora cita', 'Hora llegada', 'Consultor', 'TMK', 'Call Center', 'Calificación', 'Estado', 'Acompañante']
  const rows = citas.map(c => [
    c.nombres || '',
    c.apellidos || '',
    c.telefono || '',
    c.ciudad || '',
    c.edad || '',
    c.fecha_cita ? new Date(c.fecha_cita).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : '',
    c.hora_llegada || '',
    c.consultor_nombre || '',
    c.tmk_nombre || '',
    c.outsourcing_nombre || 'Interno',
    c.calificacion || '',
    c.estado || '',
    c.acompanante || '',
  ])
  const csv = [cols, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `manifiesto-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const CAL_LABEL = {
  TOUR:    { label: '🟢 TOUR',    cls: 'badge-green' },
  NO_TOUR: { label: '🔴 NO TOUR', cls: 'badge-red' },
}

const ESTADO_LABEL = {
  confirmada:  { label: '✅ Confirmada', cls: 'badge-green' },
  tentativa:   { label: '📋 Tentativa',  cls: 'badge-yellow' },
  tour:        { label: '🟢 TOUR',       cls: 'badge-green' },
  no_tour:     { label: '🔴 NO TOUR',    cls: 'badge-red' },
  inasistencia:{ label: '🚫 Inasistencia', cls: 'badge-gray' },
}

export default function RecepcionPage() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const { addToast } = useToast()
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
  const [lastUpdated, setLastUpdated] = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [citasHoy, listaCons] = await Promise.all([
        apiCitas.hoy({ sala_id: usuario.sala_id }),
        apiUsuarios.listar({ sala_id: usuario.sala_id, rol: 'consultor' }),
      ])
      setCitas(citasHoy)
      setConsultores(listaCons)
      setLastUpdated(new Date())
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
      addToast(modalCalificar.calificacion
        ? `Calificacion actualizada a ${formCalificar.calificacion}`
        : `Cliente calificado como ${formCalificar.calificacion}`)
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
  const sinCal   = citas.filter(c => !c.calificacion).length

  return (
    <div className="space-y-5 animate-fadeIn">

      {/* Stats del día */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4 text-center hover-lift animate-staggerFadeIn" style={{ animationDelay: '0s' }}>
          <div className="text-2xl font-bold text-blue-600 animate-countUp">{citas.length}</div>
          <div className="text-xs text-gray-500">Total citas</div>
        </div>
        <div className="card p-4 text-center hover-lift animate-staggerFadeIn" style={{ animationDelay: '0.08s' }}>
          <div className="text-2xl font-bold text-green-600 animate-countUp">{tours}</div>
          <div className="text-xs text-gray-500">TOUR</div>
        </div>
        <div className="card p-4 text-center hover-lift animate-staggerFadeIn" style={{ animationDelay: '0.16s' }}>
          <div className="text-2xl font-bold text-red-600 animate-countUp">{noTours}</div>
          <div className="text-xs text-gray-500">NO TOUR</div>
        </div>
        <div className="card p-4 text-center hover-lift animate-staggerFadeIn" style={{ animationDelay: '0.24s' }}>
          <div className="text-2xl font-bold text-yellow-600 animate-countUp">{sinCal}</div>
          <div className="text-xs text-gray-500">Por calificar</div>
        </div>
      </div>

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
            <LastUpdated timestamp={lastUpdated} />
          </div>
          <div className="flex gap-2">
            <button onClick={cargar} className="btn-secondary btn-sm">🔄 Actualizar</button>
            <button
              onClick={() => exportarManifiestoPDF(citas, hoyStr)}
              disabled={!citas.length}
              className="btn btn-sm border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              🖨️ PDF
            </button>
            <button
              onClick={() => exportarManifiestoCSV(citas)}
              disabled={!citas.length}
              className="btn btn-sm border border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              📄 CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 animate-fadeIn p-4">
            <div className="shimmer h-10 w-full rounded-lg" />
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="shimmer h-14 w-full rounded-lg" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        ) : citas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 animate-fadeIn">
            <div className="w-20 h-20 rounded-2xl bg-gray-50 flex items-center justify-center mb-5">
              <svg className="w-10 h-10 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>
            </div>
            <p className="text-sm font-medium text-gray-500">Sin citas registradas para hoy</p>
            <p className="text-xs text-gray-400 mt-1.5">Las citas del manifiesto apareceran aqui</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="crm-table">
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
                        {!cita.calificacion ? (
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
                            title="Calificar cita del cliente"
                          >
                            Calificar
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setModalCalificar(cita)
                              setFormCalificar({
                                calificacion: cita.calificacion || '',
                                hora_llegada: cita.hora_llegada || new Date().toTimeString().slice(0,5),
                                consultor_id: cita.consultor_id || '',
                                acompanante: cita.acompanante || '',
                              })
                            }}
                            className="btn btn-secondary btn-sm whitespace-nowrap"
                            title="Editar calificacion de cita"
                          >
                            Editar
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/sala/cliente/${cita.persona_id}`)}
                          className="btn-secondary btn-sm"
                          title="Ver hoja de vida del cliente"
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
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal max-w-md p-6 animate-fadeInScale">
            <h3 className="font-bold text-gray-800 text-lg mb-1">
              {modalCalificar.calificacion ? 'Editar calificacion' : 'Registrar llegada y calificar'}
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              {modalCalificar.nombres} {modalCalificar.apellidos}
              {modalCalificar.calificacion && (
                <span className="ml-2 text-xs text-amber-600 font-medium">
                  (Actual: {modalCalificar.calificacion === 'TOUR' ? 'TOUR' : 'NO TOUR'})
                </span>
              )}
            </p>

            {/* Calificación — 3 botones grandes */}
            <div className="mb-4">
              <label className="label">Calificación *</label>
              <div className="grid grid-cols-3 gap-3 mt-1">
                {[
                  { val: 'TOUR',    label: 'TOUR',    icon: '🟢', cls: 'border-green-400 bg-green-50 text-green-700' },
                  { val: 'NO_TOUR', label: 'NO TOUR', icon: '🔴', cls: 'border-red-400 bg-red-50 text-red-700' },
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
                {guardando ? 'Guardando...' : modalCalificar.calificacion ? 'Actualizar calificacion' : 'Guardar calificacion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
