import { useState, useEffect, useCallback } from 'react'
import { getStock, getMovimientos, registrarMovimiento, crearProducto, actualizarProducto } from '../../api/inventario'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

// Helpers

function fmt(val) {
  if (val === null || val === undefined || val === '') return '--'
  return `$${Number(val).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fechaHoy() {
  return new Date().toISOString().split('T')[0]
}

function formatFecha(f) {
  if (!f) return '--'
  return new Date(f).toLocaleDateString('es-EC', { timeZone: 'UTC' })
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function BadgeTipo({ tipo }) {
  const cfg = {
    entrada: 'bg-green-100 text-green-700',
    salida:  'bg-red-100 text-red-700',
    ajuste:  'bg-blue-100 text-blue-700',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${cfg[tipo] || 'bg-gray-100 text-gray-600'}`}>
      {tipo}
    </span>
  )
}

function BadgeStock({ stock }) {
  if (stock === 0)  return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700">Sin stock</span>
  if (stock <= 10)  return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-orange-100 text-orange-700">Bajo</span>
  return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700">OK</span>
}

function colorStock(stock) {
  if (stock === 0)  return 'text-red-600 font-bold'
  if (stock <= 10)  return 'text-orange-500 font-semibold'
  return 'text-green-600 font-semibold'
}

function BadgeVencimiento({ fecha }) {
  if (!fecha) return null
  const hoy = new Date()
  const venc = new Date(fecha)
  const diffDias = Math.floor((venc - hoy) / (1000 * 60 * 60 * 24))
  if (diffDias < 0) return <span className="text-xs font-semibold text-red-600 bg-red-50 rounded px-1.5 py-0.5">Vencido</span>
  if (diffDias <= 90) return <span className="text-xs font-semibold text-orange-600 bg-orange-50 rounded px-1.5 py-0.5">Pronto</span>
  return null
}

// Drawer: Crear/Editar Producto (mejorado)

