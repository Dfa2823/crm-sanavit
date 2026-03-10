const express = require('express');
const pool = require('../db');
const router = express.Router();

// GET /api/cartera?sala_id=X
router.get('/', async (req, res) => {
  const { sala_id } = req.query;
  const { sala_id: userSalaId, rol } = req.user;
  const salaFiltro = sala_id || (['admin', 'director'].includes(rol) ? null : userSalaId);

  try {
    // Intentar con tabla contratos real
    const result = await pool.query(`
      SELECT
        c.id AS contrato_id,
        c.numero_contrato,
        c.tipo_plan,
        c.monto_total,
        c.monto_cuota,
        c.n_cuotas,
        c.fecha_contrato,
        c.estado AS estado_contrato,
        COALESCE(SUM(cu.monto_pagado), 0) AS pagado,
        COALESCE(SUM(cu.monto_esperado), 0) AS esperado,
        COUNT(cu.id) FILTER (WHERE cu.estado = 'vencido') AS cuotas_vencidas,
        MAX(cu.fecha_vencimiento) FILTER (WHERE cu.estado = 'vencido') AS ultima_fecha_vencida,
        p.id AS persona_id,
        p.nombres,
        p.apellidos,
        p.telefono,
        p.email,
        p.ciudad,
        p.num_documento AS cedula,
        s.id AS sala_id,
        s.nombre AS sala_nombre,
        s.ciudad AS sala_ciudad,
        u_cons.nombre AS consultor_nombre
      FROM contratos c
      JOIN personas p ON c.persona_id = p.id
      LEFT JOIN salas s ON c.sala_id = s.id
      LEFT JOIN usuarios u_cons ON c.consultor_id = u_cons.id
      LEFT JOIN cuotas cu ON cu.contrato_id = c.id
      WHERE c.estado != 'cancelado'
        AND ($1::integer IS NULL OR c.sala_id = $1)
      GROUP BY c.id, p.id, s.id, u_cons.nombre
      ORDER BY c.fecha_contrato DESC
    `, [salaFiltro || null]);

    if (result.rows.length > 0) {
      // Usar datos reales
      const hoy = new Date();
      const clientes = result.rows.map(row => {
        const pagado = Number(row.pagado);
        const esperado = Number(row.monto_total);
        const saldo = esperado - pagado;
        let moraDias = 0;
        if (row.ultima_fecha_vencida) {
          moraDias = Math.floor((hoy - new Date(row.ultima_fecha_vencida)) / (1000 * 60 * 60 * 24));
        }
        const estado_mora = moraDias <= 0 ? 'al_dia'
          : moraDias <= 30 ? 'mora_30'
          : moraDias <= 60 ? 'mora_60'
          : 'mora_90';
        return {
          persona: { id: row.persona_id, nombres: row.nombres, apellidos: row.apellidos, telefono: row.telefono, email: row.email, ciudad: row.ciudad, cedula: row.cedula },
          sala: { id: row.sala_id, nombre: row.sala_nombre, ciudad: row.sala_ciudad },
          contrato: { id: row.contrato_id, numero: row.numero_contrato, tipo_plan: row.tipo_plan, consultor: row.consultor_nombre, fecha: row.fecha_contrato, estado: row.estado_contrato },
          monto_total: esperado,
          monto_pagado: pagado,
          monto_saldo: saldo,
          mora_dias: moraDias,
          estado_mora,
          cuotas_vencidas: Number(row.cuotas_vencidas),
        };
      });
      return res.json(clientes);
    }

    // Fallback: mock desde visitas_sala (mientras no hay contratos)
    const fallback = await pool.query(`
      SELECT vs.id AS visita_id, vs.fecha, vs.calificacion, vs.sala_id,
             p.id AS persona_id, p.nombres, p.apellidos, p.telefono, p.email, p.ciudad, p.num_documento AS cedula,
             s.nombre AS sala_nombre, s.ciudad AS sala_ciudad,
             uc.nombre AS consultor_nombre, l.id AS lead_id, l.patologia, f.nombre AS fuente_nombre
      FROM visitas_sala vs
      JOIN personas p ON vs.persona_id = p.id
      LEFT JOIN salas s ON vs.sala_id = s.id
      LEFT JOIN usuarios uc ON vs.consultor_id = uc.id
      LEFT JOIN leads l ON vs.lead_id = l.id
      LEFT JOIN fuentes f ON l.fuente_id = f.id
      WHERE vs.calificacion = 'TOUR'
        AND ($1::integer IS NULL OR vs.sala_id = $1)
      ORDER BY vs.fecha DESC
    `, [salaFiltro || null]);

    const hoy = new Date();
    const clientes = fallback.rows.map(row => {
      const fechaVisita = new Date(row.fecha);
      const montoBase = 12000;
      const montoTotal = montoBase + (row.persona_id % 1000) * 10;
      const porcentajePagado = 0.3 + ((row.persona_id % 50) / 100);
      const montoPagado = Math.round(montoTotal * porcentajePagado);
      const tieneMora = row.persona_id % 3 === 0;
      const diasDesdeVisita = Math.floor((hoy - fechaVisita) / (1000 * 60 * 60 * 24));
      const moraDias = tieneMora ? Math.min(diasDesdeVisita, 120) : 0;
      const estado_mora = moraDias <= 0 ? 'al_dia' : moraDias <= 30 ? 'mora_30' : moraDias <= 60 ? 'mora_60' : 'mora_90';
      return {
        persona: { id: row.persona_id, nombres: row.nombres, apellidos: row.apellidos, telefono: row.telefono, email: row.email, ciudad: row.ciudad, cedula: row.cedula },
        sala: { id: row.sala_id, nombre: row.sala_nombre, ciudad: row.sala_ciudad },
        contrato: null,
        monto_total: montoTotal,
        monto_pagado: montoPagado,
        monto_saldo: montoTotal - montoPagado,
        mora_dias: moraDias,
        estado_mora,
        cuotas_vencidas: tieneMora ? 1 : 0,
      };
    });
    res.json(clientes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener cartera' });
  }
});

// GET /api/cartera/resumen?sala_id=X
router.get('/resumen', async (req, res) => {
  const { sala_id } = req.query;
  const { sala_id: userSalaId, rol } = req.user;
  const salaFiltro = sala_id || (['admin', 'director'].includes(rol) ? null : userSalaId);

  try {
    const result = await pool.query(`
      SELECT
        COUNT(c.id) AS total_contratos,
        COALESCE(SUM(c.monto_total), 0) AS total_cartera,
        COALESCE(SUM(sub.pagado), 0) AS total_pagado,
        COUNT(c.id) FILTER (WHERE sub.cuotas_vencidas > 0 AND sub.dias_mora BETWEEN 1 AND 30) AS mora_30,
        COUNT(c.id) FILTER (WHERE sub.dias_mora BETWEEN 31 AND 60) AS mora_60,
        COUNT(c.id) FILTER (WHERE sub.dias_mora > 60) AS mora_90,
        COUNT(c.id) FILTER (WHERE sub.cuotas_vencidas = 0) AS al_dia
      FROM contratos c
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(cu.monto_pagado), 0) AS pagado,
          COUNT(cu.id) FILTER (WHERE cu.estado = 'vencido') AS cuotas_vencidas,
          COALESCE(
            EXTRACT(DAY FROM NOW() - MAX(cu.fecha_vencimiento) FILTER (WHERE cu.estado = 'vencido'))::integer,
            0
          ) AS dias_mora
        FROM cuotas cu WHERE cu.contrato_id = c.id
      ) sub ON true
      WHERE c.estado != 'cancelado'
        AND ($1::integer IS NULL OR c.sala_id = $1)
    `, [salaFiltro || null]);

    const row = result.rows[0];
    const totalCartera = Number(row.total_cartera);
    const totalPagado = Number(row.total_pagado);

    if (Number(row.total_contratos) > 0) {
      return res.json({
        total_clientes: Number(row.total_contratos),
        total_cartera: totalCartera,
        total_pagado: totalPagado,
        total_saldo: totalCartera - totalPagado,
        porcentaje_cobro: totalCartera > 0 ? Number(((totalPagado / totalCartera) * 100).toFixed(1)) : 0,
        mora_30: Number(row.mora_30),
        mora_60: Number(row.mora_60),
        mora_90: Number(row.mora_90),
        al_dia: Number(row.al_dia),
      });
    }

    // Fallback mock
    const fallback = await pool.query(
      `SELECT vs.persona_id, vs.fecha FROM visitas_sala vs
       WHERE vs.calificacion = 'TOUR' AND ($1::integer IS NULL OR vs.sala_id = $1)`,
      [salaFiltro || null]
    );
    const hoy = new Date();
    let totalC = 0, totalP = 0, m30 = 0, m60 = 0, m90 = 0, alDia = 0;
    fallback.rows.forEach(row => {
      const mt = 12000 + (row.persona_id % 1000) * 10;
      const mp = Math.round(mt * (0.3 + (row.persona_id % 50) / 100));
      totalC += mt; totalP += mp;
      const tieneMora = row.persona_id % 3 === 0;
      if (!tieneMora) { alDia++; return; }
      const dias = Math.min(Math.floor((hoy - new Date(row.fecha)) / 86400000), 120);
      if (dias <= 30) m30++; else if (dias <= 60) m60++; else m90++;
    });
    res.json({
      total_clientes: fallback.rows.length,
      total_cartera: totalC,
      total_pagado: totalP,
      total_saldo: totalC - totalP,
      porcentaje_cobro: totalC > 0 ? Number(((totalP / totalC) * 100).toFixed(1)) : 0,
      mora_30: m30,
      mora_60: m60,
      mora_90: m90,
      al_dia: alDia,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener resumen de cartera' });
  }
});

module.exports = router;
