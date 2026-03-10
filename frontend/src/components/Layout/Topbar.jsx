import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'

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

export default function Topbar({ title }) {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const hoy = new Date().toLocaleDateString('es-EC', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  return (
    <header className="h-14 bg-white border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-10">
      {/* Título de la página */}
      <div>
        <h1 className="font-semibold text-gray-800 text-base">{title}</h1>
        <p className="text-xs text-gray-400 capitalize">{hoy}</p>
      </div>

      {/* Usuario y logout */}
      <div className="flex items-center gap-3">
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
