import { useState, useEffect } from 'react'
import { getComisionesResumen } from '../../api/comisiones'

export default function ComisionesPage() {
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7))
  const [data, setData] = useState([])
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { cargar() }, [periodo])

  async function cargar() {
    setLoading(true)
    setError(null)
    try {
      const res = await getComisionesResumen({ periodo })
      setData(res.data || [])
      setMeta(res.meta)
    } catch (e) {
      setError('Error al cargar comisiones')
    } finally {
      setLoading(false)
    }
  }

  const totalGeneral = data.reduce((s, r) => s + Number(r.total_comision), 0)

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Comisiones del Período</h1>
          <p className="text-gray-500 text-sm mt-1">Liquidación automática basada en tours y contratos</p>
        </div>
        <input
          type="month"
          value={periodo}
          onChange={e => setPeriodo(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Cards resumen */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase font-semibold">Total a pagar</p>
          <p className="text-3xl font-bold text-teal-700 mt-1">
            ${totalGeneral.toLocaleString('es-EC', { minimumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-gray-400 mt-1">{periodo}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase font-semibold">Colaboradores con comisión</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{data.length}</p>
          <p className="text-xs text-gray-400 mt-1">en este período</p>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-700">Detalle por colaborador</h2>
        </div>
        {loading ? (
          <div className="text-center py-12 text-gray-400">Calculando comisiones...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Colaborador', 'Rol', 'Sala', 'Tours', 'Contratos', 'Com. Tours', 'Com. Contratos', 'Total'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">No hay comisiones en este período</td>
                </tr>
              ) : (
                <>
                  {data.map((r, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{r.nombre}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">{r.rol}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{r.sala || '—'}</td>
                      <td className="px-4 py-3 text-center">{r.tours}</td>
                      <td className="px-4 py-3 text-center">{r.contratos}</td>
                      <td className="px-4 py-3 text-green-700">${Number(r.comision_tours).toLocaleString()}</td>
                      <td className="px-4 py-3 text-blue-700">${Number(r.comision_contratos).toLocaleString()}</td>
                      <td className="px-4 py-3 font-bold text-teal-700">${Number(r.total_comision).toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 border-t-2 border-gray-300">
                    <td colSpan={7} className="px-4 py-3 font-bold text-gray-700 text-right">TOTAL</td>
                    <td className="px-4 py-3 font-bold text-teal-700 text-lg">${totalGeneral.toLocaleString()}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Nota tabla de comisiones */}
      {meta?.tabla_comisiones && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-blue-700">
          <strong>Tabla de comisiones configurada:</strong>
          <span className="ml-2">Tour: Consultor $50 · TMK $15 · Confirmador $10</span>
          <span className="ml-4">Contrato: Consultor $200 · TMK $30 · Confirmador $20</span>
        </div>
      )}
    </div>
  )
}
