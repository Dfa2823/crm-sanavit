// Generación de consecutivos de recibos por sala: {prefijo_contrato}-RC-{serial_recibo}.
// Debe llamarse DENTRO de una transacción abierta (recibe el client): el FOR UPDATE
// sobre la fila de salas serializa emisiones concurrentes y evita colisiones del
// UNIQUE de recibos.consecutivo. Devuelve null si no hay sala (recibo sin consecutivo,
// mismo comportamiento histórico).
async function siguienteConsecutivoRecibo(client, salaId) {
  if (!salaId) return null;
  const salaResult = await client.query(
    'SELECT prefijo_contrato, serial_recibo FROM salas WHERE id = $1 FOR UPDATE',
    [salaId]
  );
  if (salaResult.rows.length === 0) return null;
  const { prefijo_contrato, serial_recibo } = salaResult.rows[0];
  const nuevoSerial = (serial_recibo || 0) + 1;
  await client.query(
    'UPDATE salas SET serial_recibo = $1 WHERE id = $2',
    [nuevoSerial, salaId]
  );
  return `${prefijo_contrato}-RC-${nuevoSerial}`;
}

module.exports = { siguienteConsecutivoRecibo };
