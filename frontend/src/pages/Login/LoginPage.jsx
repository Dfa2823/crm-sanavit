import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function LoginPage() {
  const { login, usuario } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      setError(err.response?.data?.error || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  // Acceso rápido para la demo
  const DEMO_USERS = [
    { label: 'Director', user: 'director' },
    { label: 'TMK', user: 'tmk01' },
    { label: 'Confirmador', user: 'confirmador01' },
    { label: 'Hostess', user: 'hostess01' },
    { label: 'Admin', user: 'admin' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-teal-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo y nombre */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl font-bold text-white shadow-lg">
            S
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">SANAVIT</h1>
          <p className="text-teal-300 text-sm mt-1">CRM Ecuador — Sistema Comercial</p>
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-6 text-center">Iniciar sesión</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Usuario</label>
              <input
                type="text"
                className="input"
                placeholder="tu_usuario"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                autoFocus
                required
              />
            </div>

            <div>
              <label className="label">Contraseña</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5 text-base mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Ingresando...
                </span>
              ) : 'Ingresar'}
            </button>
          </form>

          {/* Acceso rápido para demo */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center mb-3 font-medium">
              Demo — Acceso rápido (contraseña: sanavit123)
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {DEMO_USERS.map(({ label, user }) => (
                <button
                  key={user}
                  type="button"
                  onClick={() => setForm({ username: user, password: 'sanavit123' })}
                  className="px-3 py-1 bg-gray-100 hover:bg-teal-100 hover:text-teal-700
                             text-gray-600 rounded-full text-xs font-medium transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          Sanavit Ecuador © 2026 · v1.0.0 prototipo
        </p>
      </div>
    </div>
  )
}
