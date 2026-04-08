import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getCartera, getCarteraResumen, getTipificaciones, registrarGestion, getHistorialContrato, getInfoRefinanciacion, refinanciarContrato } from '../../api/cartera'
import { getSalas, getFormasPago } from '../../api/admin'
import { toEcuadorISO, hoyEC } from '../../utils/formatFechaEC'
import { createRecibo } from '../../api/recibos'

import { fmt } from '../../utils/formatCurrency'

// ─────────────────── Helpers ─────────────────────────────────────────────────

function fmtFecha(val) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('es-EC')
}

function fmtFechaHora(val) {
  if (!val) return '—'
  return new Date(val).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })
}

function esHoy(val) {
  if (!val) return false
  const d = new Date(val)
  const hoy = new Date()
  return d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth() && d.getDate() === hoy.getDate()
}

function esPasadoOHoy(val) {
  if (!val) return false
  const d = new Date(val)
  d.setHours(0,0,0,0)
  const hoy = new Date()
  hoy.setHours(0,0,0,0)
  return d <= hoy
}

function Spinner() {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="rounded-xl border border-gray-200 p-5">
            <div className="shimmer h-3 w-20 mb-3 rounded" />
            <div className="shimmer h-8 w-14 rounded" />
          </div>
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="shimmer h-12 w-full rounded-t-xl" />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="shimmer h-14 w-full" style={{ animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>
    </div>
  )
}

// ─────────────────── Export functions ───────────────────────────────────────
function exportarCarteraCSV(cuotas) {
  if (!cuotas.length) return
  const cols = ['Cliente', 'Teléfono', 'N° Contrato', 'Cuota', 'Vence', 'Días vencido', 'Saldo', 'Tramo mora', 'Última gestión', 'Consultor', 'Sala', 'Observación']
  const rows = cuotas.map(c => [
    `${c.nombres || ''} ${c.apellidos || ''}`.trim(),
    c.telefono || '',
    c.numero_contrato || '',
    c.numero_cuota || '',
    c.fecha_vencimiento ? new Date(c.fecha_vencimiento).toLocaleDateString('es-EC') : '',
    c.dias_vencido ?? '',
    c.saldo_cuota ?? '',
    c.tramo_mora || '',
    c.ultima_tipificacion || c.tipificacion_cartera || '',
    c.consultor_nombre || '',
    c.sala_nombre || '',
    c.ultima_observacion_gestion || c.observacion_gestion || '',
  ])
  const csv = [cols, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = `cartera-${hoyEC()}.csv`
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
      <td>${c.ultima_tipificacion || c.tipificacion_cartera || '—'}</td>
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
        <th>Vence</th><th>Días</th><th>Saldo</th><th>Tramo</th><th>Gestión</th><th>Consultor</th>
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
  vigente:      { label: 'Vigente',    cls: 'badge-gray' },
  mora_30:      { label: '1-30 días',  cls: 'badge-amber' },
  mora_60:      { label: '31-60 días', cls: 'badge-orange' },
  mora_90:      { label: '61-90 días', cls: 'badge-red' },
  mora_90_plus: { label: '+90 días',   cls: 'bg-red-200 text-red-900' },
}

function BadgeTramo({ tramo }) {
  const cfg = TRAMO_CONFIG[tramo] || { label: tramo || '—', cls: 'badge-gray' }
  return (
    <span className={`badge whitespace-nowrap ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ─────────────────── Stat card de aging ──────────────────────────────────────
function AgingCard({ titulo, count, monto, bgCls, textCls, borderCls }) {
  return (
    <div className={`rounded-xl border p-5 hover-lift ${bgCls} ${borderCls}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide opacity-80 ${textCls}`}>{titulo}</p>
      <p className={`text-3xl font-bold mt-1 ${textCls}`}>{count ?? 0}</p>
      <p className={`text-sm mt-1 font-medium ${textCls} opacity-80`}>{fmt(monto)}</p>
    </div>
  )
}

// ─────────────────── Modal de gestión (con tipificaciones del backend) ───────
function PanelGestion({ cuota, tipificaciones, onClose, onSaved }) {
  const [tipId, setTipId]             = useState('')
  const [observacion, setObservacion] = useState('')
  const [fechaRellamar, setFechaRellamar] = useState('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  const tipSeleccionada = tipificaciones.find(t => String(t.id) === String(tipId))
  const requiereFecha = tipSeleccionada?.requiere_fecha || false

  const guardar = async () => {
    if (!tipId) { setError('Selecciona una tipificación'); return }
    if (requiereFecha && !fechaRellamar) { setError('Esta tipificación requiere una fecha'); return }
    setSaving(true)
    setError('')
    try {
      await registrarGestion(cuota.cuota_id, {
        tipificacion_cartera_id: Number(tipId),
        observacion: observacion || undefined,
        fecha_rellamar: requiereFecha ? toEcuadorISO(fechaRellamar) : undefined,
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
    <div className="modal-overlay">
      <div className="modal max-w-md p-6 space-y-4 animate-fadeInScale">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800 text-base">Registrar gestión</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="text-sm text-gray-600 space-y-1 bg-teal-50 rounded-lg p-3">
          <p><span className="font-semibold">Cliente:</span> {cuota.nombres} {cuota.apellidos}</p>
          <p><span className="font-semibold">Contrato:</span> {cuota.numero_contrato || '—'}</p>
          <p><span className="font-semibold">Cuota:</span> #{cuota.numero_cuota} — vence {fmtFecha(cuota.fecha_vencimiento)}</p>
          <p><span className="font-semibold">Saldo:</span> {fmt(cuota.saldo_cuota)}</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tipificación de gestión *</label>
            <select
              value={tipId}
              onChange={e => setTipId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">Seleccionar...</option>
              {tipificaciones.map(t => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </div>

          {requiereFecha && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Fecha para volver a llamar / seguimiento *
              </label>
              <input
                type="datetime-local"
                value={fechaRellamar}
                onChange={e => setFechaRellamar(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Observación</label>
            <textarea
              rows={3}
              value={observacion}
              onChange={e => setObservacion(e.target.value)}
              placeholder="Ej: Contactado por WhatsApp, prometió pago el lunes..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>
        </div>

        {error && <p className="text-red-600 text-xs bg-red-50 rounded-md px-2 py-1">{error}</p>}

        <div className="flex gap-3 justify-end pt-1">
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={saving}
            className="btn btn-primary"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────── Modal de Historial ─────────────────────────────────────
function PanelHistorial({ contrato, onClose }) {
  const [gestiones, setGestiones] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  useEffect(() => {
    setLoading(true)
    getHistorialContrato(contrato.contrato_id)
      .then(data => setGestiones(Array.isArray(data) ? data : []))
      .catch(err => setError(err.response?.data?.error || err.message))
      .finally(() => setLoading(false))
  }, [contrato.contrato_id])

  return (
    <div className="modal-overlay">
      <div className="modal max-w-2xl p-6 space-y-4 max-h-[85vh] flex flex-col animate-fadeInScale">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800 text-base">Historial de gestiones</h3>
            <p className="text-xs text-gray-500">
              Contrato {contrato.numero_contrato} — {contrato.nombres} {contrato.apellidos}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {error && <p className="text-red-600 text-xs">{error}</p>}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : gestiones.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">No hay gestiones registradas para este contrato</p>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            <table className="crm-table">
              <thead>
                <tr>
                  <th className="text-left">Fecha</th>
                  <th className="text-left">Tipificación</th>
                  <th className="text-left">Observación</th>
                  <th className="text-left">Rellamar</th>
                  <th className="text-left">Cuota</th>
                  <th className="text-left">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {gestiones.map((g, i) => (
                  <tr key={g.id}>
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{fmtFechaHora(g.created_at)}</td>
                    <td className="px-3 py-2">
                      <span className="badge badge-teal text-[10px]">
                        {g.tipificacion_nombre || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 max-w-[200px] truncate" title={g.observacion || ''}>
                      {g.observacion || '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                      {g.fecha_rellamar ? fmtFechaHora(g.fecha_rellamar) : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">#{g.numero_cuota}</td>
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{g.usuario_nombre || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────── Panel de Cobro ──────────────────────────────────────────
function PanelCobro({ cuota, formasPago, onClose, onSaved }) {
  const hoy = hoyEC()
  const [formaPagoId, setFormaPagoId] = useState('')
  const [monto, setMonto]             = useState(String(cuota.saldo_cuota || ''))
  const [fecha, setFecha]             = useState(hoy)
  const [referencia, setReferencia]   = useState('')
  const [observacion, setObservacion] = useState('')
  const [tipoTarjeta, setTipoTarjeta]         = useState('')
  const [entidadTarjeta, setEntidadTarjeta]   = useState('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  const formaSeleccionada = formasPago.find(f => String(f.id) === String(formaPagoId))
  const requiereRef = formaSeleccionada?.requiere_referencia
  const esTarjeta = formaSeleccionada && /tarjeta/i.test(formaSeleccionada.nombre)

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
        tipo_tarjeta: tipoTarjeta || undefined,
        entidad_tarjeta: entidadTarjeta || undefined,
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
    <div className="modal-overlay">
      <div className="modal max-w-md p-6 space-y-4 animate-fadeInScale">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800 text-base">Registrar Cobro</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
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
            <select value={formaPagoId} onChange={e => { setFormaPagoId(e.target.value); setTipoTarjeta(''); setEntidadTarjeta('') }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option value="">Seleccionar...</option>
              {formasPago.map(fp => <option key={fp.id} value={fp.id}>{fp.nombre}</option>)}
            </select>
          </div>

          {esTarjeta && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de tarjeta</label>
                <select value={tipoTarjeta} onChange={e => setTipoTarjeta(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
                  <option value="">Seleccionar...</option>
                  <option value="credito">Credito</option>
                  <option value="debito">Debito</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Entidad</label>
                <select value={entidadTarjeta} onChange={e => setEntidadTarjeta(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
                  <option value="">Seleccionar...</option>
                  <option value="Visa">Visa</option>
                  <option value="Mastercard">Mastercard</option>
                  <option value="Diners Club">Diners Club</option>
                  <option value="American Express">American Express</option>
                  <option value="Otra">Otra</option>
                </select>
              </div>
            </div>
          )}

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
            className="btn btn-secondary">
            Cancelar
          </button>
          <button onClick={guardar} disabled={saving}
            className="btn btn-success">
            {saving ? 'Registrando...' : 'Registrar Cobro'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────── Modal de Refinanciación ────────────────────────────────
function PanelRefinanciacion({ cuota, onClose, onSaved }) {
  const [loading, setLoading]         = useState(true)
  const [info, setInfo]               = useState(null)
  const [montoAbono, setMontoAbono]   = useState('')
  const [nCuotas, setNCuotas]         = useState('6')
  const [motivo, setMotivo]           = useState('')
  const [preview, setPreview]         = useState(null)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [success, setSuccess]         = useState(null)

  useEffect(() => {
    setLoading(true)
    getInfoRefinanciacion(cuota.contrato_id)
      .then(data => setInfo(data))
      .catch(err => setError(err.response?.data?.error || err.message))
      .finally(() => setLoading(false))
  }, [cuota.contrato_id])

  // Calcular preview de nuevas cuotas
  const calcularPreview = () => {
    if (!info) return
    const abono = Number(montoAbono) || 0
    const numCuotas = Number(nCuotas) || 1
    const saldo = info.saldo_pendiente

    if (abono < 0) { setError('El abono no puede ser negativo'); return }
    if (abono >= saldo) { setError('El abono debe ser menor al saldo pendiente'); return }
    if (numCuotas < 1 || numCuotas > 36) { setError('Las cuotas deben ser entre 1 y 36'); return }

    setError('')
    const saldoRestante = parseFloat((saldo - abono).toFixed(2))
    const montoPorCuota = parseFloat((saldoRestante / numCuotas).toFixed(2))

    const hoy = new Date()
    let mes = hoy.getMonth() + 2
    let anio = hoy.getFullYear()
    if (mes > 12) { mes -= 12; anio++ }
    const dia = Math.min(hoy.getDate(), 28)

    const cuotasPreview = []
    let acum = 0
    for (let i = 0; i < numCuotas; i++) {
      let m = mes + i
      let a = anio
      while (m > 12) { m -= 12; a++ }
      const diasMes = new Date(a, m, 0).getDate()
      const d = Math.min(dia, diasMes)
      const fecha = `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

      let monto
      if (i === numCuotas - 1) {
        monto = parseFloat((saldoRestante - acum).toFixed(2))
      } else {
        monto = montoPorCuota
        acum += montoPorCuota
      }

      cuotasPreview.push({ numero: i + 1, monto, fecha })
    }

    setPreview({ saldo_anterior: saldo, abono, saldo_restante: saldoRestante, cuotas: cuotasPreview })
  }

  const confirmar = async () => {
    if (!preview) { setError('Primero calcula el preview'); return }
    if (!motivo.trim()) { setError('El motivo es obligatorio'); return }
    setSaving(true)
    setError('')
    try {
      const result = await refinanciarContrato(cuota.contrato_id, {
        monto_abono: Number(montoAbono) || 0,
        nuevas_cuotas: Number(nCuotas),
        motivo: motivo.trim(),
      })
      setSuccess(result)
      onSaved()
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (info?.ya_refinanciado) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-800 text-base">Refinanciacion</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
            Este contrato ya fue refinanciado anteriormente. Solo se permite una refinanciacion por contrato.
          </div>
          <div className="flex justify-end">
            <button onClick={onClose} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cerrar</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800 text-base">Refinanciar contrato</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {/* Info del contrato */}
        <div className="text-sm text-gray-600 space-y-1 bg-purple-50 rounded-lg p-3">
          <p><span className="font-semibold">Cliente:</span> {info?.contrato?.nombres} {info?.contrato?.apellidos}</p>
          <p><span className="font-semibold">Contrato:</span> {info?.contrato?.numero_contrato}</p>
          <p><span className="font-semibold">Monto total:</span> {fmt(info?.contrato?.monto_total)}</p>
          <p><span className="font-semibold">Cuotas pendientes:</span> {info?.cuotas_pendientes}</p>
          <p><span className="font-semibold text-purple-700">Saldo pendiente:</span> <span className="font-bold text-purple-700">{fmt(info?.saldo_pendiente)}</span></p>
        </div>

        {success ? (
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 space-y-1">
              <p className="font-bold">Refinanciacion exitosa</p>
              <p>Saldo anterior: {fmt(success.saldo_anterior)}</p>
              <p>Abono aplicado: {fmt(success.monto_abono)}</p>
              <p>Saldo refinanciado: {fmt(success.saldo_refinanciado)}</p>
              <p>Nuevas cuotas: {success.nuevas_cuotas} x {fmt(success.monto_cuota)}</p>
            </div>
            <div className="flex justify-end">
              <button onClick={onClose} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700">Cerrar</button>
            </div>
          </div>
        ) : (
          <>
            {/* Formulario */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Monto que abona el cliente ahora *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" min="0" step="0.01"
                    value={montoAbono} onChange={e => { setMontoAbono(e.target.value); setPreview(null) }}
                    placeholder="Ej: 150.00"
                    className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Cantidad de cuotas nuevas *</label>
                <input type="number" min="1" max="36"
                  value={nCuotas} onChange={e => { setNCuotas(e.target.value); setPreview(null) }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Motivo de la refinanciacion *</label>
                <textarea rows={2} value={motivo} onChange={e => setMotivo(e.target.value)}
                  placeholder="Ej: Tarjeta rechazada, cliente solicita reestructurar cuotas..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none" />
              </div>

              <button onClick={calcularPreview}
                className="w-full bg-purple-100 text-purple-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-purple-200 transition-colors">
                Calcular nuevas cuotas
              </button>
            </div>

            {/* Preview */}
            {preview && (
              <div className="border border-purple-200 rounded-lg overflow-hidden">
                <div className="bg-purple-50 px-4 py-2 text-xs font-semibold text-purple-700 flex items-center justify-between">
                  <span>Preview de nuevas cuotas</span>
                  <span>Saldo: {fmt(preview.saldo_anterior)} - Abono {fmt(preview.abono)} = {fmt(preview.saldo_restante)}</span>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-1.5 text-xs font-semibold text-gray-600">#</th>
                        <th className="text-right px-3 py-1.5 text-xs font-semibold text-gray-600">Monto</th>
                        <th className="text-center px-3 py-1.5 text-xs font-semibold text-gray-600">Vencimiento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.cuotas.map((c, i) => (
                        <tr key={i} className={`border-b border-gray-50 ${i % 2 ? 'bg-gray-50/40' : ''}`}>
                          <td className="px-3 py-1.5 text-xs text-gray-600">{c.numero}</td>
                          <td className="px-3 py-1.5 text-xs text-right font-semibold">{fmt(c.monto)}</td>
                          <td className="px-3 py-1.5 text-xs text-center text-gray-500">{fmtFecha(c.fecha)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {error && <p className="text-red-600 text-xs bg-red-50 rounded-md px-2 py-1">{error}</p>}

            <div className="flex gap-3 justify-end pt-1">
              <button onClick={onClose}
                className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={confirmar} disabled={saving || !preview}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? 'Procesando...' : 'Confirmar refinanciacion'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────── Página principal ────────────────────────────────────────
export default function CarteraPage() {
  const { usuario } = useAuth()

  const [cuotas,          setCuotas]          = useState([])
  const [resumen,         setResumen]         = useState(null)
  const [salas,           setSalas]           = useState([])
  const [tipificaciones,  setTipificaciones]  = useState([])
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState('')

  // Filtros backend
  const [filtroSala,   setFiltroSala]   = useState(usuario?.sala_id || '')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroAging,  setFiltroAging]  = useState('')

  // Filtro frontend (búsqueda libre)
  const [busqueda,     setBusqueda]     = useState('')

  // Paneles
  const [panelCuota,    setPanelCuota]    = useState(null)
  const [panelCobro,    setPanelCobro]    = useState(null)
  const [panelHistorial, setPanelHistorial] = useState(null)
  const [panelRefinanciacion, setPanelRefinanciacion] = useState(null)
  const [formasPago,    setFormasPago]    = useState([])

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (filtroSala)   params.sala_id = filtroSala
      if (filtroEstado && filtroEstado !== 'todos') params.estado = filtroEstado
      if (filtroAging)  params.aging   = filtroAging

      const [dataCuotas, dataResumen, dataSalas, dataTipif] = await Promise.all([
        getCartera(params),
        getCarteraResumen(),
        getSalas(),
        getTipificaciones(),
      ])
      setCuotas(Array.isArray(dataCuotas) ? dataCuotas : dataCuotas?.data || [])
      setResumen(dataResumen || null)
      setSalas(Array.isArray(dataSalas) ? dataSalas : [])
      setTipificaciones(Array.isArray(dataTipif) ? dataTipif : [])
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

  // Botón WhatsApp
  const waLink = (tel) => {
    if (!tel) return null
    const num = tel.replace(/\D/g, '').replace(/^0/, '')
    return `https://wa.me/593${num}`
  }

  // Resolver tipificación para mostrar en tabla
  const getTipLabel = (c) => {
    return c.ultima_tipificacion || c.tipificacion_cartera || null
  }

  const getTipCls = (label) => {
    if (!label) return ''
    const l = label.toLowerCase()
    if (l.includes('volver') || l.includes('llamar')) return 'bg-amber-100 text-amber-700'
    if (l.includes('promesa') || l.includes('acuerdo')) return 'bg-blue-100 text-blue-700'
    if (l.includes('pag')) return 'bg-emerald-100 text-emerald-700'
    if (l.includes('no contesta') || l.includes('buz')) return 'bg-gray-100 text-gray-600'
    if (l.includes('enojado')) return 'bg-red-100 text-red-700'
    if (l.includes('equivocado')) return 'bg-orange-100 text-orange-700'
    if (l.includes('refinan')) return 'bg-purple-100 text-purple-700'
    return 'bg-teal-100 text-teal-700'
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Cartera</h1>
        <div className="flex gap-2">
          <button
            onClick={() => exportarCarteraCSV(cuotasFiltradas)}
            className="btn btn-secondary"
          >
            CSV
          </button>
          <button
            onClick={() => exportarCarteraPDF(cuotasFiltradas)}
            className="btn btn-secondary"
          >
            PDF
          </button>
          <button
            onClick={cargar}
            className="btn btn-secondary"
          >
            Actualizar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="card p-5 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Sala</label>
          <select
            className="input w-auto"
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
            className="input w-auto"
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
            className="input w-auto"
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
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 ml-4">&times;</button>
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
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-semibold text-gray-700">Cuotas en mora / pendientes</h2>
              <span className="text-sm text-gray-400">{cuotasFiltradas.length} registros</span>
            </div>

            {cuotasFiltradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 animate-fadeIn">
                <div className="w-20 h-20 rounded-2xl bg-gray-50 flex items-center justify-center mb-5">
                  <svg className="w-10 h-10 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
                </div>
                <p className="text-sm font-medium text-gray-500">No hay cuotas para esta seleccion</p>
                <p className="text-xs text-gray-400 mt-1.5">Intenta ajustar los filtros de tramo o busqueda</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="crm-table">
                  <thead>
                    <tr>
                      <th className="text-left">Cliente</th>
                      <th className="text-left">Teléfono</th>
                      <th className="text-left">N° Contrato</th>
                      <th className="text-center">Cuota</th>
                      <th className="text-center">Vence</th>
                      <th className="text-center">Días</th>
                      <th className="text-right">Saldo</th>
                      <th className="text-center">Tramo</th>
                      <th className="text-center">Última gestión</th>
                      <th className="text-left">Consultor</th>
                      <th className="text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuotasFiltradas.map((c, i) => {
                      const tipLabel = getTipLabel(c)
                      const tieneRellamar = esPasadoOHoy(c.fecha_rellamar)
                      const llamarHoy = esHoy(c.fecha_rellamar)

                      return (
                        <tr
                          key={c.cuota_id}
                          className={tieneRellamar ? 'bg-amber-50/50' : ''}
                        >
                          {/* Cliente */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="font-medium text-gray-800 whitespace-nowrap">
                                {c.nombres} {c.apellidos}
                              </div>
                              {tieneRellamar && (
                                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-200 text-amber-800 animate-pulse whitespace-nowrap">
                                  Llamar {llamarHoy ? 'hoy' : 'ahora'}
                                </span>
                              )}
                            </div>
                            {(c.ultima_observacion_gestion || c.observacion_gestion) && (
                              <div className="text-xs text-teal-600 mt-0.5 max-w-[200px] truncate" title={c.ultima_observacion_gestion || c.observacion_gestion}>
                                {c.ultima_observacion_gestion || c.observacion_gestion}
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
                                  className="text-green-500 hover:text-green-700 text-sm leading-none"
                                >
                                  WA
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

                          {/* Última gestión */}
                          <td className="px-4 py-3 text-center">
                            {tipLabel ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getTipCls(tipLabel)}`}>
                                  {tipLabel}
                                </span>
                                {c.ultima_fecha_gestion && (
                                  <span className="text-[9px] text-gray-400">{fmtFecha(c.ultima_fecha_gestion)}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-gray-300">—</span>
                            )}
                          </td>

                          {/* Consultor */}
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                            {c.consultor_nombre || '—'}
                          </td>

                          {/* Acciones */}
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <div className="flex items-center gap-1.5 justify-center">
                              <button
                                onClick={() => setPanelCobro(c)}
                                className="btn btn-success btn-xs"
                                title="Registrar pago de esta cuota"
                              >
                                Cobrar
                              </button>
                              <button
                                onClick={() => setPanelCuota(c)}
                                className="btn btn-primary btn-xs"
                                title="Registrar gestión de cobranza"
                              >
                                Gestionar
                              </button>
                              <button
                                onClick={() => setPanelHistorial(c)}
                                className="btn btn-secondary btn-xs"
                                title="Ver historial de gestiones del contrato"
                              >
                                Historial
                              </button>
                              {['admin', 'director', 'asesor_cartera'].includes(usuario?.rol) && (
                                <button
                                  onClick={() => setPanelRefinanciacion(c)}
                                  className="btn btn-xs bg-purple-600 text-white hover:bg-purple-700"
                                  title="Refinanciar contrato"
                                >
                                  Refinanciar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
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
          tipificaciones={tipificaciones}
          onClose={() => setPanelCuota(null)}
          onSaved={cargar}
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

      {/* Modal de historial */}
      {panelHistorial && (
        <PanelHistorial
          contrato={panelHistorial}
          onClose={() => setPanelHistorial(null)}
        />
      )}

      {/* Modal de refinanciación */}
      {panelRefinanciacion && (
        <PanelRefinanciacion
          cuota={panelRefinanciacion}
          onClose={() => setPanelRefinanciacion(null)}
          onSaved={cargar}
        />
      )}
    </div>
  )
}
