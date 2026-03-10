import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

import AppLayout from './components/Layout/AppLayout'
import LoginPage from './pages/Login/LoginPage'
import DashboardPage from './pages/Dashboard/DashboardPage'
import TMKDashboard from './pages/Mercadeo/TMKDashboard'
import CalendarioConfirmador from './pages/Mercadeo/CalendarioConfirmador'
import Premanifiesto from './pages/Mercadeo/Premanifiesto'
import RecepcionPage from './pages/Sala/RecepcionPage'
import HojaDeVida from './pages/Sala/HojaDeVida'
import KPIsDashboard from './pages/KPIs/KPIsDashboard'
import AdminPage from './pages/Admin/AdminPage'
import CarteraPage from './pages/Cartera/CarteraPage'
import ReportesPage from './pages/Reportes/ReportesPage'
import OutsourcingPage from './pages/Outsourcing/OutsourcingPage'
import ComisionesPage from './pages/Comisiones/ComisionesPage'
import VentasPage from './pages/Ventas/VentasPage'
import Venta360Page from './pages/Ventas/Venta360Page'
import NuevaVentaPage from './pages/Ventas/NuevaVentaPage'
import SACPage from './pages/SAC/SACPage'
import SupervisorDashboard from './pages/Mercadeo/SupervisorDashboard'

// Rutas protegidas: solo usuarios autenticados
function PrivateRoute({ children }) {
  const { usuario, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Cargando...</p>
        </div>
      </div>
    )
  }
  return usuario ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="mercadeo/captura" element={<TMKDashboard />} />
        <Route path="mercadeo/calendario" element={<CalendarioConfirmador />} />
        <Route path="mercadeo/premanifiesto" element={<Premanifiesto />} />
        <Route path="sala/recepcion" element={<RecepcionPage />} />
        <Route path="sala/cliente/:id" element={<HojaDeVida />} />
        <Route path="kpis" element={<KPIsDashboard />} />
        <Route path="admin" element={<AdminPage />} />
        <Route path="cartera" element={<CarteraPage />} />
        <Route path="reportes" element={<ReportesPage />} />
        <Route path="outsourcing" element={<OutsourcingPage />} />
        <Route path="comisiones" element={<ComisionesPage />} />
        <Route path="ventas" element={<VentasPage />} />
        <Route path="ventas/nueva" element={<NuevaVentaPage />} />
        <Route path="ventas/:id" element={<Venta360Page />} />
        <Route path="sac" element={<SACPage />} />
        <Route path="mercadeo/supervisor" element={<SupervisorDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
