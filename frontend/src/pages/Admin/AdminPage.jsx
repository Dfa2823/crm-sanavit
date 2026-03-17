import { useState, useEffect, useCallback } from 'react'
import {
  getUsuarios, createUsuario, updateUsuario, toggleUsuario, updatePermisos,
  getSalas, createSala,
  getTipificaciones, createTipificacion, updateTipificacion,
  getFuentes, createFuente, updateFuente,
  getRoles,
  getFormasPago, createFormaPago, updateFormaPago,
} from '../../api/admin'
import { getProductos, createProducto, updateProducto } from '../../api/productos'

const TABS = [
  { key: 'usuarios',       label: 'Usuarios',              icon: '👥' },
  { key: 'salas',          label: 'Salas',                 icon: '🏢' },
  { key: 'tipificaciones', label: 'Tipificaciones',        icon: '🏷️' },
  { key: 'fuentes',        label: 'Fuentes',               icon: '📡' },
  { key: 'formas_pago',    label: 'Formas de Pago',        icon: '💳' },
  { key: 'productos',      label: 'Productos',             icon: '📦' },
]

const TIPOS_FORMA_PAGO = [
  { value: 'efectivo',          label: 'Efectivo' },
  { value: 'transferencia',     label: 'Transferencia' },
  { value: 'tarjeta_credito',   label: 'Tarjeta de Crédito' },
  { value: 'tarjeta_debito',    label: 'Tarjeta de Débito' },
  { value: 'cheque',            label: 'Cheque' },
  { value: 'credito_directo',   label: 'Crédito Directo' },
  { value: 'link_pago',         label: 'Link de Pago' },
  { value: 'diferido',          label: 'Diferido' },
]

const TIPOS_PRODUCTO = [
  { value: 'servicio',  label: 'Servicio' },
  { value: 'producto',  label: 'Producto' },
  { value: 'paquete',   label: 'Paquete' },
]

// ─────────────────────────────── Módulos del sistema ────────────────────────
const TODOS_LOS_MODULOS = [
  { key: 'kpis',          label: 'Dashboard KPIs' },
  { key: 'premanifiesto', label: 'Pre-manifiesto' },
  { key: 'recepcion',     label: 'Recepción / Sala' },
  { key: 'leads',         label: 'Leads / TMK' },
  { key: 'supervisor',    label: 'Supervisor CC' },
  { key: 'calendario',    label: 'Calendario Confirmador' },
  { key: 'cartera',       label: 'Cartera' },
  { key: 'ventas',        label: 'Ventas' },
  { key: 'reportes',      label: 'Reportes' },
  { key: 'outsourcing',   label: 'Outsourcing' },
  { key: 'comisiones',    label: 'Comisiones' },
  { key: 'liquidaciones', label: 'Liquidaciones' },
  { key: 'sac',           label: 'SAC / PQR' },
  { key: 'inventario',    label: 'Inventario' },
  { key: 'alertas',       label: 'Alertas' },
  { key: 'importar',      label: 'Importar Base' },
  { key: 'nomina',        label: 'Nómina' },
  { key: 'admin',         label: 'Administración' },
]

const ROL_DEFAULTS = {
  admin:         ['kpis','premanifiesto','recepcion','leads','supervisor','calendario','cartera','ventas','reportes','outsourcing','comisiones','liquidaciones','sac','inventario','alertas','importar','nomina','admin'],
  director:      ['kpis','premanifiesto','recepcion','leads','supervisor','cartera','ventas','reportes','outsourcing','comisiones','liquidaciones','sac','inventario','alertas','importar','nomina'],
  supervisor_cc: ['supervisor','premanifiesto','leads','calendario','reportes','outsourcing','importar'],
  tmk:           ['leads'],
  confirmador:   ['calendario','premanifiesto'],
  hostess:       ['recepcion','ventas'],
  consultor:     ['recepcion','ventas'],
  asesor_cartera:['kpis','cartera','reportes'],
  sac:           ['sac','kpis','reportes'],
  outsourcing:   ['leads','premanifiesto'],
}

