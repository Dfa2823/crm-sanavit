import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import client from '../../api/client'

// ─── helpers ────────────────────────────────────────────────────────────────

function getMesActual() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function pct(real, meta) {
  if (!meta || meta <= 0) return 0
  return Math.min((real / meta) * 100, 100)
}

function cumple(row) {
  const checks = []
  if (Number(row.meta_contratos) > 0) checks.push(Number(row.real_contratos) >= Number(row.meta_contratos))
  if (Number(row.meta_ventas_monto) > 0) checks.push(Number(row.real_ventas_monto) >= Number(row.meta_ventas_monto))
  if (Number(row.meta_tours) > 0) checks.push(Number(row.real_tours) >= Number(row.meta_tours))
  return checks.length > 0 && checks.every(Boolean)
}

const ROLES_LABEL = {
  consultor: 'Consultor',
  tmk: 'TMK',
  confirmador: 'Confirmador',
  asesor_cartera: 'Asesor Cartera',
  director: 'Director',
}

// ─── UI ────────────────────────────────────────────────────────────────────

function Loading() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-7 h-7 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function ProgressBar({ real, meta, formato = 'number' }) {
  if (!meta || Number(meta) <= 0) {
    return <span className="text-gray-300 text-xs italic">Sin meta</span>
  }
  const p = pct(Number(real), Number(meta))
  const color = p >= 100 ? 'bg-green-500' : p >= 70 ? 'bg-yellow-400' : 'bg-teal-400'
  const realFmt = formato === 'money'
    ? `$${Number(real).toLocaleString('es-EC', { maximumFractionDigits: 0 })}`
    : Number(real)
  const metaFmt = formato === 'money'
    ? `$${Number(meta).toLocaleString('es-EC', { maximumFractionDigits: 0 })}`
    : Number(meta)
  return (
    <div className="min-w-[110px]">
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>{realFmt} / {metaFmt}</span>
        <span className="font-semibold">{p.toFixed(0)}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${p}%` }} />
      </div>
    </div>
  )
}

// ─── Modal establecer / editar meta ─────────────────────────────────────────

function ModalMeta({ empleado, mes, onClose, onGuardado }) {
  const [form, setForm] = useState({
    meta_contratos:    empleado.meta_contratos    || 0,
    meta_ventas_monto: empleado.meta_ventas_monto || 0,
    meta_tours:        empleado.meta_tours        || 0,
    bono_cumplimiento: empleado.bono_cumplimiento || 0,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  const handleChange = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleGuardar = async () => {
    setSaving(true)
    setError(null)
    try {
      await client.post('/api/metas', {
        usuario_id:        empleado.usuario_id,
        sala_id:           empleado.sala_id || null,
        mes,
        meta_contratos:    Number(form.meta_contratos),
        meta_ventas_monto: Number(form.meta_ventas_monto),
        meta_tours:        Number(form.meta_tours),
        bono_cumplimiento: Number(form.bono_cumplimiento),
      })
      onGuardado()
    } catch {
      setError('Error al guardar. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const rol = empleado.rol
  const esConsultor = ['consultor', 'director'].includes(rol)
  const esTMK = rol === 'tmk' || rol === 'confirmador'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-800">Establecer Meta</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {empleado.nombre} · <span className="capitalize">{ROLES_LABEL[rol] || rol}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {esConsultor && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Meta contratos (cantidad)</label>
                <input
                  type="number" min="0"
                  value={form.meta_contratos}
                  onChange={e => handleChange('meta_contratos', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Meta monto ventas ($)</label>
                <input
                  type="number" min="0"
                  value={form.meta_ventas_monto}
                  onChange={e => handleChange('meta_ventas_monto', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
            </>
          )}
          {esTMK && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Meta tours (cantidad)</label>
              <input
                type="number" min="0"
                value={form.meta_tours}
                onChange={e => handleChange('meta_tours', e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
          )}
          {!esConsultor && !esTMK && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Meta contratos</label>
                <input type="number" min="0" value={form.meta_contratos}
                  onChange={e => handleChange('meta_contratos', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Meta tours</label>
                <input type="number" min="0" value={form.meta_tours}
                  onChange={e => handleChange('meta_tours', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
              </div>
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Bono por cumplir meta ($)
              <span className="ml-1 text-gray-400 font-normal">— se añade automáticamente a nómina</span>
            </label>
            <input
              type="number" min="0"
              value={form.bono_cumplimiento}
              onChange={e => handleChange('bono_cumplimiento', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>

        <div className="px-6 pb-5 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={saving}
            className="px-5 py-2 text-sm bg-teal-500 hover:bg-teal-600 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar meta'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────

export default function MetasPage() {
  const { usuario } = useAuth()
  const [mes, setMes]       = useState(getMesActual())
  const [salaId, setSalaId] = useState(usuario?.sala_id || '')
  const [salas, setSalas]   = useState([])
  const [data, setData]     = useState([])
  const [loading, setLoading] = useState(false)
  const [editando, setEditando] = useState(null)  // empleado seleccionado

  const esAdmin = ['admin', 'director'].includes(usuario?.rol)

  // Cargar salas
  useEffect(() => {
    client.get('/api/admin/salas').then(r => setSalas(r.data || [])).catch(() => {})
  }, [])

  const fetchData = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ mes })
    if (salaId) params.set('sala_id', salaId)
    client.get(`/api/metas/progreso?${params}`)
      .then(r => setData(r.data?.data || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [mes, salaId])

  useEffect(() => { fetchData() }, [fetchData])

  // Estadísticas resumen
  const conMeta     = data.filter(d => Number(d.meta_contratos) > 0 || Number(d.meta_tours) > 0 || Number(d.meta_ventas_monto) > 0)
  const totalCumple = conMeta.filter(cumple).length
  const totalBono   = conMeta.reduce((s, r) => s + (cumple(r) ? Number(r.bono_cumplimiento) : 0), 0)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Metas Mensuales</h1>
          <p className="text-sm text-gray-500 mt-0.5">Objetivos y progreso por empleado</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-medium">Mes:</label>
            <input
              type="month" value={mes} onChange={e => setMes(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          </div>
          {salas.length > 1 && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 font-medium">Sala:</label>
              <select
                value={salaId} onChange={e => setSalaId(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              >
                <option value="">Todas</option>
                {salas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Cards resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
          <p className="text-xs text-teal-600 font-medium">Total empleados</p>
          <p className="text-2xl font-bold text-teal-700 mt-1">{data.length}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs text-blue-600 font-medium">Con meta activa</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{conMeta.length}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs text-green-600 font-medium">Metas cumplidas</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{totalCumple}</p>
          {conMeta.length > 0 && (
            <p className="text-xs text-green-500 mt-0.5">
              {((totalCumple / conMeta.length) * 100).toFixed(0)}% del equipo
            </p>
          )}
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-xs text-orange-600 font-medium">Bonos a pagar</p>
          <p className="text-2xl font-bold text-orange-700 mt-1">
            ${totalBono.toLocaleString('es-EC', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-orange-400 mt-0.5">si cumplen meta</p>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <Loading />
        ) : data.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">🎯</div>
            <p className="font-medium">No hay empleados en este período</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Empleado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rol</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contratos</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Monto</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tours</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Bono</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                  {esAdmin && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.map(row => {
                  const tieneMeta = Number(row.meta_contratos) > 0 || Number(row.meta_tours) > 0 || Number(row.meta_ventas_monto) > 0
                  const cumpleMeta = tieneMeta && cumple(row)
                  return (
                    <tr key={row.usuario_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-800">{row.nombre}</span>
                        {row.sala_nombre && (
                          <span className="block text-xs text-gray-400">{row.sala_nombre}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">
                          {ROLES_LABEL[row.rol] || row.rol}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ProgressBar real={row.real_contratos} meta={row.meta_contratos} />
                      </td>
                      <td className="px-4 py-3">
                        <ProgressBar real={row.real_ventas_monto} meta={row.meta_ventas_monto} formato="money" />
                      </td>
                      <td className="px-4 py-3">
                        <ProgressBar real={row.real_tours} meta={row.meta_tours} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {tieneMeta ? (
                          <span className="font-medium text-gray-700">
                            ${Number(row.bono_cumplimiento).toLocaleString('es-EC', { maximumFractionDigits: 0 })}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {!tieneMeta ? (
                          <span className="text-xs text-gray-400 italic">Sin meta</span>
                        ) : cumpleMeta ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium">
                            ✓ Cumplida
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
                            En progreso
                          </span>
                        )}
                      </td>
                      {esAdmin && (
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setEditando(row)}
                            className="text-xs text-teal-600 hover:text-teal-700 font-medium hover:underline"
                          >
                            {tieneMeta ? 'Editar' : 'Establecer'}
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {editando && (
        <ModalMeta
          empleado={editando}
          mes={mes}
          onClose={() => setEditando(null)}
          onGuardado={() => { setEditando(null); fetchData() }}
        />
      )}
    </div>
  )
}
