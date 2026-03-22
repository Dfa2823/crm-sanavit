import { useState, useEffect, useCallback } from 'react'
import { getStock, getMovimientos, registrarMovimiento, crearProducto, actualizarProducto } from '../../api/inventario'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'

// ─── Helpers ────────────────────────────────────────────────

function fmt(val) {
  if (val === null || val === undefined) return '—'
  return `$${Number(val).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fechaHoy() {
  return new Date().toISOString().split('T')[0]
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

// ─── Drawer: Crear/Editar Producto ──────────────────────────

function DrawerProducto({ abierto, onClose, productoEditar, onExito }) {
  const [nombre,      setNombre]      = useState('')
  const [codigo,      setCodigo]      = useState('')
  const [tipo,        setTipo]        = useState('servicio')
  const [descripcion, setDescripcion] = useState('')
  const [precio,      setPrecio]      = useState('')
  const [activo,      setActivo]      = useState(true)
  const [guardando,   setGuardando]   = useState(false)
  const [error,       setError]       = useState('')

  useEffect(() => {
    if (abierto) {
      if (productoEditar) {
        setNombre(productoEditar.nombre || '')
        setCodigo(productoEditar.codigo || '')
        setTipo(productoEditar.tipo || 'servicio')
        setDescripcion(productoEditar.descripcion || '')
        setPrecio(productoEditar.precio_venta || '')
        setActivo(productoEditar.activo !== false)
      } else {
        setNombre(''); setCodigo(''); setTipo('servicio')
        setDescripcion(''); setPrecio(''); setActivo(true)
      }
      setError('')
    }
  }, [abierto, productoEditar])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nombre.trim()) return setError('El nombre es obligatorio')
    setGuardando(true)
    setError('')
    try {
      const data = { nombre: nombre.trim(), codigo: codigo || undefined, tipo, descripcion: descripcion || undefined, precio_venta: Number(precio) || 0, activo }
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

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">{productoEditar ? 'Editar Producto' : 'Nuevo Producto'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} required
              placeholder="Ej: Programa Nutrición Premium"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
              <input value={codigo} onChange={e => setCodigo(e.target.value)}
                placeholder="Ej: PRO-001"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="servicio">Servicio</option>
                <option value="producto">Producto físico</option>
                <option value="kit">Kit</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Precio de venta ($)</label>
            <input type="number" min="0" step="0.01" value={precio} onChange={e => setPrecio(e.target.value)}
              placeholder="0.00"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción <span className="font-normal text-gray-400">(opcional)</span></label>
            <textarea rows={3} value={descripcion} onChange={e => setDescripcion(e.target.value)}
              placeholder="Descripción del producto o servicio..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
          </div>
          {productoEditar && (
            <div className="flex items-center gap-3">
              <input type="checkbox" id="activo_prod" checked={activo} onChange={e => setActivo(e.target.checked)} className="w-4 h-4 accent-teal-600" />
              <label htmlFor="activo_prod" className="text-sm text-gray-700">Producto activo (visible en catálogo)</label>
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

// ─── Componente Drawer ──────────────────────────────────────

function DrawerMovimiento({ abierto, onClose, productoInicial, stockData, onExito }) {
  const { usuario } = useAuth()
  const esPrivilegiado = ['admin', 'director'].includes(usuario?.rol)

  const [productoId,  setProductoId]  = useState(productoInicial || '')
  const [tipo,        setTipo]        = useState('entrada')
  const [cantidad,    setCantidad]    = useState('')
  const [motivo,      setMotivo]      = useState('')
  const [referencia,  setReferencia]  = useState('')
  const [fecha,       setFecha]       = useState(fechaHoy())
  const [guardando,   setGuardando]   = useState(false)
  const [error,       setError]       = useState('')

  // Sincronizar producto pre-seleccionado al abrir
  useEffect(() => {
    if (abierto) {
      setProductoId(productoInicial || '')
      setTipo('entrada')
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
  const stockResultante = stockActual !== null
    ? (tipo === 'salida' ? stockActual - cantidadNum : stockActual + cantidadNum)
    : null

  const advertenciaSalida = tipo === 'salida' && stockActual !== null && cantidadNum > stockActual

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!productoId)    return setError('Selecciona un producto')
    if (!cantidadNum || cantidadNum <= 0) return setError('La cantidad debe ser mayor a 0')

    setGuardando(true)
    try {
      await registrarMovimiento({
        producto_id: productoId,
        tipo,
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
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Panel lateral */}
      <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">Registrar Movimiento</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Cuerpo scrollable */}
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

            {/* Stock actual del producto seleccionado */}
            {productoActual && (
              <p className={`mt-1.5 text-xs font-medium ${colorStock(stockActual)}`}>
                Stock actual: {stockActual} unidades
              </p>
            )}
          </div>

          {/* Tipo de movimiento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de movimiento</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'entrada', label: 'Entrada',  icon: 'E', cls: 'border-green-400 bg-green-50 text-green-700' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTipo(opt.value)}
                  className={`border-2 rounded-lg py-3 text-sm font-semibold transition-all ${
                    tipo === opt.value
                      ? opt.cls + ' shadow-sm'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <div className="text-base mb-0.5">
                    {opt.value === 'entrada' ? '↓' : opt.value === 'salida' ? '↑' : '~'}
                  </div>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cantidad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
            <input
              type="number"
              min="1"
              step="1"
              value={cantidad}
              onChange={e => setCantidad(e.target.value)}
              placeholder="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            />

            {/* Advertencia de stock insuficiente */}
            {advertenciaSalida && (
              <p className="mt-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-md px-2 py-1">
                Advertencia: la cantidad supera el stock disponible ({stockActual}).
              </p>
            )}

            {/* Preview stock resultante */}
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
            <input
              type="text"
              value={referencia}
              onChange={e => setReferencia(e.target.value)}
              placeholder="Ej: Compra #001, Venta SQT-2477"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={3}
              placeholder="Describe el motivo del movimiento..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={guardando}
            className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-300 text-white rounded-lg py-2.5 text-sm font-medium transition"
          >
            {guardando ? 'Guardando...' : 'Registrar'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Página principal ────────────────────────────────────────

export default function InventarioPage() {
  const { usuario } = useAuth()
  const { addToast } = useToast()
  const esPrivilegiado = ['admin', 'director'].includes(usuario?.rol)

  const [tab,        setTab]        = useState('stock')      // 'stock' | 'historial'
  const [stock,      setStock]      = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')

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

  // ── Carga de stock ──
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

  // ── Carga de historial ──
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

  // ── Mini-cards stats ──
  const totalProductos = stock.length
  const activos        = stock.filter(p => p.activo).length
  const sinStock       = stock.filter(p => p.stock_actual === 0).length
  const bajoStock      = stock.filter(p => p.stock_actual > 0 && p.stock_actual <= 10).length

  // ── Handlers drawer ──
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

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Inventario</h1>
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
              + Registrar Movimiento
            </button>
          </div>
        )}
      </div>

      {/* ── Error global ── */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex justify-between">
          {error}
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 ml-4">&times;</button>
        </div>
      )}

      {/* ── Mini-cards ── */}
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
            <p className="text-xs font-semibold uppercase text-orange-500 tracking-wide">Bajo Stock (&lt;5)</p>
            <p className="text-3xl font-bold text-orange-600 mt-1">{bajoStock}</p>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {[
            { key: 'stock',     label: 'Stock Actual' },
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

      {/* ── Contenido del tab ── */}
      {loading ? (
        <Spinner />
      ) : tab === 'stock' ? (
        // ─ Tab: Stock Actual ──────────────────────────────────
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">Productos y stock</h2>
            <span className="text-sm text-gray-400">{stock.length} productos</span>
          </div>

          {stock.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <div className="text-4xl mb-3">📦</div>
              <p className="font-medium">No hay productos registrados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Código</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Nombre</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Tipo</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Precio Base</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Stock</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600">Estado</th>
                    {esPrivilegiado && (
                      <th className="text-center px-4 py-3 font-semibold text-gray-600">Acción</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {stock.map((p, i) => (
                    <tr
                      key={p.id}
                      className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {p.codigo || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-800">{p.nombre}</span>
                        {!p.activo && (
                          <span className="ml-2 text-xs text-gray-400 bg-gray-100 rounded px-1">inactivo</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 capitalize">{p.tipo || '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmt(p.precio_venta)}</td>
                      <td className={`px-4 py-3 text-right tabular-nums ${colorStock(p.stock_actual)}`}>
                        {p.stock_actual}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <BadgeStock stock={p.stock_actual} />
                      </td>
                      {esPrivilegiado && (
                        <td className="px-4 py-3 text-center">
                          <div className="flex gap-1 justify-center">
                            <button
                              onClick={() => { setProductoEditar(p); setDrawerProdAbierto(true) }}
                              className="text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-400 rounded-md px-2 py-1 text-xs font-medium transition"
                              title="Editar producto"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => abrirDrawer(p.id)}
                              className="text-teal-600 hover:text-teal-800 border border-teal-200 hover:border-teal-400 rounded-md px-2 py-1 text-xs font-medium transition"
                              title="Registrar movimiento"
                            >
                              +/-
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
        // ─ Tab: Historial de Movimientos ─────────────────────
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
                <div className="text-4xl mb-3">📋</div>
                <p className="font-medium">No hay movimientos para esta selección</p>
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
                          {m.fecha
                            ? new Date(m.fecha).toLocaleDateString('es-EC', { timeZone: 'UTC' })
                            : '—'}
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
                          {m.motivo || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                          {m.referencia || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {m.usuario_nombre || '—'}
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

      {/* ── Drawer Movimiento ── */}
      <DrawerMovimiento
        abierto={drawerAbierto}
        onClose={() => setDrawerAbierto(false)}
        productoInicial={productoSeleccionado}
        stockData={stock}
        onExito={onMovimientoExitoso}
      />

      {/* ── Drawer Producto (CRUD) ── */}
      <DrawerProducto
        abierto={drawerProdAbierto}
        onClose={() => setDrawerProdAbierto(false)}
        productoEditar={productoEditar}
        onExito={onProductoExitoso}
      />
    </div>
  )
}
