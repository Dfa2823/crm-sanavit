import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import client from '../../api/client'

const ROLES_VISIBLES = ['tmk', 'confirmador', 'supervisor_cc', 'admin', 'director']
const POLL_INTERVAL = 15000 // 15 segundos
const LS_KEY = 'tours_vistos'

function getVistos() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch { return {} }
}

function setVistos(obj) {
  localStorage.setItem(LS_KEY, JSON.stringify(obj))
}

function tiempoRelativo(fecha) {
  const diff = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000)
  if (diff < 1) return 'hace un momento'
  if (diff === 1) return 'hace 1 min'
  if (diff < 60) return `hace ${diff} min`
  return `hace ${Math.floor(diff / 60)}h`
}

export default function ToursNotification() {
  const { usuario } = useAuth()
  const [tours, setTours] = useState([])
  const [open, setOpen] = useState(false)
  const [vistos, setVistosState] = useState(getVistos)
  const wrapperRef = useRef(null)

  const esVisible = ROLES_VISIBLES.includes(usuario?.rol)

  const fetchTours = useCallback(async () => {
    if (!esVisible) return
    try {
      const { data } = await client.get('/api/alertas/tours-recientes')
      setTours(data || [])
      // Limpiar vistos antiguos (> 30 min)
      const ahora = Date.now()
      const vistosActuales = getVistos()
      const limpio = {}
      for (const [id, ts] of Object.entries(vistosActuales)) {
        if (ahora - ts < 30 * 60 * 1000) limpio[id] = ts
      }
      setVistos(limpio)
      setVistosState(limpio)
    } catch {
      // silencioso
    }
  }, [esVisible])

  useEffect(() => {
    if (!esVisible) return
    fetchTours()
    const interval = setInterval(fetchTours, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchTours, esVisible])

  // Cerrar al clic fuera
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  if (!esVisible) return null

  const noVistos = tours.filter(t => !vistos[t.id])
  const count = noVistos.length

  function handleOpen() {
    setOpen(o => !o)
    // Marcar todos como vistos
    if (!open && count > 0) {
      const nuevosVistos = { ...vistos }
      tours.forEach(t => { nuevosVistos[t.id] = Date.now() })
      setVistos(nuevosVistos)
      setVistosState(nuevosVistos)
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={handleOpen}
        className="relative text-gray-500 hover:text-teal-600 transition-colors p-1.5 rounded-lg hover:bg-gray-100"
        title="Tours recientes"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4.5 h-4.5 flex items-center justify-center min-w-[18px] h-[18px] leading-none animate-pulse">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 bg-teal-50 border-b border-teal-100">
            <h4 className="text-sm font-semibold text-teal-800">Tours recientes</h4>
            <p className="text-xs text-teal-600">Ultimos 30 minutos</p>
          </div>

          {tours.length === 0 ? (
            <div className="px-4 py-6 text-center text-gray-400 text-sm">
              Sin tours recientes
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {tours.map(t => (
                <div
                  key={t.id}
                  className={`px-4 py-3 border-b border-gray-50 last:border-0 ${
                    !vistos[t.id] ? 'bg-green-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg flex-shrink-0 mt-0.5">🎉</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {t.nombres} {t.apellidos}
                      </p>
                      <p className="text-xs text-gray-500">
                        llego como <span className="font-semibold text-green-600">TOUR</span> {tiempoRelativo(t.created_at)}
                      </p>
                      <p className="text-xs text-gray-400">{t.sala}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
