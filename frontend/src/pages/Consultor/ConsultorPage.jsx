import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import client from '../../api/client'

function fmt(val) {
  if (!val && val !== 0) return '$0.00'
  return `$${Number(val).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const ESTADO_CLS = {
  activo:     'bg-green-100 text-green-700',
  cancelado:  'bg-red-100 text-red-700',
  suspendido: 'bg-yellow-100 text-yellow-700',
  completado: 'bg-blue-100 text-blue-700',
  inactivo:   'bg-gray-100 text-gray-500',
}

export default function ConsultorPage() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [contratos, setContratos] = useState([])
  const [loading, setLoading] = useState(true)

  const mesActual = new Date().toISOString().substring(0, 7)

  useEffect(() => {
    client.get('/api/ventas', { params: { consultor_id: usuario.id } })
      .then(r => setContratos(Array.isArray(r.data) ? r.data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [usuario.id])

  // Stats del mes
  const contratosMes = contratos.filter(c =>
    c.fecha_contrato?.startsWith(mesActual) && c.estado !== 'cancelado'
  )
  const ventasMes = contratosMes.length
  const montoVendido = contratosMes.reduce((s, c) => s + Number(c.monto_total || 0), 0)
  const totalCobrado = contratos
    .filter(c => c.estado === 'activo')
    .reduce((s, c) => s + Number(c.total_pagado || 0), 0)
  const totalSaldo = contratos
    .filter(c => c.estado === 'activo')
    .reduce((s, c) => s + Number(c.saldo || 0), 0)
  const clientesPagando = contratos.filter(c => c.estado === 'activo' && Number(c.total_pagado) > 0).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Mi Panel</h1>
        <p className="text-sm text-gray-400 mt-0.5">Resumen de tu cartera de clientes</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-center">
          <div className="text-3xl font-bold text-teal-600">{ventasMes}</div>
          <div className="text-sm text-gray-500 mt-1">Ventas del mes</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-center">
          <div className="text-2xl font-bold text-green-600">{fmt(montoVendido)}</div>
          <div className="text-sm text-gray-500 mt-1">Monto vendido</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-center">
          <div className="text-2xl font-bold text-blue-600">{fmt(totalCobrado)}</div>
          <div className="text-sm text-gray-500 mt-1">Total cobrado</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-center">
          <div className="text-3xl font-bold text-purple-600">{clientesPagando}</div>
          <div className="text-sm text-gray-500 mt-1">Clientes pagando</div>
        </div>
      </div>

      {/* Tabla de contratos */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-700">Mis Clientes</h2>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">
            {contratos.length} contratos
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Cargando...
          </div>
        ) : contratos.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <div className="text-4xl mb-3">📊</div>
            <p className="font-medium">No tienes contratos registrados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Cliente</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Contrato</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Fecha</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Monto</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Pagado</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Saldo</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Estado</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600"></th>
                </tr>
              </thead>
              <tbody>
                {contratos.map(c => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{c.nombres} {c.apellidos}</div>
                      <div className="text-xs text-gray-400">{c.telefono}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-teal-700 font-bold">{c.numero_contrato}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {c.fecha_contrato ? new Date(c.fecha_contrato).toLocaleDateString('es-EC') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmt(c.monto_total)}</td>
                    <td className="px-4 py-3 text-right text-green-700 font-medium">{fmt(c.total_pagado)}</td>
                    <td className="px-4 py-3 text-right text-red-600 font-medium">{fmt(c.saldo)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${ESTADO_CLS[c.estado] || 'bg-gray-100 text-gray-600'}`}>
                        {c.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <button
                          onClick={() => navigate(`/ventas/${c.id}`)}
                          className="text-teal-600 hover:text-teal-800 text-xs font-medium"
                        >
                          Ver
                        </button>
                        {c.telefono && (
                          <a
                            href={`https://wa.me/593${c.telefono?.replace(/^0/, '').replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-500 hover:text-green-700"
                            title="WhatsApp"
                          >
                            📱
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resumen financiero */}
      {contratos.length > 0 && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-5">
          <h3 className="font-semibold text-teal-800 mb-2">Resumen de mi cartera</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-teal-600">Total vendido</p>
              <p className="font-bold text-teal-800 text-lg">{fmt(contratos.reduce((s, c) => s + Number(c.monto_total || 0), 0))}</p>
            </div>
            <div>
              <p className="text-teal-600">Total cobrado</p>
              <p className="font-bold text-green-700 text-lg">{fmt(totalCobrado)}</p>
            </div>
            <div>
              <p className="text-teal-600">Saldo pendiente</p>
              <p className="font-bold text-red-600 text-lg">{fmt(totalSaldo)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
