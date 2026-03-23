import { useState, useRef, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getSalas, getUsuarios, getFormasPago, getFuentes, getTipificaciones } from '../../api/admin'
import { previewImport, ejecutarImport, descargarDuplicados } from '../../api/importar'
import { useEffect } from 'react'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const CAMPOS_CRM = [
  { key: 'nombre_completo', label: 'Nombre Completo',     req: true,  desc: 'Apellidos y Nombres juntos' },
  { key: 'telefono',        label: 'Telefono Celular',    req: true,  desc: 'Celular principal (10 digitos)' },
  { key: 'telefono2',       label: 'Telefono Fijo/Alt.',  req: false, desc: 'Segundo telefono' },
  { key: 'ciudad',          label: 'Ciudad',              req: false, desc: 'Ciudad del cliente' },
  { key: 'genero',          label: 'Genero',              req: false, desc: 'MASCULINO / FEMENINO' },
  { key: 'direccion',       label: 'Direccion',           req: false, desc: 'Direccion completa' },
  { key: 'cedula',          label: 'Cedula / Documento',  req: false, desc: 'Numero de identidad' },
]

const PASO = { UPLOAD: 1, MAPEO: 2, CONFIG: 3, RESULTADO: 4 }

function letraColumna(idx) {
  let result = ''
  let n = idx
  while (n >= 0) {
    result = String.fromCharCode(65 + (n % 26)) + result
    n = Math.floor(n / 26) - 1
  }
  return result
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ImportarPage() {
  const { usuario } = useAuth()
  const fileRef = useRef()

  const [paso, setPaso]         = useState(PASO.UPLOAD)
  const [archivo, setArchivo]   = useState(null)
  const [preview, setPreview]   = useState(null) // respuesta del backend
  const [cargando, setCargando] = useState(false)
  const [error, setError]       = useState('')

  // Estado de mapeo: { nombre_completo: 0, telefono: 1, ... }  — null = no mapeado
  const [mapeo, setMapeo] = useState(() =>
    Object.fromEntries(CAMPOS_CRM.map(c => [c.key, null]))
  )

  const [tieneEncabezado, setTieneEncabezado] = useState(false)

  // Config de importacion
  const [salas,        setSalas]        = useState([])
  const [usuarios,     setUsuarios]     = useState([])
  const [fuentes,      setFuentes]      = useState([])
  const [tipificaciones, setTipificaciones] = useState([])
  const [config, setConfig] = useState({
    sala_id: usuario?.sala_id || '',
    tmk_id: '',          // '' = round-robin
    fuente_id: '',
    tipificacion_id: '',
  })

  const [resultado, setResultado] = useState(null)
  const [importando, setImportando] = useState(false)
  const [descargandoDup, setDescargandoDup] = useState(false)

  useEffect(() => {
    getSalas().then(s => setSalas(Array.isArray(s) ? s : [])).catch(console.error)
    getUsuarios().then(u => setUsuarios(Array.isArray(u) ? u : [])).catch(console.error)
    getFuentes().then(d => setFuentes(Array.isArray(d) ? d.filter(f => f.activo) : [])).catch(console.error)
    getTipificaciones().then(d => setTipificaciones(Array.isArray(d) ? d.filter(t => t.activo) : [])).catch(console.error)
  }, [])

  // ── Drag & Drop ────────────────────────────────────────────
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) seleccionarArchivo(file)
  }, [])

  const seleccionarArchivo = (file) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setError('Solo se aceptan archivos Excel (.xlsx o .xls)')
      return
    }
    setArchivo(file)
    setError('')
  }

  // ── Paso 1 → 2: Preview ───────────────────────────────────
  async function handlePreview() {
    if (!archivo) { setError('Selecciona un archivo primero'); return }
    setCargando(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('archivo', archivo)
      const data = await previewImport(fd)
      setPreview(data)
      setTieneEncabezado(data.esEncabezado)
      // Auto-mapear si la primera fila parece encabezado
      if (data.esEncabezado && data.preview[0]) {
        const auto = { ...mapeo }
        data.preview[0].forEach((header, idx) => {
          const h = String(header).toLowerCase()
          if (h.includes('nombre') || h.includes('name')) auto.nombre_completo = idx
          else if (h.includes('celular') || h.includes('movil') || h.includes('móvil')) auto.telefono = idx
          else if (h.includes('telefono') || h.includes('teléfono') || h.includes('fijo')) {
            if (auto.telefono === null) auto.telefono = idx
            else auto.telefono2 = idx
          }
          else if (h.includes('ciudad') || h.includes('city')) auto.ciudad = idx
          else if (h.includes('genero') || h.includes('género') || h.includes('sexo')) auto.genero = idx
          else if (h.includes('direccion') || h.includes('dirección') || h.includes('address')) auto.direccion = idx
          else if (h.includes('cedula') || h.includes('cédula') || h.includes('doc')) auto.cedula = idx
        })
        setMapeo(auto)
      }
      setPaso(PASO.MAPEO)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al leer el archivo')
    } finally {
      setCargando(false)
    }
  }

  // ── Paso 2 → 3: Validar mapeo ─────────────────────────────
  function handleValidarMapeo() {
    const faltantes = CAMPOS_CRM.filter(c => c.req && mapeo[c.key] === null).map(c => c.label)
    if (faltantes.length > 0) {
      setError(`Mapea los campos requeridos: ${faltantes.join(', ')}`)
      return
    }
    setError('')
    setPaso(PASO.CONFIG)
  }

  // ── Paso 3 → 4: Ejecutar importacion ──────────────────────
  async function handleImportar() {
    // Solo sala y fuente son requeridos; tipificacion es opcional
    if (!config.sala_id || !config.fuente_id) {
      setError('Completa sala y fuente antes de importar')
      return
    }
    setImportando(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('archivo', archivo)
      fd.append('config', JSON.stringify({
        ...config,
        tmk_id: config.tmk_id || null,
        tipificacion_id: config.tipificacion_id || null,
        tiene_encabezado: tieneEncabezado,
        mapeo,
      }))
      const res = await ejecutarImport(fd)
      setResultado(res)
      setPaso(PASO.RESULTADO)
    } catch (err) {
      setError(err.response?.data?.error || 'Error durante la importacion')
    } finally {
      setImportando(false)
    }
  }

  // ── Descargar duplicados como Excel ─────────────────────────
  async function handleDescargarDuplicados() {
    if (!resultado) return
    setDescargandoDup(true)
    try {
      const blob = await descargarDuplicados(
        resultado.duplicados_bd_detalle || [],
        resultado.duplicados_internos_detalle || []
      )
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `duplicados_${resultado.archivo_nombre || 'importacion'}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError('Error al descargar los duplicados')
      console.error(err)
    } finally {
      setDescargandoDup(false)
    }
  }

  // ── Reset ─────────────────────────────────────────────────
  function resetear() {
    setArchivo(null)
    setPreview(null)
    setMapeo(Object.fromEntries(CAMPOS_CRM.map(c => [c.key, null])))
    setTieneEncabezado(false)
    setConfig({ sala_id: usuario?.sala_id || '', tmk_id: '', fuente_id: '', tipificacion_id: '' })
    setResultado(null)
    setError('')
    setPaso(PASO.UPLOAD)
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── Filas de preview a mostrar (sin encabezado si aplica) ─
  const filasPreview = preview
    ? (tieneEncabezado ? preview.preview.slice(1, 8) : preview.preview.slice(0, 7))
    : []
  const encabezadoPreview = preview
    ? (tieneEncabezado ? preview.preview[0] : null)
    : null

  const tmksDeSala = usuarios.filter(u =>
    u.rol === 'tmk' && (!config.sala_id || String(u.sala_id) === String(config.sala_id))
  )

  const totalDuplicados = (resultado?.duplicados_bd || 0) + (resultado?.duplicados_internos || 0)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Importar Base de Datos</h1>
        <p className="text-sm text-gray-500 mt-1">Carga masiva de leads desde archivos Excel (.xlsx)</p>
      </div>

      {/* ── Stepper ── */}
      <div className="flex items-center gap-2">
        {[
          { n: 1, label: 'Subir archivo' },
          { n: 2, label: 'Mapear columnas' },
          { n: 3, label: 'Configurar' },
          { n: 4, label: 'Resultado' },
        ].map((s, i, arr) => (
          <div key={s.n} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              paso > s.n ? 'bg-teal-600 text-white' :
              paso === s.n ? 'bg-teal-500 text-white ring-2 ring-teal-200' :
              'bg-gray-200 text-gray-500'
            }`}>{paso > s.n ? '\u2713' : s.n}</div>
            <span className={`text-xs font-medium hidden sm:block ${paso === s.n ? 'text-teal-700' : 'text-gray-400'}`}>{s.label}</span>
            {i < arr.length - 1 && <div className={`w-8 h-0.5 ${paso > s.n ? 'bg-teal-400' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* ── Error global ── */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 ml-2">&times;</button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          PASO 1: Subir archivo
      ══════════════════════════════════════════════════════ */}
      {paso === PASO.UPLOAD && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
          <h2 className="font-semibold text-gray-700">1. Selecciona el archivo Excel</h2>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
              dragging ? 'border-teal-400 bg-teal-50' : 'border-gray-200 hover:border-teal-300 hover:bg-gray-50'
            }`}
          >
            <div className="text-4xl mb-3">&#128194;</div>
            {archivo ? (
              <>
                <p className="font-semibold text-teal-700 text-sm">{archivo.name}</p>
                <p className="text-gray-400 text-xs mt-1">{(archivo.size / 1024).toFixed(0)} KB</p>
              </>
            ) : (
              <>
                <p className="text-gray-600 text-sm font-medium">Arrastra tu archivo aqui o haz clic para seleccionar</p>
                <p className="text-gray-400 text-xs mt-1">Solo archivos .xlsx o .xls (max. 20 MB)</p>
              </>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={e => e.target.files[0] && seleccionarArchivo(e.target.files[0])}
          />

          {/* Formato esperado */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-1">
            <p className="font-semibold">Formatos soportados:</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs text-blue-700">
              <li>Solo nombre + telefono (minimo)</li>
              <li>Nombre + celular + telefono fijo</li>
              <li>Nombre + celular + fijo + ciudad + genero + direccion</li>
              <li>Los telefonos pueden estar como 999xxxxxx o 0999xxxxxx o 00593...</li>
              <li>La primera fila puede ser encabezado o directamente datos</li>
            </ul>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handlePreview}
              disabled={!archivo || cargando}
              className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-medium"
            >
              {cargando ? 'Leyendo archivo...' : 'Continuar \u2192'}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          PASO 2: Mapear columnas
      ══════════════════════════════════════════════════════ */}
      {paso === PASO.MAPEO && preview && (
        <div className="space-y-5">

          {/* Info del archivo */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="font-semibold text-gray-700">2. Mapear columnas</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {archivo.name} &middot; Hoja: {preview.sheetName} &middot; {preview.totalFilas} filas &middot; {preview.totalCols} columnas
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={tieneEncabezado} onChange={e => setTieneEncabezado(e.target.checked)} className="w-4 h-4 accent-teal-600" />
                  Primera fila es encabezado
                </label>
              </div>
            </div>

            {/* Preview de filas */}
            <div className="mt-4 overflow-x-auto border border-gray-100 rounded-lg">
              <table className="text-xs w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-2 py-1.5 text-gray-400 font-normal text-left w-6">#</th>
                    {(preview.preview[0] || []).map((_, ci) => (
                      <th key={ci} className="px-2 py-1.5 text-teal-700 font-bold text-left whitespace-nowrap">
                        Col {letraColumna(ci)}
                      </th>
                    ))}
                  </tr>
                  {tieneEncabezado && encabezadoPreview && (
                    <tr className="bg-yellow-50">
                      <td className="px-2 py-1 text-gray-300 italic">hdr</td>
                      {encabezadoPreview.map((v, ci) => (
                        <td key={ci} className="px-2 py-1 text-yellow-700 font-medium italic whitespace-nowrap">{v || '\u2014'}</td>
                      ))}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {filasPreview.map((fila, ri) => (
                    <tr key={ri} className={ri % 2 === 0 ? '' : 'bg-gray-50/50'}>
                      <td className="px-2 py-1 text-gray-300">{ri + 1}</td>
                      {fila.map((v, ci) => (
                        <td key={ci} className="px-2 py-1 text-gray-700 whitespace-nowrap max-w-[160px] truncate" title={String(v)}>{String(v) || '\u2014'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mapeo de campos */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-gray-700 mb-4">Que contiene cada columna?</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CAMPOS_CRM.map(campo => (
                <div key={campo.key} className={`border rounded-lg p-4 ${mapeo[campo.key] !== null ? 'border-teal-200 bg-teal-50/30' : campo.req ? 'border-red-200 bg-red-50/20' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-sm font-semibold text-gray-700">{campo.label}</span>
                      {campo.req && <span className="ml-1 text-xs text-red-500">*</span>}
                    </div>
                    {mapeo[campo.key] !== null && (
                      <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-mono">
                        Col {letraColumna(mapeo[campo.key])}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{campo.desc}</p>
                  <select
                    value={mapeo[campo.key] ?? ''}
                    onChange={e => {
                      const val = e.target.value === '' ? null : parseInt(e.target.value)
                      setMapeo(m => ({ ...m, [campo.key]: val }))
                    }}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">&mdash; No mapear &mdash;</option>
                    {(preview.preview[0] || []).map((_, ci) => {
                      const muestra = filasPreview[0]?.[ci]
                      return (
                        <option key={ci} value={ci}>
                          Columna {letraColumna(ci)}{tieneEncabezado && preview.preview[0][ci] ? ` (${preview.preview[0][ci]})` : ''}{muestra ? ` — "${String(muestra).slice(0, 20)}"` : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex justify-between mt-5 pt-4 border-t border-gray-100">
              <button onClick={() => setPaso(PASO.UPLOAD)} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
                &larr; Volver
              </button>
              <button onClick={handleValidarMapeo} className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg text-sm font-medium">
                Continuar &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          PASO 3: Configurar importacion
      ══════════════════════════════════════════════════════ */}
      {paso === PASO.CONFIG && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
          <h2 className="font-semibold text-gray-700">3. Configurar importacion</h2>
          <p className="text-sm text-gray-500">
            Se importaran aprox. <strong>{preview.totalFilas - (tieneEncabezado ? 1 : 0)}</strong> registros del archivo <strong>{archivo.name}</strong>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Sala destino *</label>
              <select
                value={config.sala_id}
                onChange={e => setConfig(c => ({ ...c, sala_id: e.target.value, tmk_id: '' }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Seleccionar sala...</option>
                {salas.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Asignar a TMK</label>
              <select
                value={config.tmk_id}
                onChange={e => setConfig(c => ({ ...c, tmk_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Distribuir automaticamente (round-robin)</option>
                {tmksDeSala.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                {config.tmk_id
                  ? 'Todos los leads se asignaran al TMK seleccionado'
                  : `Se distribuiran entre ${tmksDeSala.length || 0} TMKs activos de la sala`}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Fuente de los leads *</label>
              <select
                value={config.fuente_id}
                onChange={e => setConfig(c => ({ ...c, fuente_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Seleccionar fuente...</option>
                {fuentes.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Tipificacion inicial <span className="text-gray-400 font-normal">(opcional)</span></label>
              <select
                value={config.tipificacion_id}
                onChange={e => setConfig(c => ({ ...c, tipificacion_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Sin tipificacion</option>
                {tipificaciones.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">Si no seleccionas tipificacion, los leads se crearan en estado "pendiente"</p>
            </div>
          </div>

          {/* Resumen del mapeo */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Resumen del mapeo</p>
            <div className="flex flex-wrap gap-2">
              {CAMPOS_CRM.map(campo => (
                mapeo[campo.key] !== null ? (
                  <span key={campo.key} className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded-full">
                    {campo.label} &rarr; Col {letraColumna(mapeo[campo.key])}
                  </span>
                ) : campo.req ? (
                  <span key={campo.key} className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">
                    {campo.label} sin mapear
                  </span>
                ) : null
              ))}
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button onClick={() => setPaso(PASO.MAPEO)} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
              &larr; Volver
            </button>
            <button
              onClick={handleImportar}
              disabled={importando || !config.sala_id || !config.fuente_id}
              className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white px-8 py-2.5 rounded-lg text-sm font-bold"
            >
              {importando
                ? <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Importando... puede tardar varios minutos
                  </span>
                : `Importar ${preview.totalFilas - (tieneEncabezado ? 1 : 0)} registros`}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          PASO 4: Resultado
      ══════════════════════════════════════════════════════ */}
      {paso === PASO.RESULTADO && resultado && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-700 mb-5">4. Resultado de la importacion</h2>

            {/* Tarjetas de resumen */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="rounded-xl p-4 bg-gray-50 border border-gray-200 text-center">
                <p className="text-xs font-semibold text-gray-500 uppercase">Procesadas</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{resultado.total_procesadas}</p>
              </div>
              <div className="rounded-xl p-4 bg-green-50 border border-green-200 text-center">
                <p className="text-xs font-semibold text-green-600 uppercase">Importados</p>
                <p className="text-3xl font-bold text-green-700 mt-1">{resultado.importados}</p>
              </div>
              <div className="rounded-xl p-4 bg-yellow-50 border border-yellow-200 text-center">
                <p className="text-xs font-semibold text-yellow-600 uppercase">Duplicados BD</p>
                <p className="text-3xl font-bold text-yellow-700 mt-1">{resultado.duplicados_bd || 0}</p>
                <p className="text-xs text-yellow-500 mt-0.5">ya existen en el sistema</p>
              </div>
              <div className="rounded-xl p-4 bg-blue-50 border border-blue-200 text-center">
                <p className="text-xs font-semibold text-blue-600 uppercase">Dup. Archivo</p>
                <p className="text-3xl font-bold text-blue-700 mt-1">{resultado.duplicados_internos || 0}</p>
                <p className="text-xs text-blue-500 mt-0.5">repetidos en el archivo</p>
              </div>
              <div className="rounded-xl p-4 bg-red-50 border border-red-200 text-center">
                <p className="text-xs font-semibold text-red-500 uppercase">Errores</p>
                <p className="text-3xl font-bold text-red-600 mt-1">{resultado.errores}</p>
              </div>
            </div>

            {/* Mensajes detallados */}
            <div className="mt-5 space-y-3">
              {/* Importados */}
              {resultado.importados > 0 && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
                  <span className="text-green-600 text-lg mt-0.5">&#10003;</span>
                  <div>
                    <p className="text-green-800 text-sm font-semibold">
                      {resultado.importados} registros importados exitosamente
                    </p>
                    <p className="text-green-600 text-xs mt-1">Los TMKs ya pueden ver sus leads en "Mis Leads de Hoy".</p>
                  </div>
                </div>
              )}

              {/* Duplicados BD */}
              {(resultado.duplicados_bd || 0) > 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-start gap-3">
                  <span className="text-yellow-600 text-lg mt-0.5">&#9888;</span>
                  <div className="flex-1">
                    <p className="text-yellow-800 text-sm font-semibold">
                      {resultado.duplicados_bd} duplicados con la base existente
                    </p>
                    <p className="text-yellow-600 text-xs mt-1">Estas personas ya tienen un lead en la sala seleccionada. No se crearon leads duplicados.</p>
                  </div>
                </div>
              )}

              {/* Duplicados internos */}
              {(resultado.duplicados_internos || 0) > 0 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
                  <span className="text-blue-500 text-lg mt-0.5">&#8505;</span>
                  <div>
                    <p className="text-blue-800 text-sm font-semibold">
                      {resultado.duplicados_internos} duplicados dentro del archivo
                    </p>
                    <p className="text-blue-600 text-xs mt-1">Registros con el mismo telefono repetidos en el archivo. Solo se importo la primera aparicion.</p>
                  </div>
                </div>
              )}

              {/* Errores */}
              {resultado.detalles_errores?.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs font-semibold text-red-700 mb-1">Primeros errores detectados:</p>
                  {resultado.detalles_errores.map((e, i) => (
                    <p key={i} className="text-xs text-red-600">{e}</p>
                  ))}
                </div>
              )}
            </div>

            {/* Botones de accion */}
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={resetear}
                className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium"
              >
                + Importar otra base
              </button>

              {totalDuplicados > 0 && (
                <button
                  onClick={handleDescargarDuplicados}
                  disabled={descargandoDup}
                  className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2"
                >
                  {descargandoDup ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Descargar Duplicados (Excel)
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
