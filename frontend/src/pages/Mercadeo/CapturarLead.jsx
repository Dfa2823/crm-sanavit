import { useState, useEffect } from 'react'
import { apiLeads } from '../../api/leads'
import { apiPersonas } from '../../api/personas'
import { toEcuadorISO } from '../../utils/formatFechaEC'

export default function CapturarLead({ onClose, onGuardado }) {
  const [config, setConfig] = useState({ tipificaciones: [], fuentes: [] })
  const [busquedaTel, setBusquedaTel] = useState('')
  const [personaEncontrada, setPersonaEncontrada] = useState(null)
  const [buscando, setBuscando] = useState(false)

  const [nuevaPersona, setNuevaPersona] = useState({
    nombres: '', apellidos: '', telefono: '', telefono2: '', ciudad: '', patologia: '',
  })

  const [lead, setLead] = useState({
    fuente_id: '', tipificacion_id: '', patologia: '',
    fecha_cita: '', hora_cita: '',
    fecha_rellamar: '', hora_rellamar: '',
    observacion: '',
  })

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiLeads.configuracion().then(setConfig).catch(console.error)
  }, [])

  // Seleccionar tipificación para mostrar campos extra
  const tipSeleccionada = config.tipificaciones.find(
    t => t.id === Number(lead.tipificacion_id)
  )

  // Buscar persona por teléfono (debounce manual)
  useEffect(() => {
    if (busquedaTel.length < 7) {
      setPersonaEncontrada(null)
      return
    }
    const timer = setTimeout(async () => {
      setBuscando(true)
      try {
        const resultados = await apiPersonas.buscar(busquedaTel)
        const exacto = resultados.find(p => p.telefono === busquedaTel)
        setPersonaEncontrada(exacto || null)
      } finally {
        setBuscando(false)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [busquedaTel])

  async function handleGuardar(e) {
    e.preventDefault()
    setError('')
    setGuardando(true)

    try {
      let persona_id = personaEncontrada?.id

      // Crear persona si no existe
      if (!persona_id) {
        const p = await apiPersonas.crear({
          nombres: nuevaPersona.nombres,
          apellidos: nuevaPersona.apellidos,
          telefono: busquedaTel || nuevaPersona.telefono,
          telefono2: nuevaPersona.telefono2 || undefined,
          ciudad: nuevaPersona.ciudad,
          patologia: nuevaPersona.patologia,
        })
        persona_id = p.id
      }

      // Construir fecha_cita y fecha_rellamar completos
      let fecha_cita = null
      let fecha_rellamar = null

      if (tipSeleccionada?.requiere_fecha_cita && lead.fecha_cita) {
        fecha_cita = toEcuadorISO(`${lead.fecha_cita}T${lead.hora_cita || '09:00'}`)
      }
      if (tipSeleccionada?.requiere_fecha_rellamar && lead.fecha_rellamar) {
        fecha_rellamar = toEcuadorISO(`${lead.fecha_rellamar}T${lead.hora_rellamar || '09:00'}`)
      }

      await apiLeads.crear({
        persona_id,
        fuente_id: Number(lead.fuente_id),
        tipificacion_id: Number(lead.tipificacion_id),
        patologia: personaEncontrada ? lead.patologia : nuevaPersona.patologia,
        fecha_cita,
        fecha_rellamar,
        observacion: lead.observacion,
      })

      onGuardado()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar el lead')
    } finally {
      setGuardando(false)
    }
  }

  const ciudadesEcuador = ['Quito','Guayaquil','Manta','Cuenca','Ambato','Loja','Ibarra','Esmeraldas']

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white sticky top-0">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">Nuevo Lead</h2>
            <p className="text-xs text-gray-400">Captura de prospecto</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <form id="form-lead" onSubmit={handleGuardar} className="space-y-5">

            {/* SECCIÓN 1: Buscar o crear persona */}
            <div className="p-4 bg-blue-50 rounded-xl space-y-3">
              <h3 className="font-semibold text-blue-800 text-sm">1. Cliente</h3>

              <div>
                <label className="label">Buscar por teléfono</label>
                <div className="relative">
                  <input
                    type="tel"
                    className="input pr-10"
                    placeholder="09XXXXXXXX"
                    value={busquedaTel}
                    onChange={e => setBusquedaTel(e.target.value)}
                  />
                  {buscando && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin block" />
                    </span>
                  )}
                </div>
              </div>

              {/* Persona encontrada */}
              {personaEncontrada && (
                <div className="p-3 bg-green-100 border border-green-300 rounded-lg">
                  <p className="text-green-800 text-sm font-medium">
                    ✅ Cliente encontrado: {personaEncontrada.nombres} {personaEncontrada.apellidos}
                  </p>
                  <p className="text-green-600 text-xs">{personaEncontrada.ciudad} · {personaEncontrada.email}</p>
                </div>
              )}

              {/* Si no se encontró → crear nueva persona */}
              {!personaEncontrada && busquedaTel.length >= 7 && !buscando && (
                <div className="space-y-3 border-t border-blue-200 pt-3">
                  <p className="text-xs text-blue-600 font-medium">Cliente nuevo — completar datos:</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Nombres *</label>
                      <input
                        className="input" required
                        value={nuevaPersona.nombres}
                        onChange={e => setNuevaPersona(p => ({ ...p, nombres: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="label">Apellidos</label>
                      <input
                        className="input"
                        value={nuevaPersona.apellidos}
                        onChange={e => setNuevaPersona(p => ({ ...p, apellidos: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">Teléfono 2 <span className="text-gray-400 font-normal">(opcional)</span></label>
                    <input
                      type="tel"
                      className="input"
                      placeholder="Número alternativo"
                      value={nuevaPersona.telefono2}
                      onChange={e => setNuevaPersona(p => ({ ...p, telefono2: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="label">Ciudad</label>
                    <select
                      className="input"
                      value={nuevaPersona.ciudad}
                      onChange={e => setNuevaPersona(p => ({ ...p, ciudad: e.target.value }))}
                    >
                      <option value="">Seleccionar...</option>
                      {ciudadesEcuador.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Motivo / Patología</label>
                    <input
                      className="input"
                      placeholder="Ej: Fatiga crónica, dolores articulares..."
                      value={nuevaPersona.patologia}
                      onChange={e => setNuevaPersona(p => ({ ...p, patologia: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* SECCIÓN 2: Datos del lead */}
            <div className="p-4 bg-gray-50 rounded-xl space-y-3">
              <h3 className="font-semibold text-gray-700 text-sm">2. Información del lead</h3>

              <div>
                <label className="label">Fuente del lead *</label>
                <select
                  className="input" required
                  value={lead.fuente_id}
                  onChange={e => setLead(l => ({ ...l, fuente_id: e.target.value }))}
                >
                  <option value="">Seleccionar fuente...</option>
                  {config.fuentes.map(f => (
                    <option key={f.id} value={f.id}>{f.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Tipificación *</label>
                <select
                  className="input" required
                  value={lead.tipificacion_id}
                  onChange={e => setLead(l => ({ ...l, tipificacion_id: e.target.value }))}
                >
                  <option value="">Seleccionar tipificación...</option>
                  {config.tipificaciones.map(t => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Campos condicionales: CITA */}
              {tipSeleccionada?.requiere_fecha_cita && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg space-y-2">
                  <p className="text-xs font-semibold text-green-700">📅 Datos de la cita</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Fecha *</label>
                      <input
                        type="date" className="input" required
                        value={lead.fecha_cita}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={e => setLead(l => ({ ...l, fecha_cita: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="label">Hora *</label>
                      <input
                        type="time" className="input" required
                        value={lead.hora_cita}
                        onChange={e => setLead(l => ({ ...l, hora_cita: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Campos condicionales: VOLVER A LLAMAR */}
              {tipSeleccionada?.requiere_fecha_rellamar && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg space-y-2">
                  <p className="text-xs font-semibold text-yellow-700">
                    📅 ¿Cuándo rellamar? → El Confirmador verá este calendario
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Fecha *</label>
                      <input
                        type="date" className="input" required
                        value={lead.fecha_rellamar}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={e => setLead(l => ({ ...l, fecha_rellamar: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="label">Hora</label>
                      <input
                        type="time" className="input"
                        value={lead.hora_rellamar}
                        onChange={e => setLead(l => ({ ...l, hora_rellamar: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="label">Observación</label>
                <textarea
                  className="input resize-none h-20"
                  placeholder="Notas adicionales sobre el prospecto..."
                  value={lead.observacion}
                  onChange={e => setLead(l => ({ ...l, observacion: e.target.value }))}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                ⚠️ {error}
              </div>
            )}
          </form>
        </div>

        {/* Footer fijo */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 bg-white">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">
            Cancelar
          </button>
          <button
            type="submit"
            form="form-lead"
            disabled={guardando || (!personaEncontrada && busquedaTel.length < 7)}
            className="btn-primary flex-1 justify-center"
          >
            {guardando ? 'Guardando...' : 'Guardar Lead'}
          </button>
        </div>
      </div>
    </>
  )
}
