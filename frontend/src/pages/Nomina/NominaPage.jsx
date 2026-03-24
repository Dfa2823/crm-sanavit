import { useState, useEffect, useCallback } from 'react'
import { getNomina, calcularNomina, updateNomina, getReporteNomina, getReporteValidacion, notificarNomina, getAsistenciaDia, registrarAsistenciaBulk, getResumenMensual, suspenderComisionNomina, reactivarComisionNomina } from '../../api/nomina'
import { getSalas } from '../../api/admin'
import { useAuth } from '../../context/AuthContext'
import { fmtSinSigno as fmt } from '../../utils/formatCurrency'

const ESTADO_COLORS = {
  borrador:  'bg-gray-100 text-gray-600',
  revision:  'bg-yellow-100 text-yellow-700',
  aprobada:  'bg-blue-100 text-blue-700',
  pagada:    'bg-green-100 text-green-700',
}

const ESTADO_LABELS = {
  borrador: 'Borrador',
  revision: 'En revisión',
  aprobada: 'Aprobada',
  pagada:   'Pagada',
}

const FLUJO = {
  borrador: 'revision',
  revision: 'aprobada',
  aprobada: 'pagada',
}

const TIPO_LIQ_COLORS = {
  garantizado: 'bg-blue-100 text-blue-700',
  comisiones:  'bg-teal-100 text-teal-700',
  completa:    'bg-gray-100 text-gray-600',
}

const TIPO_LIQ_LABELS = {
  garantizado: 'Garantizado',
  comisiones:  'Comisiones',
  completa:    'Completa',
}

function BadgeTipo({ tipo }) {
  if (!tipo || tipo === 'completa') return null
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ml-1.5 ${TIPO_LIQ_COLORS[tipo] || 'bg-gray-100 text-gray-600'}`}>
      {TIPO_LIQ_LABELS[tipo] || tipo}
    </span>
  )
}

function Badge({ estado }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ESTADO_COLORS[estado] || 'bg-gray-100 text-gray-600'}`}>
      {ESTADO_LABELS[estado] || estado}
    </span>
  )
}

