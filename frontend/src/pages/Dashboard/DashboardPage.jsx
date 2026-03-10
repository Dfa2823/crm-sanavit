import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import client from '../../api/client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSaludo() {
  const h = new Date().getHours()
  if (h < 12) return '🌅 Buenos días'
  if (h < 18) return '☀️ Buenas tardes'
  return '🌙 Buenas noches'
}

function getMesActual() {
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  return `${now.getFullYear()}-${mm}`
}

function getFechaLarga() {
  return new Date().toLocaleDateString('es-EC', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// UI primitives
// ---------------------------------------------------------------------------

function Loading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function KPICard({ label, valor, icon, color = 'teal', sublabel }) {
  const colores = {
    teal:   'bg-teal-50 border-teal-200 text-teal-700',
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
    red:    'bg-red-50 border-red-200 text-red-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    green:  'bg-green-50 border-green-200 text-green-700',
    gray:   'bg-gray-50 border-gray-200 text-gray-700',
  }
  return (
    <div className={`rounded-xl border p-4 ${colores[color] || colores.teal}`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs font-medium opacity-70">{label}</p>
          <p className="text-2xl font-bold mt-1">{valor ?? '—'}</p>
          {sublabel && <p className="text-xs opacity-60 mt-0.5">{sublabel}</p>}
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  )
}

function AccesoRapido({ icon, label, to }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(to)}
      className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-teal-200 transition-all"
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-xs font-medium text-gray-700 text-center">{label}</span>
    </button>
  )
}

function SaludoHeader({ emoji, nombre, subtitulo }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
      <div className="flex flex-wrap items-center gap-2 text-gray-700">
        <span className="text-xl font-semibold">
          {getSaludo()}, <span className="text-teal-600">{nombre}</span>
        </span>
        {subtitulo && (
          <>
            <span className="text-gray-300">·</span>
            <span className="text-sm text-gray-500">{subtitulo}</span>
          </>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="mb-6">
      {title && (
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">
          {title}
        </h3>
      )}
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DashboardAdmin / DashboardDirector
// ---------------------------------------------------------------------------

function DashboardAdmin() {
  const { usuario } = useAuth()
  const [kpis, setKpis]       = useState(null)
  const [alertas, setAlertas] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mes, setMes]         = useState(getMesActual())

  useEffect(() => {
    setLoading(true)
    const params = mes ? `?periodo=${mes}` : ''
    Promise.all([
      client.get(`/api/kpis${params}`).catch(() => ({ data: null })),
      client.get('/api/alertas/resumen').catch(() => ({ data: null })),
    ]).then(([kpisRes, alertasRes]) => {
      setKpis(kpisRes.data)
      setAlertas(alertasRes.data)
    }).finally(() => setLoading(false))
  }, [mes])

  const m  = kpis?.mercadeo  || {}
  const sa = kpis?.sala      || {}
  const ca = kpis?.cartera   || {}
  const ve = kpis?.ventas    || {}
  const al = alertas         || {}

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Saludo + filtros */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xl font-semibold text-gray-700">
              {getSaludo()},{' '}
              <span className="text-teal-600">{usuario?.nombre || 'Admin'}</span>
            </span>
            <p className="text-xs text-gray-400 mt-0.5 capitalize">{getFechaLarga()}</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-medium">Mes:</label>
            <input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : (
        <>
          {/* Row 1: KPIs de mercadeo */}
          <Section title="KPIs de mercadeo">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <KPICard label="Leads"       valor={m.total_leads}       icon="🎯" color="teal"   />
              <KPICard label="Citas"        valor={m.total_citas}       icon="📅" color="blue"   />
              <KPICard label="Tours"        valor={m.total_tours}       icon="🏥" color="green"  />
              <KPICard label="Ventas (mes)" valor={ve.total_contratos}  icon="💼" color="teal"   />
              <KPICard
                label="Monto Total"
                valor={ve.monto_total != null ? `$${Number(ve.monto_total).toLocaleString('es-EC')}` : '—'}
                icon="💰"
                color="green"
              />
              <KPICard
                label="Mora 30d+"
                valor={ca.mora_30_dias != null ? ca.mora_30_dias : '—'}
                icon="⚠️"
                color="red"
                sublabel="clientes"
              />
            </div>
          </Section>

          {/* Row 2: Accesos rápidos */}
          <Section title="Accesos rápidos">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <AccesoRapido icon="💬" label="Nueva Venta"   to="/ventas/nueva"             />
              <AccesoRapido icon="👥" label="Ver Cartera"   to="/cartera"                  />
              <AccesoRapido icon="📈" label="Reportes"      to="/reportes"                 />
              <AccesoRapido icon="🔔" label="Alertas"       to="/alertas"                  />
            </div>
          </Section>

          {/* Row 3: Estado del sistema */}
          <Section title="Estado del sistema">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <KPICard
                label="Cuotas vencidas"
                valor={al.cuotas_vencidas ?? '—'}
                icon="📛"
                color="red"
                sublabel="requieren atención"
              />
              <KPICard
                label="Tickets urgentes"
                valor={al.tickets_urgentes ?? '—'}
                icon="🎫"
                color="orange"
                sublabel="tickets abiertos"
              />
              <KPICard
                label="Próximas a vencer"
                valor={al.proximas_a_vencer ?? '—'}
                icon="⏰"
                color="orange"
                sublabel="en los próximos 7 días"
              />
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DashboardConsultor
// ---------------------------------------------------------------------------

function DashboardConsultor() {
  const { usuario } = useAuth()
  const navigate    = useNavigate()
  const [kpis, setKpis]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const mes = getMesActual()
    const salaParam = usuario?.sala_id ? `&sala_id=${usuario.sala_id}` : ''
    client
      .get(`/api/kpis?periodo=${mes}${salaParam}`)
      .then((r) => setKpis(r.data))
      .catch(() => setKpis(null))
      .finally(() => setLoading(false))
  }, [usuario?.sala_id])

  const ve = kpis?.ventas  || {}
  const ca = kpis?.cartera || {}

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <SaludoHeader
        nombre={usuario?.nombre || 'Consultor'}
        subtitulo={`${usuario?.sala_nombre || 'tu sala'} · ${getFechaLarga()}`}
      />

      {loading ? (
        <Loading />
      ) : (
        <>
          <Section title="Mis estadísticas del mes">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KPICard
                label="Ventas (mes)"
                valor={ve.total_contratos ?? '—'}
                icon="💼"
                color="teal"
                sublabel="contratos"
              />
              <KPICard
                label="Comisión estimada"
                valor={
                  ve.total_contratos != null
                    ? `$${(ve.total_contratos * 1200 * 0.1).toLocaleString('es-EC', { maximumFractionDigits: 0 })}`
                    : '—'
                }
                icon="💵"
                color="green"
                sublabel="aprox. 10%"
              />
              <KPICard
                label="Clientes hoy"
                valor={kpis?.sala?.tours ?? '—'}
                icon="👤"
                color="blue"
                sublabel="tours del mes"
              />
              <KPICard
                label="En mora"
                valor={ca.mora_30_dias ?? '—'}
                icon="⚠️"
                color="red"
                sublabel="clientes 30d+"
              />
            </div>
          </Section>

          <Section title="Accesos rápidos">
            <div className="grid grid-cols-3 gap-3">
              <AccesoRapido icon="🏥" label="Ir a Recepción" to="/sala/recepcion" />
              <AccesoRapido icon="💼" label="Nueva Venta"    to="/ventas/nueva"  />
              <AccesoRapido icon="📋" label="Mis Ventas"     to="/ventas"        />
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DashboardTMK
// ---------------------------------------------------------------------------

const FRASES_TMK = [
  'Cada llamada es una oportunidad para cambiar la vida de alguien 💪',
  'La perseverancia es la clave del éxito en ventas. ¡Tú puedes! 🚀',
  "Un 'no' hoy puede ser el 'sí' de mañana. ¡Sigue adelante! ⭐",
  'Los grandes logros empiezan con pequeñas acciones consistentes 🏆',
  'Tu actitud determina tu altitud. ¡Apunta alto hoy! 🎯',
]

function DashboardTMK() {
  const { usuario } = useAuth()
  const navigate    = useNavigate()
  const [kpis, setKpis]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [frase]  = useState(
    () => FRASES_TMK[Math.floor(Math.random() * FRASES_TMK.length)]
  )

  useEffect(() => {
    const mes = getMesActual()
    const salaParam = usuario?.sala_id ? `&sala_id=${usuario.sala_id}` : ''
    client
      .get(`/api/kpis?periodo=${mes}${salaParam}`)
      .then((r) => setKpis(r.data))
      .catch(() => setKpis(null))
      .finally(() => setLoading(false))
  }, [usuario?.sala_id])

  const m = kpis?.mercadeo || {}

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <SaludoHeader
        nombre={usuario?.nombre || 'TMK'}
        subtitulo="Tus estadísticas de hoy"
      />

      {loading ? (
        <Loading />
      ) : (
        <>
          <Section title="Estadísticas del mes">
            <div className="grid grid-cols-3 gap-3">
              <KPICard label="Leads"            valor={m.total_leads}       icon="🎯" color="teal"  />
              <KPICard label="Citas agendadas"  valor={m.total_citas}       icon="📅" color="blue"  />
              <KPICard label="Tours confirmados" valor={m.total_tours}      icon="🏥" color="green" />
            </div>
          </Section>

          <Section>
            <button
              onClick={() => navigate('/mercadeo/captura')}
              className="w-full flex items-center justify-center gap-3 bg-teal-500 hover:bg-teal-600 text-white font-semibold py-4 rounded-xl shadow-md transition-colors text-base"
            >
              <span className="text-2xl">📞</span>
              Ir a Captura de Leads →
            </button>
          </Section>

          <Section title="Frase del día">
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-5 text-center">
              <p className="text-teal-700 font-medium text-sm leading-relaxed">{frase}</p>
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DashboardSupervisor
// ---------------------------------------------------------------------------

function DashboardSupervisor() {
  const { usuario } = useAuth()
  const navigate    = useNavigate()
  const [kpis, setKpis]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const mes = getMesActual()
    const salaParam = usuario?.sala_id ? `&sala_id=${usuario.sala_id}` : ''
    client
      .get(`/api/kpis?periodo=${mes}${salaParam}`)
      .then((r) => setKpis(r.data))
      .catch(() => setKpis(null))
      .finally(() => setLoading(false))
  }, [usuario?.sala_id])

  const m = kpis?.mercadeo || {}

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <SaludoHeader
        nombre={usuario?.nombre || 'Supervisor'}
        subtitulo="Panel de tu equipo"
      />

      {loading ? (
        <Loading />
      ) : (
        <>
          <Section title="Estadísticas del equipo (mes)">
            <div className="grid grid-cols-3 gap-3">
              <KPICard label="Leads del equipo" valor={m.total_leads}  icon="🎯" color="teal"  />
              <KPICard label="Citas"             valor={m.total_citas}  icon="📅" color="blue"  />
              <KPICard label="Tours"             valor={m.total_tours}  icon="🏥" color="green" />
            </div>
          </Section>

          <Section title="Accesos rápidos">
            <div className="grid grid-cols-3 gap-3">
              <AccesoRapido icon="🎯" label="Supervisor CC"    to="/mercadeo/premanifiesto" />
              <AccesoRapido icon="📋" label="Pre-manifiesto"   to="/mercadeo/premanifiesto" />
              <AccesoRapido icon="📈" label="Reportes"         to="/reportes"               />
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DashboardCartera
// ---------------------------------------------------------------------------

function DashboardCartera() {
  const { usuario } = useAuth()
  const navigate    = useNavigate()
  const [kpis, setKpis]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const mes = getMesActual()
    const salaParam = usuario?.sala_id ? `&sala_id=${usuario.sala_id}` : ''
    client
      .get(`/api/kpis?periodo=${mes}${salaParam}`)
      .then((r) => setKpis(r.data))
      .catch(() => setKpis(null))
      .finally(() => setLoading(false))
  }, [usuario?.sala_id])

  const ca = kpis?.cartera || {}

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <SaludoHeader
        nombre={usuario?.nombre || 'Asesor'}
        subtitulo="Estado de cartera"
      />

      {loading ? (
        <Loading />
      ) : (
        <>
          <Section title="Estado de mora">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KPICard label="Al día"    valor={ca.al_dia       ?? '—'} icon="✅" color="green"  sublabel="clientes" />
              <KPICard label="Mora 30d"  valor={ca.mora_30_dias ?? '—'} icon="⚠️" color="orange" sublabel="clientes" />
              <KPICard label="Mora 60d"  valor={ca.mora_60_dias ?? '—'} icon="🔶" color="orange" sublabel="clientes" />
              <KPICard label="Mora 90d+" valor={ca.mora_90_dias ?? '—'} icon="🚨" color="red"    sublabel="clientes" />
            </div>
          </Section>

          <Section title="Accesos rápidos">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate('/cartera')}
                className="flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 rounded-xl shadow-sm transition-colors"
              >
                <span>💳</span> Ir a Cartera →
              </button>
              <button
                onClick={() => navigate('/reportes')}
                className="flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 rounded-xl shadow-sm border border-gray-200 transition-colors"
              >
                <span>📈</span> Reportes
              </button>
            </div>
          </Section>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DashboardHostess
// ---------------------------------------------------------------------------

function DashboardHostess() {
  const { usuario } = useAuth()
  const navigate    = useNavigate()

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <SaludoHeader
        nombre={usuario?.nombre || 'Hostess'}
        subtitulo="Panel de recepción"
      />

      <Section title="Accesos principales">
        <div className="flex flex-col gap-4">
          <button
            onClick={() => navigate('/sala/recepcion')}
            className="flex items-center justify-center gap-3 bg-teal-500 hover:bg-teal-600 text-white font-semibold py-5 rounded-2xl shadow-md transition-colors text-lg"
          >
            <span className="text-3xl">🏥</span>
            Recepción de hoy →
          </button>
          <button
            onClick={() => navigate('/ventas')}
            className="flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-4 rounded-2xl shadow-sm border border-gray-200 transition-colors text-base"
          >
            <span className="text-2xl">💼</span>
            Ventas →
          </button>
        </div>
      </Section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DashboardGenerico
// ---------------------------------------------------------------------------

function DashboardGenerico() {
  const { usuario } = useAuth()
  return (
    <div className="text-center py-20">
      <div className="text-6xl mb-4">👋</div>
      <h2 className="text-xl font-bold text-gray-800">
        Bienvenido, {usuario?.nombre}
      </h2>
      <p className="text-gray-500 mt-2">
        Usa el menú lateral para navegar al módulo que necesitas.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DashboardPage — router por rol
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { usuario, loading } = useAuth()
  const rol = usuario?.rol

  if (loading) return <Loading />
  if (!usuario) return <Loading />

  if (rol === 'admin' || rol === 'director')    return <DashboardAdmin />
  if (rol === 'consultor')                      return <DashboardConsultor />
  if (rol === 'tmk' || rol === 'outsourcing')   return <DashboardTMK />
  if (rol === 'supervisor_cc')                  return <DashboardSupervisor />
  if (rol === 'asesor_cartera')                 return <DashboardCartera />
  if (rol === 'hostess')                        return <DashboardHostess />
  return <DashboardGenerico />
}
