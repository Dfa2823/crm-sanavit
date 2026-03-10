import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getVenta360 } from '../../api/ventas'

function formatFecha(iso) {
  if (!iso) return '—'
  const s = typeof iso === 'string' ? iso.split('T')[0] : iso
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

function formatMes(iso) {
  if (!iso) return '—'
  const s = typeof iso === 'string' ? iso.split('T')[0] : iso
  return new Date(s + 'T12:00:00').toLocaleDateString('es-EC', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatMoney(n) {
  const num = Number(n || 0)
  return `$${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

function estadoLabel(estado) {
  switch (estado) {
    case 'pagado':   return 'Pagado'
    case 'parcial':  return 'Parcial'
    case 'vencido':  return 'Vencido'
    default:         return 'Pendiente'
  }
}

export default function ContratoPrint() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getVenta360(id)
      .then(d => setData(d))
      .catch(err => setError(err.response?.data?.error || 'Error al cargar el contrato'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center h-screen text-gray-500 text-sm">
      Cargando contrato...
    </div>
  )
  if (error || !data) return (
    <div className="flex items-center justify-center h-screen text-red-600 text-sm">
      {error || 'No se pudo cargar el contrato'}
    </div>
  )

  const { contrato, productos, cuotas } = data

  const nombreCompleto = `${contrato.nombres || ''} ${contrato.apellidos || ''}`.trim()
  const valorCuota = contrato.monto_cuota
    ? contrato.monto_cuota
    : contrato.n_cuotas
      ? (contrato.monto_total || 0) / contrato.n_cuotas
      : 0

  return (
    <>
      {/* ── Estilos de impresión incrustados ── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
          .print-page {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 12mm 14mm !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
        }
        @page {
          size: A4 portrait;
          margin: 12mm 14mm;
        }
      `}</style>

      {/* ── Botones flotantes — solo en pantalla ── */}
      <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
        <button
          onClick={() => navigate(-1)}
          className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 text-sm border border-gray-300"
        >
          Volver
        </button>
        <button
          onClick={() => window.print()}
          className="bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 text-sm font-medium shadow"
        >
          Imprimir / Guardar PDF
        </button>
      </div>

      {/* ── Documento ── */}
      <div className="print-page max-w-4xl mx-auto my-10 bg-white shadow-xl rounded-xl px-16 py-12 text-gray-900 text-sm leading-relaxed">

        {/* ── Encabezado ── */}
        <div className="text-center mb-8 pb-6 border-b-2 border-gray-800">
          <h1 className="text-2xl font-bold tracking-widest uppercase text-gray-900">
            Sanavit Ecuador
          </h1>
          <p className="text-xs text-gray-500 mt-0.5 tracking-wide">
            Sistema de Salud y Bienestar
          </p>
          <div className="mt-5">
            <h2 className="text-base font-bold uppercase tracking-widest text-gray-800">
              Contrato de Afiliacion
            </h2>
            <p className="text-base font-bold text-teal-700 mt-1 font-mono">
              N° {contrato.numero_contrato || '—'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Fecha: {formatMes(contrato.fecha_contrato)} &nbsp;|&nbsp; Sala: {contrato.sala_nombre || '—'}
            </p>
          </div>
        </div>

        {/* ── Seccion 1: Datos del Afiliado ── */}
        <section className="mb-7">
          <h3 className="font-bold text-xs uppercase tracking-widest border-b border-gray-400 pb-1 mb-3 text-gray-700">
            1. Datos del Afiliado
          </h3>
          <div className="grid grid-cols-2 gap-x-10 gap-y-1.5 text-sm">
            {[
              ['Nombre completo',     nombreCompleto || '—'],
              ['Tipo de documento',   contrato.tipo_documento || '—'],
              ['N de documento',      contrato.num_documento || '—'],
              ['Fecha de nacimiento', formatFecha(contrato.fecha_nacimiento)],
              ['Estado civil',        contrato.estado_civil || '—'],
              ['Situacion laboral',   contrato.situacion_laboral || contrato.patologia || '—'],
              ['Telefono',            contrato.telefono || '—'],
              ['Email',               contrato.email || '—'],
              ['Ciudad',              contrato.ciudad || '—'],
              ['Direccion',           contrato.direccion || '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <span className="text-gray-500 min-w-[140px] shrink-0">{label}:</span>
                <span className="font-medium text-gray-800 break-all">{value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Seccion 2: Plan Contratado ── */}
        <section className="mb-7">
          <h3 className="font-bold text-xs uppercase tracking-widest border-b border-gray-400 pb-1 mb-3 text-gray-700">
            2. Plan Contratado — {contrato.tipo_plan || 'Plan'}
          </h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-3 py-1.5 text-left font-semibold text-gray-700">Descripcion</th>
                <th className="border border-gray-300 px-3 py-1.5 text-right font-semibold text-gray-700">Precio Unit.</th>
                <th className="border border-gray-300 px-3 py-1.5 text-center font-semibold text-gray-700">Cant.</th>
                <th className="border border-gray-300 px-3 py-1.5 text-right font-semibold text-gray-700">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {(productos || []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="border border-gray-300 px-3 py-2 text-center text-gray-400 italic">
                    Sin productos registrados
                  </td>
                </tr>
              ) : (
                (productos || []).map((p, i) => (
                  <tr key={p.id || i}>
                    <td className="border border-gray-300 px-3 py-1.5 text-gray-800">
                      {p.producto_nombre || p.nombre || '—'}
                    </td>
                    <td className="border border-gray-300 px-3 py-1.5 text-right">
                      {formatMoney(p.precio_unitario)}
                    </td>
                    <td className="border border-gray-300 px-3 py-1.5 text-center">
                      {p.cantidad || 1}
                    </td>
                    <td className="border border-gray-300 px-3 py-1.5 text-right">
                      {formatMoney(p.valor_total || p.subtotal || (p.precio_unitario * (p.cantidad || 1)))}
                    </td>
                  </tr>
                ))
              )}
              <tr className="bg-gray-50 font-bold">
                <td colSpan={3} className="border border-gray-300 px-3 py-1.5 text-right text-gray-700">
                  TOTAL
                </td>
                <td className="border border-gray-300 px-3 py-1.5 text-right text-gray-900">
                  {formatMoney(contrato.monto_total)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* ── Seccion 3: Plan de Pagos ── */}
        <section className="mb-7">
          <h3 className="font-bold text-xs uppercase tracking-widest border-b border-gray-400 pb-1 mb-3 text-gray-700">
            3. Plan de Pagos
          </h3>
          <div className="flex flex-wrap gap-6 mb-3 text-sm">
            <span><strong>Monto total:</strong> {formatMoney(contrato.monto_total)}</span>
            {contrato.cuota_inicial > 0 && (
              <span><strong>Cuota inicial:</strong> {formatMoney(contrato.cuota_inicial)}</span>
            )}
            <span><strong>N de cuotas:</strong> {contrato.n_cuotas || '—'}</span>
            <span><strong>Valor por cuota:</strong> {formatMoney(valorCuota)}</span>
            {contrato.dia_pago && (
              <span><strong>Dia de pago:</strong> dia {contrato.dia_pago} de cada mes</span>
            )}
          </div>
          {(cuotas || []).length > 0 && (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-3 py-1 text-center font-semibold text-gray-700">N</th>
                  <th className="border border-gray-300 px-3 py-1 text-center font-semibold text-gray-700">Fecha de vencimiento</th>
                  <th className="border border-gray-300 px-3 py-1 text-right font-semibold text-gray-700">Monto</th>
                  <th className="border border-gray-300 px-3 py-1 text-right font-semibold text-gray-700">Pagado</th>
                  <th className="border border-gray-300 px-3 py-1 text-center font-semibold text-gray-700">Estado</th>
                </tr>
              </thead>
              <tbody>
                {(cuotas || []).slice(0, 24).map((c, i) => {
                  const isVencida = !c.fecha_pago && c.estado !== 'pagado' && new Date(c.fecha_vencimiento) < new Date()
                  return (
                    <tr key={c.id || i} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                      <td className="border border-gray-300 px-3 py-1 text-center text-gray-600">
                        {c.numero_cuota || i + 1}
                      </td>
                      <td className="border border-gray-300 px-3 py-1 text-center text-gray-600">
                        {formatFecha(c.fecha_vencimiento)}
                      </td>
                      <td className="border border-gray-300 px-3 py-1 text-right">
                        {formatMoney(c.monto_esperado)}
                      </td>
                      <td className="border border-gray-300 px-3 py-1 text-right text-green-700">
                        {formatMoney(c.monto_pagado)}
                      </td>
                      <td className="border border-gray-300 px-3 py-1 text-center capitalize text-gray-600">
                        {isVencida ? 'Vencida' : estadoLabel(c.estado)}
                      </td>
                    </tr>
                  )
                })}
                {(cuotas || []).length > 24 && (
                  <tr>
                    <td colSpan={5} className="border border-gray-300 px-3 py-1.5 text-center text-gray-400 italic text-xs">
                      ... y {cuotas.length - 24} cuotas adicionales
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          {(cuotas || []).length === 0 && (
            <p className="text-gray-400 italic text-xs">Sin plan de cuotas registrado.</p>
          )}
        </section>

        {/* ── Seccion 4: Terminos y Condiciones ── */}
        <section className="mb-7">
          <h3 className="font-bold text-xs uppercase tracking-widest border-b border-gray-400 pb-1 mb-3 text-gray-700">
            4. Terminos y Condiciones
          </h3>
          <div className="text-xs text-gray-600 space-y-2 leading-relaxed">
            <p>
              El presente contrato de afiliacion se suscribe entre SANAVIT ECUADOR y el afiliado cuyos datos constan en la seccion 1,
              con el objeto de brindar los servicios de salud y bienestar descritos en la seccion 2, de conformidad con las condiciones
              establecidas y la normativa vigente en la Republica del Ecuador.
            </p>
            <p>
              El afiliado se compromete a cumplir puntualmente con el plan de pagos establecido en la seccion 3. El incumplimiento de
              dos o mas cuotas consecutivas faculta a SANAVIT ECUADOR a suspender los beneficios del plan, sin perjuicio de las acciones
              legales de cobro que correspondan conforme a la ley.
            </p>
            <p>
              SANAVIT ECUADOR se compromete a prestar los servicios contratados con los mas altos estandares de calidad, conforme a la
              normativa vigente en el Ecuador. Cualquier controversia derivada del presente contrato se sometera preferentemente a
              mediacion ante los centros autorizados por el Consejo de la Judicatura de la Republica del Ecuador.
            </p>
            <p>
              El presente contrato tiene plena validez legal desde la fecha de suscripcion indicada en el encabezado y se rige
              exclusivamente por la legislacion ecuatoriana aplicable. Las partes declaran haber leido, comprendido y aceptado
              libremente el contenido de este instrumento.
            </p>
          </div>
        </section>

        {/* ── Seccion 5: Firmas ── */}
        <section className="mt-10">
          <h3 className="font-bold text-xs uppercase tracking-widest border-b border-gray-400 pb-1 mb-10 text-gray-700">
            5. Firmas de Conformidad
          </h3>
          <div className="grid grid-cols-2 gap-20 text-sm text-center">
            {/* Afiliado */}
            <div>
              <div className="border-b-2 border-gray-700 mb-3 h-14" />
              <p className="font-semibold text-gray-800">{nombreCompleto || '—'}</p>
              <p className="text-gray-500 text-xs mt-0.5">
                {contrato.tipo_documento || 'Documento'}: {contrato.num_documento || '—'}
              </p>
              <p className="text-gray-600 font-semibold mt-2 uppercase text-xs tracking-wide">El Afiliado</p>
            </div>
            {/* Consultor */}
            <div>
              <div className="border-b-2 border-gray-700 mb-3 h-14" />
              <p className="font-semibold text-gray-800">{contrato.consultor_nombre || 'Representante'}</p>
              <p className="text-gray-500 text-xs mt-0.5">
                Consultor — {contrato.sala_nombre || 'Sanavit Ecuador'}
              </p>
              <p className="text-gray-600 font-semibold mt-2 uppercase text-xs tracking-wide">Representante Sanavit</p>
            </div>
          </div>

          {/* Pie de pagina */}
          <p className="text-center text-xs text-gray-400 mt-10 border-t border-gray-200 pt-4">
            Documento generado el {new Date().toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })}
            &nbsp;&middot;&nbsp; SANAVIT ECUADOR &nbsp;&middot;&nbsp; {contrato.sala_nombre || 'Ecuador'}
          </p>
        </section>

      </div>
    </>
  )
}