// ─────────────────────────────── ModalPermisos ──────────────────────────────
function ModalPermisos({ usuario, onClose, onSuccess }) {
  const inicial = Array.isArray(usuario.permisos)
    ? new Set(usuario.permisos)
    : new Set(ROL_DEFAULTS[usuario.rol] || [])
  const [seleccionados, setSeleccionados] = useState(inicial)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const esPersonalizado = Array.isArray(usuario.permisos)

  function toggle(key) {
    setSeleccionados(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function handleGuardar() {
    setGuardando(true)
    setError('')
    try {
      // Guardar en el mismo orden que TODOS_LOS_MODULOS
      const ordered = TODOS_LOS_MODULOS.map(m => m.key).filter(k => seleccionados.has(k))
      await updatePermisos(usuario.id, ordered)
      onSuccess('Permisos actualizados correctamente')
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar permisos')
    } finally {
      setGuardando(false)
    }
  }

  async function handleRestablecer() {
    setGuardando(true)
    setError('')
    try {
      await updatePermisos(usuario.id, null)
      onSuccess('Permisos restablecidos al rol por defecto')
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al restablecer permisos')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-800 text-lg">Permisos modulares</h3>
            <p className="text-sm text-gray-500">{usuario.nombre} · <span className="text-blue-600">{usuario.rol_label || usuario.rol}</span></p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        {!esPersonalizado && (
          <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs">
            Este usuario usa los permisos por defecto del rol. Al guardar, se aplicarán permisos personalizados.
          </div>
        )}

        {error && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-5 max-h-72 overflow-y-auto pr-1">
          {TODOS_LOS_MODULOS.map(m => (
            <label key={m.key} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer text-sm select-none">
              <input
                type="checkbox"
                checked={seleccionados.has(m.key)}
                onChange={() => toggle(m.key)}
                className="accent-teal-600 w-4 h-4"
              />
              <span className="text-gray-700">{m.label}</span>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          {esPersonalizado && (
            <button
              onClick={handleRestablecer}
              disabled={guardando}
              className="text-xs px-3 py-2 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-lg disabled:opacity-50"
            >
              Restablecer a rol
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button
              onClick={handleGuardar}
              disabled={guardando}
              className="px-4 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-lg disabled:opacity-50"
            >
              {guardando ? 'Guardando...' : 'Guardar permisos'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────── Spinner ────────────────────────────────────
function Spinner() {
  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// ─────────────────────────────── Badge activo ───────────────────────────────
function BadgeActivo({ activo }) {
  return activo
    ? <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">Activo</span>
    : <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-600">Inactivo</span>
}

// ─────────────────────────────── Modal base ─────────────────────────────────
function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-lg' : 'max-w-md'} p-6 my-4`}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-800 text-lg">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ──────────────────────── Sección Salarial ──────────────────────────────────
function SeccionSalarial({ form, setForm, rolNombre }) {
  const f = (field, val) => setForm(p => ({ ...p, [field]: val }))
  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'

  const esConsultorODirector = ['consultor','director','admin'].includes(rolNombre)
  const esTmk                = rolNombre === 'tmk'
  const esConfirmador        = rolNombre === 'confirmador'
  const esAsesor             = rolNombre === 'asesor_cartera'
  const tieneComision        = esConsultorODirector || esTmk || esConfirmador || esAsesor

  if (!tieneComision && !rolNombre) return null

  return (
    <div className="border-t border-gray-100 pt-4 mt-1">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Configuración salarial</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Sueldo base ($)</label>
          <input type="number" min="0" step="0.01" className={inp}
            placeholder="0.00"
            value={form.sueldo_base}
            onChange={e => f('sueldo_base', e.target.value)}
          />
        </div>
        {esConsultorODirector && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">% Comisión sobre cobrado</label>
              <input type="number" min="0" max="100" step="0.01" className={inp}
                placeholder="10"
                value={form.pct_comision_venta}
                onChange={e => f('pct_comision_venta', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">% Mínimo para desbloquear</label>
              <input type="number" min="0" max="100" step="0.01" className={inp}
                placeholder="30"
                value={form.pct_desbloqueo}
                onChange={e => f('pct_desbloqueo', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bono por tour ($)</label>
              <input type="number" min="0" step="0.01" className={inp}
                placeholder="50"
                value={form.bono_por_tour}
                onChange={e => f('bono_por_tour', e.target.value)}
              />
            </div>
          </>
        )}
        {esTmk && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Bono por tour ($)</label>
            <input type="number" min="0" step="0.01" className={inp}
              placeholder="15"
              value={form.bono_por_tour}
              onChange={e => f('bono_por_tour', e.target.value)}
            />
          </div>
        )}
        {esConfirmador && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bono por tour ($)</label>
              <input type="number" min="0" step="0.01" className={inp}
                placeholder="10"
                value={form.bono_por_tour}
                onChange={e => f('bono_por_tour', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bono por cita confirmada ($)</label>
              <input type="number" min="0" step="0.01" className={inp}
                placeholder="2"
                value={form.bono_por_cita}
                onChange={e => f('bono_por_cita', e.target.value)}
              />
            </div>
          </>
        )}
        {esAsesor && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">% Comisión sobre cobros cartera</label>
            <input type="number" min="0" max="100" step="0.01" className={inp}
              placeholder="2"
              value={form.pct_comision_cobro}
              onChange={e => f('pct_comision_cobro', e.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────── TAB USUARIOS ──────────────────────────────────
function TabUsuarios({ salas, roles }) {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [modalNuevo, setModalNuevo] = useState(false)
  const [modalEditar, setModalEditar] = useState(null)
  const [modalPermisos, setModalPermisos] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [mensajeExito, setMensajeExito] = useState('')

  const [busqueda, setBusqueda] = useState('')
  const [formNuevo, setFormNuevo] = useState({
    nombre: '', username: '', password: '', sala_id: '', rol_id: '',
    sueldo_base: '', pct_comision_venta: '', pct_desbloqueo: '',
    pct_comision_cobro: '', bono_por_tour: '', bono_por_cita: '',
  })
  const [formEditar, setFormEditar] = useState({
    nombre: '', sala_id: '', rol_id: '', activo: true, password: '',
    sueldo_base: '', pct_comision_venta: '', pct_desbloqueo: '',
    pct_comision_cobro: '', bono_por_tour: '', bono_por_cita: '',
  })

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getUsuarios()
      setUsuarios(Array.isArray(data) ? data : [])
    } catch (err) {
      setError('Error al cargar usuarios: ' + (err.response?.data?.error || err.message))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function handleCrear(e) {
    e.preventDefault()
    setGuardando(true)
    setError('')
    try {
      await createUsuario(formNuevo)
      setModalNuevo(false)
      setFormNuevo({
        nombre: '', username: '', password: '', sala_id: '', rol_id: '',
        sueldo_base: '', pct_comision_venta: '', pct_desbloqueo: '',
        pct_comision_cobro: '', bono_por_tour: '', bono_por_cita: '',
      })
      cargar()
    } catch (err) {
      setError('Error al crear usuario: ' + (err.response?.data?.error || err.message))
    } finally {
      setGuardando(false)
    }
  }

  async function handleEditar(e) {
    e.preventDefault()
    setGuardando(true)
    setError('')
    try {
      const payload = {
        nombre:  formEditar.nombre,
        sala_id: formEditar.sala_id || null,
        rol_id:  formEditar.rol_id,
        activo:  formEditar.activo,
        sueldo_base:        formEditar.sueldo_base        !== '' ? formEditar.sueldo_base        : null,
        pct_comision_venta: formEditar.pct_comision_venta !== '' ? formEditar.pct_comision_venta : null,
        pct_desbloqueo:     formEditar.pct_desbloqueo     !== '' ? formEditar.pct_desbloqueo     : null,
        pct_comision_cobro: formEditar.pct_comision_cobro !== '' ? formEditar.pct_comision_cobro : null,
        bono_por_tour:      formEditar.bono_por_tour      !== '' ? formEditar.bono_por_tour      : null,
        bono_por_cita:      formEditar.bono_por_cita      !== '' ? formEditar.bono_por_cita      : null,
      }
      if (formEditar.password) payload.password = formEditar.password
      await updateUsuario(modalEditar.id, payload)
      setModalEditar(null)
      cargar()
    } catch (err) {
      setError('Error al actualizar usuario: ' + (err.response?.data?.error || err.message))
    } finally {
      setGuardando(false)
    }
  }

  async function handleToggle(u) {
    try {
      await toggleUsuario(u.id, !u.activo)
      cargar()
    } catch (err) {
      setError('Error al cambiar estado: ' + (err.response?.data?.error || err.message))
    }
  }

  function abrirEditar(u) {
    setFormEditar({
      nombre:  u.nombre  || '',
      sala_id: u.sala_id || '',
      rol_id:  u.rol_id  || '',
      activo:  u.activo !== false,
      password: '',
      sueldo_base:        u.sueldo_base        ?? '',
      pct_comision_venta: u.pct_comision_venta ?? '',
      pct_desbloqueo:     u.pct_desbloqueo     ?? '',
      pct_comision_cobro: u.pct_comision_cobro ?? '',
      bono_por_tour:      u.bono_por_tour      ?? '',
      bono_por_cita:      u.bono_por_cita      ?? '',
    })
    setModalEditar(u)
  }

  const usuariosFiltrados = busqueda.trim()
    ? usuarios.filter(u =>
        u.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.username.toLowerCase().includes(busqueda.toLowerCase()) ||
        (u.rol || '').toLowerCase().includes(busqueda.toLowerCase()) ||
        (u.sala_nombre || '').toLowerCase().includes(busqueda.toLowerCase())
      )
    : usuarios

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <input
          type="text"
          placeholder="Buscar por nombre, usuario, rol o sala..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <p className="text-sm text-gray-500 whitespace-nowrap">{usuariosFiltrados.length} de {usuarios.length}</p>
        <button
          onClick={() => setModalNuevo(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap"
        >
          + Nuevo usuario
        </button>
      </div>

      {mensajeExito && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center justify-between">
          {mensajeExito}
          <button onClick={() => setMensajeExito('')} className="ml-2 text-green-400 hover:text-green-600">×</button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-400 hover:text-red-600">×</button>
        </div>
      )}

      {loading ? <Spinner /> : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Usuario</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Rol</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Sala</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.map((u, i) => (
                <tr
                  key={u.id}
                  className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                >
                  <td className="px-4 py-3 font-medium text-gray-800">{u.nombre}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{u.username}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
                      {u.rol_label || u.rol}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.sala_nombre || '—'}</td>
                  <td className="px-4 py-3"><BadgeActivo activo={u.activo !== false} /></td>
                  <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleToggle(u)}
                      className={`px-3 py-1.5 rounded-lg text-xs border ${
                        u.activo !== false
                          ? 'border-red-200 text-red-600 hover:bg-red-50'
                          : 'border-green-200 text-green-700 hover:bg-green-50'
                      }`}
                    >
                      {u.activo !== false ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      onClick={() => abrirEditar(u)}
                      className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setModalPermisos(u)}
                      className="border border-purple-200 text-purple-700 px-3 py-1.5 rounded-lg text-xs hover:bg-purple-50"
                      title="Configurar permisos de módulos"
                    >
                      🔑 Permisos
                    </button>
                  </td>
                </tr>
              ))}
              {usuarios.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-4 py-12 text-center text-gray-400">
                    No hay usuarios registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal: Nuevo usuario */}
      {modalNuevo && (
        <Modal title="Nuevo usuario" onClose={() => setModalNuevo(false)} wide>
          <form onSubmit={handleCrear} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
              <input
                type="text" required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={formNuevo.nombre}
                onChange={e => setFormNuevo(f => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
              <input
                type="text" required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={formNuevo.username}
                onChange={e => setFormNuevo(f => ({ ...f, username: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label>
              <input
                type="password" required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={formNuevo.password}
                onChange={e => setFormNuevo(f => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sala</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={formNuevo.sala_id}
                onChange={e => setFormNuevo(f => ({ ...f, sala_id: e.target.value }))}
              >
                <option value="">Sin sala</option>
                {salas.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol *</label>
              <select
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={formNuevo.rol_id}
                onChange={e => setFormNuevo(f => ({ ...f, rol_id: e.target.value }))}
              >
                <option value="">Seleccionar rol</option>
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.label || r.nombre}</option>
                ))}
              </select>
            </div>
            {/* ── Configuración salarial ── */}
            <SeccionSalarial
              form={formNuevo}
              setForm={setFormNuevo}
              rolNombre={roles.find(r => String(r.id) === String(formNuevo.rol_id))?.nombre || ''}
            />
            {error && (
              <p className="text-red-600 text-xs">{error}</p>
            )}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalNuevo(false)}
                className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                {guardando ? 'Guardando...' : 'Crear usuario'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Editar usuario */}
      {modalEditar && (
        <Modal title={`Editar: ${modalEditar.nombre}`} onClose={() => setModalEditar(null)} wide>
          <form onSubmit={handleEditar} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={formEditar.nombre}
                onChange={e => setFormEditar(f => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sala</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={formEditar.sala_id}
                onChange={e => setFormEditar(f => ({ ...f, sala_id: e.target.value }))}
              >
                <option value="">Sin sala</option>
                {salas.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={formEditar.rol_id}
                onChange={e => setFormEditar(f => ({ ...f, rol_id: e.target.value }))}
              >
                <option value="">Seleccionar rol</option>
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.label || r.nombre}</option>
                ))}
              </select>
            </div>
            {/* ── Configuración salarial ── */}
            <SeccionSalarial
              form={formEditar}
              setForm={setFormEditar}
              rolNombre={roles.find(r => String(r.id) === String(formEditar.rol_id))?.nombre || ''}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña <span className="text-gray-400 font-normal">(dejar vacío para no cambiar)</span></label>
              <input
                type="password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="••••••"
                value={formEditar.password}
                onChange={e => setFormEditar(f => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Activo</label>
              <button
                type="button"
                onClick={() => setFormEditar(f => ({ ...f, activo: !f.activo }))}
                className={`relative w-12 h-6 rounded-full transition-colors ${formEditar.activo ? 'bg-teal-500' : 'bg-gray-300'}`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${formEditar.activo ? 'translate-x-7' : 'translate-x-1'}`}
                />
              </button>
              <span className="text-sm text-gray-500">{formEditar.activo ? 'Activo' : 'Inactivo'}</span>
            </div>
            {error && <p className="text-red-600 text-xs">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalEditar(null)}
                className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Permisos modulares */}
      {modalPermisos && (
        <ModalPermisos
          usuario={modalPermisos}
          onClose={() => setModalPermisos(null)}
          onSuccess={(msg) => { setMensajeExito(msg); cargar() }}
        />
      )}
    </div>
  )
}

// ──────────────────────────── TAB SALAS ─────────────────────────────────────
function TabSalas() {
  const [salas, setSalas]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [modalNuevo, setModalNuevo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [form, setForm]           = useState({ nombre: '', ciudad: '', prefijo_contrato: '' })

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getSalas()
      setSalas(Array.isArray(data) ? data : [])
    } catch (err) {
      setError('Error al cargar salas: ' + (err.response?.data?.error || err.message))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function handleCrear(e) {
    e.preventDefault()
    setGuardando(true)
    setError('')
    try {
      await createSala(form)
      setModalNuevo(false)
      setForm({ nombre: '', ciudad: '', prefijo_contrato: '' })
      cargar()
    } catch (err) {
      setError('Error al crear sala: ' + (err.response?.data?.error || err.message))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{salas.length} salas registradas</p>
        <button
          onClick={() => setModalNuevo(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Nueva sala
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-400 hover:text-red-600">×</button>
        </div>
      )}

      {loading ? <Spinner /> : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Ciudad</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Prefijo contrato</th>
              </tr>
            </thead>
            <tbody>
              {salas.map((s, i) => (
                <tr
                  key={s.id}
                  className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                >
                  <td className="px-4 py-3 font-medium text-gray-800">{s.nombre}</td>
                  <td className="px-4 py-3 text-gray-600">{s.ciudad || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                      {s.prefijo_contrato || '—'}
                    </span>
                  </td>
                </tr>
              ))}
              {salas.length === 0 && (
                <tr>
                  <td colSpan="3" className="px-4 py-12 text-center text-gray-400">
                    No hay salas registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalNuevo && (
        <Modal title="Nueva sala" onClose={() => setModalNuevo(false)}>
          <form onSubmit={handleCrear} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                type="text" required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={form.ciudad}
                onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prefijo contrato</label>
              <input
                type="text" maxLength={10}
                placeholder="Ej: GYE, UIO, CUE"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={form.prefijo_contrato}
                onChange={e => setForm(f => ({ ...f, prefijo_contrato: e.target.value.toUpperCase() }))}
              />
            </div>
            {error && <p className="text-red-600 text-xs">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalNuevo(false)}
                className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                {guardando ? 'Guardando...' : 'Crear sala'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ─────────────────── TAB TIPIFICACIONES / FUENTES (genérico) ────────────────
function TabCatalogo({ titulo, fetchFn, createFn, updateFn }) {
  const [items, setItems]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [modalNuevo, setModalNuevo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [nombre, setNombre]       = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchFn()
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      setError('Error al cargar: ' + (err.response?.data?.error || err.message))
    } finally {
      setLoading(false)
    }
  }, [fetchFn])

  useEffect(() => { cargar() }, [cargar])

  async function handleCrear(e) {
    e.preventDefault()
    setGuardando(true)
    setError('')
    try {
      await createFn({ nombre })
      setModalNuevo(false)
      setNombre('')
      cargar()
    } catch (err) {
      setError('Error al crear: ' + (err.response?.data?.error || err.message))
    } finally {
      setGuardando(false)
    }
  }

  async function toggleActivo(item) {
    try {
      await updateFn(item.id, { activo: !item.activo })
      cargar()
    } catch (err) {
      setError('Error al actualizar: ' + (err.response?.data?.error || err.message))
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{items.length} {titulo.toLowerCase()} registradas</p>
        <button
          onClick={() => setModalNuevo(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Nueva {titulo.slice(0, -1).toLowerCase()}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-400 hover:text-red-600">×</button>
        </div>
      )}

      {loading ? <Spinner /> : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr
                  key={item.id}
                  className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                >
                  <td className="px-4 py-3 font-medium text-gray-800">{item.nombre}</td>
                  <td className="px-4 py-3"><BadgeActivo activo={item.activo !== false} /></td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleActivo(item)}
                      className={`px-3 py-1.5 rounded-lg text-xs border ${
                        item.activo !== false
                          ? 'border-red-200 text-red-600 hover:bg-red-50'
                          : 'border-green-200 text-green-700 hover:bg-green-50'
                      }`}
                    >
                      {item.activo !== false ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan="3" className="px-4 py-12 text-center text-gray-400">
                    No hay {titulo.toLowerCase()} registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalNuevo && (
        <Modal title={`Nueva ${titulo.slice(0, -1).toLowerCase()}`} onClose={() => setModalNuevo(false)}>
          <form onSubmit={handleCrear} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                type="text" required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
              />
            </div>
            {error && <p className="text-red-600 text-xs">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalNuevo(false)}
                className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                {guardando ? 'Guardando...' : 'Crear'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ──────────────────────────── TAB FORMAS DE PAGO ────────────────────────────
function TabFormasPago() {
  const [items, setItems]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [modalNuevo, setModalNuevo] = useState(false)
  const [guardando, setGuardando]   = useState(false)
  const [form, setForm]             = useState({ nombre: '', tipo: 'efectivo' })

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getFormasPago()
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      setError('Error al cargar formas de pago: ' + (err.response?.data?.error || err.message))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function handleCrear(e) {
    e.preventDefault()
    setGuardando(true)
    setError('')
    try {
      await createFormaPago(form)
      setModalNuevo(false)
      setForm({ nombre: '', tipo: 'efectivo' })
      cargar()
    } catch (err) {
      setError('Error al crear forma de pago: ' + (err.response?.data?.error || err.message))
    } finally {
      setGuardando(false)
    }
  }

  async function toggleActivo(item) {
    try {
      await updateFormaPago(item.id, { activo: !item.activo })
      cargar()
    } catch (err) {
      setError('Error al actualizar: ' + (err.response?.data?.error || err.message))
    }
  }

  function labelTipo(tipo) {
    const found = TIPOS_FORMA_PAGO.find(t => t.value === tipo)
    return found ? found.label : tipo
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{items.length} formas de pago registradas</p>
        <button
          onClick={() => setModalNuevo(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
        >
          + Nueva Forma de Pago
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-400 hover:text-red-600">×</button>
        </div>
      )}

      {loading ? <Spinner /> : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">ID</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Tipo</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr
                  key={item.id}
                  className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                >
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{item.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{item.nombre}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
                      {labelTipo(item.tipo)}
                    </span>
                  </td>
                  <td className="px-4 py-3"><BadgeActivo activo={item.activo !== false} /></td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleActivo(item)}
                      className={`px-3 py-1.5 rounded-lg text-xs border ${
                        item.activo !== false
                          ? 'border-red-200 text-red-600 hover:bg-red-50'
                          : 'border-green-200 text-green-700 hover:bg-green-50'
                      }`}
                    >
                      {item.activo !== false ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-4 py-12 text-center text-gray-400">
                    No hay formas de pago registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalNuevo && (
        <Modal title="Nueva Forma de Pago" onClose={() => setModalNuevo(false)}>
          <form onSubmit={handleCrear} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                type="text" required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
              <select
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
              >
                {TIPOS_FORMA_PAGO.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            {error && <p className="text-red-600 text-xs">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalNuevo(false)}
                className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                {guardando ? 'Guardando...' : 'Crear'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

// ──────────────────────────── TAB PRODUCTOS ─────────────────────────────────
function TabProductos() {
  const [items, setItems]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [modalNuevo, setModalNuevo] = useState(false)
  const [modalEditar, setModalEditar] = useState(null)
  const [guardando, setGuardando]   = useState(false)

  const formVacio = { codigo: '', nombre: '', tipo: 'servicio', precio_venta: '', tiene_iva: false, descripcion: '' }
  const [form, setForm] = useState(formVacio)
  const [formEditar, setFormEditar] = useState(formVacio)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getProductos()
      setItems(Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []))
    } catch (err) {
      setError('Error al cargar productos: ' + (err.response?.data?.error || err.message))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function handleCrear(e) {
    e.preventDefault()
    setGuardando(true)
    setError('')
    try {
      await createProducto({
        ...form,
        precio_venta: form.precio_venta === '' ? null : Number(form.precio_venta),
      })
      setModalNuevo(false)
      setForm(formVacio)
      cargar()
    } catch (err) {
      setError('Error al crear producto: ' + (err.response?.data?.error || err.message))
    } finally {
      setGuardando(false)
    }
  }

  async function handleEditar(e) {
    e.preventDefault()
    setGuardando(true)
    setError('')
    try {
      await updateProducto(modalEditar.id, {
        ...formEditar,
        precio_venta: formEditar.precio_venta === '' ? null : Number(formEditar.precio_venta),
      })
      setModalEditar(null)
      cargar()
    } catch (err) {
      setError('Error al actualizar producto: ' + (err.response?.data?.error || err.message))
    } finally {
      setGuardando(false)
    }
  }

  function abrirEditar(item) {
    setFormEditar({
      codigo:       item.codigo      || '',
      nombre:       item.nombre      || '',
      tipo:         item.tipo        || 'servicio',
      precio_venta: item.precio_venta != null ? String(item.precio_venta) : '',
      tiene_iva:    item.tiene_iva   || false,
      descripcion:  item.descripcion || '',
    })
    setModalEditar(item)
  }

  function labelTipo(tipo) {
    const found = TIPOS_PRODUCTO.find(t => t.value === tipo)
    return found ? found.label : tipo
  }

  function FormularioProducto({ values, onChange, onSubmit, onCancel, submitLabel }) {
    return (
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={values.codigo}
              onChange={e => onChange(f => ({ ...f, codigo: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
            <select
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={values.tipo}
              onChange={e => onChange(f => ({ ...f, tipo: e.target.value }))}
            >
              {TIPOS_PRODUCTO.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
          <input
            type="text" required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={values.nombre}
            onChange={e => onChange(f => ({ ...f, nombre: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Precio de Venta</label>
            <input
              type="number" min="0" step="0.01"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={values.precio_venta}
              onChange={e => onChange(f => ({ ...f, precio_venta: e.target.value }))}
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                checked={values.tiene_iva}
                onChange={e => onChange(f => ({ ...f, tiene_iva: e.target.checked }))}
              />
              <span className="text-sm font-medium text-gray-700">Incluye IVA</span>
            </label>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <textarea
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            value={values.descripcion}
            onChange={e => onChange(f => ({ ...f, descripcion: e.target.value }))}
          />
        </div>
        {error && <p className="text-red-600 text-xs">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            {guardando ? 'Guardando...' : submitLabel}
          </button>
        </div>
      </form>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{items.length} productos registrados</p>
        <button
          onClick={() => setModalNuevo(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
        >
          + Nuevo Producto
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-400 hover:text-red-600">×</button>
        </div>
      )}

      {loading ? <Spinner /> : (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Código</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Nombre</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Tipo</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Precio</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">IVA</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr
                  key={item.id}
                  className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.codigo || '—'}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{item.nombre}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700">
                      {labelTipo(item.tipo)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {item.precio_venta != null
                      ? `$${Number(item.precio_venta).toFixed(2)}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {item.tiene_iva
                      ? <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">Sí</span>
                      : <span className="text-gray-400 text-xs">No</span>
                    }
                  </td>
                  <td className="px-4 py-3"><BadgeActivo activo={item.activo !== false} /></td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => abrirEditar(item)}
                      className="border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-xs hover:bg-gray-50"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-4 py-12 text-center text-gray-400">
                    No hay productos registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalNuevo && (
        <Modal title="Nuevo Producto" onClose={() => { setModalNuevo(false); setError('') }}>
          <FormularioProducto
            values={form}
            onChange={setForm}
            onSubmit={handleCrear}
            onCancel={() => { setModalNuevo(false); setError('') }}
            submitLabel="Crear producto"
          />
        </Modal>
      )}

      {modalEditar && (
        <Modal title={`Editar: ${modalEditar.nombre}`} onClose={() => { setModalEditar(null); setError('') }}>
          <FormularioProducto
            values={formEditar}
            onChange={setFormEditar}
            onSubmit={handleEditar}
            onCancel={() => { setModalEditar(null); setError('') }}
            submitLabel="Guardar cambios"
          />
        </Modal>
      )}
    </div>
  )
}

// ─────────────────────────── Página principal ───────────────────────────────
export default function AdminPage() {
  const [tabActivo, setTabActivo] = useState('usuarios')
  const [salas, setSalas]         = useState([])
  const [roles, setRoles]         = useState([])
  const [loadingMeta, setLoadingMeta] = useState(true)

  useEffect(() => {
    Promise.all([getSalas(), getRoles()])
      .then(([s, r]) => {
        setSalas(Array.isArray(s) ? s : [])
        setRoles(Array.isArray(r) ? r : [])
      })
      .catch(err => console.error('Error cargando metadatos admin:', err))
      .finally(() => setLoadingMeta(false))
  }, [])

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Panel de Administración</h1>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {/* Tab headers */}
        <div className="border-b border-gray-100">
          <div className="flex overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setTabActivo(tab.key)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  tabActivo === tab.key
                    ? 'border-teal-500 text-teal-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="p-6">
          {loadingMeta ? (
            <Spinner />
          ) : (
            <>
              {tabActivo === 'usuarios' && (
                <TabUsuarios salas={salas} roles={roles} />
              )}
              {tabActivo === 'salas' && (
                <TabSalas />
              )}
              {tabActivo === 'tipificaciones' && (
                <TabCatalogo
                  titulo="Tipificaciones"
                  fetchFn={getTipificaciones}
                  createFn={createTipificacion}
                  updateFn={updateTipificacion}
                />
              )}
              {tabActivo === 'fuentes' && (
                <TabCatalogo
                  titulo="Fuentes"
                  fetchFn={getFuentes}
                  createFn={createFuente}
                  updateFn={updateFuente}
                />
              )}
              {tabActivo === 'formas_pago' && (
                <TabFormasPago />
              )}
              {tabActivo === 'productos' && (
                <TabProductos />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
