import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const REDIRECT_POR_ROL = {
  admin:          '/kpis',
  director:       '/kpis',
  supervisor_cc:  '/mercadeo/premanifiesto',
  tmk:            '/mercadeo/captura',
  confirmador:    '/mercadeo/calendario',
  hostess:        '/sala/recepcion',
  consultor:      '/sala/recepcion',
  asesor_cartera: '/cartera',
  sac:            '/kpis',
  outsourcing:    '/mercadeo/captura',
}

export default function DashboardPage() {
  const { usuario } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (usuario) {
      const destino = REDIRECT_POR_ROL[usuario.rol] || '/kpis'
      navigate(destino, { replace: true })
    }
  }, [usuario, navigate])

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Redirigiendo...</p>
      </div>
    </div>
  )
}