function DrawerProducto({ abierto, onClose, productoEditar, onExito }) {
  const [nombre,           setNombre]           = useState('')
  const [codigo,           setCodigo]           = useState('')
  const [tipo,             setTipo]             = useState('servicio')
  const [descripcion,      setDescripcion]      = useState('')
  const [laboratorio,      setLaboratorio]      = useState('')
  const [lote,             setLote]             = useState('')
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [precioSinIva,     setPrecioSinIva]     = useState('')
  const [ivaPorcentaje,    setIvaPorcentaje]    = useState(15)
  const [tieneIva,         setTieneIva]         = useState(true)
  const [imagenUrl,        setImagenUrl]        = useState('')
  const [activo,           setActivo]           = useState(true)
  const [guardando,        setGuardando]        = useState(false)
  const [error,            setError]            = useState('')

  // Precio con IVA calculado
  const precioSinIvaNum = Number(precioSinIva) || 0
  const precioConIva = tieneIva
    ? Math.round(precioSinIvaNum * (1 + Number(ivaPorcentaje) / 100) * 100) / 100
    : precioSinIvaNum

  useEffect(() => {
    if (abierto) {
      if (productoEditar) {
        setNombre(productoEditar.nombre || '')
        setCodigo(productoEditar.codigo || '')
        setTipo(productoEditar.tipo || 'servicio')
        setDescripcion(productoEditar.descripcion || '')
        setLaboratorio(productoEditar.laboratorio || '')
        setLote(productoEditar.lote || '')
        setFechaVencimiento(productoEditar.fecha_vencimiento ? productoEditar.fecha_vencimiento.split('T')[0] : '')
        setPrecioSinIva(productoEditar.precio_sin_iva != null ? productoEditar.precio_sin_iva : (productoEditar.precio_venta || ''))
        setIvaPorcentaje(productoEditar.iva_porcentaje != null ? productoEditar.iva_porcentaje : 15)
        setTieneIva(productoEditar.tiene_iva !== false)
        setImagenUrl(productoEditar.imagen_url || '')
        setActivo(productoEditar.activo !== false)
      } else {
        setNombre(''); setCodigo(''); setTipo('servicio')
        setDescripcion(''); setLaboratorio(''); setLote('')
        setFechaVencimiento(''); setPrecioSinIva(''); setIvaPorcentaje(15)
        setTieneIva(true); setImagenUrl(''); setActivo(true)
      }
      setError('')
    }
  }, [abierto, productoEditar])

  function handleImageChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setError('La imagen no puede pesar mas de 2 MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setImagenUrl(reader.result)
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nombre.trim()) return setError('El nombre es obligatorio')
    setGuardando(true)
    setError('')
    try {
      const data = {
        nombre: nombre.trim(),
        codigo: codigo || undefined,
        tipo,
        descripcion: descripcion || undefined,
        laboratorio: laboratorio || undefined,
        lote: lote || undefined,
        fecha_vencimiento: fechaVencimiento || undefined,
        precio_sin_iva: precioSinIva !== '' ? Number(precioSinIva) : undefined,
        iva_porcentaje: Number(ivaPorcentaje) || 15,
        tiene_iva: tieneIva,
        precio_venta: precioConIva,
        imagen_url: imagenUrl || undefined,
        activo,
      }
      if (productoEditar) {
        await actualizarProducto(productoEditar.id, data)
      } else {
        await crearProducto(data)
      }
      onExito()
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar producto')
    } finally {
      setGuardando(false)
    }
  }

  if (!abierto) return null

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[440px] bg-white shadow-xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">{productoEditar ? 'Editar Producto' : 'Nuevo Producto'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Nombre */}
          <div>
            <label className={labelCls}>Nombre *</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} required
              placeholder="Ej: Programa Premium"
              className={inputCls} />
          </div>

          {/* Codigo + Tipo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Codigo</label>
              <input value={codigo} onChange={e => setCodigo(e.target.value)}
                placeholder="Ej: PRO-001"
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)} className={inputCls}>
                <option value="servicio">Servicio</option>
                <option value="producto">Producto</option>
                <option value="kit">Kit</option>
                <option value="obsequio">Obsequio</option>
              </select>
            </div>
          </div>

          {/* Laboratorio + Lote */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Laboratorio</label>
              <input value={laboratorio} onChange={e => setLaboratorio(e.target.value)}
                placeholder="Ej: LabVida"
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Lote</label>
              <input value={lote} onChange={e => setLote(e.target.value)}
                placeholder="Ej: LT-2026-03"
                className={inputCls} />
            </div>
          </div>

          {/* Fecha de vencimiento */}
          <div>
            <label className={labelCls}>Fecha de vencimiento</label>
            <input type="date" value={fechaVencimiento} onChange={e => setFechaVencimiento(e.target.value)}
              className={inputCls} />
          </div>

          {/* Separador precios */}
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold uppercase text-gray-500 tracking-wide mb-3">Precios e IVA</p>

            {/* Checkbox Tiene IVA */}
            <div className="flex items-center gap-3 mb-3">
              <input type="checkbox" id="tiene_iva_chk" checked={tieneIva} onChange={e => setTieneIva(e.target.checked)}
                className="w-4 h-4 accent-teal-600" />
              <label htmlFor="tiene_iva_chk" className="text-sm text-gray-700">Producto grava IVA ({ivaPorcentaje}%)</label>
            </div>

            {/* Precio sin IVA */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Precio sin IVA ($)</label>
                <input type="number" min="0" step="0.01" value={precioSinIva}
                  onChange={e => setPrecioSinIva(e.target.value)}
                  placeholder="0.00"
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Precio con IVA ($)</label>
                <div className={`${inputCls} bg-gray-50 text-gray-700 font-semibold`}>
                  {precioSinIva !== '' ? fmt(precioConIva) : '--'}
                </div>
              </div>
            </div>
            {tieneIva && precioSinIva !== '' && (
              <p className="text-xs text-gray-400 mt-1">
                IVA {ivaPorcentaje}%: ${(precioConIva - precioSinIvaNum).toFixed(2)}
              </p>
            )}
          </div>

          {/* Imagen */}
          <div className="border-t border-gray-100 pt-3">
            <label className={labelCls}>Imagen del producto</label>
            <input type="file" accept="image/*" onChange={handleImageChange}
              className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100" />
            {imagenUrl && (
              <div className="mt-2 relative inline-block">
                <img src={imagenUrl} alt="Preview" className="h-20 w-20 object-cover rounded-lg border border-gray-200" />
                <button type="button" onClick={() => setImagenUrl('')}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-600">
                  x
                </button>
              </div>
            )}
          </div>

          {/* Descripcion */}
          <div>
            <label className={labelCls}>Descripcion <span className="font-normal text-gray-400">(opcional)</span></label>
            <textarea rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value)}
              placeholder="Descripcion del producto o servicio..."
              className={inputCls + ' resize-none'} />
          </div>

          {/* Activo (solo editar) */}
          {productoEditar && (
            <div className="flex items-center gap-3">
              <input type="checkbox" id="activo_prod" checked={activo} onChange={e => setActivo(e.target.checked)} className="w-4 h-4 accent-teal-600" />
              <label htmlFor="activo_prod" className="text-sm text-gray-700">Producto activo (visible en catalogo)</label>
            </div>
          )}

          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
        </form>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={guardando}
            className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white rounded-lg py-2.5 text-sm font-medium">
            {guardando ? 'Guardando...' : productoEditar ? 'Actualizar' : 'Crear Producto'}
          </button>
        </div>
      </div>
    </>
  )
}

