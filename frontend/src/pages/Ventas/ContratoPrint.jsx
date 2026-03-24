import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getVenta360 } from '../../api/ventas'

function formatFecha(iso) {
  if (!iso) return '______________'
  const s = typeof iso === 'string' ? iso.split('T')[0] : iso
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

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

  const fechaContrato = formatFechaLarga(contrato.fecha_contrato)

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
        .contrato-body p {
          margin-bottom: 0.45rem;
          text-align: justify;
        }
        .clausula-title {
          font-weight: 700;
          margin-top: 0.8rem;
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
      <div className="print-page max-w-4xl mx-auto my-10 bg-white shadow-xl rounded-xl px-14 py-10 text-gray-900 leading-relaxed" style={{ fontSize: '11px' }}>

        {/* Encabezado */}
        <div className="text-center mb-6 pb-4 border-b-2 border-teal-700">
          <h1 className="text-xl font-bold tracking-widest uppercase text-teal-800">
            JMGUTIERREZ S.A.S.
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">RUC: 1793198158001</p>
          <p className="text-xs text-gray-500">Marca: <strong>SANAVIT</strong></p>
          <div className="mt-3">
            <h2 className="text-base font-bold uppercase tracking-widest text-gray-800">
              CONTRATO DE COMPRAS CON CREDITO DIRECTO
            </h2>
            <p className="text-sm font-bold text-teal-700 mt-1 font-mono">
              N.° {contrato.numero_contrato || '\u2014'}
            </p>
          </div>
        </div>

        {/* Cuerpo del contrato */}
        <div className="contrato-body" style={{ fontSize: '10.5px' }}>

          <p>
            En la ciudad de <strong>{contrato.ciudad || 'Quito'}</strong> el dia <strong>{fechaContrato}</strong>, convienen
            en celebrar el presente contrato de compras con credito directo, las siguientes partes:
          </p>

          {/* CLAUSULA PRIMERA */}
          <p className="clausula-title">CLAUSULA PRIMERA, COMPARECIENTES:</p>
          <p>
            La compania <strong>JMGUTIERREZ S.A.S.</strong>, con numero de RUC <strong>1793198158001</strong>, propietarios
            de marca <strong>SANAVIT</strong> que se encuentra debidamente representada a traves de su Representante Legal
            el Sr. <strong>JUAN SEBASTIAN GUTIERREZ BUSTILLOS</strong>, segun consta del documento habilitante que se adjunta.
          </p>
          <p>
            Por otra parte, el/la senor(a) <strong>{nombreCompleto || '________________________'}</strong> portador(a)
            de la {contrato.tipo_documento || 'Cedula de identidad'} No. <strong>{contrato.num_documento || '________________'}</strong> por
            sus propios y personales derechos, domiciliado(a) en <strong>{contrato.direccion || '________________________'}</strong>,
            ciudad de <strong>{contrato.ciudad || '________________'}</strong>.
          </p>
          <p>
            Los firmantes acuerdan subscribir el presente contrato de compras con credito directo en adelante
            denominado "el Contrato" considerando que es beneficioso para ambas partes. Este contrato estara
            sujeto a las siguientes clausulas:
          </p>

          {/* CLAUSULA SEGUNDA */}
          <p className="clausula-title">CLAUSULA SEGUNDA, ANTECEDENTES:</p>
          <p>
            La compania <strong>JMGUTIERREZ S.A.S.</strong>, entre sus actividades economicas y comerciales mantiene: la compra
            y venta de productos e intermediacion en el comercio de productos diversos.
          </p>
          <p>
            <strong>EL CLIENTE</strong> tiene interes en adquirir los Productos y/o servicios ofrecidos
            por <strong>LA COMPANIA</strong> y desea aprovechar los planes de credito que esta proporciona. En este sentido,
            el CLIENTE ha completado y entregado la solicitud de credito conforme al formato proporcionado previamente,
            la cual ha sido aprobada por <strong>LA COMPANIA</strong>.
          </p>

          {/* CLAUSULA TERCERA */}
          <p className="clausula-title">CLAUSULA TERCERA, OBJETO Y ALCANCE DEL CONTRATO:</p>
          <p>
            Este contrato tiene como objeto establecer las directrices que dirigiran la compra de productos y/o servicios
            ofertados por la compania utilizando los sistemas de credito proporcionados por la COMPANIA para beneficio
            de <strong>EL CLIENTE</strong>.
          </p>

          {/* Tabla de productos */}
          <div className="my-3">
            <p className="font-bold mb-1">Productos y/o servicios adquiridos:</p>
            <table className="w-full border-collapse" style={{ fontSize: '10px' }}>
              <thead>
                <tr className="bg-teal-50">
                  <th className="border border-gray-400 px-2 py-1 text-left font-semibold">Descripcion</th>
                  <th className="border border-gray-400 px-2 py-1 text-center font-semibold w-14">Cant.</th>
                  <th className="border border-gray-400 px-2 py-1 text-right font-semibold">Precio Unit.</th>
                  <th className="border border-gray-400 px-2 py-1 text-right font-semibold">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(productos || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="border border-gray-400 px-2 py-1.5 text-center text-gray-400 italic">
                      Sin productos registrados
                    </td>
                  </tr>
                ) : (
                  (productos || []).map((p, i) => (
                    <tr key={p.id || i} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                      <td className="border border-gray-400 px-2 py-1">{p.producto_nombre || p.nombre || '\u2014'}</td>
                      <td className="border border-gray-400 px-2 py-1 text-center">{p.cantidad || 1}</td>
                      <td className="border border-gray-400 px-2 py-1 text-right">{formatMoney(p.precio_unitario)}</td>
                      <td className="border border-gray-400 px-2 py-1 text-right">{formatMoney(p.valor_total || p.subtotal || (p.precio_unitario * (p.cantidad || 1)))}</td>
                    </tr>
                  ))
                )}
                <tr className="bg-teal-50 font-bold">
                  <td colSpan={3} className="border border-gray-400 px-2 py-1 text-right">TOTAL</td>
                  <td className="border border-gray-400 px-2 py-1 text-right">{formatMoney(contrato.monto_total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Plan de cuotas */}
          {(cuotas || []).length > 0 && (
            <div className="my-3">
              <p className="font-bold mb-1">Plan de pagos:</p>
              <div className="flex flex-wrap gap-4 mb-2" style={{ fontSize: '10px' }}>
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
              <table className="w-full border-collapse" style={{ fontSize: '9.5px' }}>
                <thead>
                  <tr className="bg-teal-50">
                    <th className="border border-gray-400 px-2 py-0.5 text-center font-semibold">N.°</th>
                    <th className="border border-gray-400 px-2 py-0.5 text-center font-semibold">Fecha de vencimiento</th>
                    <th className="border border-gray-400 px-2 py-0.5 text-right font-semibold">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {(cuotas || []).slice(0, 24).map((c, i) => (
                    <tr key={c.id || i} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                      <td className="border border-gray-400 px-2 py-0.5 text-center">{c.numero_cuota || i + 1}</td>
                      <td className="border border-gray-400 px-2 py-0.5 text-center">{formatFecha(c.fecha_vencimiento)}</td>
                      <td className="border border-gray-400 px-2 py-0.5 text-right">{formatMoney(c.monto_esperado)}</td>
                    </tr>
                  ))}
                  {(cuotas || []).length > 24 && (
                    <tr>
                      <td colSpan={3} className="border border-gray-400 px-2 py-1 text-center text-gray-400 italic">
                        ... y {cuotas.length - 24} cuotas adicionales
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* CLAUSULA CUARTA */}
          <p className="clausula-title">CLAUSULA CUARTA, SISTEMA DE CREDITO:</p>
          <p>
            El CLIENTE esta habilitado a acceder a un Credito, mediante el cual la COMPANIA otorgara al CLIENTE un cupo
            para poder realizar compras de productos que deberan ser pagados en el periodo de tiempo que sea aprobado y
            previamente autorizado por la COMPANIA. La falta de pago de una cuota en la fecha establecida provocara la
            declaratoria de plazo vencido de las cuotas siguientes, por lo que toda la deuda podra ser declarada de plazo
            vencido (la "Aceleracion de Pagos").
          </p>
          <p>
            En cuanto a la tasa de interes aplicable, se estara a lo dispuesto por la autoridad competente, de acuerdo con
            las disposiciones legales que se encuentren en vigencia al momento de realizar cada transaccion. En cualquier
            caso, <strong>EL CLIENTE</strong> reconoce y acepta que la tasa de interes forma parte del credito otorgado, por
            lo que se obliga a cancelar el valor que se genere, asi como los posibles recargos y multas en caso de retardo
            en el pago.
          </p>
          <p>
            El credito que sea asignado a <strong>EL CLIENTE</strong> es para su uso personal y no podra ser transferido
            a terceros, salvo expresa autorizacion de la COMPANIA. El CLIENTE sera el unico responsable del uso que se de
            al credito otorgado, asi como de las obligaciones que de este se deriven.
          </p>

          {/* CLAUSULA QUINTA */}
          <p className="clausula-title">CLAUSULA QUINTA, LIMITE DEL CREDITO:</p>
          <p>
            La COMPANIA mantendra informado al CLIENTE con la frecuencia que este lo solicite, respecto del limite o cupo
            del credito que ha sido asignado, el cual podra variar de tiempo en tiempo, en base al historial y comportamiento
            de pago del CLIENTE. De ser solicitado, el CLIENTE podra solicitar una revision al cupo de credito asignado en
            cualquier momento, previa la entrega de la documentacion que sea requerida por la COMPANIA, y despues del analisis
            que efectue el departamento de credito.
          </p>

          {/* CLAUSULA SEXTA */}
          <p className="clausula-title">CLAUSULA SEXTA, ESTADO DE CUENTA:</p>
          <p>
            El estado de cuenta que emitira la COMPANIA de forma mensual, recopilara la informacion relacionada con la
            utilizacion del credito asignado, asi como detallara las transacciones que <strong>EL CLIENTE</strong> hubiere
            realizado, los cargos que por diversos conceptos se hayan generado, y los pagos efectivamente acreditados.
          </p>
          <p>
            Una vez entregado, <strong>EL CLIENTE</strong> tiene quince (15) dias de plazo para hacer cualquier objecion
            al mismo, y de no hacerlo, se entendera que lo acepta en todas sus partes.
          </p>

          {/* CLAUSULA SEPTIMA */}
          <p className="clausula-title">CLAUSULA SEPTIMA, DERECHOS Y OBLIGACIONES DEL CLIENTE:</p>
          <p className="font-semibold mt-1">I. DERECHOS:</p>
          <ul className="list-disc ml-5 space-y-0.5">
            <li>Conocer el valor de cada transaccion, mediante la recepcion del comprobante correspondiente.</li>
            <li>Recibir mensualmente el estado de cuenta en la direccion indicada, pudiendo objetarlo dentro del plazo establecido.</li>
            <li>Acogerse a los beneficios y promociones que realice la COMPANIA para sus clientes.</li>
            <li>Consultar en cualquier momento el saldo del cupo del credito asignado.</li>
          </ul>
          <p className="font-semibold mt-1">II. OBLIGACIONES:</p>
          <ul className="list-disc ml-5 space-y-0.5">
            <li>Pagar puntualmente los valores que adeuda a la COMPANIA, en la forma y plazos establecidos en cada transaccion.</li>
            <li>Usar exclusivamente fondos que provengan de origen licito.</li>
            <li>En caso de mora, cancelar el interes a la tasa maxima permitida por la Ley, asi como los recargos de cobranza.</li>
            <li>Notificar a la COMPANIA de manera inmediata en caso de cambio en la direccion o cualquier otra informacion.</li>
          </ul>

          {/* CLAUSULA OCTAVA */}
          <p className="clausula-title">CLAUSULA OCTAVA, PLAZO:</p>
          <p>
            El presente instrumento es de plazo indefinido. No obstante, podra terminar en cualquier momento de conformidad
            con las disposiciones aqui previstas. En caso de terminacion del Contrato, el CLIENTE estara obligado a cancelar
            todas las obligaciones economicas que se encuentren pendientes en el plazo de hasta diez (10) dias calendario
            desde la fecha de terminacion efectiva.
          </p>

          {/* CLAUSULA NOVENA */}
          <p className="clausula-title">CLAUSULA NOVENA, TERMINACION DEL CONTRATO:</p>
          <p>El presente contrato podra terminar por el acaecimiento de cualquiera de las siguientes causales:</p>
          <ul className="list-disc ml-5 space-y-0.5">
            <li>Mutuo acuerdo de las partes.</li>
            <li>Por declaracion de terminacion unilateral de cualquiera de las partes, en el evento que suceda un incumplimiento de las disposiciones aqui establecidas.</li>
            <li>Por la insolvencia, quiebra o suspension de pagos de cualquiera de las Partes.</li>
            <li>Por decision de la Compania, mediante notificacion por escrito y con al menos diez (10) dias de anticipacion.</li>
          </ul>

          {/* CLAUSULA DECIMA */}
          <p className="clausula-title">CLAUSULA DECIMA, CESION DEL CONTRATO:</p>
          <p>
            La COMPANIA podra ceder total o parcialmente el presente contrato a un tercero. EL CLIENTE no podra ceder a
            favor de terceros los derechos y obligaciones del presente contrato, por el caracter de personal y personalisimo
            del credito conferido a su favor.
          </p>

          {/* CLAUSULA UNDECIMA */}
          <p className="clausula-title">CLAUSULA UNDECIMA, DIVISIBILIDAD:</p>
          <p>
            En el caso de que alguna disposicion o parte de este Contrato fuera considerada ilegal, invalida o inexigible
            por parte de algun tribunal competente, dichas disposiciones seran completamente divisibles y las disposiciones
            restantes permaneceran en plena vigencia.
          </p>

          {/* CLAUSULA DUODECIMA */}
          <p className="clausula-title">CLAUSULA DUODECIMA, DECLARACIONES DEL CLIENTE:</p>
          <p>
            Como CLIENTE declaro y dejo expresa constancia que la COMPANIA me ha informado a mi entera satisfaccion lo siguiente:
          </p>
          <ul className="list-disc ml-5 space-y-0.5">
            <li>En forma detallada las implicaciones y consecuencias juridicas de cada una de las estipulaciones previstas en el presente documento.</li>
            <li>Las acciones judiciales y extrajudiciales que la COMPANIA podra seguir en mi contra, en el evento que incumpla con cualquiera de mis obligaciones.</li>
            <li>Que ratifica su requerimiento de recibir mensualmente su estado de credito en la direccion senalada.</li>
            <li>Que la informacion proporcionada en la solicitud de credito es cierta y verdadera, y que autorizo a la COMPANIA para que la verifique.</li>
            <li>Que autoriza a la COMPANIA a contactarlo por cualquier medio, con el fin de darle a conocer promociones, beneficios y otras informaciones.</li>
            <li>Que declara conocer y aceptar las tarifas por los servicios y prestaciones adicionales.</li>
          </ul>

          {/* CLAUSULA DECIMA TERCERA */}
          <p className="clausula-title">CLAUSULA DECIMA TERCERA, DOMICILIO, JURISDICCION Y COMPETENCIA:</p>
          <p>
            Las partes declaran que renuncian a fuero y domicilio, y en caso de existir cualquier controversia que pudiera
            derivarse de este contrato declaran que senalan como domicilio judicial la ciudad de Quito y que se someten
            expresamente a la jurisdiccion y competencia de uno de los Jueces de lo Civil del Canton Quito.
          </p>

          {/* CLAUSULA DECIMA CUARTA */}
          <p className="clausula-title">CLAUSULA DECIMA CUARTA, ACEPTACION:</p>
          <p>
            El presente documento constituye un acuerdo integral entre las Partes, puesto que contiene todas las obligaciones
            asumidas por cada una de ellas, por lo que reemplaza todos los acuerdos previos, documentos, cartas, declaraciones,
            intenciones o compromisos anteriores, ya sean escritos u orales, entre las Partes con respecto a su objeto.
          </p>

          <p className="mt-4">
            Para constancia de lo aqui senalado, las Partes firman, en el lugar y dia senalados el presente instrumento:
          </p>

        </div>

        {/* Firmas */}
        <section className="mt-10">
          <div className="grid grid-cols-2 gap-16 text-center" style={{ fontSize: '10.5px' }}>
            {/* Cliente */}
            <div>
              <div className="border-b-2 border-gray-700 mb-2 h-16" />
              <p className="font-semibold text-gray-800">{nombreCompleto || '\u2014'}</p>
              <p className="text-gray-500 text-xs mt-0.5">
                {contrato.tipo_documento || 'Cedula de identidad'} No. {contrato.num_documento || '\u2014'}
              </p>
              <p className="text-gray-600 font-semibold mt-2 uppercase text-xs tracking-wide">EL CLIENTE</p>
            </div>
            {/* Representante Legal */}
            <div>
              <div className="border-b-2 border-gray-700 mb-2 h-16" />
              <p className="font-semibold text-gray-800">JUAN SEBASTIAN GUTIERREZ BUSTILLOS</p>
              <p className="text-gray-500 text-xs mt-0.5">
                Representante Legal - JMGUTIERREZ S.A.S.
              </p>
              <p className="text-gray-600 font-semibold mt-2 uppercase text-xs tracking-wide">LA COMPANIA</p>
            </div>
          </div>

          {/* Pie de pagina */}
          <p className="text-center text-xs text-gray-400 mt-8 border-t border-gray-200 pt-3">
            Documento generado el {new Date().toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' })}
            &nbsp;&middot;&nbsp; JMGUTIERREZ S.A.S. &nbsp;&middot;&nbsp; Marca SANAVIT &nbsp;&middot;&nbsp; RUC 1793198158001
          </p>
        </section>

      </div>
    </>
  )
}
