import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import client from '../../api/client'

const SEGURIDAD_SOCIAL  = ['Cotizante', 'Beneficiario', 'Subsidiado', 'Retirado']
const SITUACION_LABORAL = ['Empleado público', 'Empleado privado', 'Independiente', 'Jubilado']
const ESTADO_CIVIL      = ['Soltero/a', 'Casado/a', 'Divorciado/a', 'Viudo/a', 'Unión libre']
const GENERO            = ['Masculino', 'Femenino', 'Otro']
const TIPO_DOCUMENTO    = ['Cédula de identidad', 'Pasaporte', 'RUC', 'Otro']

const ESTADO_LEAD_COLOR = {
  confirmada: 'bg-green-100 text-green-800',
  tour:       'bg-teal-100 text-teal-800',
  no_tour:    'bg-orange-100 text-orange-800',
  cancelada:  'bg-red-100 text-red-800',
  pendiente:  'bg-blue-100 text-blue-800',
  tentativa:  'bg-yellow-100 text-yellow-800',
  inasistencia: 'bg-red-100 text-red-800',
}

const ESTADO_CONTRATO_COLOR = {
  activo:     'bg-green-100 text-green-800',
  cancelado:  'bg-red-100 text-red-800',
  completado: 'bg-teal-100 text-teal-800',
  suspendido: 'bg-yellow-100 text-yellow-800',
}

const TIPO_TICKET_COLOR = {
  queja:        'bg-red-100 text-red-800',
  reclamo:      'bg-orange-100 text-orange-800',
  peticion:     'bg-blue-100 text-blue-800',
  felicitacion: 'bg-green-100 text-green-800',
}

const ESTADO_TICKET_COLOR = {
  abierto:    'bg-yellow-100 text-yellow-800',
  en_proceso: 'bg-blue-100 text-blue-800',
  resuelto:   'bg-green-100 text-green-800',
  cerrado:    'bg-gray-100 text-gray-800',
}