// Drawer: Registrar Movimiento (solo entradas)

function DrawerMovimiento({ abierto, onClose, productoInicial, stockData, onExito }) {
  const { usuario } = useAuth()

  const [productoId,  setProductoId]  = useState(productoInicial || '')
  const [cantidad,    setCantidad]    = useState('')
  const [motivo,      setMotivo]      = useState('')
  const [referencia,  setReferencia]  = useState('')
  const [fecha,       setFecha]       = useState(fechaHoy())
  const [guardando,   setGuardando]   = useState(false)
  const [error,       setError]       = useState('')

  useEffect(() => {
    if (abierto) {
      setProductoId(productoInicial || '')
      setCantidad('')
      setMotivo('')
      setReferencia('')
      setFecha(fechaHoy())
      setError('')
    }
  }, [abierto, productoInicial])

  const productoActual = stockData.find(p => String(p.id) === String(productoId))
  const stockActual    = productoActual ? productoActual.stock_actual : null
  const cantidadNum    = parseInt(cantidad, 10) || 0
  const stockResultante = stockActual !== null ? stockActual + cantidadNum : null

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!productoId)    return setError('Selecciona un producto')
    if (!cantidadNum || cantidadNum <= 0) return setError('La cantidad debe ser mayor a 0')

    setGuardando(true)
    try {
      await registrarMovimiento({
        producto_id: productoId,
        tipo: 'entrada',
        cantidad: cantidadNum,
        motivo:   motivo   || undefined,
        referencia: referencia || undefined,
        fecha,
      })
      onExito()
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar movimiento')
    } finally {
      setGuardando(false)
    }
  }

  if (!abierto) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">Registrar Entrada</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Producto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Producto</label>
            <select
              value={productoId}
              onChange={e => setProductoId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            >
              <option value="">Seleccionar producto...</option>
              {stockData
                .filter(p => p.activo)
                .map(p => (
                  <option key={p.id} value={p.id}>
                    {p.codigo ? `[${p.codigo}] ` : ''}{p.nombre}
                  </option>
                ))
              }
            </select>
            {productoActual && (
              <p className={`mt-1.5 text-xs font-medium ${colorStock(stockActual)}`}>
                Stock actual: {stockActual} unidades
              </p>
            )}
          </div>

          {/* Tipo de movimiento - solo entrada */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de movimiento</label>
            <div className="border-2 border-green-400 bg-green-50 text-green-700 rounded-lg py-3 text-sm font-semibold text-center shadow-sm">
              <div className="text-base mb-0.5">&#8595;</div>
              Entrada
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Las salidas se realizan automaticamente por el modulo de despacho.</p>
          </div>

          {/* Cantidad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
            <input
              type="number" min="1" step="1" value={cantidad}
              onChange={e => setCantidad(e.target.value)}
              placeholder="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            />
            {productoActual && cantidadNum > 0 && stockResultante !== null && (
              <p className="mt-1.5 text-xs text-gray-500">
                Stock resultante: <span className={colorStock(stockResultante)}>{stockResultante}</span>
              </p>
            )}
          </div>

          {/* Referencia */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Referencia <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input type="text" value={referencia} onChange={e => setReferencia(e.target.value)}
              placeholder="Ej: Compra #001, Factura FV-123"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3}
              placeholder="Describe el motivo del movimiento..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}
        </form>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 transition">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={guardando}
            className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white rounded-lg py-2.5 text-sm font-medium transition">
            {guardando ? 'Guardando...' : 'Registrar Entrada'}
          </button>
        </div>
      </div>
    </>
  )
}

