const express = require('express');
const pool = require('../db');

const router = express.Router();

// ── Helpers ────────────────────────────────────────────────────

// Calcula estado de mora según días vencidos
function calcularEstadoMora(moraDias) {
  if (moraDias <= 0)  return 'al_dia';
  if (moraDias <= 30) return 'mora_30';
  if (moraDias <= 60) return 'mora_60';
  return 'mora_90';
}

// Genera datos de deuda simulados a partir de la fecha de la visita
// Se usa mientras no existan tablas de contratos/pagos
function generarDatosMockCartera(visita) {
  const fechaVisita = new Date(visita.fecha);
  const hoy = new Date();

  // Simular monto según si es TOUR (compra potencial)
  const montoBase = visita.calificacion === 'TOUR' ? 12000 : 8500;
  const montoTotal = montoBase + (visita.persona_id % 1000) * 10; // variación por persona

  // Simular pagos parciales (30-80% pagado)
  const porcentajePagado = 0.3 + ((visita.persona_id % 50) / 100);
  const montoPagado = Math.round(montoTotal * porcentajePagado);

  // Días desde la visita como proxy de mora
  const diasDesdeVisita = Math.floor((hoy - fechaVisita) / (1000 * 60 * 60 * 24));
  // Mora simulada: algunos clientes tienen mora, otros están al día
  const tieneMora = visita.persona_id % 3 === 0; // 1 de cada 3 tiene mora
  const moraDias = tieneMora ? Math.min(diasDesdeVisita, 120) : 0;

  return {
    monto_total: montoTotal,
    monto_pagado: montoPagado,
    mora_dias: moraDias,
    estado_mora: calcularEstadoMora(moraDias),
  };
}

// ═══════════════════════════════════════════════════════════════
// GET /api/cartera?sala_id=X
// Lista clientes con información de deuda
// ═══════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  const { sala_id } = req.query;
  const { sala_id: userSalaId, rol } = req.user;

  // Admin y director pueden ver todas las salas; los demás solo la suya
  const salaFiltro = sala_id ||
    (['admin', 'director'].includes(rol) ? null : userSalaId);

  try {
    // Obtener tours registrados en visitas_sala (clientes que hicieron TOUR)
    const result = await pool.query(`
      SELECT
        vs.id AS visita_id,
        vs.fecha,
        vs.calificacion,
        vs.sala_id,
        p.id AS persona_id,
        p.nombres,
        p.apellidos,
        p.telefono,
        p.email,
        p.ciudad,
        p.cedula,
        s.nombre AS sala_nombre,
        s.ciudad AS sala_ciudad,
        uc.nombre AS consultor_nombre,
        l.id AS lead_id,
        l.patologia,
        f.nombre AS fuente_nombre
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

    const clientes = result.rows.map(row => {
      const mockDeuda = generarDatosMockCartera(row);

      return {
        persona: {
          id: row.persona_id,
          nombres: row.nombres,
          apellidos: row.apellidos,
          telefono: row.telefono,
          email: row.email,
          ciudad: row.ciudad,
          cedula: row.cedula,
        },
        sala: {
          id: row.sala_id,
          nombre: row.sala_nombre,
          ciudad: row.sala_ciudad,
        },
        visita: {
          id: row.visita_id,
          fecha: row.fecha,
          consultor: row.consultor_nombre,
          lead_id: row.lead_id,
          patologia: row.patologia,
          fuente: row.fuente_nombre,
        },
        monto_total:  mockDeuda.monto_total,
        monto_pagado: mockDeuda.monto_pagado,
        monto_saldo:  mockDeuda.monto_total - mockDeuda.monto_pagado,
        mora_dias:    mockDeuda.mora_dias,
        estado_mora:  mockDeuda.estado_mora,
      };
    });

    res.json(clientes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener cartera' });
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/cartera/resumen?sala_id=X
// Estadísticas resumen de la cartera
// ═══════════════════════════════════════════════════════════════
router.get('/resumen', async (req, res) => {
  const { sala_id } = req.query;
  const { sala_id: userSalaId, rol } = req.user;

  const salaFiltro = sala_id ||
    (['admin', 'director'].includes(rol) ? null : userSalaId);

  try {
    const result = await pool.query(`
      SELECT
        vs.id AS visita_id,
        vs.fecha,
        vs.persona_id,
        vs.calificacion
      FROM visitas_sala vs
      WHERE vs.calificacion = 'TOUR'
        AND ($1::integer IS NULL OR vs.sala_id = $1)
    `, [salaFiltro || null]);

    const rows = result.rows;

    // Calcular totales a partir de datos mock
    let totalCartera   = 0;
    let totalPagado    = 0;
    let mora30Count    = 0;
    let mora60Count    = 0;
    let mora90Count    = 0;
    let alDiaCount     = 0;

    rows.forEach(row => {
      const deuda = generarDatosMockCartera(row);
      totalCartera += deuda.monto_total;
      totalPagado  += deuda.monto_pagado;

      switch (deuda.estado_mora) {
        case 'mora_30': mora30Count++; break;
        case 'mora_60': mora60Count++; break;
        case 'mora_90': mora90Count++; break;
        default:        alDiaCount++;  break;
      }
    });

    res.json({
      total_clientes:  rows.length,
      total_cartera:   totalCartera,
      total_pagado:    totalPagado,
      total_saldo:     totalCartera - totalPagado,
      porcentaje_cobro: rows.length > 0
        ? Number(((totalPagado / totalCartera) * 100).toFixed(1))
        : 0,
      mora_30:   mora30Count,
      mora_60:   mora60Count,
      mora_90:   mora90Count,
      al_dia:    alDiaCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener resumen de cartera' });
  }
});

module.exports = router;
