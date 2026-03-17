import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getCartera, getCarteraResumen, updateGestion } from '../../api/cartera'
import { getSalas, getFormasPago } from '../../api/admin'
import { createRecibo } from '../../api/recibos'

// ─────────────────── Helpers ─────────────────────────────────────────────────
function fmt(val) {
  if (val === null || val === undefined) return '—'
  return `$${Number(val).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtFecha(val) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('es-EC')
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// ─────────────────── Export functions ───────────────────────────────────────
function exportarCarteraCSV(cuotas) {
  if (!cuotas.length) return
  const cols = ['Cliente', 'Teléfono', 'N° Contrato', 'Cuota', 'Vence', 'Días vencido', 'Saldo', 'Tramo mora', 'Consultor', 'Sala', 'Observación']
  const rows = cuotas.map(c => [
    `${c.nombres || ''} ${c.apellidos || ''}`.trim(),
    c.telefono || '',
    c.numero_contrato || '',
    c.numero_cuota || '',
    c.fecha_vencimiento ? new Date(c.fecha_vencimiento).toLocaleDateString('es-EC') : '',
    c.dias_vencido ?? '',
    c.saldo_cuota ?? '',
    c.tramo_mora || '',
    c.consultor_nombre || '',
    c.sala_nombre || '',
    c.observacion_gestion || '',
  ])
  const csv = [cols, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `cartera-${new Date().toISOString().split('T')[0]}.csv`
  a.click(); URL.revokeObjectURL(url)
}

function exportarCarteraPDF(cuotas) {
  if (!cuotas.length) return
  const filas = cuotas.map(c => `
    <tr>
      <td>${c.nombres || ''} ${c.apellidos || ''}</td>
      <td>${c.telefono || '—'}</td>
      <td>${c.numero_contrato || '—'}</td>
      <td style="text-align:center">${c.numero_cuota || '—'}</td>
      <td>${c.fecha_vencimiento ? new Date(c.fecha_vencimiento).toLocaleDateString('es-EC') : '—'}</td>
      <td style="text-align:center">${c.dias_vencido ?? '—'}</td>
      <td style="text-align:right">$${Number(c.saldo_cuota || 0).toLocaleString('es-EC', { minimumFractionDigits: 2 })}</td>
      <td>${c.tramo_mora || '—'}</td>
      <td>${c.consultor_nombre || '—'}</td>
    </tr>`).join('')
  const totalSaldo = cuotas.reduce((s, c) => s + Number(c.saldo_cuota || 0), 0)
  const html = `<!DOCTYPE html><html lang="es"><head>
    <meta charset="UTF-8"><title>Cartera — ${new Date().toLocaleDateString('es-EC')}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:9px;color:#222;margin:0}
      h1{font-size:14px;margin:0 0 2px} .sub{color:#6b7280;font-size:8px;margin:0 0 8px}
      table{width:100%;border-collapse:collapse}
      th{background:#f3f4f6;padding:4px 5px;font-size:8px;border:1px solid #d1d5db;text-align:left}
      td{padding:3px 5px;border:1px solid #e5e7eb;vertical-align:top}
      tr:nth-child(even) td{background:#f9fafb}
      .total{font-weight:bold;background:#f0fdf4;color:#166534}
      @page{margin:1cm;size:A4 landscape}
    </style></head><body>
    <h1>Gestión de Cartera</h1>
    <p class="sub">Generado el ${new Date().toLocaleString('es-EC')} — ${cuotas.length} cuotas — Total saldo: $${totalSaldo.toLocaleString('es-EC',{minimumFractionDigits:2})}</p>
    <table>
      <thead><tr>
        <th>Cliente</th><th>Teléfono</th><th>N° Contrato</th><th>Cuota</th>
        <th>Vence</th><th>Días</th><th>Saldo</th><th>Tramo</th><th>Consultor</th>
      </tr></thead>
      <tbody>${filas}</tbody>
    </table>
  </body></html>`
  const w = window.open('', '_blank', 'width=1100,height=750')
  if (!w) { alert('Permite ventanas emergentes para exportar PDF'); return }
  w.document.write(html); w.document.close(); w.focus()
  setTimeout(() => { w.print(); w.close() }, 600)
}

// ─────────────────── Badge de tramo de mora ──────────────────────────────────
const TRAMO_CONFIG = {
  vigente:      { label: 'Vigente',    cls: 'bg-gray-100 text-gray-600' },
  mora_30:      { label: '1-30 días',  cls: 'bg-yellow-100 text-yellow-800' },
  mora_60:      { label: '31-60 días', cls: 'bg-orange-100 text-orange-800' },
  mora_90:      { label: '61-90 días', cls: 'bg-red-100 text-red-700' },
  mora_90_plus: { label: '+90 días',   cls: 'bg-red-200 text-red-900' },
}

function BadgeTramo({ tramo }) {
  const cfg = TRAMO_CONFIG[tramo] || { label: tramo || '—', cls: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ─────────────────── Stat card de aging ──────────────────────────────────────
function AgingCard({ titulo, count, monto, bgCls, textCls, borderCls }) {
  return (
    <div className={`rounded-xl border p-5 ${bgCls} ${borderCls}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide opacity-80 ${textCls}`}>{titulo}</p>
      <p className={`text-3xl font-bold mt-1 ${textCls}`}>{count ?? 0}</p>
      <p className={`text-sm mt-1 font-medium ${textCls} opacity-80`}>{fmt(monto)}</p>
    </div>
  )
}

// ─────────────────── Modal / inline panel de gestión ─────────────────────────
function PanelGestion({ cuota, onClose, onSaved }) {
  const [observacion, setObservacion] = useState(cuota.observacion_gestion || '')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  const guardar = async () => {
    setSaving(true)
    setError('')
    try {
      await updateGestion(cuota.cuota_id, { observacion })
      onSaved(cuota.cuota_id, observacion)
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800 text-base">Registrar gestión</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="text-sm text-gray-600 space-y-1">
          <p><span className="font-semibold">Cliente:</span> {cuota.nombres} {cuota.apellidos}</p>
          <p><span className="font-semibold">Contrato:</span> {cuota.numero_contrato || '—'}</p>
          <p><span className="font-semibold">Cuota:</span> #{cuota.numero_cuota} — vence {fmtFecha(cuota.fecha_vencimiento)}</p>
          <p><span className="font-semibold">Saldo:</span> {fmt(cuota.saldo_cuota)}</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Observación de gestión</label>
          <textarea
            rows={4}
            value={observacion}
            onChange={e => setObservacion(e.target.value)}
            placeholder="Ej: Contactado por WhatsApp, prometió pago el lunes..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
          />
        </div>

        {error && (
          <p className="text-red-600 text-xs">{error}</p>
        )}

        <div className="flex gap-3 justify-end pt-1">
          <button
            onClick={onClose}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={saving}
            className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────── Panel de Cobro ──────────────────────────────────────────
function PanelCobro({ cuota, formasPago, onClose, onSaved }) {
  const hoy = new Date().toISOString().split('T')[0]
  const [formaPagoId, setFormaPagoId] = useState('')
  const [monto, setMonto]             = useState(String(cuota.saldo_cuota || ''))
  const [fecha, setFecha]             = useState(hoy)
  const [referencia, setReferencia]   = useState('')
  const [observacion, setObservacion] = useState('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  const formaSeleccionada = formasPago.find(f => String(f.id) === String(formaPagoId))
  const requiereRef = formaSeleccionada?.requiere_referencia

  const guardar = async () => {
    if (!monto || Number(monto) <= 0) { setError('El monto debe ser mayor a 0'); return }
    if (!formaPagoId) { setError('Selecciona una forma de pago'); return }
    if (requiereRef && !referencia.trim()) { setError('Ingresa el N° de aprobación / referencia'); return }
    setSaving(true)
    setError('')
    try {
      await createRecibo({
        persona_id: cuota.persona_id,
        contrato_id: cuota.contrato_id,
        cuota_id: cuota.cuota_id,
        valor: Number(monto),
        forma_pago_id: Number(formaPagoId),
        fecha_pago: fecha,
        referencia_pago: referencia || undefined,
        observacion: observacion || undefined,
        sala_id: cuota.sala_id,
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800 text-base">Registrar Cobro</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="text-sm text-gray-600 space-y-1 bg-teal-50 rounded-lg p-3">
          <p><span className="font-semibold">Cliente:</span> {cuota.nombres} {cuota.apellidos}</p>
          <p><span className="font-semibold">Contrato:</span> {cuota.numero_contrato} · Cuota #{cuota.numero_cuota}</p>
          <p><span className="font-semibold">Saldo cuota:</span> {fmt(cuota.saldo_cuota)}</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Monto a cobrar *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input type="number" min="0.01" step="0.01" required
                value={monto} onChange={e => setMonto(e.target.value)}
                className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Forma de pago *</label>
            <select value={formaPagoId} onChange={e => setFormaPagoId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">Seleccionar...</option>
              {formasPago.map(fp => <option key={fp.id} value={fp.id}>{fp.nombre}</option>)}
            </select>
          </div>

          {(requiereRef || formaPagoId) && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                N° Aprobación / Referencia {!requiereRef && <span className="font-normal text-gray-400">(opcional)</span>}
              </label>
              <input type="text" value={referencia} onChange={e => setReferencia(e.target.value)}
                placeholder="Ej: 123456 / REF-ABC"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Fecha de pago</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Observación <span className="font-normal text-gray-400">(opcional)</span></label>
            <textarea rows={2} value={observacion} onChange={e => setObservacion(e.target.value)}
              placeholder="Notas sobre el cobro..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
          </div>
        </div>

        {error && <p className="text-red-600 text-xs bg-red-50 rounded-md px-2 py-1">{error}</p>}

        <div className="flex gap-3 justify-end pt-1">
          <button onClick={onClose}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={guardar} disabled={saving}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
            {saving ? 'Registrando...' : '💰 Registrar Cobro'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────── Página principal ────────────────────────────────────────
export default function CarteraPage() {
  const { usuario } = useAuth()

  const [cuotas,       setCuotas]       = useState([])
  const [resumen,      setResumen]      = useState(null)
  const [salas,        setSalas]        = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')

  // Filtros backend
  const [filtroSala,   setFiltroSala]   = useState(usuario?.sala_id || '')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroAging,  setFiltroAging]  = useState('')

  // Filtro frontend (búsqueda libre)
  const [busqueda,     setBusqueda]     = useState('')

  // Paneles
  const [panelCuota,   setPanelCuota]   = useState(null)
  const [panelCobro,   setPanelCobro]   = useState(null)
  const [formasPago,   setFormasPago]   = useState([])

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (filtroSala)   params.sala_id = filtroSala
      if (filtroEstado && filtroEstado !== 'todos') params.estado = filtroEstado
      if (filtroAging)  params.aging   = filtroAging

      const [dataCuotas, dataResumen, dataSalas] = await Promise.all([
        getCartera(params),
        getCarteraResumen(),
        getSalas(),
      ])
      setCuotas(Array.isArray(dataCuotas) ? dataCuotas : [])
      setResumen(dataResumen || null)
      setSalas(Array.isArray(dataSalas) ? dataSalas : [])
    } catch (err) {
      setError('Error al cargar cartera: ' + (err.response?.data?.error || err.message))
    } finally {
      setLoading(false)
    }
  }, [filtroSala, filtroEstado, filtroAging])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => {
    getFormasPago().then(fps => setFormasPago(Array.isArray(fps) ? fps.filter(f => f.activo) : [])).catch(console.error)
  }, [])

  // Aplicar búsqueda libre en frontend
  const cuotasFiltradas = cuotas.filter(c => {
    if (!busqueda.trim()) return true
    const term = busqueda.trim().toLowerCase()
    const nombre   = `${c.nombres || ''} ${c.apellidos || ''}`.toLowerCase()
    const telefono = (c.telefono || '').toLowerCase()
    const contrato = (c.numero_contrato || '').toLowerCase()
    return nombre.includes(term) || telefono.includes(term) || contrato.includes(term)
  })

  // Actualizar observación en lista local tras guardar
  const handleGestionSaved = (cuotaId, observacion) => {
    setCuotas(prev =>
      prev.map(c => c.cuota_id === cuotaId ? { ...c, observacion_gestion: observacion } : c)
    )
  }

  // Botón WhatsApp
  const waLink = (tel) => {
    if (!tel) return null
    const num = tel.replace(/\D/g, '').replace(/^0/, '')
    return `https://wa.me/593${num}`
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Cartera</h1>
        <div className="flex gap-2">
          <button
            onClick={() => exportarCarteraCSV(cuotasFiltradas)}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
          >
            📥 CSV
          </button>
          <button
            onClick={() => exportarCarteraPDF(cuotasFiltradas)}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
          >
            🖨️ PDF
          </button>
          <button
            onClick={cargar}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
          >
            Actualizar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Sala</label>
          <select
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={filtroSala}
            onChange={e => setFiltroSala(e.target.value)}
          >
            <option value="">Todas las salas</option>
            {salas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Estado cuota</label>
          <select
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value)}
          >
            <option value="todos">Todos</option>
            <option value="vencido">Vencidas</option>
            <option value="pendiente">Vigentes</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Aging (días vencido)</label>
          <select
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={filtroAging}
            onChange={e => setFiltroAging(e.target.value)}
          >
            <option value="">Sin filtro</option>
            <option value="30">30+ días</option>
            <option value="60">60+ días</option>
            <option value="90">90+ días</option>
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Buscar cliente / teléfono / contrato</label>
          <input
            type="text"
            placeholder="Ej: García, 0991234567, SQT-100..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex justify-between">
          {error}
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 ml-4">×</button>
        </div>
      )}

      {loading ? <Spinner /> : (
        <>
          {/* 4 Aging cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <AgingCard
              titulo="Mora 1-30 días"
              count={resumen?.mora_30_count}
              monto={resumen?.mora_30_monto}
              bgCls="bg-yellow-50"
              borderCls="border-yellow-200"
              textCls="text-yellow-800"
            />
            <AgingCard
              titulo="Mora 31-60 días"
              count={resumen?.mora_60_count}
              monto={resumen?.mora_60_monto}
              bgCls="bg-orange-50"
              borderCls="border-orange-200"
              textCls="text-orange-800"
            />
            <AgingCard
              titulo="Mora 61-90 días"
              count={resumen?.mora_90_count}
              monto={resumen?.mora_90_monto}
              bgCls="bg-red-50"
              borderCls="border-red-200"
              textCls="text-red-700"
            />
            <AgingCard
              titulo="Mora +90 días"
              count={resumen?.mora_plus_count}
              monto={resumen?.mora_plus_monto}
              bgCls="bg-red-100"
              borderCls="border-red-300"
              textCls="text-red-900"
            />
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-semibold text-gray-700">Cuotas en mora / pendientes</h2>
              <span className="text-sm text-gray-400">{cuotasFiltradas.length} registros</span>
            </div>

            {cuotasFiltradas.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <div className="text-4xl mb-3">💳</div>
                <p className="font-medium">No hay cuotas para esta selección</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Cliente</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Teléfono</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">N° Contrato</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Cuota</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Vence</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Días</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Saldo</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Tramo</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Consultor</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuotasFiltradas.map((c, i) => (
                      <tr
                        key={c.cuota_id}
                        className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}
                      >
                        {/* Cliente */}
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800 whitespace-nowrap">
                            {c.nombres} {c.apellidos}
                          </div>
                          {c.observacion_gestion && (
                            <div className="text-xs text-teal-600 mt-0.5 max-w-[200px] truncate" title={c.observacion_gestion}>
                              {c.observacion_gestion}
                            </div>
                          )}
                        </td>

                        {/* Teléfono + WhatsApp */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-gray-600">{c.telefono || '—'}</span>
                            {c.telefono && (
                              <a
                                href={waLink(c.telefono)}
                                target="_blank"
                                rel="noreferrer"
                                title="Enviar WhatsApp"
                                className="text-green-500 hover:text-green-700 text-base leading-none"
                              >
                                💬
                              </a>
                            )}
                          </div>
                        </td>

                        {/* N° Contrato */}
                        <td className="px-4 py-3 font-mono text-xs text-teal-700 font-bold whitespace-nowrap">
                          {c.numero_contrato || '—'}
                        </td>

                        {/* Cuota */}
                        <td className="px-4 py-3 text-center text-gray-600 whitespace-nowrap">
                          #{c.numero_cuota}
                        </td>

                        {/* Vencimiento */}
                        <td className="px-4 py-3 text-center text-xs text-gray-500 whitespace-nowrap">
                          {fmtFecha(c.fecha_vencimiento)}
                        </td>

                        {/* Días vencido */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {c.dias_vencido !== null && c.dias_vencido !== undefined ? (
                            <span className={`font-bold tabular-nums ${
                              c.dias_vencido > 90 ? 'text-red-700' :
                              c.dias_vencido > 60 ? 'text-red-500' :
                              c.dias_vencido > 30 ? 'text-orange-500' :
                              c.dias_vencido > 0  ? 'text-yellow-600' :
                              'text-gray-400'
                            }`}>
                              {c.dias_vencido > 0 ? c.dias_vencido : '—'}
                            </span>
                          ) : '—'}
                        </td>

                        {/* Saldo */}
                        <td className="px-4 py-3 text-right font-semibold text-gray-800 whitespace-nowrap">
                          {fmt(c.saldo_cuota)}
                        </td>

                        {/* Tramo */}
                        <td className="px-4 py-3 text-center">
                          <BadgeTramo tramo={c.tramo_mora} />
                        </td>

                        {/* Consultor */}
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {c.consultor_nombre || '—'}
                        </td>

                        {/* Acciones */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <div className="flex items-center gap-2 justify-center">
                            <button
                              onClick={() => setPanelCobro(c)}
                              className="bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 text-xs font-medium"
                              title="Registrar pago de esta cuota"
                            >
                              💰 Cobrar
                            </button>
                            <button
                              onClick={() => setPanelCuota(c)}
                              className="bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 text-xs font-medium"
                              title="Registrar gestión de cobranza"
                            >
                              Gestionar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal de gestión */}
      {panelCuota && (
        <PanelGestion
          cuota={panelCuota}
          onClose={() => setPanelCuota(null)}
          onSaved={handleGestionSaved}
        />
      )}

      {/* Modal de cobro */}
      {panelCobro && (
        <PanelCobro
          cuota={panelCobro}
          formasPago={formasPago}
          onClose={() => setPanelCobro(null)}
          onSaved={cargar}
        />
      )}
    </div>
  )
}
