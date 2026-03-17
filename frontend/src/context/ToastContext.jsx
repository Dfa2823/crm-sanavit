import { createContext, useContext, useState, useCallback } from 'react'

const ToastCtx = createContext(null)

const ICONS = {
  success: '✅',
  error:   '❌',
  warning: '⚠️',
  info:    'ℹ️',
}

const STYLES = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error:   'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  info:    'bg-blue-50 border-blue-200 text-blue-800',
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((msg, type = 'success', duration = 3500) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastCtx.Provider value={{ addToast }}>
      {children}
      {/* Toaster */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`
              flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg
              text-sm font-medium max-w-sm w-full
              animate-fadeInUp
              pointer-events-auto
              ${STYLES[t.type] || STYLES.info}
            `}
          >
            <span className="shrink-0 text-base">{ICONS[t.type]}</span>
            <span className="flex-1">{t.msg}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="shrink-0 opacity-50 hover:opacity-100 transition-opacity ml-1"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}
