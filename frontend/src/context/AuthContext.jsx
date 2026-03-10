import { createContext, useContext, useState, useEffect } from 'react'
import { apiAuth } from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('crm_token')
    const userData = localStorage.getItem('crm_usuario')
    if (token && userData) {
      try {
        setUsuario(JSON.parse(userData))
      } catch {
        localStorage.removeItem('crm_token')
        localStorage.removeItem('crm_usuario')
      }
    }
    setLoading(false)
  }, [])

  async function login(username, password) {
    const data = await apiAuth.login(username, password)
    localStorage.setItem('crm_token', data.token)
    localStorage.setItem('crm_usuario', JSON.stringify(data.usuario))
    setUsuario(data.usuario)
    return data.usuario
  }

  function logout() {
    localStorage.removeItem('crm_token')
    localStorage.removeItem('crm_usuario')
    setUsuario(null)
  }

  return (
    <AuthContext.Provider value={{ usuario, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
