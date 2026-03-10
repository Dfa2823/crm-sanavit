import { useState, useEffect } from 'react'
import { getEmpresas, createEmpresa, updateEmpresa, getOutsourcingStats } from '../../api/outsourcing'

export default function OutsourcingPage() {
  const [tab, setTab] = useState('empresas')
  const [empresas, setEmpresas] = useState([])
  const [stats, setStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ nombre: '', ciudad: '', contacto_nombre: '', contacto_telefono: '', contacto_email: '', notas: '' })
  const [guardando, setGuardando] = useState(false)
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7))

  useEffect(() => { cargarDatos() }, [])
  useEffect(() => { if (tab === 'stats') cargarStats() }, [tab, periodo])

  async function cargarDatos() {
    try {
      setLoading(true)
      const data = await getEmpresas()
      setEmpresas(data)
    } catch (e) {
      setError('Error al cargar empresas')
    } finally {
      setLoading(false)
    }
  }

  async function cargarStats() {
    try {
      const [anio, mes] = periodo.split('-')
      const fechaInicio = `${anio}-${mes}-01`
      const ultimoDia = new Date(Number(anio), Number(mes), 0).getDate()
      const fechaFin = `${anio}-${mes}-${ultimoDia}`
      const data = await getOutsourcingStats({ fecha_inicio: fechaInicio, fecha_fin: fechaFin })
      setStats(data.data || [])
    } catch (e) {
      console.error(e)
    }
  }

  function abrirNuevo() {
    setEditando(null)
    setForm({ nombre: '', ciudad: '', contacto_nombre: '', contacto_telefono: '', contacto_email: '', notas: '' })
    setShowModal(true)
  }

  function abrirEditar(emp) {
    setEditando(emp)
    setForm({
      nombre: emp.nombre,
      ciudad: emp.ciudad || '',
      contacto_nombre: emp.contacto_nombre || '',
      contacto_telefono: emp.contacto_telefono || '',
      contacto_email: emp.contacto_email || '',
      notas: emp.notas || ''
    })
    setShowModal(true)
  }

  async function guardar() {
    if (!form.nombre.trim()) return
    setGuardando(true)
    try {
      if (editando) {
        const updated = await updateEmpresa(editando.id, form)
        setEmpresas(prev => prev.map(e => e.id === editando.id ? updated : e))
      } else {
        const nueva = await createEmpresa(form)
        setEmpresas(prev => [...prev, nueva])
      }
      setShowModal(false)
    } catch (e) {
      setError('Error al guardar empresa')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Outsourcing</h1>
        <p className="text-gray-500 text-sm mt-1">Administra empresas de call center externas y sus métricas</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[['empresas', '🏢 Empresas'], ['stats', '📊 Estadísticas']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === id ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'empresas' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-gray-500">{empresas.length} empresas registradas</span>
            <button onClick={abrirNuevo} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
              + Nueva empresa
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-400">Cargando...</div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Empresa', 'Ciudad', 'Contacto', 'Teléfono', 'Email', 'Estado', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {empresas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-gray-400">No hay empresas registradas</td>
                    </tr>
                  ) : empresas.map(emp => (
                    <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{emp.nombre}</td>
                      <td className="px-4 py-3 text-gray-600">{emp.ciudad || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{emp.contacto_nombre || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{emp.contacto_telefono || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{emp.contacto_email || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${emp.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {emp.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => abrirEditar(emp)}
                          className="text-teal-600 hover:text-teal-800 text-xs border border-teal-200 px-2 py-1 rounded"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'stats' && (
        <div>
          <div className="flex gap-3 mb-4">
            <input
              type="month"
              value={periodo}
              onChange={e => setPeriodo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <button onClick={cargarStats} className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm">
              Actualizar
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Empresa', 'Ciudad', 'Leads', 'Citas', 'Asistencias', 'Tours', 'Efect. Datos', 'Conv. Tour'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-400">No hay leads de outsourcing en este período</td>
                  </tr>
                ) : stats.map(s => (
                  <tr key={s.empresa_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{s.empresa}</td>
                    <td className="px-4 py-3 text-gray-600">{s.ciudad}</td>
                    <td className="px-4 py-3">{s.total_leads}</td>
                    <td className="px-4 py-3">{s.citas}</td>
                    <td className="px-4 py-3">{s.asistencias}</td>
                    <td className="px-4 py-3 font-bold text-teal-700">{s.tours}</td>
                    <td className="px-4 py-3">{s.efectividad_datos}%</td>
                    <td className="px-4 py-3 font-bold text-purple-700">{s.efectividad_tour}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal crear/editar empresa */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">{editando ? 'Editar empresa' : 'Nueva empresa'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {[
                ['nombre', 'Nombre *', 'text'],
                ['ciudad', 'Ciudad', 'text'],
                ['contacto_nombre', 'Nombre de contacto', 'text'],
                ['contacto_telefono', 'Teléfono de contacto', 'tel'],
                ['contacto_email', 'Email de contacto', 'email'],
              ].map(([field, label, type]) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type={type}
                    value={form[field]}
                    onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={form.notas}
                  onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={guardando || !form.nombre.trim()}
                className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
