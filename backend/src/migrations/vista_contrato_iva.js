const pool = require('../db');

// Vista reutilizable con el desglose de IVA por contrato. UNA sola definición
// para que todos los cálculos de comisión usen el mismo criterio.
//
// El IVA se deriva del precio efectivamente cobrado (venta_productos.valor_total)
// y el iva_porcentaje del producto — a prueba de descuentos:
//   - producto gravado (tiene_iva): sin_iva = valor_total / (1 + iva%/100)
//   - producto/servicio exento (p.ej. sueroterapia): cuenta completo, IVA 0
// factor_sin_iva = monto_sin_iva / monto_con_iva  (1 si el contrato no tiene líneas).
async function crearVistaContratoIva() {
  try {
    await pool.query(`
      CREATE OR REPLACE VIEW v_contrato_iva AS
      SELECT vp.contrato_id,
             SUM(CASE WHEN pr.tiene_iva AND COALESCE(pr.iva_porcentaje, 0) > 0
                      THEN vp.valor_total / (1 + pr.iva_porcentaje / 100.0)
                      ELSE vp.valor_total END)                  AS monto_sin_iva,
             SUM(vp.valor_total)                                AS monto_con_iva,
             CASE WHEN SUM(vp.valor_total) > 0
                  THEN SUM(CASE WHEN pr.tiene_iva AND COALESCE(pr.iva_porcentaje, 0) > 0
                                THEN vp.valor_total / (1 + pr.iva_porcentaje / 100.0)
                                ELSE vp.valor_total END) / SUM(vp.valor_total)
                  ELSE 1 END                                    AS factor_sin_iva
      FROM venta_productos vp
      JOIN productos pr ON vp.producto_id = pr.id
      GROUP BY vp.contrato_id
    `);
    console.log('[VISTA] v_contrato_iva lista');
  } catch (e) {
    console.warn('[VISTA] Warning v_contrato_iva:', e.message);
  }
}

module.exports = crearVistaContratoIva;