// Pagina principal

export default function InventarioPage() {
  const { usuario } = useAuth()
  const { addToast } = useToast()
  const esPrivilegiado = ['admin', 'director'].includes(usuario?.rol)

  const [tab,        setTab]        = useState('stock')
  const [stock,      setStock]      = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [busqueda,   setBusqueda]   = useState('')

  // Drawer Movimiento
  const [drawerAbierto,          setDrawerAbierto]          = useState(false)
  const [productoSeleccionado,   setProductoSeleccionado]   = useState(null)

  // Drawer Producto (CRUD)
  const [drawerProdAbierto,      setDrawerProdAbierto]      = useState(false)
  const [productoEditar,         setProductoEditar]         = useState(null)

  // Filtros historial
  const [filtroProducto,  setFiltroProducto]  = useState('')
  const [filtroTipo,      setFiltroTipo]      = useState('')
  const [filtroFechaInicio, setFiltroFechaInicio] = useState('')
  const [filtroFechaFin,    setFiltroFechaFin]    = useState('')
  const [cargandoHistorial, setCargandoHistorial] = useState(false)

  // Carga de stock
  const cargarStock = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getStock()
      setStock(Array.isArray(data) ? data : [])
    } catch (err) {
      setError('Error al cargar inventario: ' + (err.response?.data?.error || err.message))
    } finally {
      setLoading(false)
    }
  }, [])

  // Carga de historial
  const cargarHistorial = useCallback(async () => {
    setCargandoHistorial(true)
    try {
      const params = {}
      if (filtroProducto)    params.producto_id  = filtroProducto
      if (filtroTipo)        params.tipo          = filtroTipo
      if (filtroFechaInicio) params.fecha_inicio  = filtroFechaInicio
      if (filtroFechaFin)    params.fecha_fin     = filtroFechaFin

      const data = await getMovimientos(params)
      setMovimientos(Array.isArray(data) ? data : [])
    } catch (err) {
      setError('Error al cargar historial: ' + (err.response?.data?.error || err.message))
    } finally {
      setCargandoHistorial(false)
    }
  }, [filtroProducto, filtroTipo, filtroFechaInicio, filtroFechaFin])

  useEffect(() => { cargarStock() }, [cargarStock])

  useEffect(() => {
    if (tab === 'historial') cargarHistorial()
  }, [tab, cargarHistorial])

  // Filtro de busqueda en tabla stock
  const stockFiltrado = stock.filter(p => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return (p.nombre || '').toLowerCase().includes(q)
      || (p.codigo || '').toLowerCase().includes(q)
      || (p.laboratorio || '').toLowerCase().includes(q)
      || (p.lote || '').toLowerCase().includes(q)
  })

  // Mini-cards stats
  const totalProductos = stock.length
  const activos        = stock.filter(p => p.activo).length
  const sinStock       = stock.filter(p => p.stock_actual === 0).length
  const bajoStock      = stock.filter(p => p.stock_actual > 0 && p.stock_actual <= 10).length

  // Handlers drawer
  function abrirDrawer(productoId = null) {
    setProductoSeleccionado(productoId)
    setDrawerAbierto(true)
  }

  function onMovimientoExitoso() {
    cargarStock()
    if (tab === 'historial') cargarHistorial()
    addToast('Movimiento registrado correctamente')
  }

  function onProductoExitoso() {
    cargarStock()
    addToast('Producto guardado correctamente')
  }

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Productos e Inventario</h1>
        {esPrivilegiado && (
          <div className="flex gap-2">
            <button
              onClick={() => { setProductoEditar(null); setDrawerProdAbierto(true) }}
              className="border border-teal-600 text-teal-700 hover:bg-teal-50 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition"
            >
              + Nuevo Producto
            </button>
            <button
              onClick={() => abrirDrawer(null)}
              className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition"
            >
              + Registrar Entrada
            </button>
          </div>
        )}
      </div>

      {/* Error global */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex justify-between">
          {error}
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 ml-4">&times;</button>
        </div>
      )}

      {/* Mini-cards */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold uppercase text-gray-500 tracking-wide">Total Productos</p>
            <p className="text-3xl font-bold text-gray-800 mt-1">{totalProductos}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold uppercase text-teal-600 tracking-wide">Activos</p>
            <p className="text-3xl font-bold text-teal-700 mt-1">{activos}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold uppercase text-red-500 tracking-wide">Sin Stock</p>
            <p className="text-3xl font-bold text-red-600 mt-1">{sinStock}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold uppercase text-orange-500 tracking-wide">Bajo Stock (&lt;10)</p>
            <p className="text-3xl font-bold text-orange-600 mt-1">{bajoStock}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {[
            { key: 'stock',     label: 'Productos y Stock' },
            { key: 'historial', label: 'Historial de Movimientos' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenido del tab */}
      {loading ? (
        <Spinner />
      ) : tab === 'stock' ? (
        // Tab: Stock Actual
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
            <h2 className="font-semibold text-gray-700">Productos y stock</h2>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Buscar por nombre, codigo, laboratorio..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 w-64"
              />
              <span className="text-sm text-gray-400">{stockFiltrado.length} productos</span>
            </div>
          </div>

          {stockFiltrado.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <p className="font-medium">{busqueda ? 'No se encontraron productos con esa busqueda' : 'No hay productos registrados'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-3 py-3 font-semibold text-gray-600">Codigo</th>
                    <th className="text-left px-3 py-3 font-semibold text-gray-600">Nombre</th>
                    <th className="text-left px-3 py-3 font-semibold text-gray-600">Laboratorio</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-600">P. sin IVA</th>
                    <th className="text-center px-3 py-3 font-semibold text-gray-600">IVA</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-600">P. con IVA</th>
                    <th className="text-right px-3 py-3 font-semibold text-gray-600">Stock</th>
                    <th className="text-left px-3 py-3 font-semibold text-gray-600">Lote</th>
                    <th className="text-left px-3 py-3 font-semibold text-gray-600">Vencimiento</th>
                    <th className="text-center px-3 py-3 font-semibold text-gray-600">Estado</th>
                    {esPrivilegiado && (
                      <th className="text-center px-3 py-3 font-semibold text-gray-600">Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {stockFiltrado.map((p, i) => (
                    <tr
                      key={p.id}
                      className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                    >
                      <td className="px-3 py-3 font-mono text-xs text-gray-500">
                        {p.codigo || '--'}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          {p.imagen_url && (
                            <img src={p.imagen_url} alt="" className="w-8 h-8 rounded object-cover border border-gray-200 flex-shrink-0" />
                          )}
                          <div>
                            <span className="font-medium text-gray-800">{p.nombre}</span>
                            {!p.activo && (
                              <span className="ml-2 text-xs text-gray-400 bg-gray-100 rounded px-1">inactivo</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-500 text-xs">{p.laboratorio || '--'}</td>
                      <td className="px-3 py-3 text-right text-gray-600 tabular-nums">{fmt(p.precio_sin_iva)}</td>
                      <td className="px-3 py-3 text-center text-xs text-gray-500">
                        {p.tiene_iva === false ? 'No' : `${p.iva_porcentaje || 15}%`}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-700 font-semibold tabular-nums">{fmt(p.precio_con_iva || p.precio_venta)}</td>
                      <td className={`px-3 py-3 text-right tabular-nums ${colorStock(p.stock_actual)}`}>
                        {p.stock_actual}
                      </td>
                      <td className="px-3 py-3 text-gray-500 text-xs font-mono">{p.lote || '--'}</td>
                      <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {p.fecha_vencimiento ? formatFecha(p.fecha_vencimiento) : '--'}
                          <BadgeVencimiento fecha={p.fecha_vencimiento} />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <BadgeStock stock={p.stock_actual} />
                      </td>
                      {esPrivilegiado && (
                        <td className="px-3 py-3 text-center">
                          <div className="flex gap-1 justify-center">
                            <button
                              onClick={() => { setProductoEditar(p); setDrawerProdAbierto(true) }}
                              className="text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-400 rounded-md px-2 py-1 text-xs font-medium transition"
                              title="Editar producto"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => abrirDrawer(p.id)}
                              className="text-teal-600 hover:text-teal-800 border border-teal-200 hover:border-teal-400 rounded-md px-2 py-1 text-xs font-medium transition"
                              title="Registrar entrada"
                            >
                              +Entrada
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      ) : (
        // Tab: Historial de Movimientos
        <div className="space-y-4">
          {/* Filtros */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Producto</label>
              <select
                value={filtroProducto}
                onChange={e => setFiltroProducto(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Todos los productos</option>
                {stock.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.codigo ? `[${p.codigo}] ` : ''}{p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
              <select
                value={filtroTipo}
                onChange={e => setFiltroTipo(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Todos</option>
                <option value="entrada">Entrada</option>
                <option value="salida">Salida (despacho)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
              <input
                type="date"
                value={filtroFechaInicio}
                onChange={e => setFiltroFechaInicio(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
              <input
                type="date"
                value={filtroFechaFin}
                onChange={e => setFiltroFechaFin(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <button
              onClick={cargarHistorial}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
            >
              Filtrar
            </button>
          </div>

          {/* Tabla historial */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-700">Historial de movimientos</h2>
              <span className="text-sm text-gray-400">{movimientos.length} registros</span>
            </div>

            {cargandoHistorial ? (
              <Spinner />
            ) : movimientos.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <p className="font-medium">No hay movimientos para esta seleccion</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Fecha</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Producto</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-600">Tipo</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Cantidad</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Ant.</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">Nuevo</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Motivo</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Referencia</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Usuario</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map((m, i) => (
                      <tr
                        key={m.id}
                        className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                      >
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {m.fecha ? formatFecha(m.fecha) : '--'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800">{m.producto_nombre}</div>
                          {m.producto_codigo && (
                            <div className="text-xs text-gray-400 font-mono">{m.producto_codigo}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <BadgeTipo tipo={m.tipo} />
                        </td>
                        <td className={`px-4 py-3 text-right tabular-nums font-semibold ${
                          m.tipo === 'entrada' ? 'text-green-600' :
                          m.tipo === 'salida'  ? 'text-red-600'   : 'text-blue-600'
                        }`}>
                          {m.tipo === 'salida' ? '-' : '+'}{m.cantidad}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500 tabular-nums">{m.stock_anterior}</td>
                        <td className={`px-4 py-3 text-right tabular-nums ${colorStock(m.stock_nuevo)}`}>
                          {m.stock_nuevo}
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate" title={m.motivo || ''}>
                          {m.motivo || <span className="text-gray-300">--</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                          {m.referencia || <span className="text-gray-300">--</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {m.usuario_nombre || '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Drawer Movimiento */}
      <DrawerMovimiento
        abierto={drawerAbierto}
        onClose={() => setDrawerAbierto(false)}
        productoInicial={productoSeleccionado}
        stockData={stock}
        onExito={onMovimientoExitoso}
      />

      {/* Drawer Producto (CRUD) */}
      <DrawerProducto
        abierto={drawerProdAbierto}
        onClose={() => setDrawerProdAbierto(false)}
        productoEditar={productoEditar}
        onExito={onProductoExitoso}
      />
    </div>
  )
}
