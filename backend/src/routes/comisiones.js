const express = require('express');
const pool = require('../db');
const router = express.Router();

// GET /api/comisiones?periodo=YYYY-MM&sala_id=X
router.get('/', async (req, res) => {
  const { periodo, sala_id } = req.query;
  const { sala_id: userSalaId, rol, id: userId } = req.user;

  const periodoFiltro = periodo || new Date().toISOString().slice(0, 7);
  const salaFiltro = sala_id || (['admin', 'director'].includes(rol) ? null : userSalaId);
  // TMK y consultor solo ven sus propias comisiones
  const usuarioFiltro = ['admin', 'director', 'supervisor_cc'].includes(rol) ? null : userId;

  try {
    const result = await pool.query(`
      SELECT
        c.id,
        c.tipo,
        c.monto,
        c.estado,
        c.periodo,
        c.referencia_id,
        c.referencia_tipo,
        c.observacion,
        c.created_at,
        u.nombre AS usuario_nombre,
        u.username,
        r.label AS rol_label,
        s.nombre AS sala_nombre
      FROM comisiones c
      JOIN usuarios u ON c.usuario_id = u.id
      JOIN roles r ON u.rol_id = r.id
      LEFT JOIN salas s ON c.sala_id = s.id
      WHERE c.periodo = $1
        AND ($2::integer IS NULL OR c.sala_id = $2)
        AND ($3::integer IS NULL OR c.usuario_id = $3)
      ORDER BY c.created_at DESC
    `, [periodoFiltro, salaFiltro || null, usuarioFiltro || null]);

    res.json({
      data: result.rows,
      meta: {
        periodo: periodoFiltro,
        total: result.rows.length,
        total_monto: result.rows.reduce((sum, r) => sum + Number(r.monto), 0),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener comisiones' });
  }
});

// GET /api/comisiones/resumen?periodo=YYYY-MM
// Resumen agrupado por usuario
router.get('/resumen', async (req, res) => {
  const { periodo, sala_id } = req.query;
  const { sala_id: userSalaId, rol } = req.user;
  const periodoFiltro = periodo || new Date().toISOString().slice(0, 7);
  const salaFiltro = sala_id || (['admin', 'director'].includes(rol) ? null : userSalaId);

  try {
    // Calcular comisiones automáticas basadas en tours y ventas del período
    const toursResult = await pool.query(`
      SELECT
        u.id AS usuario_id,
        u.nombre,
        r.nombre AS rol,
        s.nombre AS sala,
        COUNT(vs.id) FILTER (WHERE vs.calificacion = 'TOUR') AS tours,
        COUNT(DISTINCT c.id) AS contratos
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      LEFT JOIN salas s ON u.sala_id = s.id
      LEFT JOIN visitas_sala vs ON vs.consultor_id = u.id
        AND TO_CHAR(vs.fecha, 'YYYY-MM') = $1
        AND ($2::integer IS NULL OR vs.sala_id = $2)
      LEFT JOIN contratos c ON c.consultor_id = u.id
        AND TO_CHAR(c.fecha_contrato, 'YYYY-MM') = $1
        AND ($2::integer IS NULL OR c.sala_id = $2)
      WHERE u.activo = true
        AND r.nombre IN ('consultor', 'tmk', 'confirmador', 'supervisor_cc')
      GROUP BY u.id, u.nombre, r.nombre, s.nombre
      HAVING COUNT(vs.id) FILTER (WHERE vs.calificacion = 'TOUR') > 0
          OR COUNT(DISTINCT c.id) > 0
      ORDER BY contratos DESC, tours DESC
    `, [periodoFiltro, salaFiltro || null]);

    // Tabla de comisiones por rol (configuración básica)
    const comisionPorTour = { consultor: 50, tmk: 15, confirmador: 10 };
    const comisionPorContrato = { consultor: 200, tmk: 30, confirmador: 20 };

    const data = toursResult.rows.map(row => {
      const tours = Number(row.tours);
      const contratos = Number(row.contratos);
      const comTour = (comisionPorTour[row.rol] || 0) * tours;
      const comContrato = (comisionPorContrato[row.rol] || 0) * contratos;
      const total = comTour + comContrato;
      return {
        ...row,
        comision_tours: comTour,
        comision_contratos: comContrato,
        total_comision: total,
      };
    });

    res.json({
      data,
      meta: {
        periodo: periodoFiltro,
        total_comisiones: data.reduce((s, r) => s + r.total_comision, 0),
        tabla_comisiones: {
          tour: comisionPorTour,
          contrato: comisionPorContrato,
        },
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al calcular resumen de comisiones' });
  }
});

module.exports = router;
