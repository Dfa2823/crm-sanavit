import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'
import ToursNotification from './ToursNotification'

const ROL_COLORS = {
  admin:          'bg-purple-50 text-purple-700 border-purple-200',
  director:       'bg-blue-50 text-blue-700 border-blue-200',
  supervisor_cc:  'bg-indigo-50 text-indigo-700 border-indigo-200',
  tmk:            'bg-green-50 text-green-700 border-green-200',
  confirmador:    'bg-teal-50 text-teal-700 border-teal-200',
  hostess:        'bg-pink-50 text-pink-700 border-pink-200',
  consultor:      'bg-orange-50 text-orange-700 border-orange-200',
  asesor_cartera: 'bg-red-50 text-red-700 border-red-200',
  sac:            'bg-yellow-50 text-yellow-700 border-yellow-200',
  outsourcing:    'bg-gray-50 text-gray-700 border-gray-200',
}

export default function Topbar({ title, onToggleSidebar, onOpenSearch, onToggleMobile }) {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()

  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState([])
  const [searching, setSearching] = useState(false)
  const [showDrop, setShowDrop] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const wrapperRef   = useRef(null)
  const userMenuRef  = useRef(null)
  const timerRef     = useRef(null)

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const hoy = new Date().toLocaleDateString('es-EC', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  // Cerrar dropdown de busqueda al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDrop(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Busqueda con debounce
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

  const userInitial = (usuario?.nombre || '?')[0].toUpperCase()

  return (
    <header className="h-16 bg-white dark:bg-slate-800 border-b border-gray-200/80 dark:border-slate-700 px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">

      {/* ─── Izquierda: hamburguesa + titulo ─── */}
      <div className="flex items-center gap-3 min-w-[180px]">
        {/* Hamburguesa mobile */}
        {onToggleMobile && (
          <button
            onClick={onToggleMobile}
            className="md:hidden text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg p-2 transition-all duration-200"
            title="Abrir menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        {/* Toggle sidebar desktop */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="hidden md:flex text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg p-2 transition-all duration-200"
            title="Alternar menu lateral"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        <div className="min-w-0">
          <h1 className="font-semibold text-gray-800 dark:text-gray-100 text-[15px] truncate leading-tight">{title}</h1>
          <p className="text-[11px] text-gray-400 capitalize leading-tight mt-0.5">{hoy}</p>
        </div>
      </div>

      {/* ─── Centro: buscador global ─── */}
      <div ref={wrapperRef} className="relative hidden sm:block flex-1 max-w-md mx-4 lg:mx-8">
        <div className="relative">
          <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => results.length > 0 && setShowDrop(true)}
            aria-label="Buscar cliente por nombre, telefono o cedula"
            placeholder="Buscar cliente por nombre, tel, cedula..."
            className="w-full border border-gray-200 rounded-xl pl-10 pr-20 py-2 text-sm bg-gray-50/80 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 focus:bg-white transition-all duration-200 placeholder:text-gray-400"
          />
          {/* Ctrl+K badge */}
          {onOpenSearch && !searching && (
            <button
              onClick={onOpenSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 flex items-center gap-1 text-[11px] text-gray-400 bg-gray-100 hover:bg-gray-200 rounded-md px-2 py-0.5 transition-all duration-200 border border-gray-200/60"
              title="Busqueda avanzada (Ctrl+K)"
            >
              <kbd className="font-mono text-[10px]">Ctrl</kbd>
              <kbd className="font-mono text-[10px]">K</kbd>
            </button>
          )}
          {searching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              <span className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin inline-block" />
            </span>
          )}
        </div>

        {/* Dropdown resultados */}
        {showDrop && results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-xl shadow-black/8 z-50 overflow-hidden">
            {results.map(p => (
              <button
                key={p.id}
                onClick={() => handleSelectResult(p)}
                className="w-full text-left px-4 py-2.5 hover:bg-teal-50/60 flex items-center gap-3 border-b border-gray-100 last:border-0 transition-colors duration-150"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-100 to-teal-200 text-teal-700 flex items-center justify-center text-sm font-bold shrink-0">
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
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-xl shadow-black/8 z-50 px-4 py-3 text-sm text-gray-400">
            No se encontraron clientes
          </div>
        )}
      </div>

      {/* ─── Derecha: notificaciones + usuario ─── */}
      <div className="flex items-center gap-2 lg:gap-3 min-w-fit">
        <ToursNotification />

        {/* Badge del rol */}
        <span className={`hidden lg:inline-flex text-[11px] font-medium px-2.5 py-1 rounded-full border ${ROL_COLORS[usuario?.rol] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
          {usuario?.rol_label || usuario?.rol}
        </span>

        {/* Avatar + nombre + dropdown */}
        <div ref={userMenuRef} className="relative">
          <button
            onClick={() => setUserMenuOpen(v => !v)}
            className="flex items-center gap-2.5 hover:bg-gray-50 rounded-xl px-2 py-1.5 transition-all duration-200"
          >
            <span className="hidden sm:inline text-sm font-medium text-gray-700 max-w-[120px] truncate">
              {usuario?.nombre}
            </span>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0d9488] to-[#0f766e] text-white flex items-center justify-center text-sm font-semibold shadow-sm">
              {userInitial}
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* User dropdown menu */}
          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-xl shadow-black/8 z-50 overflow-hidden">
              {/* User info header */}
              <div className="px-4 py-3 bg-gray-50/80 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-800 truncate">{usuario?.nombre}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{usuario?.email || usuario?.rol_label || usuario?.rol}</p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => { setUserMenuOpen(false); navigate('/perfil') }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors duration-150 flex items-center gap-3"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  Mi Perfil
                </button>
                <div className="border-t border-gray-100 mx-3" />
                <button
                  onClick={() => { setUserMenuOpen(false); handleLogout() }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors duration-150 flex items-center gap-3"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                  Cerrar sesion
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
