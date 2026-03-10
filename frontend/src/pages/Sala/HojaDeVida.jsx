import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { apiPersonas } from '../../api/personas'
import { useAuth } from '../../context/AuthContext'

const SEGURIDAD_SOCIAL = ['Cotizante','Beneficiario','Subsidiado','Retirado']
const SITUACION_LABORAL = ['Empleado público','Empleado privado','Independiente','Jubilado']
const ESTADO_CIVIL = ['Soltero/a','Casado/a','Divorciado/a','Viudo/a','Unión libre']
const GENERO = ['Masculino','Femenino','Otro']
const TIPO_DOCUMENTO = ['Cédula de identidad','Pasaporte','RUC','Otro']

export default function HojaDeVida() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { usuario } = useAuth()

  const [datos, setDatos] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('info')
  const [editandoContrato, setEditandoContrato] = useState(false)
  const [formContrato, setFormContrato] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiPersonas.obtener(id)
      setDatos(data)
      setFormContrato({
        tipo_documento: data.persona.tipo_documento || '',
        num_documento:  data.persona.num_documento  || '',
        estado_civil:   data.persona.estado_civil   || '',
        genero:         data.persona.genero         || '',
        direccion:      data.persona.direccion       || '',
        email:          data.persona.email           || '',
        fecha_nacimiento: data.persona.fecha_nacimiento
          ? data.persona.fecha_nacimiento.split('T')[0]
          : '',
        situacion_laboral:   data.persona.situacion_laboral   || '',
        tipo_seguridad_social: data.persona.tipo_seguridad_social || '',
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  async function guardarContrato() {
    setGuardando(true)
    try {
      await apiPersonas.actualizar(id, formContrato)
      setMensaje('✅ Datos del contrato guardados')
      setEditandoContrato(false)
      cargar()
    } catch (err) {
      console.error(err)
    } finally {
      setGuardando(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!datos) {
    return (
      <div className="text-center p-12 text-gray-400">
        <p className="text-4xl mb-3">❓</p>
        <p>Cliente no encontrado</p>
        <button onClick={() => navigate(-1)} className="btn-secondary mt-4">← Volver</button>
      </div>
    )
  }

  const { persona, visita } = datos
  const puedeEditarContrato = ['admin','director','hostess','consultor'].includes(usuario.rol)

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* Encabezado */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate(-1)} className="btn-secondary btn-sm mt-1">← Volver</button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">
            {persona.nombres} {persona.apellidos}
          </h1>
          <p className="text-gray-400 text-sm">
            📞 {persona.telefono} · 📍 {persona.ciudad} · 🎂 {persona.edad} años
          </p>
        </div>
        {visita?.calificacion && (
          <div className={`px-4 py-2 rounded-xl font-bold text-lg
            ${visita.calificacion === 'TOUR'    ? 'bg-green-100 text-green-700' :
              visita.calificacion === 'NO_TOUR' ? 'bg-red-100 text-red-700' :
                                                  'bg-gray-100 text-gray-700'}`}>
            {visita.calificacion === 'TOUR' ? '🟢' : visita.calificacion === 'NO_TOUR' ? '🔴' : '⚫'}
            {' '}{visita.calificacion}
          </div>
        )}
      </div>

      {/* Mensaje */}
      {mensaje && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex justify-between">
          {mensaje}
          <button onClick={() => setMensaje('')} className="text-green-500">×</button>
        </div>
      )}

      {/* Tabs */}
      <div className="card overflow-hidden">
        <div className="border-b border-gray-200 flex">
          {[
            { key: 'info',     label: '📞 Lead / TMK' },
            { key: 'visita',   label: '🏥 Visita a Sala' },
            { key: 'contrato', label: '📄 Datos del Contrato' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors
                ${tab === t.key
                  ? 'border-blue-500 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* TAB: Info del Lead (TMK) */}
        {tab === 'info' && (
          <div className="p-6">
            <div className="grid grid-cols-2 gap-6">
              <Campo label="Nombres y apellidos" valor={`${persona.nombres} ${persona.apellidos}`} />
              <Campo label="Teléfono" valor={persona.telefono} />
              <Campo label="Ciudad" valor={persona.ciudad} />
              <Campo label="Edad" valor={persona.edad ? `${persona.edad} años` : '—'} />
              <Campo label="Motivo / Patología" valor={persona.patologia || persona.lead_patologia || '—'} span />
              <Campo label="Fuente del lead" valor={persona.fuente_nombre || '—'} />
              <Campo label="Tipificación" valor={persona.tipificacion_nombre || '—'} />
              <Campo label="TMK que llamó" valor={persona.tmk_nombre || '—'} />
              <Campo
                label="Fecha cita"
                valor={persona.fecha_cita
                  ? new Date(persona.fecha_cita).toLocaleString('es-EC', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                    })
                  : '—'}
              />
              <Campo label="Estado del lead" valor={persona.lead_estado || '—'} />
            </div>
          </div>
        )}

        {/* TAB: Visita a Sala */}
        {tab === 'visita' && (
          <div className="p-6">
            {!visita ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-3xl mb-2">🏥</p>
                <p>El cliente aún no ha llegado a sala o no hay registro de visita.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <div className={`p-4 rounded-xl text-center font-bold text-xl
                    ${visita.calificacion === 'TOUR'    ? 'bg-green-100 text-green-700' :
                      visita.calificacion === 'NO_TOUR' ? 'bg-red-100 text-red-700' :
                                                          'bg-gray-100 text-gray-600'}`}>
                    {visita.calificacion === 'TOUR'    ? '🟢 TOUR' :
                     visita.calificacion === 'NO_TOUR' ? '🔴 NO TOUR' : '⚫ NO SHOW'}
                  </div>
                </div>
                <Campo label="Hora de cita agendada" valor={visita.hora_cita_agendada || '—'} />
                <Campo label="Hora de llegada real" valor={visita.hora_llegada || '—'} />
                <Campo label="Consultor asignado" valor={visita.consultor_nombre || '—'} />
                <Campo label="Hostess / Recepcionista" valor={visita.hostess_nombre || '—'} />
                <Campo label="Acompañante" valor={visita.acompanante || '—'} />
                <Campo label="Fecha de visita" valor={visita.fecha || '—'} />
              </div>
            )}
          </div>
        )}

        {/* TAB: Datos del Contrato */}
        {tab === 'contrato' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-semibold text-gray-700">Información para el contrato</h3>
              {puedeEditarContrato && !editandoContrato && (
                <button
                  onClick={() => setEditandoContrato(true)}
                  className="btn-secondary btn-sm"
                >
                  ✏️ Editar
                </button>
              )}
            </div>

            {!editandoContrato ? (
              <div className="grid grid-cols-2 gap-6">
                <Campo label="Tipo de documento" valor={persona.tipo_documento || '—'} />
                <Campo label="Número de documento" valor={persona.num_documento || '—'} />
                <Campo label="Estado civil" valor={persona.estado_civil || '—'} />
                <Campo label="Género" valor={persona.genero || '—'} />
                <Campo label="Email" valor={persona.email || '—'} />
                <Campo label="Fecha de nacimiento" valor={persona.fecha_nacimiento?.split('T')[0] || '—'} />
                <Campo label="Situación laboral" valor={persona.situacion_laboral || '—'} />
                <Campo label="Seguridad social" valor={persona.tipo_seguridad_social || '—'} />
                <Campo label="Dirección" valor={persona.direccion || '—'} span />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Tipo de documento</label>
                    <select className="input" value={formContrato.tipo_documento}
                      onChange={e => setFormContrato(f => ({ ...f, tipo_documento: e.target.value }))}>
                      <option value="">Seleccionar...</option>
                      {TIPO_DOCUMENTO.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">N° de documento</label>
                    <input className="input" value={formContrato.num_documento}
                      onChange={e => setFormContrato(f => ({ ...f, num_documento: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Estado civil</label>
                    <select className="input" value={formContrato.estado_civil}
                      onChange={e => setFormContrato(f => ({ ...f, estado_civil: e.target.value }))}>
                      <option value="">Seleccionar...</option>
                      {ESTADO_CIVIL.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Género</label>
                    <select className="input" value={formContrato.genero}
                      onChange={e => setFormContrato(f => ({ ...f, genero: e.target.value }))}>
                      <option value="">Seleccionar...</option>
                      {GENERO.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input type="email" className="input" value={formContrato.email}
                      onChange={e => setFormContrato(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Fecha de nacimiento</label>
                    <input type="date" className="input" value={formContrato.fecha_nacimiento}
                      onChange={e => setFormContrato(f => ({ ...f, fecha_nacimiento: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Situación laboral</label>
                    <select className="input" value={formContrato.situacion_laboral}
                      onChange={e => setFormContrato(f => ({ ...f, situacion_laboral: e.target.value }))}>
                      <option value="">Seleccionar...</option>
                      {SITUACION_LABORAL.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Seguridad social</label>
                    <select className="input" value={formContrato.tipo_seguridad_social}
                      onChange={e => setFormContrato(f => ({ ...f, tipo_seguridad_social: e.target.value }))}>
                      <option value="">Seleccionar...</option>
                      {SEGURIDAD_SOCIAL.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Dirección</label>
                  <input className="input" value={formContrato.direccion}
                    onChange={e => setFormContrato(f => ({ ...f, direccion: e.target.value }))} />
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setEditandoContrato(false)} className="btn-secondary">
                    Cancelar
                  </button>
                  <button onClick={guardarContrato} disabled={guardando} className="btn-primary">
                    {guardando ? 'Guardando...' : 'Guardar datos'}
                  </button>
                </div>
              </div>
            )}

            {/* Placeholder generación de contrato */}
            {!editandoContrato && (
              <div className="mt-6 p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl text-center">
                <p className="text-gray-500 text-sm">
                  📄 La generación del contrato SQT/SQM estará disponible en la siguiente versión.
                </p>
                <button className="btn-secondary btn-sm mt-3 opacity-50 cursor-not-allowed" disabled>
                  Generar contrato (próximamente)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Campo({ label, valor, span }) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-gray-800 font-medium">{valor || '—'}</p>
    </div>
  )
}
