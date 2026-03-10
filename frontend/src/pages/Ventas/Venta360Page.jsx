import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getVenta360 } from '../../api/ventas'
import { getRecibos, createRecibo } from '../../api/recibos'

function fmt(val) {
  if (val === null || val === undefined) return '—'
  return `$${Number(val).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

const TABS = [
  { key: 'cliente',    label: '👤 Cliente' },
  { key: 'contrato',   label: '📋 Contrato' },
  { key: 'productos',  label: '🛒 Productos' },
  { key: 'cartera',    label: '💳 Cartera' },
  { key: 'pagos',      label: '💰 Pagos' },
]

export default function Venta360Page() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData]       = useState(null)
  const [tab, setTab]         = useState('cliente')
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const cargar = async () => {
    setLoading(true); setError('')
    try {
      const d = await getVenta360(id)
      setData(d)
    } catch (err) {
      setError('Error al cargar contrato: ' + (err.response?.data?.error || err.message))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [id])

  if (loading) return <div className="p-6"><Spinner /></div>
  if (error) return (
    <div className="p-6">
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">{error}</div>
    </div>
  )
  if (!data) return null

  const { contrato, productos, cuotas, recibos, resumen } = data

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 font-mono">{contrato.numero_contrato}</h1>
          <p className="text-sm text-gray-500">{contrato.nombres} {contrato.apellidos}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
            contrato.estado === 'activo' ? 'bg-green-100 text-green-700' :
            contrato.estado === 'completado' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-600'
          }`}>{contrato.estado}</span>
        </div>
      </div>

      {/* Resumen financiero */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-xl border bg-teal-50 border-teal-200 p-4">
          <p className="text-xs font-semibold uppercase text-teal-600 opacity-70">Monto Total</p>
          <p className="text-xl font-bold text-teal-700 mt-1">{fmt(resumen.monto_total)}</p>
        </div>
        <div className="rounded-xl border bg-green-50 border-green-200 p-4">
          <p className="text-xs font-semibold uppercase text-green-600 opacity-70">Pagado</p>
          <p className="text-xl font-bold text-green-700 mt-1">{fmt(resumen.total_pagado)}</p>
        </div>
        <div className="rounded-xl border bg-orange-50 border-orange-200 p-4">
          <p className="text-xs font-semibold uppercase text-orange-600 opacity-70">Saldo</p>
          <p className="text-xl font-bold text-orange-700 mt-1">{fmt(resumen.saldo_pendiente)}</p>
        </div>
        <div className="rounded-xl border bg-blue-50 border-blue-200 p-4">
          <p className="text-xs font-semibold uppercase text-blue-600 opacity-70">% Cobrado</p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{resumen.porcentaje_pagado}%</p>
          {resumen.comision_desbloqueada && (
            <p className="text-xs text-green-600 mt-1">✅ Comisión desbloqueada</p>
          )}
          {!resumen.comision_desbloqueada && (
            <p className="text-xs text-orange-500 mt-1">⏳ Falta {Math.max(0, 30 - resumen.porcentaje_pagado).toFixed(1)}% para comisión</p>
          )}
        </div>
        <div className="rounded-xl border bg-purple-50 border-purple-200 p-4">
          <p className="text-xs font-semibold uppercase text-purple-600 opacity-70">Cuotas</p>
          <p className="text-2xl font-bold text-purple-700 mt-1">{resumen.cuotas_pagadas}/{resumen.n_cuotas}</p>
          {resumen.cuotas_vencidas > 0 && (
            <p className="text-xs text-red-500 mt-1">⚠️ {resumen.cuotas_vencidas} vencidas</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-teal-500 text-teal-600 bg-teal-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* TAB: Cliente */}
          {tab === 'cliente' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-700">Datos Personales</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Nombre completo', value: `${contrato.nombres} ${contrato.apellidos}` },
                    { label: 'Teléfono', value: contrato.telefono },
                    { label: 'Email', value: contrato.email },
                    { label: 'Ciudad', value: contrato.ciudad },
                    { label: 'Dirección', value: contrato.direccion },
                  ].map(f => (
                    <div key={f.label} className="flex gap-3">
                      <span className="text-xs font-medium text-gray-400 w-36 shrink-0">{f.label}</span>
                      <span className="text-sm text-gray-800">{f.value || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-700">Datos Adicionales</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Tipo documento', value: contrato.tipo_documento },
                    { label: 'N° documento', value: contrato.num_documento },
                    { label: 'Fecha nacimiento', value: contrato.fecha_nacimiento ? new Date(contrato.fecha_nacimiento).toLocaleDateString('es-EC') : null },
                    { label: 'Género', value: contrato.genero },
                    { label: 'Estado civil', value: contrato.estado_civil },
                    { label: 'Patología', value: contrato.patologia },
                  ].map(f => (
                    <div key={f.label} className="flex gap-3">
                      <span className="text-xs font-medium text-gray-400 w-36 shrink-0">{f.label}</span>
                      <span className="text-sm text-gray-800">{f.value || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: Contrato */}
          {tab === 'contrato' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                {[
                  { label: 'N° Contrato', value: contrato.numero_contrato, mono: true },
                  { label: 'Fecha contrato', value: contrato.fecha_contrato ? new Date(contrato.fecha_contrato).toLocaleDateString('es-EC') : null },
                  { label: 'Sala', value: contrato.sala_nombre },
                  { label: 'Consultor', value: contrato.consultor_nombre },
                  { label: 'Outsourcing', value: contrato.outsourcing_nombre },
                  { label: 'Tipo de plan', value: contrato.tipo_plan },
                  { label: 'Segunda venta', value: contrato.segunda_venta ? '✅ Sí' : '❌ No' },
                ].map(f => (
                  <div key={f.label} className="flex gap-3">
                    <span className="text-xs font-medium text-gray-400 w-36 shrink-0">{f.label}</span>
                    <span className={`text-sm text-gray-800 ${f.mono ? 'font-mono font-bold text-teal-700' : ''}`}>{f.value || '—'}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Monto total', value: fmt(contrato.monto_total) },
                  { label: 'Cuota inicial', value: fmt(contrato.cuota_inicial) },
                  { label: 'Valor financiado', value: fmt((contrato.monto_total || 0) - (contrato.cuota_inicial || 0)) },
                  { label: 'N° cuotas', value: contrato.n_cuotas },
                  { label: 'Valor cuota', value: fmt(contrato.monto_cuota) },
                  { label: 'Día de pago', value: contrato.dia_pago ? `Día ${contrato.dia_pago} de cada mes` : null },
                  { label: 'Observaciones', value: contrato.observaciones },
                ].map(f => (
                  <div key={f.label} className="flex gap-3">
                    <span className="text-xs font-medium text-gray-400 w-36 shrink-0">{f.label}</span>
                    <span className="text-sm text-gray-800">{f.value || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: Productos */}
          {tab === 'productos' && (
            productos.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <div className="text-4xl mb-3">🛒</div>
                <p>No hay productos registrados</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600">Código</th>
                    <th className="text-left px-4 py-3 text-gray-600">Producto</th>
                    <th className="text-center px-4 py-3 text-gray-600">Cantidad</th>
                    <th className="text-right px-4 py-3 text-gray-600">Precio Unit.</th>
                    <th className="text-right px-4 py-3 text-gray-600">Total</th>
                    <th className="text-center px-4 py-3 text-gray-600">Despacho</th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map(p => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.codigo}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{p.producto_nombre}</td>
                      <td className="px-4 py-3 text-center">{p.cantidad}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{fmt(p.precio_unitario)}</td>
                      <td className="px-4 py-3 text-right font-medium">{fmt(p.valor_total)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-1 rounded-full ${p.despacho_estado === 'despachado' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {p.despacho_estado === 'despachado' ? '✅ Despachado' : '⏳ Pendiente'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {/* TAB: Cartera (Cuotas) */}
          {tab === 'cartera' && (
            cuotas.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <div className="text-4xl mb-3">💳</div>
                <p>Sin plan de cuotas (pago único o sin financiación)</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-center px-4 py-3 text-gray-600">Cuota</th>
                    <th className="text-right px-4 py-3 text-gray-600">Monto</th>
                    <th className="text-right px-4 py-3 text-gray-600">Pagado</th>
                    <th className="text-right px-4 py-3 text-gray-600">Saldo</th>
                    <th className="text-center px-4 py-3 text-gray-600">Vencimiento</th>
                    <th className="text-center px-4 py-3 text-gray-600">Fecha Pago</th>
                    <th className="text-center px-4 py-3 text-gray-600">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {cuotas.map(q => {
                    const saldo = parseFloat(q.monto_esperado) - parseFloat(q.monto_pagado || 0)
                    const isVencida = !q.fecha_pago && new Date(q.fecha_vencimiento) < new Date()
                    return (
                      <tr key={q.id} className={`border-b border-gray-50 hover:bg-gray-50 ${isVencida ? 'bg-red-50/30' : ''}`}>
                        <td className="px-4 py-3 text-center text-gray-600">#{q.numero_cuota}</td>
                        <td className="px-4 py-3 text-right">{fmt(q.monto_esperado)}</td>
                        <td className="px-4 py-3 text-right text-green-600">{fmt(q.monto_pagado)}</td>
                        <td className="px-4 py-3 text-right text-orange-600 font-medium">{fmt(saldo)}</td>
                        <td className="px-4 py-3 text-center text-xs">{new Date(q.fecha_vencimiento).toLocaleDateString('es-EC')}</td>
                        <td className="px-4 py-3 text-center text-xs text-gray-500">
                          {q.fecha_pago ? new Date(q.fecha_pago).toLocaleDateString('es-EC') : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            q.estado === 'pagado'   ? 'bg-green-100 text-green-700' :
                            q.estado === 'parcial'  ? 'bg-yellow-100 text-yellow-700' :
                            isVencida               ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {q.estado === 'pagado' ? '✅ Pagado' :
                             q.estado === 'parcial' ? '⚠️ Parcial' :
                             isVencida ? '❌ Vencida' : '⏳ Pendiente'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          )}

          {/* TAB: Pagos (Recibos) */}
          {tab === 'pagos' && (
            <div className="space-y-4">
              {recibos.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-4xl mb-3">💰</div>
                  <p>Sin pagos registrados aún</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-600">N° Recibo</th>
                      <th className="text-right px-4 py-3 text-gray-600">Valor</th>
                      <th className="text-left px-4 py-3 text-gray-600">Forma de Pago</th>
                      <th className="text-center px-4 py-3 text-gray-600">Fecha</th>
                      <th className="text-left px-4 py-3 text-gray-600">Referencia</th>
                      <th className="text-center px-4 py-3 text-gray-600">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recibos.map(r => (
                      <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-xs text-teal-700">{r.consecutivo || `RC-${r.id}`}</td>
                        <td className="px-4 py-3 text-right font-bold text-green-700">{fmt(r.valor)}</td>
                        <td className="px-4 py-3 text-gray-600">{r.forma_pago_nombre || '—'}</td>
                        <td className="px-4 py-3 text-center text-xs">{r.fecha_pago ? new Date(r.fecha_pago).toLocaleDateString('es-EC') : '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-400">{r.referencia_pago || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${r.estado === 'activo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {r.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