// ── Drawer detalle por empleado ──────────────────────────────────────────────
function DrawerNomina({ registro, onClose, onUpdate, esAdmin }) {
  const [form, setForm] = useState({
    otros_ingresos:    registro.otros_ingresos    || 0,
    anticipo:          registro.anticipo          || 0,
    otras_deducciones: registro.otras_deducciones || 0,
    observaciones:     registro.observaciones     || '',
  })

  // Sincronizar form cuando cambia el registro (tras guardar)
  useEffect(() => {
    setForm({
      otros_ingresos:    registro.otros_ingresos    || 0,
      anticipo:          registro.anticipo          || 0,
      otras_deducciones: registro.otras_deducciones || 0,
      observaciones:     registro.observaciones     || '',
    })
  }, [registro.id, registro.otros_ingresos, registro.anticipo, registro.otras_deducciones, registro.observaciones])
  const [guardando, setGuardando] = useState(false)
  const [error,     setError]     = useState('')

  const inmutable = registro.estado === 'pagada'

  async function handleGuardar() {
    setGuardando(true)
    setError('')
    try {
      const updated = await updateNomina(registro.id, form)
      onUpdate(updated)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function handleEstado(nuevoEstado) {
    setGuardando(true)
    setError('')
    try {
      const updated = await updateNomina(registro.id, { estado: nuevoEstado })
      onUpdate(updated)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cambiar estado')
    } finally {
      setGuardando(false)
    }
  }

  function exportarPDF() {
    const r = registro
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; margin: 0; padding: 24px; color: #1a1a1a; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0d9488; padding-bottom: 12px; margin-bottom: 20px; }
  .logo { font-size: 22px; font-weight: 800; color: #0d9488; }
  .logo small { display: block; font-size: 11px; color: #6b7280; font-weight: 400; }
  h2 { margin: 0 0 4px 0; font-size: 16px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; }
  .info-item { background: #f9fafb; padding: 8px 12px; border-radius: 6px; }
  .info-item .label { font-size: 10px; color: #6b7280; text-transform: uppercase; }
  .info-item .value { font-weight: 600; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #f3f4f6; text-align: left; padding: 8px 12px; font-size: 11px; color: #4b5563; text-transform: uppercase; }
  td { padding: 7px 12px; border-bottom: 1px solid #f0f0f0; font-size: 12px; }
  .total-row td { font-weight: 700; background: #f9fafb; }
  .neto-box { background: #0d9488; color: white; padding: 16px 20px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin: 16px 0; }
  .neto-box .label { font-size: 14px; font-weight: 600; }
  .neto-box .amount { font-size: 24px; font-weight: 800; }
  .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 48px; }
  .firma-box { border-top: 1px solid #9ca3af; padding-top: 8px; text-align: center; font-size: 11px; color: #6b7280; }
  @media print { @page { size: A4; margin: 15mm; } }
</style>
</head>
<body>
<div class="header">
  <div class="logo">SANAVIT<small>CRM Ecuador</small></div>
  <div style="text-align:right">
    <h2>Rol de Pago</h2>
    <p style="margin:0;color:#6b7280">${r.mes}</p>
  </div>
</div>

<div class="info-grid">
  <div class="info-item"><div class="label">Empleado</div><div class="value">${r.usuario_nombre}</div></div>
  <div class="info-item"><div class="label">Cargo</div><div class="value">${r.rol_label || r.rol || '—'}</div></div>
  <div class="info-item"><div class="label">Sala</div><div class="value">${r.sala_nombre || '—'}</div></div>
  <div class="info-item"><div class="label">Estado</div><div class="value">${ESTADO_LABELS[r.estado] || r.estado}</div></div>
</div>

<table>
  <thead><tr><th>Ingresos</th><th>Detalle</th><th style="text-align:right">Monto</th></tr></thead>
  <tbody>
    <tr><td>Sueldo base</td><td></td><td style="text-align:right">$${fmt(r.sueldo_base)}</td></tr>
    <tr><td>Comisión ventas (${r.pct_comision_venta_config || 0}%)</td><td>${r.contratos_desbloqueados || 0} contratos desbl.</td><td style="text-align:right">$${fmt(r.comision_ventas)}</td></tr>
    <tr><td>Comisión cobros</td><td></td><td style="text-align:right">$${fmt(r.comision_cobros)}</td></tr>
    <tr><td>Bono tours</td><td>${r.tours_count || 0} tours</td><td style="text-align:right">$${fmt(r.bono_tours)}</td></tr>
    <tr><td>Bono citas</td><td>${r.citas_count || 0} citas</td><td style="text-align:right">$${fmt(r.bono_citas)}</td></tr>
    <tr><td>Bono meta</td><td></td><td style="text-align:right">$${fmt(r.bono_meta)}</td></tr>
    <tr><td>Otros ingresos</td><td>${r.observaciones || ''}</td><td style="text-align:right">$${fmt(r.otros_ingresos)}</td></tr>
    <tr class="total-row"><td colspan="2">TOTAL INGRESOS</td><td style="text-align:right">$${fmt(r.total_ingresos)}</td></tr>
  </tbody>
</table>

<table>
  <thead><tr><th>Deducciones</th><th>Detalle</th><th style="text-align:right">Monto</th></tr></thead>
  <tbody>
    <tr><td>IESS empleado (9.45%)</td><td>Sobre sueldo base $${fmt(r.sueldo_base)}</td><td style="text-align:right">$${fmt(r.aporte_iess)}</td></tr>
    <tr><td>Anticipo</td><td></td><td style="text-align:right">$${fmt(r.anticipo)}</td></tr>
    <tr><td>Otras deducciones</td><td></td><td style="text-align:right">$${fmt(r.otras_deducciones)}</td></tr>
    <tr class="total-row"><td colspan="2">TOTAL DEDUCCIONES</td><td style="text-align:right">$${fmt(r.total_deducciones)}</td></tr>
  </tbody>
</table>

<div class="neto-box">
  <span class="label">NETO A PAGAR</span>
  <span class="amount">$${fmt(r.neto_a_pagar)}</span>
</div>

<div class="firmas">
  <div class="firma-box">Firma del empleado</div>
  <div class="firma-box">Firma del empleador</div>
</div>
</body>
</html>`

    const w = window.open('', '_blank', 'width=800,height=900')
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 600)
  }

  const siguienteEstado = FLUJO[registro.estado]

  return (
    <div className="drawer-overlay flex justify-end">
      <div className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-800">{registro.usuario_nombre}</h3>
            <p className="text-sm text-gray-500">{registro.rol_label || registro.rol} · {registro.sala_nombre || '—'} · {registro.mes}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge estado={registro.estado} />
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-2">×</button>
          </div>
        </div>

        <div className="flex-1 px-6 py-5 space-y-5">
          {/* Ingresos */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Ingresos</p>
            <div className="space-y-2">
              {[
                ['Sueldo base', null, registro.sueldo_base],
                [`Comision ventas (${registro.pct_comision_venta_config || 0}%)`, `${registro.contratos_desbloqueados || 0} contratos`, registro.comision_ventas],
                ['Comision cobros', null, registro.comision_cobros],
                [`Bono tours`, `${registro.tours_count || 0} tours`, registro.bono_tours],
                [`Bono citas`, `${registro.citas_count || 0} citas`, registro.bono_citas],
                ['Bono meta', null, registro.bono_meta],
              ].map(([label, sub, val]) => (
                Number(val) > 0 || label === 'Sueldo base' ? (
                  <div key={label} className="flex justify-between items-baseline">
                    <div>
                      <span className="text-sm text-gray-700">{label}</span>
                      {sub && <span className="text-xs text-gray-400 ml-2">{sub}</span>}
                    </div>
                    <span className="text-sm font-medium text-gray-800">${fmt(val)}</span>
                  </div>
                ) : null
              ))}
              {/* Desglose semanal TMK */}
              {registro.rol === 'tmk' && Array.isArray(registro.desglose_semanal_tmk) && registro.desglose_semanal_tmk.length > 0 && (
                <div className="mt-3 mb-1">
                  <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-2">Desglose semanal TMK</p>
                  <div className="bg-teal-50/50 rounded-lg border border-teal-100 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-teal-100/60">
                          <th className="text-left px-3 py-1.5 font-semibold text-teal-700">Semana</th>
                          <th className="text-center px-2 py-1.5 font-semibold text-teal-700">Tours</th>
                          <th className="text-right px-2 py-1.5 font-semibold text-teal-700">$/Tour</th>
                          <th className="text-right px-2 py-1.5 font-semibold text-teal-700">Bono Tours</th>
                          <th className="text-right px-2 py-1.5 font-semibold text-teal-700">Bono Sem.</th>
                          <th className="text-right px-3 py-1.5 font-semibold text-teal-700">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {registro.desglose_semanal_tmk.map((s, i) => {
                          const inicioDate = new Date(s.semana_inicio + 'T00:00:00')
                          const finDate = new Date(inicioDate)
                          finDate.setDate(finDate.getDate() + 6)
                          const fmtDate = (d) => `${d.getDate()}/${d.getMonth() + 1}`
                          return (
                            <tr key={i} className={i % 2 === 0 ? '' : 'bg-teal-50/40'}>
                              <td className="px-3 py-1.5 text-gray-700">{fmtDate(inicioDate)} - {fmtDate(finDate)}</td>
                              <td className="px-2 py-1.5 text-center font-medium text-gray-800">{s.tours}</td>
                              <td className="px-2 py-1.5 text-right text-gray-600">${Number(s.bono_por_tour).toFixed(2)}</td>
                              <td className="px-2 py-1.5 text-right text-gray-700">${fmt(s.bono_tours_sem)}</td>
                              <td className="px-2 py-1.5 text-right text-gray-700">${fmt(s.bono_semanal)}</td>
                              <td className="px-3 py-1.5 text-right font-medium text-teal-700">${fmt(s.total_semana)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {/* Otros ingresos editable */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700">Otros ingresos</span>
                {esAdmin && !inmutable ? (
                  <input
                    type="number" min="0" step="0.01"
                    className="w-28 border border-gray-300 rounded px-2 py-1 text-sm text-right"
                    value={form.otros_ingresos}
                    onChange={e => setForm(f => ({ ...f, otros_ingresos: e.target.value }))}
                  />
                ) : (
                  <span className="text-sm font-medium text-gray-800">${fmt(registro.otros_ingresos)}</span>
                )}
              </div>
              <div className="flex justify-between items-baseline border-t pt-2 mt-1">
                <span className="font-semibold text-gray-800">TOTAL INGRESOS</span>
                <span className="font-semibold text-gray-800">${fmt(registro.total_ingresos)}</span>
              </div>
            </div>
          </div>

          {/* Deducciones */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Deducciones</p>
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-sm text-gray-700">IESS empleado (9.45%)</span>
                <span className="text-sm font-medium text-red-600">${fmt(registro.aporte_iess)}</span>
              </div>
              {/* Anticipo editable */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700">Anticipo</span>
                {esAdmin && !inmutable ? (
                  <input
                    type="number" min="0" step="0.01"
                    className="w-28 border border-gray-300 rounded px-2 py-1 text-sm text-right"
                    value={form.anticipo}
                    onChange={e => setForm(f => ({ ...f, anticipo: e.target.value }))}
                  />
                ) : (
                  <span className="text-sm font-medium text-red-600">${fmt(registro.anticipo)}</span>
                )}
              </div>
              {/* Otras deducciones editable */}
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-700">Otras deducciones</span>
                {esAdmin && !inmutable ? (
                  <input
                    type="number" min="0" step="0.01"
                    className="w-28 border border-gray-300 rounded px-2 py-1 text-sm text-right"
                    value={form.otras_deducciones}
                    onChange={e => setForm(f => ({ ...f, otras_deducciones: e.target.value }))}
                  />
                ) : (
                  <span className="text-sm font-medium text-red-600">${fmt(registro.otras_deducciones)}</span>
                )}
              </div>
              <div className="flex justify-between items-baseline border-t pt-2 mt-1">
                <span className="font-semibold text-gray-800">TOTAL DEDUCCIONES</span>
                <span className="font-semibold text-red-600">${fmt(registro.total_deducciones)}</span>
              </div>
            </div>
          </div>

          {/* Neto */}
          <div className="bg-teal-600 rounded-xl p-4 flex justify-between items-center">
            <span className="text-white font-semibold text-sm">NETO A PAGAR</span>
            <span className="text-white font-bold text-2xl">${fmt(registro.neto_a_pagar)}</span>
          </div>

          {/* Observaciones */}
          {esAdmin && !inmutable && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Observaciones</label>
              <textarea
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={form.observaciones}
                onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))}
              />
            </div>
          )}
          {registro.observaciones && inmutable && (
            <p className="text-xs text-gray-500 italic">{registro.observaciones}</p>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">{error}</div>
          )}
        </div>

        {/* Footer acciones */}
        <div className="px-6 py-4 border-t border-gray-100 space-y-2">
          {esAdmin && !inmutable && (
            <button
              onClick={handleGuardar}
              disabled={guardando}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium"
            >
              {guardando ? 'Guardando...' : 'Guardar ajustes'}
            </button>
          )}
          {esAdmin && siguienteEstado && !inmutable && (
            <button
              onClick={() => handleEstado(siguienteEstado)}
              disabled={guardando}
              className="w-full border border-teal-600 text-teal-700 hover:bg-teal-50 disabled:opacity-50 py-2 rounded-lg text-sm font-medium"
            >
              {guardando ? '...' : `→ Pasar a "${ESTADO_LABELS[siguienteEstado]}"`}
            </button>
          )}
          <button
            onClick={exportarPDF}
            className="w-full border border-gray-300 text-gray-700 hover:bg-gray-50 py-2 rounded-lg text-sm"
          >
            Descargar Rol de Pago PDF
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal de Reporte de Validación ───────────────────────────────────────────
function ModalReporteValidacion({ mes, salaId, onClose }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandido, setExpandido] = useState({})
  const [suspendiendo, setSuspendiendo] = useState(null) // contrato_id que se está suspendiendo

  const cargarReporte = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (salaId) params.sala_id = salaId
      const result = await getReporteValidacion(mes, params)
      setData(Array.isArray(result) ? result : [])
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar reporte de validación')
    } finally {
      setLoading(false)
    }
  }, [mes, salaId])

  useEffect(() => { cargarReporte() }, [cargarReporte])

  function toggleExpandido(nominaId) {
    setExpandido(prev => ({ ...prev, [nominaId]: !prev[nominaId] }))
  }

  async function handleSuspender(usuarioId, contratoId) {
    const motivo = prompt('Motivo de la suspension:')
    if (motivo === null) return // canceló
    setSuspendiendo(contratoId)
    try {
      await suspenderComisionNomina({ usuario_id: usuarioId, contrato_id: contratoId, motivo, mes })
      await cargarReporte()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al suspender comision')
    } finally {
      setSuspendiendo(null)
    }
  }

  async function handleReactivar(usuarioId, contratoId) {
    if (!confirm('Reactivar esta comision?')) return
    setSuspendiendo(contratoId)
    try {
      await reactivarComisionNomina({ usuario_id: usuarioId, contrato_id: contratoId, mes })
      await cargarReporte()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al reactivar comision')
    } finally {
      setSuspendiendo(null)
    }
  }

  function exportarExcel() {
    // Generar CSV con desglose completo (compatible con Excel)
    const filas = []
    // Header
    filas.push([
      'Empleado','Rol','Sala','Sueldo Base Config','Días Trabajados','Días Laborables','Garantizado',
      '% Com. Venta','% Desbloqueo',
      'Contrato','Cliente','Monto Total','Monto Pagado','% Pagado','Monto Base','Comisión Calculada','Estado Comisión',
      'Com. Venta Recurrente','Com. Abonos Cartera','Com. Reactivaciones','Com. Arrastre TMK',
      'Bono Tours','Tours','Bono Citas','Citas','Bono Meta',
      'Otros Ingresos','Total Ingresos',
      'IESS','Anticipo','Otras Deducciones','Total Deducciones',
      'Neto a Pagar','Estado Nómina'
    ])

    for (const emp of data) {
      const contratos = emp.contratos_del_mes || []
      const arrastres = emp.contratos_arrastre || []
      const allContratos = [
        ...contratos.map(c => ({ ...c, tipo: 'mes' })),
        ...arrastres.map(c => ({ ...c, tipo: 'arrastre' })),
      ]

      if (allContratos.length === 0) {
        filas.push([
          emp.usuario_nombre, emp.rol_label || emp.rol, emp.sala_nombre || '',
          emp.sueldo_base_config, emp.dias_trabajados, emp.dias_laborables, emp.garantizado,
          emp.pct_comision_venta, emp.pct_desbloqueo,
          '', '', '', '', '', '', '', '',
          emp.comision_venta_recurrente, emp.comision_abonos_cartera, emp.comision_reactivaciones, emp.comision_arrastre_tmk,
          emp.bono_tours, emp.tours_count, emp.bono_citas, emp.citas_count, emp.bono_meta,
          emp.otros_ingresos, emp.total_ingresos,
          emp.aporte_iess, emp.anticipo, emp.otras_deducciones, emp.total_deducciones,
          emp.neto_a_pagar, emp.estado_nomina
        ])
      } else {
        for (let i = 0; i < allContratos.length; i++) {
          const c = allContratos[i]
          filas.push([
            i === 0 ? emp.usuario_nombre : '', i === 0 ? (emp.rol_label || emp.rol) : '', i === 0 ? (emp.sala_nombre || '') : '',
            i === 0 ? emp.sueldo_base_config : '', i === 0 ? emp.dias_trabajados : '', i === 0 ? emp.dias_laborables : '', i === 0 ? emp.garantizado : '',
            i === 0 ? emp.pct_comision_venta : '', i === 0 ? emp.pct_desbloqueo : '',
            c.numero_contrato || `C-${c.id}`, c.cliente || c.cliente_nombre || '', c.monto_total,
            c.tipo === 'mes' ? c.monto_pagado : c.monto_pagado_mes,
            c.tipo === 'mes' ? c.pct_pagado : '',
            c.tipo === 'mes' ? c.monto_base : (c.monto_base_pagado_mes || ''),
            c.tipo === 'mes' ? c.comision_calculada : (c.comision_arrastre || ''),
            c.tipo === 'mes' ? c.estado : 'arrastre',
            i === 0 ? emp.comision_venta_recurrente : '', i === 0 ? emp.comision_abonos_cartera : '',
            i === 0 ? emp.comision_reactivaciones : '', i === 0 ? emp.comision_arrastre_tmk : '',
            i === 0 ? emp.bono_tours : '', i === 0 ? emp.tours_count : '',
            i === 0 ? emp.bono_citas : '', i === 0 ? emp.citas_count : '',
            i === 0 ? emp.bono_meta : '',
            i === 0 ? emp.otros_ingresos : '', i === 0 ? emp.total_ingresos : '',
            i === 0 ? emp.aporte_iess : '', i === 0 ? emp.anticipo : '',
            i === 0 ? emp.otras_deducciones : '', i === 0 ? emp.total_deducciones : '',
            i === 0 ? emp.neto_a_pagar : '', i === 0 ? emp.estado_nomina : '',
          ])
        }
      }
    }

    const csv = '\uFEFF' + filas.map(row => row.map(v => `"${v === undefined || v === null ? '' : v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte_validacion_nomina_${mes}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportarPDFValidacion() {
    const rows = data.map(emp => {
      const contratosHTML = (emp.contratos_del_mes || []).map(c => `
        <tr class="sub-row">
          <td style="padding-left:30px">${c.numero_contrato || 'C-' + c.id}</td>
          <td>${c.cliente || ''}</td>
          <td style="text-align:right">$${fmt(c.monto_total)}</td>
          <td style="text-align:right">$${fmt(c.monto_pagado)}</td>
          <td style="text-align:right">${c.pct_pagado}%</td>
          <td style="text-align:right">$${fmt(c.monto_base)}</td>
          <td style="text-align:right">$${fmt(c.comision_calculada)}</td>
          <td><span class="badge-${c.estado}">${c.estado}</span></td>
        </tr>
      `).join('')

      const arrastresHTML = (emp.contratos_arrastre || []).map(c => `
        <tr class="sub-row arrastre">
          <td style="padding-left:30px">${c.numero_contrato || 'C-' + c.id}</td>
          <td>${c.cliente || ''}</td>
          <td style="text-align:right">$${fmt(c.monto_total)}</td>
          <td style="text-align:right">$${fmt(c.monto_pagado_mes)}</td>
          <td></td>
          <td style="text-align:right">$${fmt(c.monto_base_pagado_mes)}</td>
          <td style="text-align:right">$${fmt(c.comision_arrastre)}</td>
          <td><span class="badge-arrastre">arrastre</span></td>
        </tr>
      `).join('')

      const semanalHTML = emp.rol === 'tmk' && Array.isArray(emp.desglose_semanal_tmk) && emp.desglose_semanal_tmk.length > 0
        ? `<tr class="sub-row"><td colspan="8" style="padding-left:30px;font-size:10px;color:#0d9488">
            <strong>Desglose semanal TMK:</strong> ${emp.desglose_semanal_tmk.map(s => {
              const d = new Date(s.semana_inicio + 'T00:00:00')
              return `Sem ${d.getDate()}/${d.getMonth()+1}: ${s.tours} tours=$${fmt(s.total_semana)}`
            }).join(' | ')}
          </td></tr>`
        : ''

      return `
        <tr class="emp-row">
          <td colspan="3"><strong>${emp.usuario_nombre}</strong> <span style="color:#6b7280;font-size:10px">${emp.rol_label || emp.rol} · ${emp.sala_nombre || ''}</span></td>
          <td style="text-align:right">Garantizado: $${fmt(emp.garantizado)}</td>
          <td style="text-align:right">Com: $${fmt(emp.comision_ventas)}</td>
          <td style="text-align:right">Bonos: $${fmt(emp.bono_tours + emp.bono_citas + emp.bono_meta)}</td>
          <td style="text-align:right">Deduc: $${fmt(emp.total_deducciones)}</td>
          <td style="text-align:right;font-weight:700;color:#0d9488"><strong>$${fmt(emp.neto_a_pagar)}</strong></td>
        </tr>
        ${contratosHTML}${arrastresHTML}${semanalHTML}
      `
    }).join('')

    const totNeto = data.reduce((a, e) => a + e.neto_a_pagar, 0)

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; margin: 0; padding: 20px; font-size: 10px; color: #1a1a1a; }
  h1 { font-size: 16px; color: #0d9488; margin-bottom: 4px; }
  p.subtitle { margin: 0 0 12px 0; color: #6b7280; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #0d9488; color: white; padding: 5px 6px; text-align: left; font-size: 9px; text-transform: uppercase; }
  td { padding: 4px 6px; border-bottom: 1px solid #e5e7eb; }
  .emp-row td { background: #f3f4f6; border-top: 2px solid #d1d5db; }
  .sub-row td { font-size: 9px; color: #4b5563; }
  .arrastre td { background: #fefce8; }
  .badge-desbloqueada { background: #d1fae5; color: #065f46; padding: 1px 6px; border-radius: 8px; font-size: 8px; }
  .badge-bloqueada { background: #fee2e2; color: #991b1b; padding: 1px 6px; border-radius: 8px; font-size: 8px; }
  .badge-suspendida { background: #fef3c7; color: #92400e; padding: 1px 6px; border-radius: 8px; font-size: 8px; }
  .badge-arrastre { background: #e0e7ff; color: #3730a3; padding: 1px 6px; border-radius: 8px; font-size: 8px; }
  .total-final { background: #0d9488; color: white; padding: 10px; text-align: right; font-size: 14px; font-weight: 700; margin-top: 12px; border-radius: 6px; }
  @media print { @page { size: A4 landscape; margin: 8mm; } }
</style></head><body>
<h1>SANAVIT - Reporte de Validacion de Nomina</h1>
<p class="subtitle">Periodo: ${mes} | ${data.length} empleados | Generado: ${new Date().toLocaleDateString('es-EC')}</p>
<table>
  <thead><tr>
    <th>Contrato/Empleado</th><th>Cliente</th><th>Monto Total</th><th>Pagado</th><th>% Pago</th><th>Base</th><th>Comision</th><th>Estado</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="total-final">NETO TOTAL A PAGAR: $${fmt(totNeto)}</div>
</body></html>`

    const w = window.open('', '_blank', 'width=1200,height=900')
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 600)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-8 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl mx-4 mb-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Reporte de Validacion de Nomina</h2>
            <p className="text-sm text-gray-500">Periodo: {mes} - Desglose detallado por empleado y contratos</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportarExcel} disabled={loading || data.length === 0}
              className="border border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-medium">
              Exportar Excel
            </button>
            <button onClick={exportarPDFValidacion} disabled={loading || data.length === 0}
              className="border border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-medium">
              Exportar PDF
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-2">&times;</button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
          ) : data.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="font-medium">No hay datos de nomina para validar en {mes}</p>
              <p className="text-sm mt-1">Primero calcula la nomina del mes.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Resumen totales */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="border rounded-xl p-3 bg-slate-50 border-slate-200">
                  <p className="text-xs text-gray-500">Empleados</p>
                  <p className="text-lg font-bold text-gray-800">{data.length}</p>
                </div>
                <div className="border rounded-xl p-3 bg-blue-50 border-blue-200">
                  <p className="text-xs text-gray-500">Total Bruto</p>
                  <p className="text-lg font-bold text-gray-800">${fmt(data.reduce((a, e) => a + e.total_ingresos, 0))}</p>
                </div>
                <div className="border rounded-xl p-3 bg-orange-50 border-orange-200">
                  <p className="text-xs text-gray-500">Deducciones</p>
                  <p className="text-lg font-bold text-gray-800">${fmt(data.reduce((a, e) => a + e.total_deducciones, 0))}</p>
                </div>
                <div className="border rounded-xl p-3 bg-teal-50 border-teal-200">
                  <p className="text-xs text-gray-500">Neto Total</p>
                  <p className="text-lg font-bold text-teal-700">${fmt(data.reduce((a, e) => a + e.neto_a_pagar, 0))}</p>
                </div>
              </div>

              {/* Tabla por empleado expandible */}
              {data.map(emp => {
                const isOpen = expandido[emp.nomina_id]
                const contratos = emp.contratos_del_mes || []
                const arrastres = emp.contratos_arrastre || []
                return (
                  <div key={emp.nomina_id} className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* Fila principal */}
                    <button
                      onClick={() => toggleExpandido(emp.nomina_id)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-xs transition-transform ${isOpen ? 'rotate-90' : ''}`}>&#9654;</span>
                        <div>
                          <span className="font-semibold text-gray-800">{emp.usuario_nombre}</span>
                          <span className="text-xs text-gray-500 ml-2">{emp.rol_label || emp.rol} {emp.sala_nombre ? `· ${emp.sala_nombre}` : ''}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-xs">
                        <div className="text-right">
                          <span className="text-gray-500">Garantizado</span>
                          <span className="ml-2 font-medium text-gray-700">${fmt(emp.garantizado)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-gray-500">Comisiones</span>
                          <span className="ml-2 font-medium text-gray-700">${fmt(emp.comision_ventas + emp.comision_cobros)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-gray-500">Bonos</span>
                          <span className="ml-2 font-medium text-gray-700">${fmt(emp.bono_tours + emp.bono_citas + emp.bono_meta)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-gray-500">Deducciones</span>
                          <span className="ml-2 font-medium text-red-600">-${fmt(emp.total_deducciones)}</span>
                        </div>
                        <div className="bg-teal-600 text-white px-3 py-1 rounded-lg font-semibold">
                          ${fmt(emp.neto_a_pagar)}
                        </div>
                      </div>
                    </button>

                    {/* Detalle expandido */}
                    {isOpen && (
                      <div className="px-4 py-3 space-y-4 bg-white">
                        {/* Info base */}
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                          <div className="bg-gray-50 rounded-lg p-2">
                            <p className="text-gray-500">Sueldo base</p>
                            <p className="font-semibold">${fmt(emp.sueldo_base_config)}</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2">
                            <p className="text-gray-500">Dias trab/lab</p>
                            <p className="font-semibold">{emp.dias_trabajados}/{emp.dias_laborables}</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2">
                            <p className="text-gray-500">Garantizado</p>
                            <p className="font-semibold">${fmt(emp.garantizado)}</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2">
                            <p className="text-gray-500">% Com. Venta</p>
                            <p className="font-semibold">{emp.pct_comision_venta}%</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2">
                            <p className="text-gray-500">% Desbloqueo</p>
                            <p className="font-semibold">{emp.pct_desbloqueo}%</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-2">
                            <p className="text-gray-500">Estado nomina</p>
                            <p className="font-semibold capitalize">{emp.estado_nomina}</p>
                          </div>
                        </div>

                        {/* Contratos del mes */}
                        {contratos.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Contratos del mes ({contratos.length})</p>
                            <div className="overflow-x-auto rounded-lg border border-gray-100">
                              <table className="w-full text-xs">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Contrato</th>
                                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Cliente</th>
                                    <th className="text-right px-3 py-2 font-semibold text-gray-600">Monto Total</th>
                                    <th className="text-right px-3 py-2 font-semibold text-gray-600">Pagado</th>
                                    <th className="text-right px-3 py-2 font-semibold text-gray-600">% Pago</th>
                                    <th className="text-right px-3 py-2 font-semibold text-gray-600">Base (sin int.)</th>
                                    <th className="text-right px-3 py-2 font-semibold text-gray-600">Comision</th>
                                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Estado</th>
                                    <th className="text-center px-3 py-2 font-semibold text-gray-600">Acciones</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {contratos.map(c => (
                                    <tr key={c.id} className={`border-t border-gray-50 ${c.suspendida ? 'bg-red-50/40' : ''}`}>
                                      <td className="px-3 py-2 font-medium">{c.numero_contrato || `C-${c.id}`}</td>
                                      <td className="px-3 py-2 text-gray-600">{c.cliente}</td>
                                      <td className="px-3 py-2 text-right">${fmt(c.monto_total)}</td>
                                      <td className="px-3 py-2 text-right">${fmt(c.monto_pagado)}</td>
                                      <td className="px-3 py-2 text-right">{c.pct_pagado}%</td>
                                      <td className="px-3 py-2 text-right">${fmt(c.monto_base)}</td>
                                      <td className="px-3 py-2 text-right font-medium text-teal-700">{c.suspendida ? <span className="text-red-400 line-through">${fmt(c.monto_base > 0 ? c.monto_base * (emp.pct_comision_venta || 10) / 100 : 0)}</span> : `$${fmt(c.comision_calculada)}`}</td>
                                      <td className="px-3 py-2">
                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                          c.suspendida ? 'bg-red-100 text-red-700' :
                                          c.estado === 'desbloqueada' ? 'bg-green-100 text-green-700' :
                                          c.estado === 'suspendida' ? 'bg-yellow-100 text-yellow-700' :
                                          'bg-red-100 text-red-700'
                                        }`}>
                                          {c.suspendida ? 'Suspendida' : c.estado}
                                        </span>
                                        {c.suspendida && c.motivo_suspension && (
                                          <span className="block text-[9px] text-red-500 mt-0.5" title={c.motivo_suspension}>{c.motivo_suspension}</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        {c.suspendida ? (
                                          <button
                                            onClick={() => handleReactivar(emp.usuario_id, c.id)}
                                            disabled={suspendiendo === c.id}
                                            className="text-[10px] border border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-50 px-2 py-0.5 rounded-lg font-medium"
                                          >
                                            {suspendiendo === c.id ? '...' : 'Reactivar'}
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => handleSuspender(emp.usuario_id, c.id)}
                                            disabled={suspendiendo === c.id}
                                            className="text-[10px] border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 px-2 py-0.5 rounded-lg font-medium"
                                          >
                                            {suspendiendo === c.id ? '...' : 'Suspender'}
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Contratos arrastre */}
                        {arrastres.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">Arrastre cartera ({arrastres.length} contratos anteriores con pagos en {mes})</p>
                            <div className="overflow-x-auto rounded-lg border border-indigo-100">
                              <table className="w-full text-xs">
                                <thead className="bg-indigo-50">
                                  <tr>
                                    <th className="text-left px-3 py-2 font-semibold text-indigo-700">Contrato</th>
                                    <th className="text-left px-3 py-2 font-semibold text-indigo-700">Cliente</th>
                                    <th className="text-right px-3 py-2 font-semibold text-indigo-700">Total Contrato</th>
                                    <th className="text-right px-3 py-2 font-semibold text-indigo-700">Pagado en {mes}</th>
                                    <th className="text-right px-3 py-2 font-semibold text-indigo-700">Base pagado</th>
                                    <th className="text-right px-3 py-2 font-semibold text-indigo-700">Comision arrastre</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {arrastres.map(c => (
                                    <tr key={c.id} className="border-t border-indigo-50">
                                      <td className="px-3 py-2 font-medium">{c.numero_contrato || `C-${c.id}`}</td>
                                      <td className="px-3 py-2 text-gray-600">{c.cliente}</td>
                                      <td className="px-3 py-2 text-right">${fmt(c.monto_total)}</td>
                                      <td className="px-3 py-2 text-right">${fmt(c.monto_pagado_mes)}</td>
                                      <td className="px-3 py-2 text-right">${fmt(c.monto_base_pagado_mes)}</td>
                                      <td className="px-3 py-2 text-right font-medium text-indigo-700">${fmt(c.comision_arrastre)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Desglose semanal TMK */}
                        {emp.rol === 'tmk' && Array.isArray(emp.desglose_semanal_tmk) && emp.desglose_semanal_tmk.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-2">Desglose semanal TMK (tours)</p>
                            <div className="overflow-x-auto rounded-lg border border-teal-100">
                              <table className="w-full text-xs">
                                <thead className="bg-teal-50">
                                  <tr>
                                    <th className="text-left px-3 py-2 font-semibold text-teal-700">Semana</th>
                                    <th className="text-center px-3 py-2 font-semibold text-teal-700">Tours</th>
                                    <th className="text-right px-3 py-2 font-semibold text-teal-700">$/Tour</th>
                                    <th className="text-right px-3 py-2 font-semibold text-teal-700">Bono Tours</th>
                                    <th className="text-right px-3 py-2 font-semibold text-teal-700">Bono Semanal</th>
                                    <th className="text-right px-3 py-2 font-semibold text-teal-700">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {emp.desglose_semanal_tmk.map((s, i) => {
                                    const d = new Date(s.semana_inicio + 'T00:00:00')
                                    const fin = new Date(d)
                                    fin.setDate(fin.getDate() + 6)
                                    return (
                                      <tr key={i} className="border-t border-teal-50">
                                        <td className="px-3 py-2">{d.getDate()}/{d.getMonth()+1} - {fin.getDate()}/{fin.getMonth()+1}</td>
                                        <td className="px-3 py-2 text-center font-medium">{s.tours}</td>
                                        <td className="px-3 py-2 text-right">${Number(s.bono_por_tour).toFixed(2)}</td>
                                        <td className="px-3 py-2 text-right">${fmt(s.bono_tours_sem)}</td>
                                        <td className="px-3 py-2 text-right">${fmt(s.bono_semanal)}</td>
                                        <td className="px-3 py-2 text-right font-medium text-teal-700">${fmt(s.total_semana)}</td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Resumen de comisiones */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div className="bg-teal-50 rounded-lg p-2 border border-teal-100">
                            <p className="text-teal-600">Com. venta recurrente</p>
                            <p className="font-semibold">${fmt(emp.comision_venta_recurrente)}</p>
                          </div>
                          <div className="bg-indigo-50 rounded-lg p-2 border border-indigo-100">
                            <p className="text-indigo-600">Com. abonos cartera</p>
                            <p className="font-semibold">${fmt(emp.comision_abonos_cartera)}</p>
                          </div>
                          <div className="bg-purple-50 rounded-lg p-2 border border-purple-100">
                            <p className="text-purple-600">Com. reactivaciones</p>
                            <p className="font-semibold">${fmt(emp.comision_reactivaciones)}</p>
                          </div>
                          <div className="bg-amber-50 rounded-lg p-2 border border-amber-100">
                            <p className="text-amber-600">Arrastre TMK</p>
                            <p className="font-semibold">${fmt(emp.comision_arrastre_tmk)}</p>
                          </div>
                        </div>

                        {/* Totales finales */}
                        <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3 text-xs">
                          <div className="flex gap-4">
                            <div><span className="text-gray-500">IESS:</span> <span className="font-medium text-red-600">-${fmt(emp.aporte_iess)}</span></div>
                            <div><span className="text-gray-500">Anticipo:</span> <span className="font-medium text-red-600">-${fmt(emp.anticipo)}</span></div>
                            <div><span className="text-gray-500">Otras deduc.:</span> <span className="font-medium text-red-600">-${fmt(emp.otras_deducciones)}</span></div>
                            <div><span className="text-gray-500">Otros ing.:</span> <span className="font-medium text-green-600">+${fmt(emp.otros_ingresos)}</span></div>
                          </div>
                          <div className="bg-teal-600 text-white px-4 py-2 rounded-lg font-bold text-sm">
                            NETO: ${fmt(emp.neto_a_pagar)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Modal de Notificación (Preview + Enviar placeholder) ─────────────────────
function ModalNotificar({ registro, onClose }) {
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState('')

  const mensaje = `Hola ${registro.usuario_nombre}, tu liquidacion del periodo ${registro.mes} es de $${fmt(registro.neto_a_pagar)}. Genera tu factura por este valor.`

  async function handleEnviar() {
    setEnviando(true)
    setError('')
    try {
      const res = await notificarNomina(registro.id)
      setResultado(res)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al enviar notificación')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">Notificar liquidacion</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {!resultado ? (
            <>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Para:</span>
                  <span className="font-medium text-gray-800">{registro.usuario_nombre}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Asunto:</span>
                  <span className="font-medium text-gray-800">Liquidacion {registro.mes} - SANAVIT</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Preview del mensaje:</p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-gray-700">
                  {mensaje}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                <strong>Nota:</strong> El envio de email aun no esta configurado. Al hacer clic en "Enviar" se registrara la intención pero el correo no se enviara realmente hasta que se configure SMTP.
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">{error}</div>
              )}

              <button
                onClick={handleEnviar}
                disabled={enviando}
                className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-medium"
              >
                {enviando ? 'Enviando...' : 'Enviar notificacion'}
              </button>
            </>
          ) : (
            <>
              <div className="text-center py-4">
                <div className="text-4xl mb-3">&#9989;</div>
                <p className="font-medium text-gray-800">{resultado.message}</p>
              </div>

              {resultado.preview && (
                <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                  <p><span className="text-gray-500">Destinatario:</span> {resultado.preview.destinatario}</p>
                  <p><span className="text-gray-500">Email:</span> {resultado.preview.email}</p>
                  <p><span className="text-gray-500">Asunto:</span> {resultado.preview.asunto}</p>
                  <p><span className="text-gray-500">Mensaje:</span> {resultado.preview.mensaje}</p>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full border border-gray-300 text-gray-700 hover:bg-gray-50 py-2 rounded-lg text-sm font-medium"
              >
                Cerrar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Estado de asistencia: colores y labels ───────────────────────────────────
const ASISTENCIA_ESTADOS = [
  { value: 'presente',  label: 'Presente',  color: 'bg-green-100 text-green-700' },
  { value: 'ausente',   label: 'Ausente',   color: 'bg-red-100 text-red-700' },
  { value: 'tardanza',  label: 'Tardanza',  color: 'bg-yellow-100 text-yellow-700' },
  { value: 'permiso',   label: 'Permiso',   color: 'bg-blue-100 text-blue-700' },
  { value: 'vacacion',  label: 'Vacaci\u00f3n', color: 'bg-purple-100 text-purple-700' },
]

// ── Tab de Asistencia ────────────────────────────────────────────────────────
function AsistenciaTab({ salas }) {
  const { usuario } = useAuth()
  const puedeRegistrar = ['admin', 'director', 'hostess', 'supervisor_cc'].includes(usuario?.rol)
  const esAdmin = ['admin', 'director'].includes(usuario?.rol)

  const hoy = new Date().toISOString().slice(0, 10)
  const mesActual = hoy.slice(0, 7)

  const [vista, setVista]         = useState('diaria') // 'diaria' | 'resumen'
  const [fecha, setFecha]         = useState(hoy)
  const [mesResumen, setMesResumen] = useState(mesActual)
  const [salaId, setSalaId]       = useState(usuario?.sala_id || '')
  const [usuarios, setUsuarios]   = useState([])
  const [asistenciaForm, setAsistenciaForm] = useState({}) // { [usuario_id]: { estado, justificacion } }
  const [loading, setLoading]     = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')
  const [resumen, setResumen]     = useState(null)

  // Cargar asistencia del día
  const cargarDia = useCallback(async () => {
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const params = { fecha }
      if (salaId) params.sala_id = salaId
      const data = await getAsistenciaDia(params)
      setUsuarios(Array.isArray(data) ? data : [])
      // Inicializar form con lo que ya existe
      const form = {}
      for (const u of data) {
        form[u.usuario_id] = {
          estado: u.estado || 'presente',
          justificacion: u.justificacion || '',
        }
      }
      setAsistenciaForm(form)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar asistencia')
    } finally {
      setLoading(false)
    }
  }, [fecha, salaId])

  // Cargar resumen mensual
  const cargarResumen = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = { mes: mesResumen }
      if (salaId) params.sala_id = salaId
      const data = await getResumenMensual(params)
      setResumen(data)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar resumen')
    } finally {
      setLoading(false)
    }
  }, [mesResumen, salaId])

  useEffect(() => {
    if (vista === 'diaria') cargarDia()
    else cargarResumen()
  }, [vista, cargarDia, cargarResumen])

  function handleEstadoChange(usuarioId, campo, valor) {
    setAsistenciaForm(prev => ({
      ...prev,
      [usuarioId]: { ...prev[usuarioId], [campo]: valor },
    }))
  }

  // Marcar todos presente
  function marcarTodos(estado) {
    setAsistenciaForm(prev => {
      const nuevo = { ...prev }
      for (const uid of Object.keys(nuevo)) {
        nuevo[uid] = { ...nuevo[uid], estado }
      }
      return nuevo
    })
  }

  async function guardarAsistencia() {
    setGuardando(true)
    setError('')
    setSuccess('')
    try {
      const registros = Object.entries(asistenciaForm).map(([uid, data]) => ({
        usuario_id: parseInt(uid, 10),
        estado: data.estado,
        justificacion: data.justificacion || null,
        sala_id: salaId ? parseInt(salaId, 10) : null,
      }))
      await registrarAsistenciaBulk({ fecha, registros })
      setSuccess('Asistencia guardada correctamente')
      await cargarDia()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar asistencia')
    } finally {
      setGuardando(false)
    }
  }

  // Contar presentes/ausentes del form actual
  const conteo = Object.values(asistenciaForm)
  const presentes = conteo.filter(c => c.estado === 'presente' || c.estado === 'tardanza').length
  const ausentes  = conteo.filter(c => c.estado === 'ausente').length

  return (
    <div className="space-y-5">
      {/* Sub-tabs: Diaria / Resumen mensual */}
      <div className="flex items-center gap-4 border-b border-gray-200">
        <button
          onClick={() => setVista('diaria')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${vista === 'diaria' ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Registro diario
        </button>
        <button
          onClick={() => setVista('resumen')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${vista === 'resumen' ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Resumen mensual
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        {vista === 'diaria' ? (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
            <input
              type="date"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
            />
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Mes</label>
            <input
              type="month"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={mesResumen}
              onChange={e => setMesResumen(e.target.value)}
            />
          </div>
        )}
        {(esAdmin || salas.length > 0) && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Sala</label>
            <select
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={salaId}
              onChange={e => setSalaId(e.target.value)}
            >
              <option value="">Todas las salas</option>
              {salas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{success}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : vista === 'diaria' ? (
        /* ── Vista diaria ───────────────────────────────────────────── */
        <>
          {/* Cards resumen rápido */}
          {usuarios.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              <div className="border rounded-xl p-3 bg-slate-50 border-slate-200">
                <p className="text-xs text-gray-500">Personal</p>
                <p className="text-xl font-bold text-gray-800">{usuarios.length}</p>
              </div>
              <div className="border rounded-xl p-3 bg-green-50 border-green-200">
                <p className="text-xs text-gray-500">Presentes</p>
                <p className="text-xl font-bold text-green-700">{presentes}</p>
              </div>
              <div className="border rounded-xl p-3 bg-red-50 border-red-200">
                <p className="text-xs text-gray-500">Ausentes</p>
                <p className="text-xl font-bold text-red-700">{ausentes}</p>
              </div>
            </div>
          )}

          {usuarios.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">📋</p>
              <p className="font-medium">No se encontraron usuarios activos para esta sala</p>
            </div>
          ) : (
            <>
              {/* Acciones rápidas */}
              {puedeRegistrar && (
                <div className="flex gap-2">
                  <button
                    onClick={() => marcarTodos('presente')}
                    className="text-xs border border-green-300 text-green-700 hover:bg-green-50 px-3 py-1.5 rounded-lg"
                  >
                    Marcar todos presente
                  </button>
                  <button
                    onClick={() => marcarTodos('ausente')}
                    className="text-xs border border-red-300 text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg"
                  >
                    Marcar todos ausente
                  </button>
                </div>
              )}

              {/* Tabla de asistencia diaria */}
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Empleado</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Rol</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Sala</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Observaci\u00f3n</th>
                      {!puedeRegistrar && <th className="text-left px-4 py-3 font-semibold text-gray-600">Registrado por</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map((u, i) => {
                      const form = asistenciaForm[u.usuario_id] || { estado: 'presente', justificacion: '' }
                      const yaRegistrado = !!u.asistencia_id
                      return (
                        <tr key={u.usuario_id} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                          <td className="px-4 py-3 font-medium text-gray-800">{u.usuario_nombre}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{u.rol_label || u.rol}</td>
                          <td className="px-4 py-3 text-gray-500">{u.sala_nombre || '\u2014'}</td>
                          <td className="px-4 py-3">
                            {puedeRegistrar ? (
                              <select
                                value={form.estado}
                                onChange={e => handleEstadoChange(u.usuario_id, 'estado', e.target.value)}
                                className={`border rounded-lg px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                                  ASISTENCIA_ESTADOS.find(e => e.value === form.estado)?.color || ''
                                }`}
                              >
                                {ASISTENCIA_ESTADOS.map(e => (
                                  <option key={e.value} value={e.value}>{e.label}</option>
                                ))}
                              </select>
                            ) : (
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                ASISTENCIA_ESTADOS.find(e => e.value === form.estado)?.color || 'bg-gray-100 text-gray-600'
                              }`}>
                                {ASISTENCIA_ESTADOS.find(e => e.value === form.estado)?.label || form.estado}
                              </span>
                            )}
                            {yaRegistrado && (
                              <span className="ml-2 text-xs text-gray-400" title="Ya registrado">
                                &#10003;
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {puedeRegistrar ? (
                              <input
                                type="text"
                                placeholder="Obs..."
                                value={form.justificacion}
                                onChange={e => handleEstadoChange(u.usuario_id, 'justificacion', e.target.value)}
                                className="border border-gray-200 rounded-lg px-2 py-1 text-xs w-full max-w-[200px] focus:outline-none focus:ring-2 focus:ring-teal-500"
                              />
                            ) : (
                              <span className="text-xs text-gray-500">{u.justificacion || '\u2014'}</span>
                            )}
                          </td>
                          {!puedeRegistrar && (
                            <td className="px-4 py-3 text-xs text-gray-400">{u.registrado_por_nombre || '\u2014'}</td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Botón guardar */}
              {puedeRegistrar && (
                <div className="flex justify-end">
                  <button
                    onClick={guardarAsistencia}
                    disabled={guardando}
                    className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-medium"
                  >
                    {guardando ? 'Guardando...' : 'Guardar Asistencia del D\u00eda'}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      ) : (
        /* ── Vista resumen mensual ──────────────────────────────────── */
        resumen && (
          <>
            {/* Info días laborables */}
            <div className="flex items-center gap-4">
              <div className="border rounded-xl p-3 bg-slate-50 border-slate-200">
                <p className="text-xs text-gray-500">D\u00edas laborables del mes</p>
                <p className="text-xl font-bold text-gray-800">{resumen.dias_laborables}</p>
              </div>
              <div className="border rounded-xl p-3 bg-slate-50 border-slate-200">
                <p className="text-xs text-gray-500">Empleados activos</p>
                <p className="text-xl font-bold text-gray-800">{resumen.usuarios?.length || 0}</p>
              </div>
            </div>

            {resumen.usuarios?.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="font-medium">No hay datos de asistencia para este mes</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Empleado</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Rol</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Sala</th>
                      <th className="text-center px-4 py-3 font-semibold text-green-600">Presentes</th>
                      <th className="text-center px-4 py-3 font-semibold text-yellow-600">Tardanzas</th>
                      <th className="text-center px-4 py-3 font-semibold text-red-600">Ausentes</th>
                      <th className="text-center px-4 py-3 font-semibold text-blue-600">Permisos</th>
                      <th className="text-center px-4 py-3 font-semibold text-purple-600">Vacaci\u00f3n</th>
                      <th className="text-center px-4 py-3 font-semibold text-teal-700">D\u00edas trabajados</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-600">% Asistencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumen.usuarios.map((u, i) => {
                      const dt = parseInt(u.dias_trabajados) || 0
                      const pct = resumen.dias_laborables > 0
                        ? Math.round((dt / resumen.dias_laborables) * 100)
                        : 0
                      return (
                        <tr key={u.usuario_id} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                          <td className="px-4 py-3 font-medium text-gray-800">{u.usuario_nombre}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{u.rol_label}</td>
                          <td className="px-4 py-3 text-gray-500">{u.sala_nombre || '\u2014'}</td>
                          <td className="px-4 py-3 text-center text-green-700 font-medium">{u.dias_presente}</td>
                          <td className="px-4 py-3 text-center text-yellow-600">{u.dias_tardanza}</td>
                          <td className="px-4 py-3 text-center text-red-600">{u.dias_ausente}</td>
                          <td className="px-4 py-3 text-center text-blue-600">{u.dias_permiso}</td>
                          <td className="px-4 py-3 text-center text-purple-600">{u.dias_vacacion}</td>
                          <td className="px-4 py-3 text-center font-bold text-teal-700">{dt}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium text-gray-600">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )
      )}
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function NominaPage() {
  const { usuario } = useAuth()
  const esAdmin = ['admin', 'director'].includes(usuario?.rol)
  const puedeVerAsistencia = ['admin', 'director', 'hostess', 'supervisor_cc'].includes(usuario?.rol)

  const hoy = new Date()
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`

  const [tabActivo, setTabActivo] = useState('nomina')
  const [mes,         setMes]         = useState(mesActual)
  const [salaId,      setSalaId]      = useState('')
  const [tipoLiquidacion, setTipoLiquidacion] = useState('completa')
  const [salas,       setSalas]       = useState([])
  const [registros,   setRegistros]   = useState([])
  const [loading,     setLoading]     = useState(false)
  const [calculando,  setCalculando]  = useState(false)
  const [error,       setError]       = useState('')
  const [detalle,     setDetalle]     = useState(null)
  const [showValidacion, setShowValidacion] = useState(false)
  const [notificarReg,   setNotificarReg]   = useState(null)

  useEffect(() => {
    getSalas().then(d => setSalas(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = { mes }
      if (salaId) params.sala_id = salaId
      if (tipoLiquidacion) params.tipo_liquidacion = tipoLiquidacion
      const data = await getNomina(params)
      setRegistros(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar nómina')
    } finally {
      setLoading(false)
    }
  }, [mes, salaId, tipoLiquidacion])

  useEffect(() => { cargar() }, [cargar])

  async function handleCalcular() {
    setCalculando(true)
    setError('')
    try {
      const body = { mes, tipo_liquidacion: tipoLiquidacion }
      if (salaId) body.sala_id = Number(salaId)
      await calcularNomina(body)
      await cargar()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al calcular nómina')
    } finally {
      setCalculando(false)
    }
  }

  function handleUpdateRegistro(updated) {
    setRegistros(prev => prev.map(r => r.id === updated.id ? updated : r))
    setDetalle(updated)
  }

  function exportarCSV() {
    const cols = ['Nombre','Rol','Sala','Sueldo Base','Com.Ventas','Com.Cobros','Bono Tours','Bono Citas','Bono Meta','Otros Ingresos','TOTAL BRUTO','IESS 9.45%','Anticipo','Otras Deduc.','NETO A PAGAR','Estado']
    const rows = registros.map(r => [
      r.usuario_nombre, r.rol_label || r.rol, r.sala_nombre || '',
      r.sueldo_base, r.comision_ventas, r.comision_cobros,
      r.bono_tours, r.bono_citas, r.bono_meta, r.otros_ingresos,
      r.total_ingresos, r.aporte_iess, r.anticipo, r.otras_deducciones,
      r.neto_a_pagar, ESTADO_LABELS[r.estado] || r.estado,
    ])
    const csv = '\uFEFF' + [cols, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `nomina_${mes}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportarPDFPlanilla() {
    const rows = registros.map(r => `
      <tr>
        <td>${r.usuario_nombre}</td>
        <td>${r.rol_label || r.rol}</td>
        <td>${r.sala_nombre || '—'}</td>
        <td style="text-align:right">$${fmt(r.sueldo_base)}</td>
        <td style="text-align:right">$${fmt(r.comision_ventas)}</td>
        <td style="text-align:right">$${fmt(r.bono_tours)}</td>
        <td style="text-align:right">$${fmt(r.total_ingresos)}</td>
        <td style="text-align:right">$${fmt(r.aporte_iess)}</td>
        <td style="text-align:right">$${fmt(r.anticipo)}</td>
        <td style="text-align:right"><strong>$${fmt(r.neto_a_pagar)}</strong></td>
        <td>${ESTADO_LABELS[r.estado] || r.estado}</td>
      </tr>`).join('')

    const totBruto  = registros.reduce((a, r) => a + Number(r.total_ingresos || 0), 0)
    const totIESS   = registros.reduce((a, r) => a + Number(r.aporte_iess    || 0), 0)
    const totNeto   = registros.reduce((a, r) => a + Number(r.neto_a_pagar   || 0), 0)

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; margin: 0; padding: 20px; font-size: 11px; color: #1a1a1a; }
  h1 { font-size: 18px; color: #0d9488; margin-bottom: 4px; }
  p { margin: 0 0 16px 0; color: #6b7280; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #0d9488; color: white; padding: 7px 8px; text-align: left; font-size: 10px; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #f9fafb; }
  .totales td { font-weight: 700; background: #f3f4f6; border-top: 2px solid #0d9488; }
  @media print { @page { size: A4 landscape; margin: 10mm; } }
</style>
</head>
<body>
<h1>SANAVIT — Planilla de Nómina</h1>
<p>Período: ${mes} · ${registros.length} empleados</p>
<table>
  <thead>
    <tr>
      <th>Empleado</th><th>Rol</th><th>Sala</th>
      <th>Sueldo</th><th>Comisiones</th><th>Bonos</th>
      <th>Bruto</th><th>IESS</th><th>Anticipo</th><th>Neto</th><th>Estado</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
    <tr class="totales">
      <td colspan="6">TOTALES</td>
      <td>$${fmt(totBruto)}</td>
      <td>$${fmt(totIESS)}</td>
      <td></td>
      <td>$${fmt(totNeto)}</td>
      <td></td>
    </tr>
  </tbody>
</table>
</body>
</html>`

    const w = window.open('', '_blank', 'width=1100,height=800')
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 600)
  }

  // Resumen cards
  const totalEmpleados = registros.length
  const nominaBruta    = registros.reduce((a, r) => a + Number(r.total_ingresos || 0), 0)
  const totalIESS      = registros.reduce((a, r) => a + Number(r.aporte_iess    || 0), 0)
  const netoTotal      = registros.reduce((a, r) => a + Number(r.neto_a_pagar   || 0), 0)

  return (
    <div className="space-y-6">
      {/* Tabs principales */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        <button
          onClick={() => setTabActivo('nomina')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tabActivo === 'nomina' ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Nomina
        </button>
        {puedeVerAsistencia && (
          <button
            onClick={() => setTabActivo('asistencia')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tabActivo === 'asistencia' ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Asistencia
          </button>
        )}
      </div>

      {tabActivo === 'asistencia' && puedeVerAsistencia ? (
        <AsistenciaTab salas={salas} />
      ) : (
        <>
          {/* Cabecera nomina */}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Mes</label>
              <input
                type="month"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={mes}
                onChange={e => setMes(e.target.value)}
              />
            </div>
            {esAdmin && salas.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Sala</label>
                <select
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  value={salaId}
                  onChange={e => setSalaId(e.target.value)}
                >
                  <option value="">Todas las salas</option>
                  {salas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
            )}
            {esAdmin && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo liquidacion</label>
                <select
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  value={tipoLiquidacion}
                  onChange={e => setTipoLiquidacion(e.target.value)}
                >
                  <option value="completa">Liquidacion completa (todo junto)</option>
                  <option value="garantizado">Garantizado — 1er viernes (quincena mes anterior)</option>
                  <option value="comisiones">Quincena + Comisiones — 3er viernes</option>
                </select>
              </div>
            )}
            {esAdmin && (
              <>
                <button
                  onClick={handleCalcular}
                  disabled={calculando}
                  className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  {calculando ? 'Calculando...' : 'Calcular mes'}
                </button>
                {registros.length > 0 && (
                  <button
                    onClick={() => setShowValidacion(true)}
                    className="border border-indigo-300 text-indigo-700 hover:bg-indigo-50 px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    Reporte de Validacion
                  </button>
                )}
              </>
            )}
            {registros.length > 0 && esAdmin && (
              <>
                <button
                  onClick={exportarCSV}
                  className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm"
                >
                  Exportar Excel CSV
                </button>
                <button
                  onClick={exportarPDFPlanilla}
                  className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm"
                >
                  PDF Planilla completa
                </button>
              </>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Cards resumen */}
          {esAdmin && registros.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Empleados',    value: totalEmpleados, prefix: '',  color: 'bg-slate-50  border-slate-200'  },
                { label: 'Nomina bruta', value: nominaBruta,    prefix: '$', color: 'bg-blue-50   border-blue-200'   },
                { label: 'IESS total',   value: totalIESS,      prefix: '$', color: 'bg-orange-50 border-orange-200' },
                { label: 'Neto total',   value: netoTotal,      prefix: '$', color: 'bg-teal-50   border-teal-200'   },
              ].map(c => (
                <div key={c.label} className={`border rounded-xl p-4 ${c.color}`}>
                  <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                  <p className="text-xl font-bold text-gray-800">
                    {c.prefix}{c.prefix ? fmt(c.value) : c.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Tabla */}
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : registros.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">$</p>
              <p className="font-medium">No hay registros de nomina para {mes}</p>
              {esAdmin && <p className="text-sm mt-1">Haz clic en "Calcular mes" para generar la nomina</p>}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Empleado</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Rol</th>
                    {esAdmin && <th className="text-left px-4 py-3 font-semibold text-gray-600">Sala</th>}
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Sueldo</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Comisiones</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Bonos</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">IESS</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Neto</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((r, i) => (
                    <tr key={r.id} className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                      <td className="px-4 py-3 font-medium text-gray-800">{r.usuario_nombre}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{r.rol_label || r.rol}</td>
                      {esAdmin && <td className="px-4 py-3 text-gray-500">{r.sala_nombre || '\u2014'}</td>}
                      <td className="px-4 py-3 text-right text-gray-700">${fmt(r.sueldo_base)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">${fmt(Number(r.comision_ventas) + Number(r.comision_cobros))}</td>
                      <td className="px-4 py-3 text-right text-gray-700">${fmt(Number(r.bono_tours) + Number(r.bono_citas) + Number(r.bono_meta))}</td>
                      <td className="px-4 py-3 text-right text-red-500">-${fmt(r.aporte_iess)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-teal-700">${fmt(r.neto_a_pagar)}</td>
                      <td className="px-4 py-3"><Badge estado={r.estado} /><BadgeTipo tipo={r.tipo_liquidacion} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setDetalle(r)}
                            className="text-xs border border-teal-200 text-teal-700 hover:bg-teal-50 px-3 py-1.5 rounded-lg"
                          >
                            Ver detalle
                          </button>
                          {esAdmin && ['aprobada', 'pagada'].includes(r.estado) && (
                            <button
                              onClick={() => setNotificarReg(r)}
                              className="text-xs border border-amber-200 text-amber-700 hover:bg-amber-50 px-2.5 py-1.5 rounded-lg"
                              title="Notificar liquidación al empleado"
                            >
                              Notificar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Drawer detalle */}
          {detalle && (
            <DrawerNomina
              registro={detalle}
              onClose={() => setDetalle(null)}
              onUpdate={handleUpdateRegistro}
              esAdmin={esAdmin}
            />
          )}

          {/* Modal Reporte Validación */}
          {showValidacion && (
            <ModalReporteValidacion
              mes={mes}
              salaId={salaId}
              onClose={() => setShowValidacion(false)}
            />
          )}

          {/* Modal Notificar */}
          {notificarReg && (
            <ModalNotificar
              registro={notificarReg}
              onClose={() => setNotificarReg(null)}
            />
          )}
        </>
      )}
    </div>
  )
}
