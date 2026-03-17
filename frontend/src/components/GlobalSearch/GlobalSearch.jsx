import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'

const TIPO_CONFIG = {
  persona:  { icon: '👤', color: 'text-blue-600',   label: 'Cliente' },
  contrato: { icon: '💼', color: 'text-teal-600',   label: 'Contrato' },
  lead:     { icon: '🎯', color: 'text-orange-600', label: 'Lead' },
}

export default function GlobalSearch({ onClose }) {
  const navigate    = useNavigate()
  const inputRef    = useRef(null)
  const [query, setQuery]           = useState('')
  const [resultados, setResultados] = useState({ personas: [], contratos: [], leads: [] })
  const [loading, setLoading]       = useState(false)

  // Foco automático al abrir
  useEffect(() => { inputRef.current?.focus() }, [])

  // Búsqueda con debounce 250ms
  useEffect(() => {
    if (query.trim().length < 2) {
      setResultados({ personas: [], contratos: [], leads: [] })
      return
    }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const r = await client.get('/api/buscar', { params: { q: query.trim() } })
        setResultados(r.data || { personas: [], contratos: [], leads: [] })
      } catch {
        setResultados({ personas: [], contratos: [], leads: [] })
      } finally { setLoading(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const ir = useCallback((url) => { navigate(url); onClose() }, [navigate, onClose])

  const hayResultados =
    resultados.personas.length > 0 ||
    resultados.contratos.length > 0 ||
    resultados.leads.length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <span className="text-gray-400 text-lg">🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar cliente, contrato, lead…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 text-base outline-none text-gray-800 placeholder-gray-400"
          />
          {loading && (
            <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          )}
          <kbd className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Esc</kbd>
        </div>

        {/* Resultados */}
        <div className="max-h-96 overflow-y-auto">
          {query.trim().length < 2 ? (
            <div className="py-10 text-center text-gray-400 text-sm">
              <p className="text-3xl mb-2">🔍</p>
              Escribe al menos 2 caracteres para buscar
            </div>
          ) : !hayResultados && !loading ? (
            <div className="py-10 text-center text-gray-400 text-sm">
              <p className="text-3xl mb-2">😶</p>
              Sin resultados para "{query}"
            </div>
          ) : (
            <div className="divide-y divide-gray-50">

              {/* Personas */}
              {resultados.personas.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">
                    👤 Clientes
                  </div>
                  {resultados.personas.map(p => (
                    <button
                      key={p.id}
                      onClick={() => ir(`/sala/cliente/${p.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-teal-50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">
                        {p.nombres?.[0] || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">
                          {p.nombres} {p.apellidos}
                        </p>
                        <p className="text-xs text-gray-400">
                          📱 {p.telefono || '—'} · 📍 {p.ciudad || '—'}
                          {p.num_documento && ` · 🪪 ${p.num_documento}`}
                        </p>
                      </div>
                      <span className="text-xs text-blue-500 flex-shrink-0">Ver →</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Contratos */}
              {resultados.contratos.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">
                    💼 Contratos
                  </div>
                  {resultados.contratos.map(c => (
                    <button
                      key={c.id}
                      onClick={() => ir(`/ventas/${c.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-teal-50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 text-sm flex-shrink-0">
                        💼
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">
                          {c.numero_contrato}
                          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                            c.estado === 'activo' ? 'bg-green-100 text-green-700' :
                            c.estado === 'cancelado' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{c.estado}</span>
                        </p>
                        <p className="text-xs text-gray-400">
                          {c.cliente} · {c.sala_nombre || '—'} ·{' '}
                          ${Number(c.monto_total || 0).toLocaleString('es-EC')}
                        </p>
                      </div>
                      <span className="text-xs text-teal-500 flex-shrink-0">Ver →</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Leads */}
              {resultados.leads.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50">
                    🎯 Leads
                  </div>
                  {resultados.leads.map(l => (
                    <button
                      key={l.id}
                      onClick={() => ir(`/sala/cliente/${l.persona_id}`)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-teal-50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-sm flex-shrink-0">
                        🎯
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{l.cliente}</p>
                        <p className="text-xs text-gray-400">
                          📱 {l.telefono} · {l.estado} · {l.fuente_nombre || '—'} ·{' '}
                          {new Date(l.created_at).toLocaleDateString('es-EC')}
                        </p>
                      </div>
                      <span className="text-xs text-orange-500 flex-shrink-0">Ver →</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-400">
          <span>↩ Enter para navegar</span>
          <span>Esc para cerrar</span>
        </div>
      </div>
    </div>
  )
}
