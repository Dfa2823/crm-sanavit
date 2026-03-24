import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getVenta360 } from '../../api/ventas'

function formatFechaLarga(iso) {
  if (!iso) return '______________'
  const s = typeof iso === 'string' ? iso.split('T')[0] : iso
  const date = new Date(s + 'T12:00:00')
  const dias = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab']
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return `${dias[date.getDay()]}, ${date.getDate()} de ${meses[date.getMonth()]} del ${date.getFullYear()}`
}

function formatMoney(n) {
  const num = Number(n || 0)
  return `$${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
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

  const fechaContrato = formatFechaLarga(contrato.fecha_contrato)

  // Build product names string for inline text
  const productNames = (productos || []).map(p => p.producto_nombre || p.nombre || 'Producto').join(' / ')

  return (
    <>
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
        .acta-body p {
          margin-bottom: 0.4rem;
          text-align: justify;
        }
        .acta-section-title {
          font-weight: 700;
          margin-top: 0.7rem;
          margin-bottom: 0.3rem;
        }
      `}</style>

      {/* Botones flotantes */}
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
      <div className="print-page max-w-4xl mx-auto my-10 bg-white shadow-xl rounded-xl px-14 py-10 text-gray-900 leading-relaxed" style={{ fontSize: '10.5px' }}>

        {/* Encabezado */}
        <div className="text-center mb-5 pb-4 border-b-2 border-teal-700">
          <h1 className="text-xl font-bold tracking-widest uppercase text-teal-800">
            JMGUTIERREZ S.A.S.
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">RUC: 1793198158001 &nbsp;|&nbsp; Marca: <strong>SANAVIT</strong></p>
          <div className="mt-3">
            <h2 className="text-base font-bold uppercase tracking-widest text-gray-800">
              ACTA DE ENTREGA-RECEPCION
            </h2>
            <p className="text-sm font-bold text-teal-700 mt-1 font-mono">
              Contrato N.° {contrato.numero_contrato || '\u2014'}
            </p>
          </div>
        </div>

        {/* Cuerpo del acta */}
        <div className="acta-body">

          {/* Parrafo introductorio */}
          <p>
            En la ciudad de <strong>{contrato.ciudad || 'Quito'}</strong> el dia <strong>{fechaContrato}</strong>, las
            partes suscriben la presente: por una parte la compania <strong>JM GUTIERREZ S.A.S.</strong> con numero de
            RUC <strong>1793198158001</strong>, con nombre comercial <strong>SANAVIT</strong> la cual tiene como objeto
            social la venta al por menor de productos naturistas en establecimientos especializados, y por otra parte
            el/la Sr/ra <strong>{nombreCompleto || '________________________'}</strong> portador(a)
            de {contrato.tipo_documento || 'Cedula de identidad'} No. <strong>{contrato.num_documento || '________________'}</strong> quienes
            libre y voluntariamente llevan a cabo la entrega-recepcion del siguiente producto a base de ingredientes
            naturales, bajo solicitud del cliente <strong>{nombreCompleto || '________________________'}</strong> con
            cedula: {contrato.tipo_documento || 'Cedula de identidad'} No. <strong>{contrato.num_documento || '________________'}</strong>.
          </p>

          <p>
            La compania <strong>JM GUTIERREZ S.A.S.</strong> duenos de la marca <strong>SANAVIT</strong> declara que:
          </p>
          <ul className="list-disc ml-5 space-y-0.5 mb-2">
            <li>Ofrece y vende productos al mercado en sus establecimientos y redes oficiales de la compania. Es propietario y/o comercializador legitimo de todos los productos ofertados en su establecimiento.</li>
            <li>Los Productos han sido disenados y fabricados con los mas altos estandares de calidad, su sello de seguridad es el reconocimiento de que el producto ha sido fabricado bajo un sistema de calidad, y que cumple con todos los propositos ofrecidos y estan libres de defectos en materiales y su fabricacion.</li>
            <li>Unicamente los asesores comerciales de SANAVIT estan autorizados para la venta y distribucion de nuestros productos.</li>
          </ul>

          <p>
            <strong>SANAVIT</strong> declara entregar al cliente final el
            producto <strong>{productNames || '________________________'}</strong> (de uso naturista) mencionado
            anteriormente en las condiciones explicadas, pactadas y detalladas con informacion clara veraz y oportuna.
          </p>

          {/* 1. Datos del producto */}
          <p className="acta-section-title">1. Datos del/los producto(s) y servicio adquirido(s):</p>
          <table className="w-full border-collapse mb-3" style={{ fontSize: '10px' }}>
            <thead>
              <tr className="bg-teal-50">
                <th className="border border-gray-400 px-2 py-1 text-center font-semibold w-10">#</th>
                <th className="border border-gray-400 px-2 py-1 text-left font-semibold">Descripcion</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-semibold w-14">Cant.</th>
                <th className="border border-gray-400 px-2 py-1 text-right font-semibold">Precio Unit.</th>
                <th className="border border-gray-400 px-2 py-1 text-right font-semibold">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {(productos || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="border border-gray-400 px-2 py-1.5 text-center text-gray-400 italic">
                    Sin productos registrados
                  </td>
                </tr>
              ) : (
                (productos || []).map((p, i) => (
                  <tr key={p.id || i} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                    <td className="border border-gray-400 px-2 py-1 text-center">{i + 1}</td>
                    <td className="border border-gray-400 px-2 py-1">{p.producto_nombre || p.nombre || '\u2014'}</td>
                    <td className="border border-gray-400 px-2 py-1 text-center">{p.cantidad || 1}</td>
                    <td className="border border-gray-400 px-2 py-1 text-right">{formatMoney(p.precio_unitario)}</td>
                    <td className="border border-gray-400 px-2 py-1 text-right">{formatMoney(p.valor_total || p.subtotal || (p.precio_unitario * (p.cantidad || 1)))}</td>
                  </tr>
                ))
              )}
              <tr className="bg-teal-50 font-bold">
                <td colSpan={4} className="border border-gray-400 px-2 py-1 text-right">TOTAL DEL CONTRATO</td>
                <td className="border border-gray-400 px-2 py-1 text-right">{formatMoney(contrato.monto_total)}</td>
              </tr>
            </tbody>
          </table>

          {/* Condiciones de credito */}
          {(cuotas || []).length > 0 && (
            <div className="mb-3 p-2 border border-gray-300 rounded bg-gray-50" style={{ fontSize: '10px' }}>
              <p className="font-bold mb-1">Condiciones de credito directo:</p>
              <div className="flex flex-wrap gap-4">
                <span><strong>Monto total:</strong> {formatMoney(contrato.monto_total)}</span>
                {contrato.cuota_inicial > 0 && (
                  <span><strong>Cuota inicial:</strong> {formatMoney(contrato.cuota_inicial)}</span>
                )}
                <span><strong>N.° de cuotas:</strong> {contrato.n_cuotas || '\u2014'}</span>
                <span><strong>Valor por cuota:</strong> {formatMoney(valorCuota)}</span>
                {contrato.dia_pago && (
                  <span><strong>Dia de pago:</strong> dia {contrato.dia_pago} de cada mes</span>
                )}
              </div>
            </div>
          )}

          {/* 2. Politica de Calidad */}
          <p className="acta-section-title">2. Politica de Calidad:</p>
          <p>
            <strong>SANAVIT</strong> garantiza la calidad de este producto fabricado y/o distribuido a su nombre y certifica
            que cumplen con altos estandares de calidad para su uso. El cliente que adquiera este producto encontrara que el
            mismo es satisfactorio en todos los sentidos.
          </p>
          <p>
            Sin embargo, si por alguna razon no esta conforme con algun producto de SANAVIT, porque el producto se encuentra
            danado (danos causados por el servicio de paqueteria) o el producto que se entrego no era el solicitado en la
            solicitud de compra puede devolverlo en un plazo de <strong>3 dias</strong> a partir de la fecha de recepcion de
            la compra y recibir un reembolso total o un cambio de producto. En caso de haber notado el dano del producto
            despues de haberlo recibido, es necesario que guarde los productos y se asegure de que se mantengan en el mismo
            estado en que fueron entregados, conservando su embalaje, etiquetado y sello de garantia y seguridad intacto.
            No se realizara ningun cambio, devolucion o reembolso en productos abiertos, consumidos total o parcialmente.
          </p>
          <p>
            Para hacer valida la devolucion o reembolso, debera informar al equipo de soporte al cliente el mismo dia de la
            recepcion del articulo y enviar fotografias y/o videos que muestren la inconformidad con el producto al siguiente
            correo <strong>servicio.cliente@jmgecuador.com</strong>.
          </p>
          <p>
            Si la devolucion cumple con lo anterior y es aprobada, se proporcionara el proceso a seguir para hacer efectivo
            el reembolso. Se procedera a realizar el reembolso del importe cobrado dentro de un plazo de 30 dias a partir
            de la fecha de recepcion de la notificacion.
          </p>

          {/* 3. Declaracion del cliente */}
          <p className="acta-section-title">3. Declaracion del cliente:</p>
          <div className="border border-gray-300 rounded p-3 bg-gray-50 mb-3">
            <p>
              El cliente declara recibir el producto en optimas condiciones de calidad. Declara que conoce los componentes,
              indicaciones de uso y consumo, almacenamiento y demas especificaciones del producto adquirido. Declara que
              solicito adquirir el producto y que recibio explicacion por parte de SANAVIT con informacion clara veraz y
              oportuna previo a la firma de este documento.
            </p>
          </div>

          {/* 4. Politica de uso de datos personales */}
          <p className="acta-section-title">4. Politica de uso de datos personales:</p>
          <p>
            <strong>JM GUTIERREZ S.A.S</strong> como compania dedicada a la venta al por menor de productos naturistas en
            establecimientos especializados, cree firmemente en la transparencia y en el respeto de los derechos y las
            libertades fundamentales de las personas en el adecuado tratamiento de sus datos personales.
          </p>
          <p>La compania como responsable del tratamiento podra tratar sus datos personales con las siguientes finalidades:</p>
          <ul className="list-disc ml-5 space-y-0.5 mb-2" style={{ fontSize: '9.5px' }}>
            <li>Gestion de la reserva de invitaciones para la presentacion de productos y/o servicios de la compania.</li>
            <li>Atender sus solicitudes especiales y preferencias asociadas a la reserva y/o compra de los productos.</li>
            <li>Envio de la confirmacion de la compra garantizada.</li>
            <li>Analizar los datos sobre las preferencias personales para hacer que su uso y consumo sean optimos.</li>
            <li>Gestion de las solicitudes de informacion y contacto a traves de los canales dispuestos para ello.</li>
            <li>Envio de comunicaciones comerciales para informarle sobre novedades, ofertas, eventos y productos o servicios de su interes.</li>
            <li>Conocer la opinion de los clientes a traves de encuestas de satisfaccion.</li>
          </ul>
          <p>
            Los terminos y condiciones de la presente acta tienen un caracter vinculante y, por lo tanto, los usuarios y
            clientes aceptan el uso de sus datos para que se efectue la compra de los productos ofertados por la compania,
            y su uso implica la aceptacion incondicional de tales terminos y condiciones.
          </p>
          <p className="font-semibold mt-2">
            Al firmar este documento mediante el recibido conforme EL CLIENTE acepta que entiende y esta de acuerdo con lo
            expuesto en el mismo y ademas que esta de acuerdo con el acto comercial, ya que, fue libre, voluntario y
            solicitado por EL CLIENTE mismo.
          </p>

        </div>

        {/* Firmas */}
        <section className="mt-8">
          <div className="grid grid-cols-2 gap-16 text-center" style={{ fontSize: '10.5px' }}>
            {/* Cliente */}
            <div>
              <p className="text-gray-600 font-semibold uppercase text-xs tracking-wide mb-1">Firma del Cliente</p>
              <div className="border-b-2 border-gray-700 mb-2 h-14" />
              <p className="font-semibold text-gray-800">{nombreCompleto || '\u2014'}</p>
              <p className="text-gray-500 text-xs mt-0.5">
                {contrato.tipo_documento || 'Cedula de identidad'} No. {contrato.num_documento || '\u2014'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">EL CLIENTE</p>
            </div>
            {/* Representante */}
            <div>
              <p className="text-gray-600 font-semibold uppercase text-xs tracking-wide mb-1">Por la Compania</p>
              <div className="border-b-2 border-gray-700 mb-2 h-14" />
              <p className="font-semibold text-gray-800">{contrato.consultor_nombre || 'Representante SANAVIT'}</p>
              <p className="text-gray-500 text-xs mt-0.5">
                {contrato.sala_nombre || 'SANAVIT Ecuador'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">SANAVIT - JM GUTIERREZ S.A.S.</p>
            </div>
          </div>

          {/* Pie de pagina */}
          <p className="text-center text-xs text-gray-400 mt-8 border-t border-gray-200 pt-3">
            Acta de Entrega-Recepcion generada el {new Date().toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })}
            &nbsp;&middot;&nbsp; JM GUTIERREZ S.A.S. &nbsp;&middot;&nbsp; SANAVIT &nbsp;&middot;&nbsp; RUC 1793198158001
          </p>
        </section>

      </div>
    </>
  )
}
