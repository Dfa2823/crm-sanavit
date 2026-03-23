import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { ThemeProvider } from './context/ThemeContext'

import AppLayout from './components/Layout/AppLayout'

// Lazy load de todas las páginas
const LoginPage = lazy(() => import('./pages/Login/LoginPage'))
const DashboardPage = lazy(() => import('./pages/Dashboard/DashboardPage'))
const TMKDashboard = lazy(() => import('./pages/Mercadeo/TMKDashboard'))
const CalendarioConfirmador = lazy(() => import('./pages/Mercadeo/CalendarioConfirmador'))
const Premanifiesto = lazy(() => import('./pages/Mercadeo/Premanifiesto'))
const SupervisorDashboard = lazy(() => import('./pages/Mercadeo/SupervisorDashboard'))
const RecepcionPage = lazy(() => import('./pages/Sala/RecepcionPage'))
const HojaDeVida = lazy(() => import('./pages/Sala/HojaDeVida'))
const KPIsDashboard = lazy(() => import('./pages/KPIs/KPIsDashboard'))
const AdminPage = lazy(() => import('./pages/Admin/AdminPage'))
const CarteraPage = lazy(() => import('./pages/Cartera/CarteraPage'))
const ReportesPage = lazy(() => import('./pages/Reportes/ReportesPage'))
const OutsourcingPage = lazy(() => import('./pages/Outsourcing/OutsourcingPage'))
const ComisionesPage = lazy(() => import('./pages/Comisiones/ComisionesPage'))
const ConsultorPage = lazy(() => import('./pages/Consultor/ConsultorPage'))
const VentasPage = lazy(() => import('./pages/Ventas/VentasPage'))
const NuevaVentaPage = lazy(() => import('./pages/Ventas/NuevaVentaPage'))
const Venta360Page = lazy(() => import('./pages/Ventas/Venta360Page'))
const ContratoPrint = lazy(() => import('./pages/Ventas/ContratoPrint'))
const ActaEntregaPrint = lazy(() => import('./pages/Ventas/ActaEntregaPrint'))
const SACPage = lazy(() => import('./pages/SAC/SACPage'))
const InventarioPage = lazy(() => import('./pages/Inventario/InventarioPage'))
const LiquidacionesPage = lazy(() => import('./pages/Comisiones/LiquidacionesPage'))
const AlertasPage = lazy(() => import('./pages/Alertas/AlertasPage'))
const PerfilPage = lazy(() => import('./pages/Perfil/PerfilPage'))
const ImportarPage = lazy(() => import('./pages/Importar/ImportarPage'))
const NominaPage = lazy(() => import('./pages/Nomina/NominaPage'))
const MetasPage = lazy(() => import('./pages/Metas/MetasPage'))

// Loader visual para Suspense
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-3 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
      <span className="text-sm text-gray-400">Cargando módulo...</span>
    </div>
  </div>
)

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
    <Suspense fallback={<PageLoader />}>
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
          <Route path="consultor" element={<ConsultorPage />} />
          <Route path="ventas" element={<VentasPage />} />
          <Route path="ventas/nueva" element={<NuevaVentaPage />} />
          <Route path="ventas/:id" element={<Venta360Page />} />
          <Route path="ventas/:id/imprimir" element={<ContratoPrint />} />
          <Route path="ventas/:id/acta-entrega" element={<ActaEntregaPrint />} />
          <Route path="sac" element={<SACPage />} />
          <Route path="mercadeo/supervisor" element={<SupervisorDashboard />} />
          <Route path="inventario" element={<InventarioPage />} />
          <Route path="liquidaciones" element={<LiquidacionesPage />} />
          <Route path="alertas" element={<AlertasPage />} />
          <Route path="perfil" element={<PerfilPage />} />
          <Route path="importar" element={<ImportarPage />} />
          <Route path="nomina" element={<NominaPage />} />
          <Route path="metas" element={<MetasPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <AppRoutes />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
