import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'

const ROL_COLORS = {
  admin:          'bg-purple-100 text-purple-800',
  director:       'bg-blue-100 text-blue-800',
  supervisor_cc:  'bg-indigo-100 text-indigo-800',
  tmk:            'bg-green-100 text-green-800',
  confirmador:    'bg-teal-100 text-teal-800',
  hostess:        'bg-pink-100 text-pink-800',
  consultor:      'bg-orange-100 text-orange-800',
  asesor_cartera: 'bg-red-100 text-red-800',
  sac:            'bg-yellow-100 text-yellow-800',
  outsourcing:    'bg-gray-100 text-gray-800',
}

export default function Topbar({ title, onToggleSidebar, onOpenSearch }) {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()

  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState([])
  const [searching, setSearching] = useState(false)
  const [showDrop, setShowDrop] = useState(false)
  const wrapperRef = useRef(null)
  const timerRef   = useRef(null)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const hoy = new Date().toLocaleDateString('es-EC', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDrop(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Búsqueda con debounce
  const buscar = useCallback((q) => {
    clearTimeout(timerRef.current)
    if (q.trim().length < 2) { setResults([]); setShowDrop(false); return }
    timerRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const { data } = await client.get('/api/personas', { params: { q: q.trim() } })
        setResults(data.slice(0, 5))
        setShowDrop(true)
      } catch (e) {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 400)
  }, [])

  function handleChange(e) {
    const val = e.target.value
    setQuery(val)
    buscar(val)
  }

  function handleSelectResult(persona) {
    setQuery('')
    setResults([])
    setShowDrop(false)
    navigate(`/sala/cliente/${persona.id}`)
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { setShowDrop(false); setQuery('') }
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 px-4 flex items-center justify-between sticky top-0 z-10">
      {/* Hamburger + Título */}
      <div className="flex items-center gap-3 min-w-[180px]">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg p-1.5 transition-colors"
            title="Alternar menú lateral"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <div>
          <h1 className="font-semibold text-gray-800 text-base">{title}</h1>
          <p className="text-xs text-gray-400 capitalize">{hoy}</p>
        </div>
      </div>

      {/* Búsqueda global — centro */}
      <div ref={wrapperRef} className="relative flex-1 max-w-sm mx-6">
        {/* Botón Ctrl+K */}
        {onOpenSearch && (
          <button
            onClick={onOpenSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1 text-xs text-gray-400 bg-gray-100 hover:bg-gray-200 rounded px-1.5 py-0.5 transition-colors"
            title="Búsqueda avanzada (Ctrl+K)"
          >
            <kbd className="font-sans">⌘K</kbd>
          </button>
        )}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">🔍</span>
          <input
            type="text"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => results.length > 0 && setShowDrop(true)}
            placeholder="Buscar cliente por nombre, tel, cédula..."
            className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-1.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-colors"
          />
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              <span className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin inline-block" />
            </span>
          )}
        </div>

        {/* Dropdown resultados */}
        {showDrop && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
            {results.map(p => (
              <button
                key={p.id}
                onClick={() => handleSelectResult(p)}
                className="w-full text-left px-4 py-2.5 hover:bg-teal-50 flex items-center gap-3 border-b border-gray-50 last:border-0"
              >
                <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-bold shrink-0">
                  {(p.nombres || '?')[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-gray-800 text-sm truncate">{p.nombres} {p.apellidos}</div>
                  <div className="text-xs text-gray-400 font-mono">{p.telefono || p.num_documento || '—'}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {showDrop && results.length === 0 && query.trim().length >= 2 && !searching && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 px-4 py-3 text-sm text-gray-400">
            No se encontraron clientes
          </div>
        )}
      </div>

      {/* Usuario y logout */}
      <div className="flex items-center gap-3 min-w-fit">
        <span className={`badge text-xs font-medium px-2 py-1 rounded-full ${ROL_COLORS[usuario?.rol] || 'bg-gray-100 text-gray-700'}`}>
          {usuario?.rol_label || usuario?.rol}
        </span>
        <span className="text-sm font-medium text-gray-700">{usuario?.nombre}</span>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-400 hover:text-red-600 transition-colors ml-2"
          title="Cerrar sesión"
        >
          Salir →
        </button>
      </div>
    </header>
  )
}
