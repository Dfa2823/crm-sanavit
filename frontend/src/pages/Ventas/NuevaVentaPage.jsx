import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { createVenta } from '../../api/ventas'
import { apiPersonas } from '../../api/personas'
import { getProductos } from '../../api/productos'
import { getSalas, getUsuarios, getFormasPago } from '../../api/admin'
import { getEmpresas } from '../../api/outsourcing'
import SignatureCanvas from 'react-signature-canvas'

function fmt(val) {
  if (!val && val !== 0) return '$0.00'
  return `$${Number(val).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function NuevaVentaPage() {
  const { usuario } = useAuth()
  const navigate = useNavigate()

  // ── Config data ──────────────────────────────────────────
  const [salas, setSalas]           = useState([])
  const [usuarios, setUsuarios]     = useState([])
  const [formasPago, setFormasPago] = useState([])
  const [empresas, setEmpresas]     = useState([])
  const [catalogo, setCatalogo]     = useState([])

  // ── Sección 1: Cliente ────────────────────────────────────
  const [modoBusqueda, setModoBusqueda]         = useState('telefono') // 'telefono' | 'cedula' | 'nombre'
  const [busqueda, setBusqueda]                 = useState('')
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]) // para modo nombre
  const [personaEncontrada, setPersonaEncontrada] = useState(null)
  const [buscando, setBuscando]                 = useState(false)
  const [nuevaPersona, setNuevaPersona]         = useState({
    nombres: '', apellidos: '', ciudad: '', email: '',
  })

  // ── Sección 2: Contrato ───────────────────────────────────
  const [contrato, setContrato] = useState({
    sala_id: usuario?.sala_id || '',
    consultor_id: (usuario?.rol === 'consultor' ? usuario?.id : '') || '',
    tipo_plan: 'mensual',
    segunda_venta: false,
    sac_asesor_id: '',
    outsourcing_empresa_id: '',
    observaciones: '',
  })

  // ── Sección 3: Productos ──────────────────────────────────
  const [carrito, setCarrito] = useState([])   // [{ producto_id, codigo, nombre, cantidad, precio_unitario }]

  // ── Sección 4: Plan de pago ───────────────────────────────
  const [plan, setPlan] = useState({
    monto_total: '',
    cuota_inicial: '0',
    forma_pago_inicial_id: '',
    n_cuotas: '1',
    dia_pago: '1',
    fecha_primer_pago: '',
  })

  // ── Estado UI ─────────────────────────────────────────────
  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState('')
  // Fase 19: Firma digital
  const sigCanvasRef  = useRef(null)
  const [firmaTouched, setFirmaTouched] = useState(false)

  // ── Cargar config al montar ───────────────────────────────
  useEffect(() => {
    Promise.all([
      getSalas(),
      getUsuarios(),
      getFormasPago(),
      getEmpresas(),
      getProductos(),
    ]).then(([s, u, fp, emp, prod]) => {
      setSalas(Array.isArray(s) ? s : [])
      setUsuarios(Array.isArray(u) ? u : [])
      setFormasPago(Array.isArray(fp) ? fp.filter(f => f.activo) : [])
      setEmpresas(Array.isArray(emp) ? emp : [])
      setCatalogo(Array.isArray(prod) ? prod.filter(p => p.activo) : [])
    }).catch(console.error)
  }, [])

  // ── Total automático desde carrito ───────────────────────
  const totalCarrito = carrito.reduce(
    (sum, item) => sum + (Number(item.precio_unitario) * Number(item.cantidad)),
    0
  )

  // Sincronizar monto_total con carrito cuando cambia
  useEffect(() => {
    if (carrito.length > 0) {
      setPlan(p => ({ ...p, monto_total: totalCarrito.toFixed(2) }))
    }
  }, [totalCarrito])

  // Resetear búsqueda al cambiar modo
  useEffect(() => {
    setBusqueda('')
    setPersonaEncontrada(null)
    setResultadosBusqueda([])
  }, [modoBusqueda])

  // ── Buscar persona (debounce, multi-modo) ─────────────────
  useEffect(() => {
    const minLen = modoBusqueda === 'nombre' ? 3 : 6
    if (busqueda.length < minLen) {
      setPersonaEncontrada(null)
      setResultadosBusqueda([])
      return
    }
    const timer = setTimeout(async () => {
      setBuscando(true)
      try {
        const res = await apiPersonas.buscar(busqueda)
        if (modoBusqueda === 'nombre') {
          setResultadosBusqueda(res)
          setPersonaEncontrada(null)
        } else if (modoBusqueda === 'telefono') {
          const exacto = res.find(p => p.telefono === busqueda || p.telefono2 === busqueda)
          setPersonaEncontrada(exacto || null)
          setResultadosBusqueda([])
        } else { // cedula
          const exacto = res.find(p => p.num_documento === busqueda)
          setPersonaEncontrada(exacto || null)
          setResultadosBusqueda([])
        }
      } finally { setBuscando(false) }
    }, 500)
    return () => clearTimeout(timer)
  }, [busqueda, modoBusqueda])

  // ── Gestión del carrito ───────────────────────────────────
  function agregarProducto(prod) {
    setCarrito(prev => {
      const existe = prev.find(i => i.producto_id === prod.id)
      if (existe) {
        return prev.map(i =>
          i.producto_id === prod.id ? { ...i, cantidad: i.cantidad + 1 } : i
        )
      }
      return [...prev, {
        producto_id: prod.id,
        codigo: prod.codigo,
        nombre: prod.nombre,
        cantidad: 1,
        precio_unitario: prod.precio_venta || 0,
      }]
    })
  }

  function quitarProducto(producto_id) {
    setCarrito(prev => prev.filter(i => i.producto_id !== producto_id))
  }

  function actualizarCarrito(producto_id, campo, valor) {
    setCarrito(prev => prev.map(i =>
      i.producto_id === producto_id ? { ...i, [campo]: valor } : i
    ))
  }

  // ── Consultores del sala seleccionada ─────────────────────
  const consultores = usuarios.filter(u =>
    u.rol === 'consultor' &&
    (!contrato.sala_id || String(u.sala_id) === String(contrato.sala_id))
  )

  // ── Fecha primer pago default (hoy + 1 mes) ───────────────
  const fechaDefaultPrimerPago = (() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    return d.toISOString().split('T')[0]
  })()

  // ── Submit ────────────────────────────────────────────────
  async function handleGuardar(e) {
    e.preventDefault()
    setError('')

    if (!busqueda && !personaEncontrada) {
      setError('Busca al cliente por teléfono, cédula o nombre')
      return
    }

    setGuardando(true)
    try {
      let persona_id = personaEncontrada?.id

      if (!persona_id) {
        if (!nuevaPersona.nombres.trim()) {
          setError('El nombre del cliente es obligatorio')
          setGuardando(false)
          return
        }
        // Solo creamos persona nueva cuando buscamos por teléfono
        if (modoBusqueda !== 'telefono') {
          setError('Para crear un cliente nuevo, usa la búsqueda por teléfono')
          setGuardando(false)
          return
        }
        const p = await apiPersonas.crear({
          nombres: nuevaPersona.nombres,
          apellidos: nuevaPersona.apellidos,
          telefono: busqueda,
          ciudad: nuevaPersona.ciudad,
          email: nuevaPersona.email,
        })
        persona_id = p.id
      }

      const montoTotal = Number(plan.monto_total) || 0
      const cuotaInicial = Number(plan.cuota_inicial) || 0
      const valorFinanciado = montoTotal - cuotaInicial

      // Capturar firma si se dibujó
      let firma_cliente = undefined
      if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
        firma_cliente = sigCanvasRef.current.getTrimmedCanvas().toDataURL('image/png')
      }

      const payload = {
        persona_id,
        sala_id: contrato.sala_id || undefined,
        consultor_id: contrato.consultor_id || undefined,
        tipo_plan: contrato.tipo_plan,
        segunda_venta: contrato.segunda_venta,
        sac_asesor_id: contrato.sac_asesor_id || undefined,
        outsourcing_empresa_id: contrato.outsourcing_empresa_id || undefined,
        observaciones: contrato.observaciones || undefined,
        monto_total: montoTotal,
        cuota_inicial: cuotaInicial,
        valor_financiado: valorFinanciado,
        forma_pago_inicial_id: plan.forma_pago_inicial_id || undefined,
        n_cuotas: contrato.tipo_plan !== 'pago_unico' ? Number(plan.n_cuotas) || 1 : 1,
        dia_pago: contrato.tipo_plan !== 'pago_unico' ? Number(plan.dia_pago) || 1 : undefined,
        fecha_primer_pago: contrato.tipo_plan !== 'pago_unico' ? plan.fecha_primer_pago || fechaDefaultPrimerPago : undefined,
        firma_cliente,
        productos: carrito.map(i => ({
          producto_id: i.producto_id,
          cantidad: Number(i.cantidad),
          precio_unitario: Number(i.precio_unitario),
        })),
      }

      const res = await createVenta(payload)
      navigate(`/ventas/${res.contrato.id}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear la venta')
    } finally {
      setGuardando(false)
    }
  }

  const ciudadesEcuador = ['Quito', 'Guayaquil', 'Manta', 'Cuenca', 'Ambato', 'Loja', 'Ibarra', 'Esmeraldas']
  const diasPago = Array.from({ length: 28 }, (_, i) => i + 1)

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/ventas')} className="text-gray-400 hover:text-gray-600 text-lg">←</button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Nueva Venta</h1>
          <p className="text-sm text-gray-500">Registrar nuevo contrato</p>
        </div>
      </div>

      <form onSubmit={handleGuardar} className="space-y-6">

        {/* ── SECCIÓN 1: Cliente ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-teal-500 text-white text-xs flex items-center justify-center font-bold">1</span>
            Cliente
          </h2>

          {/* Selector de modo de búsqueda */}
          <div className="flex gap-2">
            {[
              { key: 'telefono', label: '📱 Teléfono' },
              { key: 'cedula',   label: '🪪 Cédula' },
              { key: 'nombre',   label: '👤 Nombre' },
            ].map(m => (
              <button
                key={m.key}
                type="button"
                onClick={() => setModoBusqueda(m.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  modoBusqueda === m.key
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-teal-400'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              {modoBusqueda === 'telefono' ? 'Número de teléfono' :
               modoBusqueda === 'cedula'   ? 'N° de cédula / documento' :
               'Nombre o apellido del cliente'}
            </label>
            <div className="relative max-w-sm">
              <input
                type={modoBusqueda === 'telefono' ? 'tel' : 'text'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 pr-10"
                placeholder={
                  modoBusqueda === 'telefono' ? '09XXXXXXXX' :
                  modoBusqueda === 'cedula'   ? '0900000000' :
                  'Ej: García, María...'
                }
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
              {buscando && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <span className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin block" />
                </span>
              )}
            </div>

            {/* Dropdown para modo nombre */}
            {modoBusqueda === 'nombre' && resultadosBusqueda.length > 0 && !personaEncontrada && (
              <div className="absolute z-10 mt-1 max-w-sm w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {resultadosBusqueda.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setPersonaEncontrada(p); setResultadosBusqueda([]) }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-teal-50 border-b border-gray-50 last:border-0"
                  >
                    <span className="font-medium text-gray-800">{p.nombres} {p.apellidos}</span>
                    <span className="text-gray-400 ml-2 text-xs">{p.telefono} · {p.ciudad || '—'}</span>
                  </button>
                ))}
              </div>
            )}
            {modoBusqueda === 'nombre' && busqueda.length >= 3 && !buscando && resultadosBusqueda.length === 0 && !personaEncontrada && (
              <p className="text-xs text-gray-400 mt-1">Sin resultados para "{busqueda}"</p>
            )}
          </div>

          {personaEncontrada && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg max-w-sm flex items-start justify-between gap-2">
              <div>
                <p className="text-green-800 text-sm font-medium">
                  ✅ {personaEncontrada.nombres} {personaEncontrada.apellidos}
                </p>
                <p className="text-green-600 text-xs mt-0.5">{personaEncontrada.telefono} · {personaEncontrada.ciudad} · {personaEncontrada.email || 'Sin email'}</p>
              </div>
              <button type="button" onClick={() => { setPersonaEncontrada(null); setBusqueda('') }}
                className="text-green-400 hover:text-green-600 text-xs mt-0.5 shrink-0">Cambiar</button>
            </div>
          )}

          {!personaEncontrada && modoBusqueda === 'telefono' && busqueda.length >= 7 && !buscando && (
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
              <p className="col-span-2 text-xs text-blue-600 font-medium">Cliente nuevo — completar datos:</p>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nombres *</label>
                <input required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  value={nuevaPersona.nombres}
                  onChange={e => setNuevaPersona(p => ({ ...p, nombres: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Apellidos</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  value={nuevaPersona.apellidos}
                  onChange={e => setNuevaPersona(p => ({ ...p, apellidos: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Ciudad</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  value={nuevaPersona.ciudad}
                  onChange={e => setNuevaPersona(p => ({ ...p, ciudad: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {ciudadesEcuador.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  value={nuevaPersona.email}
                  onChange={e => setNuevaPersona(p => ({ ...p, email: e.target.value }))} />
              </div>
            </div>
          )}
        </div>

        {/* ── SECCIÓN 2: Contrato ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-teal-500 text-white text-xs flex items-center justify-center font-bold">2</span>
            Datos del Contrato
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Sala</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={contrato.sala_id}
                onChange={e => setContrato(c => ({ ...c, sala_id: e.target.value, consultor_id: '' }))}>
                <option value="">Seleccionar sala...</option>
                {salas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Consultor</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={contrato.consultor_id}
                onChange={e => setContrato(c => ({ ...c, consultor_id: e.target.value }))}>
                <option value="">Sin asignar</option>
                {consultores.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de plan</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={contrato.tipo_plan}
                onChange={e => setContrato(c => ({ ...c, tipo_plan: e.target.value }))}>
                <option value="mensual">Mensual</option>
                <option value="trimestral">Trimestral</option>
                <option value="anual">Anual</option>
                <option value="pago_unico">Pago único</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Outsourcing <span className="font-normal text-gray-400">(opcional)</span></label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={contrato.outsourcing_empresa_id}
                onChange={e => setContrato(c => ({ ...c, outsourcing_empresa_id: e.target.value }))}>
                <option value="">Ninguno</option>
                {empresas.map(emp => <option key={emp.id} value={emp.id}>{emp.nombre}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input type="checkbox" id="segunda_venta" className="w-4 h-4 accent-teal-600"
              checked={contrato.segunda_venta}
              onChange={e => setContrato(c => ({ ...c, segunda_venta: e.target.checked, sac_asesor_id: '' }))} />
            <label htmlFor="segunda_venta" className="text-sm text-gray-700">Segunda venta (cliente ya tenía contrato previo)</label>
          </div>

          {contrato.segunda_venta && (
            <div className="max-w-sm">
              <label className="block text-xs font-medium text-gray-500 mb-1">Asesor SAC que gestionó la renovación</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={contrato.sac_asesor_id}
                onChange={e => setContrato(c => ({ ...c, sac_asesor_id: e.target.value }))}>
                <option value="">Sin asesor asignado</option>
                {usuarios
                  .filter(u => ['sac', 'asesor_cartera', 'confirmador'].includes(u.rol))
                  .map(u => <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>)
                }
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Observaciones</label>
            <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="Notas internas sobre el contrato..."
              value={contrato.observaciones}
              onChange={e => setContrato(c => ({ ...c, observaciones: e.target.value }))} />
          </div>
        </div>

        {/* ── SECCIÓN 3: Productos ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-teal-500 text-white text-xs flex items-center justify-center font-bold">3</span>
            Productos / Servicios
            <span className="text-xs text-gray-400 font-normal ml-auto">Opcional — también puedes ingresar el monto total manualmente</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Catálogo */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Catálogo disponible</p>
              <div className="space-y-1 max-h-52 overflow-y-auto border border-gray-100 rounded-lg p-2">
                {catalogo.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">Cargando catálogo...</p>
                ) : catalogo.map(prod => (
                  <div key={prod.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 group">
                    <div>
                      <span className="text-xs font-mono text-gray-400 mr-2">{prod.codigo}</span>
                      <span className="text-sm text-gray-800">{prod.nombre}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{fmt(prod.precio_venta)}</span>
                      <button type="button"
                        onClick={() => agregarProducto(prod)}
                        className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 hover:bg-teal-500 hover:text-white text-sm font-bold flex items-center justify-center transition-colors">
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Carrito */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Productos seleccionados</p>
              {carrito.length === 0 ? (
                <div className="border border-dashed border-gray-200 rounded-lg p-6 text-center text-gray-400 text-sm">
                  Haz clic en "+" para agregar productos
                </div>
              ) : (
                <div className="space-y-2">
                  {carrito.map(item => (
                    <div key={item.producto_id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{item.nombre}</p>
                      </div>
                      <input type="number" min="1"
                        className="w-12 border border-gray-300 rounded px-1 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-teal-500"
                        value={item.cantidad}
                        onChange={e => actualizarCarrito(item.producto_id, 'cantidad', e.target.value)} />
                      <input type="number" min="0" step="0.01"
                        className="w-20 border border-gray-300 rounded px-1 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-teal-500"
                        value={item.precio_unitario}
                        onChange={e => actualizarCarrito(item.producto_id, 'precio_unitario', e.target.value)} />
                      <button type="button" onClick={() => quitarProducto(item.producto_id)}
                        className="text-red-400 hover:text-red-600 text-xs font-bold w-5 shrink-0">×</button>
                    </div>
                  ))}
                  <div className="flex justify-between items-center px-2 pt-2 border-t border-gray-200">
                    <span className="text-xs font-medium text-gray-500">Total productos:</span>
                    <span className="text-sm font-bold text-teal-700">{fmt(totalCarrito)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── SECCIÓN 4: Plan de pago ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-teal-500 text-white text-xs flex items-center justify-center font-bold">4</span>
            Plan de Pago
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Monto total *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input required type="number" min="0" step="0.01"
                  className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="0.00"
                  value={plan.monto_total}
                  onChange={e => setPlan(p => ({ ...p, monto_total: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Cuota inicial</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" min="0" step="0.01"
                  className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="0.00"
                  value={plan.cuota_inicial}
                  onChange={e => setPlan(p => ({ ...p, cuota_inicial: e.target.value }))} />
              </div>
            </div>

            {Number(plan.cuota_inicial) > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Forma de pago inicial</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  value={plan.forma_pago_inicial_id}
                  onChange={e => setPlan(p => ({ ...p, forma_pago_inicial_id: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {formasPago.map(fp => <option key={fp.id} value={fp.id}>{fp.nombre}</option>)}
                </select>
              </div>
            )}
          </div>

          {contrato.tipo_plan !== 'pago_unico' && (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs font-medium text-teal-700 mb-3">📅 Cuotas del plan</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">N° de cuotas</label>
                  <input type="number" min="1" max="60"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    value={plan.n_cuotas}
                    onChange={e => setPlan(p => ({ ...p, n_cuotas: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Día de pago</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    value={plan.dia_pago}
                    onChange={e => setPlan(p => ({ ...p, dia_pago: e.target.value }))}>
                    {diasPago.map(d => <option key={d} value={d}>Día {d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Primer pago</label>
                  <input type="date"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    value={plan.fecha_primer_pago || fechaDefaultPrimerPago}
                    onChange={e => setPlan(p => ({ ...p, fecha_primer_pago: e.target.value }))} />
                </div>
              </div>

              {/* Preview cuotas */}
              {Number(plan.monto_total) > 0 && Number(plan.n_cuotas) > 0 && (
                <div className="mt-3 p-3 bg-teal-50 rounded-lg">
                  <p className="text-xs text-teal-700">
                    💡 <strong>{plan.n_cuotas} cuotas</strong> de{' '}
                    <strong>
                      {fmt((Number(plan.monto_total) - Number(plan.cuota_inicial || 0)) / Number(plan.n_cuotas))}
                    </strong>
                    {' '}cada una · Valor financiado: {fmt(Number(plan.monto_total) - Number(plan.cuota_inicial || 0))}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── SECCIÓN 5: Firma del cliente ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
          <h2 className="font-semibold text-gray-700 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-teal-500 text-white text-xs flex items-center justify-center font-bold">5</span>
            Firma del Cliente
            <span className="text-xs font-normal text-gray-400">(opcional)</span>
          </h2>
          <p className="text-xs text-gray-500">El cliente puede firmar directamente en pantalla o con tablet/stylus.</p>
          <div className="relative border-2 border-dashed border-gray-200 rounded-xl overflow-hidden bg-gray-50"
            style={{ touchAction: 'none' }}>
            <SignatureCanvas
              ref={sigCanvasRef}
              penColor="#0f766e"
              canvasProps={{ width: 600, height: 180, className: 'w-full' }}
              onEnd={() => setFirmaTouched(true)}
            />
            {!firmaTouched && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-gray-300 text-sm">✍️ Firmar aquí</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { sigCanvasRef.current?.clear(); setFirmaTouched(false) }}
              className="text-xs text-gray-500 hover:text-red-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-red-300 transition-colors"
            >
              🗑️ Limpiar firma
            </button>
            {firmaTouched && (
              <span className="text-xs text-teal-600 font-medium">✅ Firma capturada</span>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex justify-between">
            ⚠️ {error}
            <button type="button" onClick={() => setError('')} className="text-red-400 hover:text-red-600 ml-2">×</button>
          </div>
        )}

        {/* Botones */}
        <div className="flex gap-3 justify-end pb-6">
          <button type="button" onClick={() => navigate('/ventas')}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
            Cancelar
          </button>
          <button type="submit" disabled={guardando}
            className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium">
            {guardando ? 'Guardando...' : '✓ Guardar Contrato'}
          </button>
        </div>

      </form>
    </div>
  )
}
