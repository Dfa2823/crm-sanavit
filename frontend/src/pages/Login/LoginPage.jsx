import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function LoginPage() {
  const { login, usuario } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [shaking, setShaking] = useState(false)

  // Si ya está autenticado, redirigir
  if (usuario) {
    navigate('/dashboard')
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.username, form.password)
      navigate('/dashboard')
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al iniciar sesión'
      setError(msg)
      setShaking(true)
      setTimeout(() => setShaking(false), 600)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ===== PANEL IZQUIERDO — Branding ===== */}
      <div
        className="hidden lg:flex lg:w-[55%] relative overflow-hidden flex-col items-center justify-center px-12"
        style={{ backgroundColor: '#0a3d39' }}
      >
        {/* Decorative circles */}
        <div
          className="absolute animate-spinSlow"
          style={{
            width: 520,
            height: 520,
            border: '2px solid rgba(94,234,212,0.10)',
            borderRadius: '50%',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
        <div
          className="absolute"
          style={{
            width: 380,
            height: 380,
            border: '1.5px solid rgba(94,234,212,0.07)',
            borderRadius: '50%',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
        <div
          className="absolute"
          style={{
            width: 680,
            height: 680,
            background: 'radial-gradient(circle, rgba(13,148,136,0.12) 0%, transparent 70%)',
            borderRadius: '50%',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
        {/* Large decorative "S" */}
        <div
          className="absolute select-none pointer-events-none"
          style={{
            fontSize: 320,
            fontWeight: 800,
            color: 'rgba(94,234,212,0.04)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -55%)',
            lineHeight: 1,
          }}
        >
          S
        </div>
        {/* Small accent circle top-right */}
        <div
          className="absolute"
          style={{
            width: 120,
            height: 120,
            background: 'rgba(94,234,212,0.08)',
            borderRadius: '50%',
            top: '8%',
            right: '12%',
          }}
        />
        {/* Small accent circle bottom-left */}
        <div
          className="absolute"
          style={{
            width: 80,
            height: 80,
            background: 'rgba(13,148,136,0.15)',
            borderRadius: '50%',
            bottom: '14%',
            left: '10%',
          }}
        />

        {/* Brand content */}
        <div className="relative z-10 text-center">
          <h1
            className="font-extrabold tracking-wider"
            style={{ fontSize: 56, color: '#5eead4', lineHeight: 1.1 }}
          >
            SANAVIT
          </h1>
          <p
            className="font-semibold tracking-[0.45em] mt-1"
            style={{ fontSize: 18, color: 'rgba(94,234,212,0.7)' }}
          >
            ECUADOR
          </p>
          <div
            className="mx-auto my-6"
            style={{ width: 48, height: 2, backgroundColor: 'rgba(94,234,212,0.3)' }}
          />
          <p
            className="text-base font-light tracking-wide"
            style={{ color: '#ccfbf1' }}
          >
            Sistema de Gestión Comercial
          </p>
        </div>

        {/* Footer */}
        <p
          className="absolute bottom-6 text-xs tracking-wide"
          style={{ color: 'rgba(204,251,241,0.4)' }}
        >
          &copy; 2026 Sanavit Ecuador &middot; Uso exclusivo interno
        </p>
      </div>

      {/* ===== PANEL DERECHO — Formulario ===== */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-6 py-12 lg:py-0">
        <div
          className={`w-full max-w-md animate-loginFadeIn ${shaking ? 'animate-loginShake' : ''}`}
        >
          {/* Mobile-only branding */}
          <div className="lg:hidden text-center mb-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl font-bold text-white shadow-lg"
              style={{ backgroundColor: '#0d9488' }}
            >
              S
            </div>
            <h1 className="text-xl font-bold tracking-wide" style={{ color: '#0a3d39' }}>
              <span className="dark:text-teal-300">SANAVIT</span>
            </h1>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 tracking-widest">ECUADOR</p>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2
              className="text-2xl font-bold dark:text-white"
              style={{ color: '#0a3d39' }}
            >
              Iniciar Sesión
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Ingresa tus credenciales para acceder al sistema
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Usuario
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <input
                  type="text"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-shadow text-sm"
                  placeholder="tu_usuario"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  autoFocus
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full pl-10 pr-11 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-shadow text-sm"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? (
                    /* Eye-off icon */
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    /* Eye icon */
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-white font-semibold text-sm tracking-wide transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
              style={{ backgroundColor: '#0d9488' }}
              onMouseEnter={e => { if (!loading) e.target.style.backgroundColor = '#0f766e' }}
              onMouseLeave={e => { e.target.style.backgroundColor = '#0d9488' }}
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Ingresando...
                </>
              ) : (
                <>
                  Iniciar Sesión
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="M12 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Version footer */}
          <p className="text-center text-gray-400 dark:text-gray-600 text-xs mt-8 tracking-wide">
            CRM Sanavit v2.0
          </p>
        </div>
      </div>
    </div>
  )
}
