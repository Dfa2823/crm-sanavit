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

export default function ActaEntregaPrint() {
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
      Cargando acta de entrega...
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
      {/* Estilos de impresion */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
          .print-page {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 10mm 14mm !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
        }
        @page {
          size: A4 portrait;
          margin: 10mm 14mm;
        }
      `}</style>

      {/* Botones flotantes — solo en pantalla */}
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

      {/* Documento */}
      <div className="print-page max-w-4xl mx-auto my-10 bg-white shadow-xl rounded-xl px-16 py-12 text-gray-900 text-sm leading-relaxed">

        {/* Encabezado */}
        <div className="text-center mb-6 pb-5 border-b-2 border-teal-700">
          <h1 className="text-2xl font-bold tracking-widest uppercase text-teal-800">
            Sanavit Ecuador
          </h1>
          <p className="text-xs text-gray-500 mt-0.5 tracking-wide">
            Sistema de Salud y Bienestar
          </p>
          <div className="mt-4">
            <h2 className="text-lg font-bold uppercase tracking-widest text-gray-800">
              Acta de Entrega
            </h2>
            <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider">
              Recepcion de Productos y Servicios a Credito Directo
            </p>
            <p className="text-base font-bold text-teal-700 mt-2 font-mono">
              Contrato N° {contrato.numero_contrato || '—'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Fecha de emision: {new Date().toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })}
              &nbsp;&nbsp;|&nbsp;&nbsp; Sala: {contrato.sala_nombre || '—'}
            </p>
          </div>
        </div>

        {/* Seccion 1: Datos del Cliente */}
        <section className="mb-6">
          <h3 className="font-bold text-xs uppercase tracking-widest border-b border-teal-600 pb-1 mb-3 text-teal-700">
            1. Datos del Cliente
          </h3>
          <div className="grid grid-cols-2 gap-x-10 gap-y-1.5 text-sm">
            {[
              ['Nombre completo',   nombreCompleto || '—'],
              ['Cedula / Documento', contrato.num_documento || '—'],
              ['Telefono',          contrato.telefono || '—'],
              ['Email',             contrato.email || '—'],
              ['Ciudad',            contrato.ciudad || '—'],
              ['Direccion',         contrato.direccion || '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <span className="text-gray-500 min-w-[140px] shrink-0">{label}:</span>
                <span className="font-medium text-gray-800 break-all">{value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Seccion 2: Datos de la Sala */}
        <section className="mb-6">
          <h3 className="font-bold text-xs uppercase tracking-widest border-b border-teal-600 pb-1 mb-3 text-teal-700">
            2. Datos de la Sala
          </h3>
          <div className="grid grid-cols-2 gap-x-10 gap-y-1.5 text-sm">
            {[
              ['Sala',              contrato.sala_nombre || '—'],
              ['Consultor',         contrato.consultor_nombre || '—'],
              ['Fecha del contrato', formatMes(contrato.fecha_contrato)],
              ['Plan contratado',   contrato.tipo_plan || '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <span className="text-gray-500 min-w-[140px] shrink-0">{label}:</span>
                <span className="font-medium text-gray-800 break-all">{value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Seccion 3: Productos / Servicios Entregados */}
        <section className="mb-6">
          <h3 className="font-bold text-xs uppercase tracking-widest border-b border-teal-600 pb-1 mb-3 text-teal-700">
            3. Productos y Servicios Entregados
          </h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-teal-50">
                <th className="border border-gray-300 px-3 py-1.5 text-center font-semibold text-gray-700 w-10">#</th>
                <th className="border border-gray-300 px-3 py-1.5 text-left font-semibold text-gray-700">Descripcion</th>
                <th className="border border-gray-300 px-3 py-1.5 text-center font-semibold text-gray-700 w-16">Cant.</th>
                <th className="border border-gray-300 px-3 py-1.5 text-right font-semibold text-gray-700">Precio Unit.</th>
                <th className="border border-gray-300 px-3 py-1.5 text-right font-semibold text-gray-700">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {(productos || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="border border-gray-300 px-3 py-2 text-center text-gray-400 italic">
                    Sin productos registrados
                  </td>
                </tr>
              ) : (
                (productos || []).map((p, i) => (
                  <tr key={p.id || i} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                    <td className="border border-gray-300 px-3 py-1.5 text-center text-gray-600">
                      {i + 1}
                    </td>
                    <td className="border border-gray-300 px-3 py-1.5 text-gray-800">
                      {p.producto_nombre || p.nombre || '—'}
                    </td>
                    <td className="border border-gray-300 px-3 py-1.5 text-center">
                      {p.cantidad || 1}
                    </td>
                    <td className="border border-gray-300 px-3 py-1.5 text-right">
                      {formatMoney(p.precio_unitario)}
                    </td>
                    <td className="border border-gray-300 px-3 py-1.5 text-right">
                      {formatMoney(p.valor_total || p.subtotal || (p.precio_unitario * (p.cantidad || 1)))}
                    </td>
                  </tr>
                ))
              )}
              <tr className="bg-teal-50 font-bold">
                <td colSpan={4} className="border border-gray-300 px-3 py-1.5 text-right text-gray-700">
                  TOTAL DEL CONTRATO
                </td>
                <td className="border border-gray-300 px-3 py-1.5 text-right text-gray-900">
                  {formatMoney(contrato.monto_total)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Seccion 4: Condiciones de Credito Directo */}
        <section className="mb-6">
          <h3 className="font-bold text-xs uppercase tracking-widest border-b border-teal-600 pb-1 mb-3 text-teal-700">
            4. Condiciones de Credito Directo
          </h3>
          <div className="flex flex-wrap gap-6 mb-3 text-sm">
            <span><strong>Monto total:</strong> {formatMoney(contrato.monto_total)}</span>
            {contrato.cuota_inicial > 0 && (
              <span><strong>Cuota inicial:</strong> {formatMoney(contrato.cuota_inicial)}</span>
            )}
            <span><strong>N° de cuotas:</strong> {contrato.n_cuotas || '—'}</span>
            <span><strong>Valor por cuota:</strong> {formatMoney(valorCuota)}</span>
            {contrato.dia_pago && (
              <span><strong>Dia de pago:</strong> dia {contrato.dia_pago} de cada mes</span>
            )}
          </div>
          {(cuotas || []).length > 0 && (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-teal-50">
                  <th className="border border-gray-300 px-3 py-1 text-center font-semibold text-gray-700">N°</th>
                  <th className="border border-gray-300 px-3 py-1 text-center font-semibold text-gray-700">Fecha de vencimiento</th>
                  <th className="border border-gray-300 px-3 py-1 text-right font-semibold text-gray-700">Monto</th>
                  <th className="border border-gray-300 px-3 py-1 text-center font-semibold text-gray-700">Estado</th>
                </tr>
              </thead>
              <tbody>
                {(cuotas || []).slice(0, 18).map((c, i) => (
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
                    <td className="border border-gray-300 px-3 py-1 text-center capitalize text-gray-600">
                      {estadoLabel(c.estado)}
                    </td>
                  </tr>
                ))}
                {(cuotas || []).length > 18 && (
                  <tr>
                    <td colSpan={4} className="border border-gray-300 px-3 py-1.5 text-center text-gray-400 italic text-xs">
                      ... y {cuotas.length - 18} cuotas adicionales
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

        {/* Seccion 5: Declaracion del Cliente */}
        <section className="mb-6">
          <h3 className="font-bold text-xs uppercase tracking-widest border-b border-teal-600 pb-1 mb-3 text-teal-700">
            5. Declaracion del Cliente
          </h3>
          <div className="text-xs text-gray-600 space-y-2 leading-relaxed border border-gray-200 rounded-lg p-4 bg-gray-50">
            <p>
              Yo, <strong>{nombreCompleto || '________________'}</strong>, con documento de identidad
              N° <strong>{contrato.num_documento || '________________'}</strong>, declaro que he recibido a mi entera
              satisfaccion los productos y/o servicios detallados en la seccion 3 del presente documento.
            </p>
            <p>
              Acepto recibir los productos y servicios descritos bajo las condiciones de credito directo establecidas
              en la seccion 4, comprometiendome al pago puntual de las cuotas segun el calendario acordado.
            </p>
            <p>
              Confirmo que he sido informado(a) de las condiciones, plazos y obligaciones derivadas de este contrato
              de credito directo. En caso de incumplimiento, acepto las consecuencias previstas en el contrato de
              afiliacion N° <strong>{contrato.numero_contrato || '—'}</strong>.
            </p>
            <p>
              El presente documento constituye constancia legal de la entrega y recepcion conforme de los bienes
              y servicios contratados con SANAVIT ECUADOR, y se rige por la legislacion vigente en la
              Republica del Ecuador.
            </p>
          </div>
        </section>

        {/* Seccion 6: Firmas */}
        <section className="mt-8">
          <h3 className="font-bold text-xs uppercase tracking-widest border-b border-teal-600 pb-1 mb-10 text-teal-700">
            6. Firmas de Conformidad
          </h3>
          <div className="grid grid-cols-2 gap-20 text-sm text-center">
            {/* Cliente */}
            <div>
              <div className="border-b-2 border-gray-700 mb-3 h-14" />
              <p className="font-semibold text-gray-800">{nombreCompleto || '—'}</p>
              <p className="text-gray-500 text-xs mt-0.5">
                {contrato.tipo_documento || 'Cedula'}: {contrato.num_documento || '—'}
              </p>
              <p className="text-gray-600 font-semibold mt-2 uppercase text-xs tracking-wide">El Cliente</p>
            </div>
            {/* Representante */}
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
            Acta de Entrega generada el {new Date().toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })}
            &nbsp;&middot;&nbsp; SANAVIT ECUADOR &nbsp;&middot;&nbsp; {contrato.sala_nombre || 'Ecuador'}
          </p>
        </section>

      </div>
    </>
  )
}
