import { useState, useEffect, useCallback } from 'react'
import { getNomina, calcularNomina, updateNomina, getReporteNomina } from '../../api/nomina'
import { getSalas } from '../../api/admin'
import { useAuth } from '../../context/AuthContext'

const fmt = (n) => Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end">
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
                [`Comisión ventas (${registro.pct_comision_venta_config || 0}%)`, `${registro.contratos_desbloqueados || 0} contratos`, registro.comision_ventas],
                ['Comisión cobros', null, registro.comision_cobros],
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

// ── Página principal ─────────────────────────────────────────────────────────
export default function NominaPage() {
  const { usuario } = useAuth()
  const esAdmin = ['admin', 'director'].includes(usuario?.rol)

  const hoy = new Date()
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`

  const [mes,         setMes]         = useState(mesActual)
  const [salaId,      setSalaId]      = useState('')
  const [salas,       setSalas]       = useState([])
  const [registros,   setRegistros]   = useState([])
  const [loading,     setLoading]     = useState(false)
  const [calculando,  setCalculando]  = useState(false)
  const [error,       setError]       = useState('')
  const [detalle,     setDetalle]     = useState(null)

  useEffect(() => {
    getSalas().then(d => setSalas(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = { mes }
      if (salaId) params.sala_id = salaId
      const data = await getNomina(params)
      setRegistros(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar nómina')
    } finally {
      setLoading(false)
    }
  }, [mes, salaId])

  useEffect(() => { cargar() }, [cargar])

  async function handleCalcular() {
    setCalculando(true)
    setError('')
    try {
      const body = { mes }
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
      {/* Cabecera */}
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
          <button
            onClick={handleCalcular}
            disabled={calculando}
            className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            {calculando ? 'Calculando...' : '⚙ Calcular mes'}
          </button>
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
            { label: 'Nómina bruta', value: nominaBruta,    prefix: '$', color: 'bg-blue-50   border-blue-200'   },
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
          <p className="text-4xl mb-3">💵</p>
          <p className="font-medium">No hay registros de nómina para {mes}</p>
          {esAdmin && <p className="text-sm mt-1">Haz clic en "Calcular mes" para generar la nómina</p>}
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
                  {esAdmin && <td className="px-4 py-3 text-gray-500">{r.sala_nombre || '—'}</td>}
                  <td className="px-4 py-3 text-right text-gray-700">${fmt(r.sueldo_base)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">${fmt(Number(r.comision_ventas) + Number(r.comision_cobros))}</td>
                  <td className="px-4 py-3 text-right text-gray-700">${fmt(Number(r.bono_tours) + Number(r.bono_citas) + Number(r.bono_meta))}</td>
                  <td className="px-4 py-3 text-right text-red-500">-${fmt(r.aporte_iess)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-teal-700">${fmt(r.neto_a_pagar)}</td>
                  <td className="px-4 py-3"><Badge estado={r.estado} /></td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setDetalle(r)}
                      className="text-xs border border-teal-200 text-teal-700 hover:bg-teal-50 px-3 py-1.5 rounded-lg"
                    >
                      Ver detalle
                    </button>
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
    </div>
  )
}
