import { useState, useEffect, useCallback } from 'react'
import client from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { formatFechaEC } from '../../utils/formatFechaEC'

/**
 * Línea de tiempo de comentarios para cualquier entidad (contrato, ticket SAC, lead).
 * Los comentarios solo se agregan — nunca se editan ni borran — para conservar
 * el historial completo (reemplaza el viejo campo de notas que se sobrescribía).
 */
export default function TimelineComentarios({ entidadTipo, entidadId, titulo = 'Comentarios' }) {
  const { addToast } = useToast()
  const [comentarios, setComentarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(() => {
    if (!entidadId) return
    client.get('/api/comentarios', { params: { entidad_tipo: entidadTipo, entidad_id: entidadId } })
      .then(r => setComentarios(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [entidadTipo, entidadId])

  useEffect(() => { cargar() }, [cargar])

  const agregar = async (e) => {
    e?.preventDefault?.()
    if (!texto.trim() || guardando) return
    setGuardando(true)
    try {
      const r = await client.post('/api/comentarios', {
        entidad_tipo: entidadTipo,
        entidad_id: entidadId,
        texto: texto.trim(),
      })
      setComentarios(prev => [r.data, ...prev])
      setTexto('')
    } catch (err) {
      addToast(err.response?.data?.error || 'No se pudo guardar el comentario', 'error')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {titulo} {comentarios.length > 0 && <span className="text-gray-400 font-normal">({comentarios.length})</span>}
      </p>

      {/* Caja para agregar */}
      <form onSubmit={agregar} className="flex gap-2 items-start">
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) agregar(e) }}
          rows={2}
          placeholder="Escribe un comentario… (Ctrl+Enter para guardar)"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
        />
        <button
          type="submit"
          disabled={guardando || !texto.trim()}
          className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium shrink-0"
        >
          {guardando ? 'Guardando…' : 'Comentar'}
        </button>
      </form>

      {/* Línea de tiempo */}
      {loading ? (
        <p className="text-sm text-gray-400 py-3">Cargando comentarios…</p>
      ) : comentarios.length === 0 ? (
        <p className="text-sm text-gray-400 py-3">Sin comentarios todavía. Sé el primero en dejar uno.</p>
      ) : (
        <ul className="space-y-0 max-h-96 overflow-y-auto pr-1">
          {comentarios.map((c, i) => (
            <li key={c.id} className="relative pl-6 pb-4">
              {/* eje vertical */}
              {i < comentarios.length - 1 && (
                <span className="absolute left-[7px] top-4 bottom-0 w-px bg-gray-200" aria-hidden="true" />
              )}
              <span className="absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full bg-teal-100 border-2 border-teal-500" aria-hidden="true" />
              <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-gray-700">
                    {c.usuario_nombre || 'Sistema'}
                    {c.usuario_rol_label && <span className="text-gray-400 font-normal"> · {c.usuario_rol_label}</span>}
                  </span>
                  <span className="text-[11px] text-gray-400">{formatFechaEC(c.created_at)}</span>
                </div>
                <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words">{c.texto}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
