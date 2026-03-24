import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Breadcrumb from '../../components/UI/Breadcrumb'
import { getVenta360, updateEstadoVenta, updateNotasVenta, despacharProducto, anularVenta, condonarIntereses } from '../../api/ventas'
import { createRecibo, anularRecibo } from '../../api/recibos'
import { getFormasPago } from '../../api/admin'
import { useToast } from '../../context/ToastContext'
import client from '../../api/client'

const TIPOS_DOC = [
  { value: 'contrato_firmado', label: 'Contrato firmado' },
  { value: 'acta_entrega', label: 'Acta de entrega' },
  { value: 'acta_recepcion_credito', label: 'Acta recepcion credito' },
  { value: 'soporte_pago', label: 'Soporte de pago' },
  { value: 'cedula', label: 'Cedula del cliente' },
  { value: 'otro', label: 'Otro documento' },
]

function TabDocumentos({ contratoId }) {
  const { usuario } = useAuth()
  const fileRef = useRef()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [tipoDoc, setTipoDoc] = useState('contrato_firmado')

  useEffect(() => {
    client.get(`/api/ventas/${contratoId}/documentos`)
      .then(r => setDocs(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [contratoId])

  const subirArchivo = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('archivo', file)
    formData.append('tipo', tipoDoc)
    try {
      const r = await client.post(`/api/ventas/${contratoId}/documentos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setDocs(prev => [r.data, ...prev])
    } catch (err) { console.error(err) }
    finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const eliminar = async (docId) => {
    if (!confirm('Eliminar este documento?')) return
    try {
      await client.delete(`/api/ventas/${contratoId}/documentos/${docId}`)
      setDocs(prev => prev.filter(d => d.id !== docId))
    } catch (err) { console.error(err) }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={tipoDoc} onChange={e => setTipoDoc(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
          {TIPOS_DOC.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors
          ${uploading ? 'bg-gray-300 text-gray-500' : 'bg-teal-600 text-white hover:bg-teal-700'}`}>
          {uploading ? 'Subiendo...' : '📎 Subir archivo'}
          <input ref={fileRef} type="file" className="hidden" onChange={subirArchivo} disabled={uploading}
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
        </label>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-400">Cargando documentos...</div>
      ) : docs.length === 0 ? (
        <div className="p-8 text-center text-gray-400">
          <div className="text-3xl mb-2">📁</div>
          <p className="text-sm">No hay documentos adjuntos</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-gray-600">Tipo</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-600">Archivo</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-600">Subido por</th>
              <th className="text-left px-4 py-2 font-semibold text-gray-600">Fecha</th>
              <th className="text-center px-4 py-2 font-semibold text-gray-600"></th>
            </tr>
          </thead>
          <tbody>
            {docs.map(d => (
              <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-2">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    {TIPOS_DOC.find(t => t.value === d.tipo)?.label || d.tipo}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-700">{d.nombre_archivo}</td>
                <td className="px-4 py-2 text-gray-500 text-xs">{d.uploaded_by_nombre || '—'}</td>
                <td className="px-4 py-2 text-gray-500 text-xs">{new Date(d.created_at).toLocaleDateString('es-EC')}</td>
                <td className="px-4 py-2 text-center">
                  <div className="flex items-center gap-2 justify-center">
                    <a href={d.url} target="_blank" rel="noreferrer"
                      className="text-teal-600 hover:text-teal-800 text-xs font-medium">Descargar</a>
                    {['admin','director'].includes(usuario?.rol) && (
                      <button onClick={() => eliminar(d.id)} className="text-red-400 hover:text-red-600 text-xs">Eliminar</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

import { fmt } from '../../utils/formatCurrency'

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
  { key: 'documentos', label: '📎 Documentos' },
]

export default function Venta360Page() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const { addToast } = useToast()
  const [data, setData]       = useState(null)
  const [tab, setTab]         = useState('cliente')
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  // ── Pago / Recibo ─────────────────────────────────────────
  const [mostrarPago, setMostrarPago] = useState(false)
  const [formasPago, setFormasPago]   = useState([])
  const [pago, setPago] = useState({
    cuota_id: '',
    valor: '',
    forma_pago_id: '',
    fecha_pago: new Date().toISOString().split('T')[0],
    referencia_pago: '',
    observacion: '',
  })
  const [guardandoPago, setGuardandoPago] = useState(false)
  const [errorPago, setErrorPago]         = useState('')
  const [comprobante, setComprobante]     = useState(null)
  const [comprobanteNombre, setComprobanteNombre] = useState('')
  const comprobanteRef = useRef()
  // ── Notas del contrato ─────────────────────────────────────
  const [notasEdit, setNotasEdit]     = useState('')
  const [guardandoNotas, setGuardandoNotas] = useState(false)
  const [notasMsg, setNotasMsg]       = useState('')
  // ── Cambio de estado ──────────────────────────────────────
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  // ── Despacho de productos ─────────────────────────────────
  const [despachando, setDespachando] = useState(new Set())
  // ── Condonar intereses ──────────────────────────────────
  const [condonando, setCondonando] = useState(false)

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
  useEffect(() => { getFormasPago().then(fps => setFormasPago(fps.filter(f => f.activo))).catch(console.error) }, [])
  useEffect(() => {
    if (data?.contrato?.observaciones !== undefined) {
      setNotasEdit(data.contrato.observaciones || '')
    }
  }, [data])

  function handleComprobanteChange(e) {
    const file = e.target.files[0]
    if (!file) { setComprobante(null); setComprobanteNombre(''); return }
    if (file.size > 5 * 1024 * 1024) { setErrorPago('El comprobante no puede superar 5MB'); return }
    setComprobanteNombre(file.name)
    const reader = new FileReader()
    reader.onload = () => setComprobante(reader.result)
    reader.readAsDataURL(file)
  }

  async function handleGuardarPago(e) {
    e.preventDefault()
    setErrorPago('')
    if (!pago.valor || Number(pago.valor) <= 0) { setErrorPago('El monto debe ser mayor a 0'); return }
    setGuardandoPago(true)
    try {
      await createRecibo({
        persona_id: data.contrato.persona_id,
        contrato_id: Number(id),
        cuota_id: pago.cuota_id ? Number(pago.cuota_id) : undefined,
        valor: Number(pago.valor),
        forma_pago_id: pago.forma_pago_id ? Number(pago.forma_pago_id) : undefined,
        fecha_pago: pago.fecha_pago,
        referencia_pago: pago.referencia_pago || undefined,
        observacion: pago.observacion || undefined,
        sala_id: data.contrato.sala_id,
        comprobante: comprobante || undefined,
      })
      addToast(`Pago de $${Number(pago.valor).toLocaleString('es-EC', { minimumFractionDigits: 2 })} registrado`)
      setMostrarPago(false)
      setPago({ cuota_id: '', valor: '', forma_pago_id: '', fecha_pago: new Date().toISOString().split('T')[0], referencia_pago: '', observacion: '' })
      setComprobante(null); setComprobanteNombre('')
      if (comprobanteRef.current) comprobanteRef.current.value = ''
      cargar()
    } catch (err) {
      setErrorPago(err.response?.data?.error || 'Error al registrar el pago')
    } finally {
      setGuardandoPago(false)
    }
  }

  async function handleAnularRecibo(reciboId) {
    if (!window.confirm('¿Anular este recibo? Esta acción no se puede deshacer.')) return
    try {
      await anularRecibo(reciboId)
      addToast('Recibo anulado correctamente', 'warning')
      cargar()
    } catch (err) {
      addToast(err.response?.data?.error || 'Error al anular el recibo', 'error')
    }
  }

  async function handleCambiarEstado(nuevoEstado) {
    const labels = { suspendido: 'suspender', cancelado: 'cancelar', activo: 'reactivar', completado: 'marcar como completado' }
    const msg = `¿Estás seguro de ${labels[nuevoEstado] || nuevoEstado} este contrato?`
    if (!window.confirm(msg)) return
    setCambiandoEstado(true)
    try {
      await updateEstadoVenta(id, { estado: nuevoEstado })
      addToast('Estado del contrato actualizado')
      cargar()
    } catch (err) {
      addToast(err.response?.data?.error || 'Error al cambiar estado', 'error')
    } finally {
      setCambiandoEstado(false)
    }
  }

  async function handleAnularContrato() {
    const motivo = window.prompt('Motivo de la anulación (caída en mesa):')
    if (motivo === null) return // canceló
    if (!window.confirm(`¿Confirmas anular el contrato ${contrato.numero_contrato}? Esta acción no se puede deshacer.`)) return
    setCambiandoEstado(true)
    try {
      await anularVenta(id, motivo || 'Caída en mesa')
      addToast('Contrato anulado — Caída en mesa', 'warning')
      cargar()
    } catch (err) {
      addToast(err.response?.data?.error || 'Error al anular el contrato', 'error')
    } finally {
      setCambiandoEstado(false)
    }
  }

  async function handleGuardarNotas(e) {
    e.preventDefault()
    setGuardandoNotas(true); setNotasMsg('')
    try {
      await updateNotasVenta(id, notasEdit)
      addToast('Notas guardadas correctamente')
      cargar()
    } catch (err) {
      addToast('Error al guardar notas', 'error')
      setNotasMsg('❌ Error al guardar notas')
    } finally {
      setGuardandoNotas(false)
    }
  }

  async function handleDespachar(productoId) {
    const prod = productos.find(p => p.id === productoId)
    const cantidadTotal = parseInt(prod?.cantidad) || 1
    const yaDespachado = parseInt(prod?.cantidad_despachada) || 0
    const pendiente = cantidadTotal - yaDespachado

    let cantDespachar = pendiente
    if (pendiente > 1) {
      const input = window.prompt(`¿Cuantas unidades va a despachar? (pendientes: ${pendiente})`, String(pendiente))
      if (input === null) return
      cantDespachar = parseInt(input)
      if (isNaN(cantDespachar) || cantDespachar <= 0) { addToast('Cantidad invalida', 'error'); return }
      if (cantDespachar > pendiente) { addToast(`Solo quedan ${pendiente} unidades por despachar`, 'error'); return }
    } else {
      if (!window.confirm('¿Confirmar despacho de este producto?')) return
    }

    setDespachando(prev => new Set(prev).add(productoId))
    try {
      await despacharProducto(productoId, cantDespachar)
      addToast(`${cantDespachar} unidad(es) despachada(s) correctamente`)
      cargar()
    } catch (err) {
      addToast(err.response?.data?.error || 'Error al registrar el despacho', 'error')
    } finally {
      setDespachando(prev => { const s = new Set(prev); s.delete(productoId); return s })
    }
  }

  async function handleCondonarIntereses() {
    const motivo = window.prompt('Motivo de la condonacion (opcional):', 'Pago anticipado')
    if (motivo === null) return // canceló el prompt
    if (!window.confirm('¿Confirmas condonar los intereses de todas las cuotas pendientes? Los montos se recalcularán sin intereses.')) return
    setCondonando(true)
    try {
      const result = await condonarIntereses(id, motivo || 'Pago anticipado')
      addToast(`Intereses condonados: $${Number(result.total_interes_condonado).toLocaleString('es-EC', { minimumFractionDigits: 2 })} en ${result.cuotas_afectadas} cuota(s)`)
      cargar()
    } catch (err) {
      addToast(err.response?.data?.error || 'Error al condonar intereses', 'error')
    } finally {
      setCondonando(false)
    }
  }

  if (loading) return <div className="p-6"><Spinner /></div>
  if (error) return (
    <div className="p-6">
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">{error}</div>
    </div>
  )
  if (!data) return null

  const { contrato, productos, cuotas, recibos, resumen } = data

  return (
    <>
    <div className="p-6 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb items={[
        { label: 'Ventas', to: '/ventas' },
        { label: `Contrato ${contrato.numero_contrato || ''}` },
      ]} />

      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 font-mono">{contrato.numero_contrato}</h1>
          <p className="text-sm text-gray-500">{contrato.nombres} {contrato.apellidos}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => navigate(`/ventas/${id}/imprimir`)}
            className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 text-sm flex items-center gap-1.5"
          >
            🖨️ Imprimir contrato
          </button>
          <button
            onClick={() => navigate(`/ventas/${id}/acta-entrega`)}
            className="border border-teal-400 text-teal-700 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5"
          >
            📄 Acta de Entrega
          </button>
          {/* Botón Caída en Mesa — para hostess/confirmador/consultor solo contratos de hoy */}
          {['hostess','confirmador','consultor','admin','director'].includes(usuario?.rol) &&
           contrato.estado === 'activo' &&
           new Date(contrato.fecha_contrato).toISOString().split('T')[0] === new Date().toISOString().split('T')[0] && (
            <button
              disabled={cambiandoEstado}
              onClick={handleAnularContrato}
              className="border border-red-400 text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg text-sm disabled:opacity-60 flex items-center gap-1"
            >
              🚫 Caída en Mesa
            </button>
          )}

          {/* Botón Refinanciar — solo admin/director/asesor_cartera, contrato activo sin refinanciación previa */}
          {['admin','director','asesor_cartera'].includes(usuario?.rol) &&
           contrato.estado === 'activo' && (
            <button
              onClick={() => {
                const cuotas = prompt('¿Cuántas cuotas nuevas? (ej: 6)')
                const fecha = prompt('Fecha primer pago nueva (YYYY-MM-DD):')
                if (!cuotas || !fecha) return
                client.post(`/api/cartera/refinanciar/${id}`, {
                  n_cuotas_nuevas: Number(cuotas),
                  fecha_primer_pago: fecha,
                  motivo: 'Refinanciación solicitada por el cliente'
                }).then(() => {
                  alert('Contrato refinanciado exitosamente')
                  cargar()
                }).catch(err => alert(err.response?.data?.error || 'Error al refinanciar'))
              }}
              className="border border-blue-400 text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-sm flex items-center gap-1"
            >
              🔄 Refinanciar
            </button>
          )}

          {/* Botones de cambio de estado — solo admin/director */}
          {['admin','director'].includes(usuario?.rol) && (
            <div className="flex items-center gap-2">
              {contrato.estado === 'activo' && (
                <>
                  <button
                    disabled={cambiandoEstado}
                    onClick={() => handleCambiarEstado('suspendido')}
                    className="border border-yellow-400 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 px-3 py-1.5 rounded-lg text-sm disabled:opacity-60"
                  >
                    ⏸ Suspender
                  </button>
                  <button
                    disabled={cambiandoEstado}
                    onClick={() => handleCambiarEstado('cancelado')}
                    className="border border-red-400 text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg text-sm disabled:opacity-60"
                  >
                    ✕ Anular
                  </button>
                </>
              )}
              {contrato.estado === 'suspendido' && (
                <>
                  <button
                    disabled={cambiandoEstado}
                    onClick={() => handleCambiarEstado('activo')}
                    className="border border-green-400 text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg text-sm disabled:opacity-60"
                  >
                    ▶ Reactivar
                  </button>
                  <button
                    disabled={cambiandoEstado}
                    onClick={() => handleCambiarEstado('cancelado')}
                    className="border border-red-400 text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg text-sm disabled:opacity-60"
                  >
                    ✕ Anular
                  </button>
                </>
              )}
              {['cancelado','completado','inactivo'].includes(contrato.estado) && (
                <button
                  disabled={cambiandoEstado}
                  onClick={() => handleCambiarEstado('activo')}
                  className="border border-green-400 text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg text-sm disabled:opacity-60"
                >
                  ▶ Reactivar
                </button>
              )}
            </div>
          )}
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
            contrato.estado === 'activo' ? 'bg-green-100 text-green-700' :
            contrato.estado === 'completado' ? 'bg-blue-100 text-blue-700' :
            contrato.estado === 'suspendido' ? 'bg-yellow-100 text-yellow-700' :
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
                ].map(f => (
                  <div key={f.label} className="flex gap-3">
                    <span className="text-xs font-medium text-gray-400 w-36 shrink-0">{f.label}</span>
                    <span className="text-sm text-gray-800">{f.value || '—'}</span>
                  </div>
                ))}
                {/* Notas / Observaciones editables */}
                <div className="pt-3 border-t border-gray-100">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Observaciones / Notas del contrato
                  </label>
                  {['admin','director','consultor','hostess'].includes(usuario?.rol) ? (
                    <form onSubmit={handleGuardarNotas} className="space-y-2">
                      <textarea
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                        placeholder="Agregar notas sobre el contrato..."
                        value={notasEdit}
                        onChange={e => setNotasEdit(e.target.value)}
                      />
                      <div className="flex items-center gap-3">
                        <button
                          type="submit"
                          disabled={guardandoNotas}
                          className="bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
                        >
                          {guardandoNotas ? 'Guardando...' : '💾 Guardar notas'}
                        </button>
                        {notasMsg && <span className="text-sm text-gray-600">{notasMsg}</span>}
                      </div>
                    </form>
                  ) : (
                    <p className="text-sm text-gray-700">{contrato.observaciones || '—'}</p>
                  )}
                </div>
              </div>

              {/* Firma del cliente */}
              {contrato.firma_cliente && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">✍️ Firma del cliente</p>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 inline-block">
                    <img
                      src={contrato.firma_cliente}
                      alt="Firma del cliente"
                      className="max-h-28 max-w-xs"
                      style={{ imageRendering: 'crisp-edges' }}
                    />
                  </div>
                </div>
              )}
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
                        {(() => {
                          const cantTotal = parseInt(p.cantidad) || 1
                          const cantDesp = parseInt(p.cantidad_despachada) || 0
                          const pendiente = cantTotal - cantDesp
                          if (p.despacho_estado === 'despachado' || pendiente <= 0) {
                            return <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">✅ Despachado ({cantDesp}/{cantTotal})</span>
                          }
                          if (p.despacho_estado === 'parcial') {
                            return (
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Parcial {cantDesp}/{cantTotal}</span>
                                {['admin', 'director', 'inventario'].includes(usuario?.rol) && (
                                  <button disabled={despachando.has(p.id)} onClick={() => handleDespachar(p.id)}
                                    className="text-xs px-2 py-0.5 bg-teal-600 hover:bg-teal-700 text-white rounded-full disabled:opacity-60 font-medium">
                                    {despachando.has(p.id) ? '...' : `📦 Despachar (${pendiente})`}
                                  </button>
                                )}
                              </div>
                            )
                          }
                          return ['admin', 'director', 'inventario'].includes(usuario?.rol) ? (
                            <button disabled={despachando.has(p.id)} onClick={() => handleDespachar(p.id)}
                              className="text-xs px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-full disabled:opacity-60 font-medium">
                              {despachando.has(p.id) ? '...' : `📦 Despachar${cantTotal > 1 ? ` (${cantTotal})` : ''}`}
                            </button>
                          ) : (
                            <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">⏳ Pendiente</span>
                          )
                        })()}
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
              <div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-center px-4 py-3 text-gray-600">Cuota</th>
                    <th className="text-right px-4 py-3 text-gray-600">Capital</th>
                    <th className="text-right px-4 py-3 text-gray-600">Interes</th>
                    <th className="text-right px-4 py-3 text-gray-600">Total</th>
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
                    const tieneInteres = parseFloat(q.monto_interes || 0) > 0
                    const montoCapital = parseFloat(q.monto_esperado) - parseFloat(q.monto_interes || 0)
                    return (
                      <tr key={q.id} className={`border-b border-gray-50 hover:bg-gray-50 ${isVencida ? 'bg-red-50/30' : ''} ${tieneInteres ? 'bg-amber-50/30' : ''}`}>
                        <td className="px-4 py-3 text-center text-gray-600">#{q.numero_cuota}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmt(montoCapital)}</td>
                        <td className="px-4 py-3 text-right">
                          {tieneInteres ? (
                            <span className="text-amber-600 font-medium">{fmt(q.monto_interes)}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{fmt(q.monto_esperado)}</td>
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
                            {q.estado === 'pagado' ? 'Pagado' :
                             q.estado === 'parcial' ? 'Parcial' :
                             isVencida ? 'Vencida' : 'Pendiente'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {cuotas.some(q => parseFloat(q.monto_interes || 0) > 0) && (
                <div className="px-4 py-3 bg-amber-50 border-t border-amber-200 text-xs text-amber-700 flex items-center justify-between flex-wrap gap-2">
                  <span>
                    <strong>Nota:</strong> Las cuotas resaltadas incluyen interes del {contrato.tasa_interes || 1.5}% mensual (aplicado a partir de la 4ta cuota).
                  </span>
                  {['admin','director','asesor_cartera','sac'].includes(usuario?.rol) &&
                   contrato.estado === 'activo' &&
                   cuotas.some(q => q.estado !== 'pagado' && parseFloat(q.monto_interes || 0) > 0) && (
                    <button
                      disabled={condonando}
                      onClick={handleCondonarIntereses}
                      className="bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap"
                    >
                      {condonando ? 'Procesando...' : 'Condonar intereses (pago anticipado)'}
                    </button>
                  )}
                </div>
              )}
              </div>
            )
          )}

          {/* TAB: Pagos (Recibos) */}
          {tab === 'pagos' && (
            <div className="space-y-4">
              {/* Header con botón */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {recibos.length} pago{recibos.length !== 1 ? 's' : ''} registrado{recibos.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => setMostrarPago(true)}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  + Registrar Pago
                </button>
              </div>

              {recibos.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <div className="text-4xl mb-3">💰</div>
                  <p>Sin pagos registrados aún</p>
                  <p className="text-sm mt-1">Haz clic en "+ Registrar Pago" para comenzar</p>
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
                      <th className="px-4 py-3"></th>
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
                        <td className="px-4 py-3 text-center">
                          {['admin', 'director'].includes(usuario?.rol) && r.estado === 'activo' && (
                            <button
                              onClick={() => handleAnularRecibo(r.id)}
                              className="text-red-400 hover:text-red-600 text-xs font-medium"
                            >
                              Anular
                            </button>
                          )}
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

    {/* TAB: Documentos */}
    {tab === 'documentos' && <TabDocumentos contratoId={id} />}

    {/* ── Drawer: Registrar Pago ── */}
    {mostrarPago && (
      <>
        <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setMostrarPago(false)} />
        <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white sticky top-0">
            <div>
              <h2 className="font-bold text-gray-800 text-lg">Registrar Pago</h2>
              <p className="text-xs text-gray-400">{contrato.numero_contrato} · {contrato.nombres} {contrato.apellidos}</p>
            </div>
            <button onClick={() => setMostrarPago(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <form id="form-pago" onSubmit={handleGuardarPago} className="space-y-4">

              {/* Info saldo */}
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-sm">
                <div className="flex justify-between">
                  <span className="text-teal-700">Saldo pendiente:</span>
                  <span className="font-bold text-teal-800">{fmt(resumen.saldo_pendiente)}</span>
                </div>
              </div>

              {/* Cuota */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Cuota a pagar</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  value={pago.cuota_id}
                  onChange={e => {
                    const cuotaId = e.target.value
                    const cuota = cuotas.find(q => String(q.id) === cuotaId)
                    const saldoCuota = cuota ? (parseFloat(cuota.monto_esperado) - parseFloat(cuota.monto_pagado || 0)).toFixed(2) : ''
                    setPago(p => ({ ...p, cuota_id: cuotaId, valor: saldoCuota || p.valor }))
                  }}
                >
                  <option value="">💸 Pago libre (sin asignar cuota)</option>
                  {cuotas
                    .filter(q => q.estado !== 'pagado')
                    .map(q => {
                      const saldo = (parseFloat(q.monto_esperado) - parseFloat(q.monto_pagado || 0)).toFixed(2)
                      return (
                        <option key={q.id} value={q.id}>
                          Cuota #{q.numero_cuota} — Saldo: ${saldo} ({q.estado})
                        </option>
                      )
                    })
                  }
                </select>
              </div>

              {/* Monto */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Monto *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input required type="number" min="0.01" step="0.01"
                    className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="0.00"
                    value={pago.valor}
                    onChange={e => setPago(p => ({ ...p, valor: e.target.value }))} />
                </div>
              </div>

              {/* Forma de pago */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Forma de pago</label>
                <select
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  value={pago.forma_pago_id}
                  onChange={e => setPago(p => ({ ...p, forma_pago_id: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {formasPago.map(fp => <option key={fp.id} value={fp.id}>{fp.nombre}</option>)}
                </select>
              </div>

              {/* Fecha */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Fecha de pago</label>
                <input type="date"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  value={pago.fecha_pago}
                  onChange={e => setPago(p => ({ ...p, fecha_pago: e.target.value }))} />
              </div>

              {/* Referencia */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Referencia <span className="font-normal text-gray-400">(opcional)</span></label>
                <input type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="N° transferencia, cheque, etc."
                  value={pago.referencia_pago}
                  onChange={e => setPago(p => ({ ...p, referencia_pago: e.target.value }))} />
              </div>

              {/* Observación */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Observación <span className="font-normal text-gray-400">(opcional)</span></label>
                <textarea rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                  placeholder="Notas sobre el pago..."
                  value={pago.observacion}
                  onChange={e => setPago(p => ({ ...p, observacion: e.target.value }))} />
              </div>

              {/* Comprobante de pago */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Comprobante de pago <span className="font-normal text-gray-400">(PDF o imagen, max 5MB)</span></label>
                <div className="flex items-center gap-2">
                  <label className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer border transition-colors
                    ${comprobante ? 'bg-green-50 border-green-300 text-green-700' : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'}`}>
                    {comprobante ? '✅ Archivo adjunto' : '📎 Adjuntar comprobante'}
                    <input ref={comprobanteRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleComprobanteChange} />
                  </label>
                  {comprobanteNombre && (
                    <span className="text-xs text-gray-500 truncate max-w-[180px]">{comprobanteNombre}</span>
                  )}
                  {comprobante && (
                    <button type="button" onClick={() => { setComprobante(null); setComprobanteNombre(''); if (comprobanteRef.current) comprobanteRef.current.value = '' }}
                      className="text-red-400 hover:text-red-600 text-xs">Quitar</button>
                  )}
                </div>
              </div>

              {errorPago && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">⚠️ {errorPago}</div>
              )}
            </form>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex gap-3 bg-white">
            <button type="button" onClick={() => setMostrarPago(false)}
              className="flex-1 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" form="form-pago" disabled={guardandoPago}
              className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg text-sm font-medium">
              {guardandoPago ? 'Guardando...' : '✓ Registrar Pago'}
            </button>
          </div>
        </div>
      </>
    )}
    </>
  )
}