export default function HojaDeVida() {
  const { id }    = useParams()
  const navigate  = useNavigate()
  const { usuario } = useAuth()
  const { addToast } = useToast()

  const [historia,   setHistoria]   = useState(null)
  const [despachando, setDespachando] = useState(null) // id del vp que se está despachando
  const [loading,    setLoading]    = useState(true)
  const [tab,        setTab]        = useState('datos')
  const [editando,   setEditando]   = useState(false)
  const [form,       setForm]       = useState({})
  const [guardando,  setGuardando]  = useState(false)
  const [mensaje,    setMensaje]    = useState('')
  // Fase 15: Timeline
  const [timeline,      setTimeline]      = useState([])
  const [timelineLoad,  setTimelineLoad]  = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await client.get(`/api/personas/${id}/historia`).then(r => r.data)
      setHistoria(data)
      setForm({
        nombres:               data.persona.nombres               || '',
        apellidos:             data.persona.apellidos              || '',
        telefono:              data.persona.telefono               || '',
        telefono2:             data.persona.telefono2              || '',
        ciudad:                data.persona.ciudad                 || '',
        edad:                  data.persona.edad                   || '',
        patologia:             data.persona.patologia              || '',
        email:                 data.persona.email                  || '',
        tipo_documento:        data.persona.tipo_documento         || '',
        num_documento:         data.persona.num_documento          || '',
        estado_civil:          data.persona.estado_civil           || '',
        genero:                data.persona.genero                 || '',
        direccion:             data.persona.direccion              || '',
        fecha_nacimiento:      data.persona.fecha_nacimiento?.split('T')[0] || '',
        situacion_laboral:     data.persona.situacion_laboral      || '',
        tipo_seguridad_social: data.persona.tipo_seguridad_social  || '',
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  // Cargar timeline al hacer clic en la tab
  useEffect(() => {
    if (tab !== 'timeline') return
    setTimelineLoad(true)
    client.get(`/api/personas/${id}/timeline`)
      .then(r => setTimeline(r.data || []))
      .catch(() => setTimeline([]))
      .finally(() => setTimelineLoad(false))
  }, [tab, id])

  async function guardarDatos() {
    setGuardando(true)
    try {
      await client.patch(`/api/personas/${id}`, form)
      setMensaje('✅ Datos guardados correctamente')
      setEditando(false)
      cargar()
    } catch (err) {
      console.error(err)
      setMensaje('❌ Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!historia) {
    return (
      <div className="text-center p-12 text-gray-400">
        <p className="text-4xl mb-3">❓</p>
        <p>Cliente no encontrado</p>
        <button onClick={() => navigate(-1)} className="btn-secondary mt-4">← Volver</button>
      </div>
    )
  }

  const { persona, leads, visitas, contratos, productos = [], tickets } = historia
  const puedeEditar = ['admin', 'director', 'hostess', 'consultor', 'tmk', 'confirmador', 'sac'].includes(usuario?.rol)
  const puedeDespachar = ['admin', 'director', 'inventario', 'hostess'].includes(usuario?.rol)

  // Agrupar productos por contrato_id
  const productosPorContrato = {}
  productos.forEach(p => {
    if (!productosPorContrato[p.contrato_id]) productosPorContrato[p.contrato_id] = []
    productosPorContrato[p.contrato_id].push(p)
  })

  async function handleDespachar(vpId) {
    const prod = productos.find(p => p.id === vpId)
    const cantidadTotal = parseInt(prod?.cantidad) || 1
    const yaDespachado = parseInt(prod?.cantidad_despachada) || 0
    const pendiente = cantidadTotal - yaDespachado

    let cantDespachar = pendiente
    if (pendiente > 1) {
      const input = window.prompt(`¿Cuantas unidades va a despachar? (pendientes: ${pendiente})`, String(pendiente))
      if (input === null) return
      cantDespachar = parseInt(input)
      if (isNaN(cantDespachar) || cantDespachar <= 0) { addToast('Cantidad invalida', 'error'); return }
      if (cantDespachar > pendiente) { addToast(`Solo quedan ${pendiente} unidades por despachar`, 'error'); return }
    } else {
      if (!confirm('Confirmar despacho de este producto?')) return
    }

    setDespachando(vpId)
    try {
      await client.patch(`/api/ventas/productos/${vpId}/despachar`, { cantidad_despachada: cantDespachar })
      addToast(`${cantDespachar} unidad(es) despachada(s) correctamente`)
      cargar()
    } catch (err) {
      console.error(err)
      addToast(err.response?.data?.error || 'Error al despachar producto', 'error')
    } finally {
      setDespachando(null)
    }
  }

  const TABS = [
    { key: 'datos',     label: '👤 Datos Personales' },
    { key: 'historia',  label: '📋 Historia' },
    { key: 'contratos', label: '💼 Contratos' },
    { key: 'sac',       label: '🎫 SAC' },
    { key: 'timeline',  label: '📅 Timeline' },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-10">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center text-2xl font-bold text-teal-600 flex-shrink-0">
          {persona.nombres?.[0] || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">
            {persona.nombres} {persona.apellidos}
          </h1>
          <p className="text-sm text-gray-500">
            📞 {persona.telefono || '—'} · 📍 {persona.ciudad || '—'}
            {persona.num_documento && ` · 🪪 ${persona.num_documento}`}
          </p>
          <div className="flex gap-2 mt-1 flex-wrap">
            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
              {leads.length} leads
            </span>
            <span className="text-xs bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full">
              {contratos.length} contratos
            </span>
            <span className="text-xs bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full">
              {visitas.length} visitas
            </span>
          </div>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="ml-auto text-gray-400 hover:text-gray-600 text-sm flex-shrink-0"
        >
          ← Volver
        </button>
      </div>

      {/* ── Mensaje feedback ───────────────────────────────────────────────── */}
      {mensaje && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex justify-between">
          {mensaje}
          <button onClick={() => setMensaje('')} className="text-green-500 ml-4">×</button>
        </div>
      )}

      {/* ── Tabs container ─────────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="border-b border-gray-200 flex overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                ${tab === t.key
                  ? 'border-teal-500 text-teal-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ══ TAB 1: Datos Personales ═══════════════════════════════════════ */}
        {tab === 'datos' && (
          <div className="p-6">

            {/* Sección: Info solo lectura (TMK, Fuente) */}
            <div className="mb-6 p-4 bg-gray-50 rounded-xl">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Asignación (solo lectura)
              </h3>
              <div className="grid grid-cols-2 gap-6">
                <Campo label="Fuente del último lead" valor={leads[0]?.fuente_nombre || '—'} />
                <Campo label="TMK que llamó" valor={leads[0]?.tmk_nombre || '—'} />
                <Campo label="Tipificación" valor={leads[0]?.tipificacion_nombre || '—'} />
              </div>
            </div>

            {/* Sección: Datos Personales (editables) */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Datos Personales
                </h3>
                {puedeEditar && !editando && (
                  <button onClick={() => setEditando(true)} className="btn-secondary btn-sm">
                    Editar
                  </button>
                )}
              </div>

              {!editando ? (
                <div className="grid grid-cols-2 gap-6">
                  <Campo label="Nombres"             valor={persona.nombres               || '—'} />
                  <Campo label="Apellidos"            valor={persona.apellidos              || '—'} />
                  <Campo label="Teléfono"             valor={persona.telefono               || '—'} />
                  <Campo label="Teléfono 2"           valor={persona.telefono2              || '—'} />
                  <Campo label="Ciudad"               valor={persona.ciudad                 || '—'} />
                  <Campo label="Edad"                 valor={persona.edad ? `${persona.edad} años` : '—'} />
                  <Campo label="Patología"            valor={persona.patologia              || '—'} />
                  <Campo label="Email"                valor={persona.email                  || '—'} />
                  <Campo label="Tipo de documento"    valor={persona.tipo_documento         || '—'} />
                  <Campo label="N° de documento"      valor={persona.num_documento          || '—'} />
                  <Campo label="Género"               valor={persona.genero                 || '—'} />
                  <Campo label="Estado civil"         valor={persona.estado_civil            || '—'} />
                  <Campo label="Fecha de nacimiento"  valor={persona.fecha_nacimiento?.split('T')[0] || '—'} />
                  <Campo label="Situación laboral"    valor={persona.situacion_laboral       || '—'} />
                  <Campo label="Seguridad social"     valor={persona.tipo_seguridad_social   || '—'} />
                  <Campo label="Dirección"            valor={persona.direccion               || '—'} span />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Nombres</label>
                      <input className="input" value={form.nombres}
                        onChange={e => setForm(f => ({ ...f, nombres: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Apellidos</label>
                      <input className="input" value={form.apellidos}
                        onChange={e => setForm(f => ({ ...f, apellidos: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Teléfono</label>
                      <input className="input" value={form.telefono}
                        onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Teléfono 2</label>
                      <input className="input" value={form.telefono2}
                        onChange={e => setForm(f => ({ ...f, telefono2: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Ciudad</label>
                      <input className="input" value={form.ciudad}
                        onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Edad</label>
                      <input type="number" className="input" value={form.edad}
                        onChange={e => setForm(f => ({ ...f, edad: e.target.value }))} />
                    </div>
                    <div className="col-span-2">
                      <label className="label">Patología</label>
                      <input className="input" value={form.patologia}
                        onChange={e => setForm(f => ({ ...f, patologia: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Email</label>
                      <input type="email" className="input" value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Tipo de documento</label>
                      <select className="input" value={form.tipo_documento}
                        onChange={e => setForm(f => ({ ...f, tipo_documento: e.target.value }))}>
                        <option value="">Seleccionar...</option>
                        {TIPO_DOCUMENTO.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">N° de documento</label>
                      <input className="input" value={form.num_documento}
                        onChange={e => setForm(f => ({ ...f, num_documento: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Género</label>
                      <select className="input" value={form.genero}
                        onChange={e => setForm(f => ({ ...f, genero: e.target.value }))}>
                        <option value="">Seleccionar...</option>
                        {GENERO.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Estado civil</label>
                      <select className="input" value={form.estado_civil}
                        onChange={e => setForm(f => ({ ...f, estado_civil: e.target.value }))}>
                        <option value="">Seleccionar...</option>
                        {ESTADO_CIVIL.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Fecha de nacimiento</label>
                      <input type="date" className="input" value={form.fecha_nacimiento}
                        onChange={e => setForm(f => ({ ...f, fecha_nacimiento: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Situación laboral</label>
                      <select className="input" value={form.situacion_laboral}
                        onChange={e => setForm(f => ({ ...f, situacion_laboral: e.target.value }))}>
                        <option value="">Seleccionar...</option>
                        {SITUACION_LABORAL.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Seguridad social</label>
                      <select className="input" value={form.tipo_seguridad_social}
                        onChange={e => setForm(f => ({ ...f, tipo_seguridad_social: e.target.value }))}>
                        <option value="">Seleccionar...</option>
                        {SEGURIDAD_SOCIAL.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="label">Dirección</label>
                    <input className="input" value={form.direccion}
                      onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setEditando(false)} className="btn-secondary">
                      Cancelar
                    </button>
                    <button onClick={guardarDatos} disabled={guardando} className="btn-primary">
                      {guardando ? 'Guardando...' : 'Guardar datos'}
                    </button>
                  </div>
                </div>
              )}

              {/* Placeholder contrato */}
              {!editando && (
                <div className="mt-6 p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl text-center">
                  <p className="text-gray-500 text-sm">
                    La generacion del contrato SQT/SQM estara disponible en la siguiente version.
                  </p>
                  <button className="btn-secondary btn-sm mt-3 opacity-50 cursor-not-allowed" disabled>
                    Generar contrato (proximamente)
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ TAB 2: Historia ═══════════════════════════════════════════════ */}
        {tab === 'historia' && (
          <div className="p-6">

            {/* Timeline de leads */}
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Historial de llamadas ({leads.length})
            </h3>

            {leads.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <p className="text-3xl mb-2">📋</p>
                <p className="text-sm">Sin leads registrados</p>
              </div>
            ) : (
              <div className="relative">
                {leads.map((lead, i) => (
                  <div key={lead.id} className="flex gap-4 mb-2">
                    {/* Línea vertical + punto */}
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 bg-teal-500 rounded-full mt-1 flex-shrink-0" />
                      {i < leads.length - 1 && (
                        <div className="w-0.5 bg-gray-200 flex-1 mt-1" />
                      )}
                    </div>
                    {/* Card del lead */}
                    <div className="bg-white rounded-lg shadow-sm border p-3 flex-1 mb-2">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_LEAD_COLOR[lead.estado] || 'bg-gray-100 text-gray-800'}`}>
                            {lead.estado}
                          </span>
                          {lead.tipificacion_nombre && (
                            <span className="text-xs text-gray-500">{lead.tipificacion_nombre}</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                          {new Date(lead.created_at).toLocaleDateString('es-EC')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">
                        <span className="font-medium">TMK:</span> {lead.tmk_nombre || '—'} ·{' '}
                        <span className="font-medium">Fuente:</span> {lead.fuente_nombre || '—'} ·{' '}
                        <span className="font-medium">Sala:</span> {lead.sala_nombre || '—'}
                      </p>
                      {lead.patologia && (
                        <p className="text-xs text-gray-500 mt-1">Patología: {lead.patologia}</p>
                      )}
                      {lead.observacion && (
                        <p className="text-xs text-gray-500 mt-0.5 italic">"{lead.observacion}"</p>
                      )}
                      {lead.fecha_cita && (
                        <p className="text-xs text-blue-600 mt-1">
                          📅 Cita: {new Date(lead.fecha_cita).toLocaleString('es-EC')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Visitas a sala */}
            <h3 className="text-sm font-semibold text-gray-700 mb-3 mt-6">
              Visitas a sala ({visitas.length})
            </h3>
            {visitas.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-3xl mb-2">🏥</p>
                <p className="text-sm">Sin visitas registradas</p>
              </div>
            ) : (
              visitas.map(v => (
                <div key={v.id} className="bg-white rounded-lg border p-3 mb-2 flex justify-between items-center">
                  <div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      v.calificacion === 'TOUR'    ? 'bg-teal-100 text-teal-800' :
                      v.calificacion === 'NO_TOUR' ? 'bg-orange-100 text-orange-800' :
                                                     'bg-gray-100 text-gray-800'
                    }`}>
                      {v.calificacion || 'Sin calificar'}
                    </span>
                    <span className="text-sm text-gray-700 ml-2">
                      {v.sala_nombre} · {v.consultor_nombre || 'Sin consultor'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{v.fecha}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* ══ TAB 3: Contratos ══════════════════════════════════════════════ */}
        {tab === 'contratos' && (
          <div className="p-6">
            {contratos.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-2">💼</p>
                <p className="text-sm">Sin contratos registrados</p>
              </div>
            ) : (
              contratos.map(c => {
                const monto   = Number(c.monto_total)   || 0
                const pagado  = Number(c.total_pagado)  || 0
                const vencidas = Number(c.cuotas_vencidas) || 0
                const pct     = monto > 0 ? Math.round((pagado / monto) * 100) : 0
                return (
                  <div key={c.id} className="bg-white rounded-lg shadow-sm border p-4 mb-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">{c.numero_contrato}</p>
                        <p className="text-xs text-gray-500">
                          {c.tipo_plan || '—'} · {c.n_cuotas || 0} cuotas · {c.consultor_nombre || '—'}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_CONTRATO_COLOR[c.estado] || 'bg-gray-100 text-gray-800'}`}>
                          {c.estado}
                        </span>
                        {vencidas > 0 && (
                          <p className="text-xs text-red-600 mt-1">⚠️ {vencidas} cuotas vencidas</p>
                        )}
                      </div>
                    </div>

                    {/* Barra de progreso de pago */}
                    <div className="mb-2">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>
                          Pagado: ${pagado.toLocaleString('es-EC', { minimumFractionDigits: 2 })}
                        </span>
                        <span>
                          Total: ${monto.toLocaleString('es-EC', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            pct >= 100 ? 'bg-teal-500' :
                            pct >= 30  ? 'bg-blue-500' :
                                         'bg-orange-400'
                          }`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 text-right">
                        {pct}% cobrado
                        {pct >= 30 && (
                          <span className="text-green-600 ml-1">✅ Comisión desbloqueada</span>
                        )}
                      </p>
                    </div>

                    {/* Despacho de productos */}
                    {(() => {
                      const prods = productosPorContrato[c.id] || []
                      if (prods.length === 0) return null
                      const despachados = prods.filter(p => p.despacho_estado === 'despachado').length
                      const total = prods.length
                      const todoDespachado = despachados === total
                      return (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                              Despacho de productos
                            </h4>
                            {todoDespachado ? (
                              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                Despacho completo
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500">
                                {despachados} de {total} despachados
                              </span>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            {prods.map(p => {
                              const cantTotal = parseInt(p.cantidad) || 1
                              const cantDesp = parseInt(p.cantidad_despachada) || 0
                              const pendiente = cantTotal - cantDesp
                              const estaDespachado = p.despacho_estado === 'despachado' || pendiente <= 0
                              const esParcial = p.despacho_estado === 'parcial' && pendiente > 0
                              return (
                                <div key={p.id} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                                  estaDespachado ? 'bg-green-50' : esParcial ? 'bg-blue-50' : 'bg-yellow-50'
                                }`}>
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <span className="flex-shrink-0">{estaDespachado ? '\u2705' : esParcial ? '\u{1F4E6}' : '\u23F3'}</span>
                                    <div className="min-w-0">
                                      <span className="font-medium text-gray-800 truncate block">
                                        {p.producto_nombre}
                                      </span>
                                      {p.codigo && (
                                        <span className="text-xs text-gray-400">{p.codigo}</span>
                                      )}
                                    </div>
                                    <span className="text-xs text-gray-500 flex-shrink-0">
                                      {cantTotal > 1 ? `${cantDesp}/${cantTotal}` : `x${cantTotal}`}
                                    </span>
                                  </div>
                                  {!estaDespachado && puedeDespachar && (
                                    <button
                                      onClick={() => handleDespachar(p.id)}
                                      disabled={despachando === p.id}
                                      className="ml-2 px-3 py-1 text-xs font-medium rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 transition-colors flex-shrink-0"
                                    >
                                      {despachando === p.id ? 'Despachando...' : `Despachar${pendiente > 1 ? ` (${pendiente})` : ''}`}
                                    </button>
                                  )}
                                  {estaDespachado && (
                                    <span className="ml-2 text-xs text-green-600 font-medium flex-shrink-0">Despachado</span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })()}

                    <div className="flex items-center justify-between mt-3">
                      <p className="text-xs text-gray-400">
                        {c.fecha_contrato
                          ? new Date(c.fecha_contrato).toLocaleDateString('es-EC')
                          : '—'}
                        {c.sala_nombre && ` · ${c.sala_nombre}`}
                      </p>
                      <button
                        onClick={() => navigate(`/ventas/${c.id}`)}
                        className="text-teal-600 text-xs font-medium hover:underline"
                      >
                        Ver detalle →
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ══ TAB 5: Timeline ═══════════════════════════════════════════════ */}
        {tab === 'timeline' && (
          <div className="p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-5">
              Línea de tiempo del cliente
            </h3>
            {timelineLoad ? (
              <div className="flex justify-center py-12">
                <div className="w-7 h-7 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : timeline.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-2">📅</p>
                <p className="text-sm">Sin eventos registrados</p>
              </div>
            ) : (
              <div className="relative">
                {/* Línea vertical */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                <div className="space-y-3">
                  {timeline.map((ev, i) => {
                    const config = {
                      lead:     { icon: '🎯', bg: 'bg-blue-100',   dot: 'bg-blue-500'  },
                      visita:   { icon: '🏥', bg: 'bg-green-100',  dot: 'bg-green-500' },
                      contrato: { icon: '💼', bg: 'bg-teal-100',   dot: 'bg-teal-500'  },
                      pago:     { icon: '💰', bg: 'bg-orange-100', dot: 'bg-orange-500'},
                      ticket:   { icon: '🎫', bg: 'bg-red-100',    dot: 'bg-red-500'   },
                    }[ev.tipo] || { icon: '📌', bg: 'bg-gray-100', dot: 'bg-gray-400' }
                    return (
                      <div key={`${ev.tipo}-${ev.id}-${i}`} className="flex gap-4 pl-1">
                        {/* Punto en la línea */}
                        <div className={`w-7 h-7 rounded-full ${config.dot} flex items-center justify-center text-white text-xs flex-shrink-0 z-10 shadow-sm`}>
                          {config.icon}
                        </div>
                        {/* Tarjeta */}
                        <div className={`flex-1 ${config.bg} rounded-lg px-4 py-3 mb-1`}>
                          <div className="flex justify-between items-start gap-2">
                            <p className="text-sm font-medium text-gray-800 leading-tight">
                              {ev.descripcion}
                            </p>
                            <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                              {ev.fecha ? new Date(ev.fecha).toLocaleString('es-EC', {
                                day: '2-digit', month: '2-digit', year: '2-digit',
                                hour: '2-digit', minute: '2-digit',
                              }) : '—'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {ev.estado && (
                              <span className="text-xs bg-white/70 text-gray-600 rounded-full px-2 py-0.5">
                                {ev.estado}
                              </span>
                            )}
                            {ev.actor && (
                              <span className="text-xs text-gray-500">👤 {ev.actor}</span>
                            )}
                            {ev.monto && Number(ev.monto) > 0 && (
                              <span className="text-xs font-semibold text-gray-700">
                                💵 ${Number(ev.monto).toLocaleString('es-EC', { maximumFractionDigits: 2 })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ TAB 4: SAC ════════════════════════════════════════════════════ */}
        {tab === 'sac' && (
          <div className="p-6">
            {!tickets || tickets.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-2">🎫</p>
                <p className="text-sm">Sin tickets SAC registrados</p>
              </div>
            ) : (
              tickets.map(t => (
                <div key={t.id} className="bg-white rounded-lg border p-4 mb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="font-medium text-sm text-gray-900">{t.numero_ticket}</p>
                      {t.descripcion && (
                        <p className="text-xs text-gray-500 mt-0.5">{t.descripcion}</p>
                      )}
                    </div>
                    <div className="flex gap-1 flex-col items-end flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${TIPO_TICKET_COLOR[t.tipo] || 'bg-gray-100 text-gray-800'}`}>
                        {t.tipo}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_TICKET_COLOR[t.estado] || 'bg-gray-100 text-gray-800'}`}>
                        {t.estado}
                      </span>
                      {t.prioridad && (
                        <span className="text-xs text-gray-500">{t.prioridad}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Apertura:{' '}
                    {t.fecha_apertura
                      ? new Date(t.fecha_apertura).toLocaleDateString('es-EC')
                      : '—'}
                    {t.fecha_cierre &&
                      ` · Cierre: ${new Date(t.fecha_cierre).toLocaleDateString('es-EC')}`}
                    {t.asignado_nombre && ` · Asignado: ${t.asignado_nombre}`}
                  </p>
                </div>
              ))
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
