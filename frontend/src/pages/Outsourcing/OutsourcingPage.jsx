import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { getEmpresas, createEmpresa, updateEmpresa, getOutsourcingStats, getOutsourcingSalas, crearLeadOutsourcing, cargaMasivaOutsourcing, getMisLeads, getMiResumen } from '../../api/outsourcing'

export default function OutsourcingPage() {
  const { usuario } = useAuth()
  const { addToast: toast } = useToast()
  const esOutsourcing = usuario?.rol === 'outsourcing'

  const [tab, setTab] = useState(esOutsourcing ? 'mi_panel' : 'empresas')
  const [empresas, setEmpresas] = useState([])
  const [stats, setStats] = useState([])
  const [salas, setSalas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ nombre: '', ciudad: '', contacto_nombre: '', contacto_telefono: '', contacto_email: '', notas: '' })
  const [guardando, setGuardando] = useState(false)
  const [periodo, setPeriodo] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' }).slice(0, 7))

  // Estado para carga de leads
  const [leadForm, setLeadForm] = useState({ nombre: '', telefono: '', fecha_cita: '', sala_id: '', patologia: '', observacion: '', outsourcing_empresa_id: '' })
  const [guardandoLead, setGuardandoLead] = useState(false)

  // Estado para carga masiva
  const [archivo, setArchivo] = useState(null)
  const [masivaSalaId, setMasivaSalaId] = useState('')
  const [masivaEmpresaId, setMasivaEmpresaId] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [resultado, setResultado] = useState(null)
  const fileInputRef = useRef(null)

  // Estado para Mi Panel (outsourcing)
  const [resumen, setResumen] = useState(null)
  const [misLeads, setMisLeads] = useState([])
  const [loadingPanel, setLoadingPanel] = useState(false)
  const [periodoPanel, setPeriodoPanel] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' }).slice(0, 7))

  useEffect(() => { if (!esOutsourcing) cargarDatos(); else cargarMiPanel() }, [])
  useEffect(() => { if (tab === 'stats') cargarStats() }, [tab, periodo])
  useEffect(() => { if (tab === 'mi_panel') cargarMiPanel() }, [tab, periodoPanel])
  useEffect(() => {
    if (tab === 'cargar') {
      if (salas.length === 0) cargarSalas()
      if (empresas.length === 0) cargarDatos()
    }
  }, [tab])

  async function cargarDatos() {
    try {
      setLoading(true)
      const data = await getEmpresas()
      setEmpresas(data)
    } catch (e) {
      setError('Error al cargar empresas')
      toast?.('Error al cargar datos', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function cargarSalas() {
    try {
      const data = await getOutsourcingSalas()
      setSalas(data)
    } catch (e) {
      console.error('Error cargando salas:', e)
      toast?.('Error al cargar datos', 'error')
    }
  }

  async function cargarStats() {
    try {
      const [anio, mes] = periodo.split('-')
      const fechaInicio = `${anio}-${mes}-01`
      const ultimoDia = new Date(Number(anio), Number(mes), 0).getDate()
      const fechaFin = `${anio}-${mes}-${ultimoDia}`
      const data = await getOutsourcingStats({ fecha_inicio: fechaInicio, fecha_fin: fechaFin })
      setStats(data.data || [])
    } catch (e) {
      console.error(e)
      toast?.('Error al cargar datos', 'error')
    }
  }

  async function cargarMiPanel() {
    try {
      setLoadingPanel(true)
      const [resumenData, leadsData] = await Promise.all([
        getMiResumen({ mes: periodoPanel }),
        getMisLeads({ mes: periodoPanel }),
      ])
      setResumen(resumenData)
      setMisLeads(leadsData)
    } catch (e) {
      console.error(e)
      setError('Error al cargar panel')
      toast?.('Error al cargar datos', 'error')
    } finally {
      setLoadingPanel(false)
    }
  }

  function formatMoney(val) {
    return '$' + Number(val || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function formatDate(d) {
    if (!d) return '--'
    return new Date(d).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const estadoColor = (estado) => {
    const colores = {
      confirmada: 'bg-blue-100 text-blue-700',
      tentativa: 'bg-yellow-100 text-yellow-700',
      tour: 'bg-green-100 text-green-700',
      no_tour: 'bg-red-100 text-red-700',
      inasistencia: 'bg-gray-100 text-gray-600',
      nueva: 'bg-purple-100 text-purple-700',
    }
    return colores[estado] || 'bg-gray-100 text-gray-600'
  }

  function abrirNuevo() {
    setEditando(null)
    setForm({ nombre: '', ciudad: '', contacto_nombre: '', contacto_telefono: '', contacto_email: '', notas: '' })
    setShowModal(true)
  }

  function abrirEditar(emp) {
    setEditando(emp)
    setForm({
      nombre: emp.nombre,
      ciudad: emp.ciudad || '',
      contacto_nombre: emp.contacto_nombre || '',
      contacto_telefono: emp.contacto_telefono || '',
      contacto_email: emp.contacto_email || '',
      notas: emp.notas || ''
    })
    setShowModal(true)
  }

  async function guardar() {
    if (!form.nombre.trim()) return
    setGuardando(true)
    try {
      if (editando) {
        const updated = await updateEmpresa(editando.id, form)
        setEmpresas(prev => prev.map(e => e.id === editando.id ? updated : e))
      } else {
        const nueva = await createEmpresa(form)
        setEmpresas(prev => [...prev, nueva])
      }
      setShowModal(false)
    } catch (e) {
      setError('Error al guardar empresa')
    } finally {
      setGuardando(false)
    }
  }

  // ── Crear lead individual ──
  async function guardarLead() {
    const { nombre, telefono, fecha_cita, sala_id } = leadForm
    if (!nombre.trim() || !telefono.trim() || !fecha_cita || !sala_id) {
      setError('Nombre, telefono, fecha de cita y sala son requeridos')
      return
    }
    setGuardandoLead(true)
    setError(null)
    try {
      await crearLeadOutsourcing({
        ...leadForm,
        sala_id: Number(leadForm.sala_id),
        outsourcing_empresa_id: leadForm.outsourcing_empresa_id ? Number(leadForm.outsourcing_empresa_id) : null,
      })
      setSuccess('Lead creado exitosamente. Aparecera en el pre-manifiesto de las hostess.')
      setLeadForm({ nombre: '', telefono: '', fecha_cita: '', sala_id: leadForm.sala_id, patologia: '', observacion: '', outsourcing_empresa_id: leadForm.outsourcing_empresa_id })
      setTimeout(() => setSuccess(null), 4000)
    } catch (e) {
      setError(e.response?.data?.error || 'Error al crear lead')
    } finally {
      setGuardandoLead(false)
    }
  }

  // ── Carga masiva ──
  async function ejecutarCargaMasiva() {
    if (!archivo || !masivaSalaId) {
      setError('Selecciona un archivo y una sala')
      return
    }
    setSubiendo(true)
    setError(null)
    setResultado(null)
    try {
      const fd = new FormData()
      fd.append('archivo', archivo)
      fd.append('config', JSON.stringify({
        sala_id: Number(masivaSalaId),
        outsourcing_empresa_id: masivaEmpresaId ? Number(masivaEmpresaId) : null,
      }))
      const res = await cargaMasivaOutsourcing(fd)
      setResultado(res)
      setArchivo(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (e) {
      setError(e.response?.data?.error || 'Error al procesar archivo')
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Gestion de Outsourcing</h1>
        <p className="text-gray-500 text-sm mt-1">Administra empresas de call center externas y sus metricas</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-bold">X</button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 flex justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700 font-bold">X</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          ...(esOutsourcing ? [['mi_panel', 'Mi Panel']] : []),
          ['empresas', 'Empresas'],
          ['cargar', 'Cargar Leads'],
          ['stats', 'Estadisticas'],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-all duration-200 ${tab === id ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ═══════════════ TAB MI PANEL (outsourcing) ═══════════════ */}
      {tab === 'mi_panel' && (
        <div className="tab-content-enter">
          {/* Filtro de mes */}
          <div className="flex gap-3 mb-6">
            <input
              type="month"
              value={periodoPanel}
              onChange={e => setPeriodoPanel(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <button onClick={cargarMiPanel} className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-teal-700">
              Actualizar
            </button>
          </div>

          {loadingPanel ? (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="rounded-xl border border-gray-200 p-4">
                    <div className="shimmer h-3 w-20 mb-2 rounded" />
                    <div className="shimmer h-7 w-14 rounded" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Tarjetas KPI */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                {[
                  { label: 'Leads del mes', valor: resumen?.leads_mes || 0, color: 'bg-blue-50 text-blue-700', borde: 'border-blue-200' },
                  { label: 'Citas agendadas', valor: resumen?.citas_agendadas || 0, color: 'bg-indigo-50 text-indigo-700', borde: 'border-indigo-200' },
                  { label: 'Tours', valor: resumen?.tours || 0, color: 'bg-green-50 text-green-700', borde: 'border-green-200' },
                  { label: 'Ventas cerradas', valor: resumen?.ventas_cerradas || 0, color: 'bg-emerald-50 text-emerald-700', borde: 'border-emerald-200' },
                  { label: 'Monto vendido', valor: formatMoney(resumen?.monto_vendido), color: 'bg-purple-50 text-purple-700', borde: 'border-purple-200', esMonto: true },
                  { label: 'Total cobrado', valor: formatMoney(resumen?.total_cobrado), color: 'bg-teal-50 text-teal-700', borde: 'border-teal-200', esMonto: true },
                ].map((kpi) => (
                  <div key={kpi.label} className={`rounded-xl border ${kpi.borde} ${kpi.color} p-4 hover-lift`}>
                    <p className="text-xs font-medium opacity-70 mb-1">{kpi.label}</p>
                    <p className={`font-bold ${kpi.esMonto ? 'text-lg' : 'text-2xl'}`}>{kpi.valor}</p>
                  </div>
                ))}
              </div>

              {/* Tabla de mis leads */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <h3 className="text-sm font-semibold text-gray-700">Mis leads ({misLeads.length})</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {['Nombre', 'Telefono', 'Fecha cita', 'Estado', 'Visita', 'Contrato', 'Monto', 'Pagado', 'Saldo'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {misLeads.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center py-12 text-gray-400">No tienes leads en este periodo</td>
                        </tr>
                      ) : misLeads.map(lead => (
                        <tr key={lead.lead_id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">
                            {lead.nombres} {lead.apellidos}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{lead.telefono || '--'}</td>
                          <td className="px-4 py-3 text-gray-600">{formatDate(lead.fecha_cita)}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${estadoColor(lead.estado)}`}>
                              {lead.estado}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {lead.calificacion ? (
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${lead.calificacion === 'TOUR' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                {lead.calificacion}
                              </span>
                            ) : '--'}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {lead.numero_contrato ? (
                              <span className="text-teal-700 font-medium">{lead.numero_contrato}</span>
                            ) : '--'}
                          </td>
                          <td className="px-4 py-3 text-gray-800 font-medium">
                            {lead.contrato_id ? formatMoney(lead.monto_total) : '--'}
                          </td>
                          <td className="px-4 py-3 text-green-700 font-medium">
                            {lead.contrato_id ? formatMoney(lead.total_pagado) : '--'}
                          </td>
                          <td className="px-4 py-3 text-orange-600 font-medium">
                            {lead.contrato_id ? formatMoney(lead.saldo) : '--'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════ TAB EMPRESAS ═══════════════ */}
      {tab === 'empresas' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm text-gray-500">{empresas.length} empresas registradas</span>
            <button onClick={abrirNuevo} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
              + Nueva empresa
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-400">Cargando...</div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Empresa', 'Ciudad', 'Contacto', 'Telefono', 'Email', 'Estado', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {empresas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-gray-400">No hay empresas registradas</td>
                    </tr>
                  ) : empresas.map(emp => (
                    <tr key={emp.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{emp.nombre}</td>
                      <td className="px-4 py-3 text-gray-600">{emp.ciudad || '---'}</td>
                      <td className="px-4 py-3 text-gray-600">{emp.contacto_nombre || '---'}</td>
                      <td className="px-4 py-3 text-gray-600">{emp.contacto_telefono || '---'}</td>
                      <td className="px-4 py-3 text-gray-600">{emp.contacto_email || '---'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${emp.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {emp.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => abrirEditar(emp)}
                          className="text-teal-600 hover:text-teal-800 text-xs border border-teal-200 px-2 py-1 rounded"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ TAB CARGAR LEADS ═══════════════ */}
      {tab === 'cargar' && (
        <div className="space-y-8">

          {/* ── Formulario individual ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Carga individual</h2>
            <p className="text-sm text-gray-500 mb-4">Registra una cita manualmente. El lead quedara con estado "confirmada" y aparecera en el pre-manifiesto.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
                <input
                  type="text"
                  value={leadForm.nombre}
                  onChange={e => setLeadForm(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Juan Perez Garcia"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefono *</label>
                <input
                  type="tel"
                  value={leadForm.telefono}
                  onChange={e => setLeadForm(p => ({ ...p, telefono: e.target.value }))}
                  placeholder="0991234567"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de cita *</label>
                <input
                  type="datetime-local"
                  value={leadForm.fecha_cita}
                  onChange={e => setLeadForm(p => ({ ...p, fecha_cita: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sala *</label>
                <select
                  value={leadForm.sala_id}
                  onChange={e => setLeadForm(p => ({ ...p, sala_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">Seleccionar sala...</option>
                  {salas.map(s => <option key={s.id} value={s.id}>{s.nombre} {s.ciudad ? `(${s.ciudad})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Empresa outsourcing</label>
                <select
                  value={leadForm.outsourcing_empresa_id}
                  onChange={e => setLeadForm(p => ({ ...p, outsourcing_empresa_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">Sin empresa</option>
                  {empresas.filter(e => e.activo).map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patologia</label>
                <input
                  type="text"
                  value={leadForm.patologia}
                  onChange={e => setLeadForm(p => ({ ...p, patologia: e.target.value }))}
                  placeholder="Ej: Rodilla, Columna..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div className="md:col-span-2 lg:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Observacion</label>
                <input
                  type="text"
                  value={leadForm.observacion}
                  onChange={e => setLeadForm(p => ({ ...p, observacion: e.target.value }))}
                  placeholder="Notas adicionales..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={guardarLead}
                disabled={guardandoLead || !leadForm.nombre.trim() || !leadForm.telefono.trim() || !leadForm.fecha_cita || !leadForm.sala_id}
                className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {guardandoLead ? 'Guardando...' : 'Guardar lead'}
              </button>
            </div>
          </div>

          {/* ── Carga masiva ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Carga masiva desde archivo</h2>
            <p className="text-sm text-gray-500 mb-4">
              Sube un archivo Excel (.xlsx, .xls) o CSV con las citas. Las columnas se detectan automaticamente por nombre
              (nombre, telefono, fecha_cita, patologia, observacion). El orden no importa.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sala *</label>
                <select
                  value={masivaSalaId}
                  onChange={e => setMasivaSalaId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">Seleccionar sala...</option>
                  {salas.map(s => <option key={s.id} value={s.id}>{s.nombre} {s.ciudad ? `(${s.ciudad})` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Empresa outsourcing</label>
                <select
                  value={masivaEmpresaId}
                  onChange={e => setMasivaEmpresaId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">Sin empresa</option>
                  {empresas.filter(e => e.activo).map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Archivo Excel/CSV *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={e => setArchivo(e.target.files[0] || null)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                />
              </div>
            </div>

            {archivo && (
              <div className="bg-gray-50 rounded-lg p-3 mb-4 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{archivo.name}</span>
                  <span className="ml-2 text-gray-400">({(archivo.size / 1024).toFixed(1)} KB)</span>
                </div>
                <button
                  onClick={ejecutarCargaMasiva}
                  disabled={subiendo || !masivaSalaId}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {subiendo ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Procesando...
                    </span>
                  ) : 'Subir y procesar'}
                </button>
              </div>
            )}

            {/* Resultado de carga masiva */}
            {resultado && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-gray-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-gray-800">{resultado.total_procesadas}</div>
                    <div className="text-xs text-gray-500 mt-1">Total procesadas</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-700">{resultado.importados}</div>
                    <div className="text-xs text-green-600 mt-1">Importados</div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-amber-700">{resultado.duplicados}</div>
                    <div className="text-xs text-amber-600 mt-1">Duplicados</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-red-700">{resultado.errores}</div>
                    <div className="text-xs text-red-600 mt-1">Errores</div>
                  </div>
                </div>

                {resultado.importados > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                    Se importaron {resultado.importados} citas desde "{resultado.archivo_nombre}". Apareceran en el pre-manifiesto de las hostess.
                  </div>
                )}

                {resultado.detalles_errores?.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="text-sm font-medium text-red-700 mb-1">Detalle de errores:</div>
                    <ul className="text-xs text-red-600 space-y-1">
                      {resultado.detalles_errores.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}

                {resultado.duplicados_detalle?.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="text-sm font-medium text-amber-700 mb-1">Detalle de duplicados ({resultado.duplicados_detalle.length}):</div>
                    <div className="max-h-48 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-amber-600">
                            <th className="text-left py-1 pr-2">Fila</th>
                            <th className="text-left py-1 pr-2">Nombre</th>
                            <th className="text-left py-1 pr-2">Telefono</th>
                            <th className="text-left py-1">Motivo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resultado.duplicados_detalle.map((d, i) => (
                            <tr key={i} className="text-amber-700 border-t border-amber-100">
                              <td className="py-1 pr-2">{d.fila}</td>
                              <td className="py-1 pr-2">{d.nombre}</td>
                              <td className="py-1 pr-2">{d.telefono}</td>
                              <td className="py-1">{d.motivo}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ TAB ESTADISTICAS ═══════════════ */}
      {tab === 'stats' && (
        <div className="tab-content-enter">
          <div className="flex gap-3 mb-4">
            <input
              type="month"
              value={periodo}
              onChange={e => setPeriodo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <button onClick={cargarStats} className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm">
              Actualizar
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Empresa', 'Ciudad', 'Leads', 'Citas', 'Asistencias', 'Tours', 'Efect. Datos', 'Conv. Tour'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-400">No hay leads de outsourcing en este periodo</td>
                  </tr>
                ) : stats.map(s => (
                  <tr key={s.empresa_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{s.empresa}</td>
                    <td className="px-4 py-3 text-gray-600">{s.ciudad}</td>
                    <td className="px-4 py-3">{s.total_leads}</td>
                    <td className="px-4 py-3">{s.citas}</td>
                    <td className="px-4 py-3">{s.asistencias}</td>
                    <td className="px-4 py-3 font-bold text-teal-700">{s.tours}</td>
                    <td className="px-4 py-3">{s.efectividad_datos}%</td>
                    <td className="px-4 py-3 font-bold text-purple-700">{s.efectividad_tour}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal crear/editar empresa */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">{editando ? 'Editar empresa' : 'Nueva empresa'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">X</button>
            </div>
            <div className="p-6 space-y-4">
              {[
                ['nombre', 'Nombre *', 'text'],
                ['ciudad', 'Ciudad', 'text'],
                ['contacto_nombre', 'Nombre de contacto', 'text'],
                ['contacto_telefono', 'Telefono de contacto', 'tel'],
                ['contacto_email', 'Email de contacto', 'email'],
              ].map(([field, label, type]) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type={type}
                    value={form[field]}
                    onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea
                  value={form.notas}
                  onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={guardar}
                disabled={guardando || !form.nombre.trim()}
                className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
