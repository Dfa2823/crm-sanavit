const express = require('express');
const multer  = require('multer');
const XLSX    = require('xlsx');
const pool = require('../db');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Auto-migrate: agregar outsourcing_empresa_id a leads si no existe
(async () => { try { await pool.query(`
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS outsourcing_empresa_id INTEGER REFERENCES outsourcing_empresas(id)
`); } catch(e) { /* ya existe */ } })();

// GET /api/outsourcing/empresas — listar todas las empresas
router.get('/empresas', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM outsourcing_empresas ORDER BY activo DESC, nombre ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener empresas outsourcing' });
  }
});

// POST /api/outsourcing/empresas — crear empresa
router.post('/empresas', async (req, res) => {
  const { nombre, contacto_nombre, contacto_telefono, contacto_email, ciudad, notas } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    const result = await pool.query(
      `INSERT INTO outsourcing_empresas (nombre, contacto_nombre, contacto_telefono, contacto_email, ciudad, notas, activo)
       VALUES ($1,$2,$3,$4,$5,$6,true) RETURNING *`,
      [nombre, contacto_nombre || null, contacto_telefono || null, contacto_email || null, ciudad || null, notas || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear empresa outsourcing' });
  }
});

// PATCH /api/outsourcing/empresas/:id — actualizar empresa
router.patch('/empresas/:id', async (req, res) => {
  const { nombre, contacto_nombre, contacto_telefono, contacto_email, ciudad, notas, activo } = req.body;
  try {
    const updates = [];
    const params = [];
    let idx = 1;
    if (nombre !== undefined) { updates.push(`nombre = $${idx++}`); params.push(nombre); }
    if (contacto_nombre !== undefined) { updates.push(`contacto_nombre = $${idx++}`); params.push(contacto_nombre); }
    if (contacto_telefono !== undefined) { updates.push(`contacto_telefono = $${idx++}`); params.push(contacto_telefono); }
    if (contacto_email !== undefined) { updates.push(`contacto_email = $${idx++}`); params.push(contacto_email); }
    if (ciudad !== undefined) { updates.push(`ciudad = $${idx++}`); params.push(ciudad); }
    if (notas !== undefined) { updates.push(`notas = $${idx++}`); params.push(notas); }
    if (activo !== undefined) { updates.push(`activo = $${idx++}`); params.push(activo); }
    if (updates.length === 0) return res.status(400).json({ error: 'Sin campos para actualizar' });
    params.push(req.params.id);
    const result = await pool.query(
      `UPDATE outsourcing_empresas SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Empresa no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar empresa outsourcing' });
  }
});

// GET /api/outsourcing/stats — estadísticas por empresa
router.get('/stats', async (req, res) => {
  const { sala_id, fecha_inicio, fecha_fin } = req.query;
  const { sala_id: userSalaId, rol } = req.user;
  const hoy = new Date();
  const primerMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
  const inicio = fecha_inicio || primerMes;
  const fin = fecha_fin || hoy.toISOString().split('T')[0];
  const salaFiltro = sala_id || (['admin', 'director'].includes(rol) ? null : userSalaId);
  try {
    const result = await pool.query(`
      SELECT
        oe.id AS empresa_id,
        oe.nombre AS empresa,
        oe.ciudad,
        COUNT(l.id) AS total_leads,
        COUNT(l.id) FILTER (WHERE l.estado IN ('confirmada','tentativa')) AS citas,
        COUNT(l.id) FILTER (WHERE l.estado IN ('tour','no_tour','inasistencia')) AS asistencias,
        COUNT(l.id) FILTER (WHERE l.estado = 'tour') AS tours,
        CASE WHEN COUNT(l.id) > 0
          THEN ROUND(COUNT(l.id) FILTER (WHERE l.estado IN ('confirmada','tentativa'))::numeric / COUNT(l.id) * 100, 1)
          ELSE 0 END AS efectividad_datos,
        CASE WHEN COUNT(l.id) FILTER (WHERE l.estado IN ('tour','no_tour','inasistencia')) > 0
          THEN ROUND(COUNT(l.id) FILTER (WHERE l.estado = 'tour')::numeric /
               COUNT(l.id) FILTER (WHERE l.estado IN ('tour','no_tour','inasistencia')) * 100, 1)
          ELSE 0 END AS efectividad_tour
      FROM outsourcing_empresas oe
      LEFT JOIN leads l ON l.outsourcing_empresa_id = oe.id
        AND DATE(l.created_at) BETWEEN $1::date AND $2::date
        AND ($3::integer IS NULL OR l.sala_id = $3)
      WHERE oe.activo = true
      GROUP BY oe.id, oe.nombre, oe.ciudad
      ORDER BY total_leads DESC
    `, [inicio, fin, salaFiltro || null]);
    res.json({ data: result.rows, meta: { inicio, fin, sala_id: salaFiltro || 'todas' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener estadísticas outsourcing' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers para carga de leads por outsourcing
// ─────────────────────────────────────────────────────────────────────────────
function normalizarTelefono(val) {
  if (!val && val !== 0) return null;
  let t = String(val).trim().replace(/[\s\-\.()]/g, '');
  if (t.startsWith('00593')) t = '0' + t.slice(5);
  if (t.startsWith('+593')) t = '0' + t.slice(4);
  if (t.startsWith('593') && t.length >= 12) t = '0' + t.slice(3);
  if (/^\d{9}$/.test(t)) t = '0' + t;
  if (/^0\d{9}$/.test(t)) return t;
  if (/^\d{7,8}$/.test(t)) return '0' + t;
  return t.length > 0 ? t : null;
}

function toTitleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/outsourcing/lead — Crear lead individual desde outsourcing
// ─────────────────────────────────────────────────────────────────────────────
router.post('/lead', async (req, res) => {
  const { nombre, telefono, fecha_cita, sala_id, patologia, observacion, outsourcing_empresa_id } = req.body;
  const outsourcingUserId = req.user.id;

  if (!nombre || !telefono || !fecha_cita || !sala_id) {
    return res.status(400).json({ error: 'Nombre, teléfono, fecha de cita y sala son requeridos' });
  }

  const telNorm = normalizarTelefono(telefono);
  if (!telNorm) return res.status(400).json({ error: 'Teléfono inválido' });

  try {
    // Buscar o crear persona
    const existing = await pool.query(
      'SELECT id FROM personas WHERE telefono = $1 OR telefono2 = $1 LIMIT 1', [telNorm]
    );

    let personaId;
    if (existing.rows.length > 0) {
      personaId = existing.rows[0].id;
    } else {
      const partes = nombre.trim().split(/\s+/).filter(Boolean);
      let nombres, apellidos;
      if (partes.length >= 3) {
        apellidos = partes.slice(0, Math.ceil(partes.length / 2)).join(' ');
        nombres = partes.slice(Math.ceil(partes.length / 2)).join(' ');
      } else if (partes.length === 2) {
        apellidos = partes[0]; nombres = partes[1];
      } else {
        nombres = nombre.trim(); apellidos = '';
      }
      const pRes = await pool.query(
        `INSERT INTO personas (nombres, apellidos, telefono, patologia)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [toTitleCase(nombres), toTitleCase(apellidos), telNorm, patologia || null]
      );
      personaId = pRes.rows[0].id;
    }

    // Verificar duplicado (lead activo en misma sala)
    const leadExist = await pool.query(
      'SELECT id FROM leads WHERE persona_id = $1 AND sala_id = $2 LIMIT 1',
      [personaId, sala_id]
    );
    if (leadExist.rows.length > 0) {
      return res.status(409).json({ error: 'Ya existe un lead con este teléfono en la sala seleccionada' });
    }

    // Crear lead: estado confirmada, tipificacion_id=2 (Cita)
    const result = await pool.query(
      `INSERT INTO leads (persona_id, sala_id, outsourcing_id, tipificacion_id, fecha_cita, patologia, estado, observacion, outsourcing_empresa_id)
       VALUES ($1,$2,$3,2,$4,$5,'confirmada',$6,$7) RETURNING id`,
      [personaId, sala_id, outsourcingUserId, fecha_cita, patologia || null,
       observacion || 'Cargado por outsourcing', outsourcing_empresa_id || null]
    );

    res.status(201).json({ ok: true, lead_id: result.rows[0].id, mensaje: 'Lead creado exitosamente' });
  } catch (err) {
    console.error('Error crear lead outsourcing:', err);
    res.status(500).json({ error: 'Error al crear lead: ' + err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/outsourcing/carga-masiva — Subir Excel/CSV con leads
// ─────────────────────────────────────────────────────────────────────────────
router.post('/carga-masiva', upload.single('archivo'), async (req, res) => {
  const outsourcingUserId = req.user.id;

  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

  let config;
  try {
    config = JSON.parse(req.body.config || '{}');
  } catch {
    return res.status(400).json({ error: 'Configuración inválida' });
  }

  const { sala_id, outsourcing_empresa_id } = config;
  if (!sala_id) return res.status(400).json({ error: 'La sala es requerida' });

  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellText: true, cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
    const filas = raw.filter(f => f.some(c => String(c).trim() !== ''));

    if (filas.length === 0) return res.status(400).json({ error: 'El archivo está vacío' });

    // Auto-detectar encabezado y mapeo de columnas
    const primerFila = filas[0].map(c => String(c).toLowerCase().trim());
    const palabrasNombre = ['nombre', 'nombres', 'cliente', 'nombre completo', 'nombre_completo'];
    const palabrasTelefono = ['telefono', 'teléfono', 'celular', 'tel', 'phone', 'movil', 'móvil'];
    const palabrasFecha = ['fecha', 'fecha_cita', 'fecha cita', 'date', 'cita'];
    const palabrasPatologia = ['patologia', 'patología', 'diagnostico', 'diagnóstico', 'enfermedad'];
    const palabrasObservacion = ['observacion', 'observación', 'nota', 'notas', 'comentario'];

    function findCol(keywords) {
      return primerFila.findIndex(h => keywords.some(k => h.includes(k)));
    }

    const colNombre = findCol(palabrasNombre);
    const colTelefono = findCol(palabrasTelefono);
    const colFecha = findCol(palabrasFecha);
    const colPatologia = findCol(palabrasPatologia);
    const colObservacion = findCol(palabrasObservacion);

    // Determinar si tiene encabezado
    const tieneEncabezado = colNombre >= 0 || colTelefono >= 0;
    const datos = tieneEncabezado ? filas.slice(1) : filas;

    // Si no detectó columnas, usar primeras 3 columnas: nombre, telefono, fecha
    const iNombre = colNombre >= 0 ? colNombre : 0;
    const iTelefono = colTelefono >= 0 ? colTelefono : 1;
    const iFecha = colFecha >= 0 ? colFecha : (filas[0].length > 2 ? 2 : -1);
    const iPatologia = colPatologia;
    const iObservacion = colObservacion;

    const stats = {
      importados: 0,
      duplicados: 0,
      errores: 0,
      detalles_errores: [],
      duplicados_detalle: [],
    };

    const telefonosVistos = new Set();
    const nombreArchivo = req.file?.originalname || 'desconocido';

    for (let i = 0; i < datos.length; i++) {
      const fila = datos[i];
      try {
        const nombreRaw = String(fila[iNombre] || '').trim();
        const telRaw = String(fila[iTelefono] || '').trim();
        const fechaRaw = iFecha >= 0 ? String(fila[iFecha] || '').trim() : '';
        const patologiaRaw = iPatologia >= 0 ? String(fila[iPatologia] || '').trim() : '';
        const obsRaw = iObservacion >= 0 ? String(fila[iObservacion] || '').trim() : '';

        if (!nombreRaw) {
          stats.errores++;
          if (stats.detalles_errores.length < 10) stats.detalles_errores.push(`Fila ${i + 2}: nombre vacío`);
          continue;
        }

        const telNorm = normalizarTelefono(telRaw);
        if (!telNorm) {
          stats.errores++;
          if (stats.detalles_errores.length < 10) stats.detalles_errores.push(`Fila ${i + 2}: teléfono inválido "${telRaw}"`);
          continue;
        }

        // Duplicado interno
        if (telefonosVistos.has(telNorm)) {
          stats.duplicados++;
          if (stats.duplicados_detalle.length < 100) {
            stats.duplicados_detalle.push({ fila: i + 2, nombre: nombreRaw, telefono: telNorm, motivo: 'Duplicado en archivo' });
          }
          continue;
        }
        telefonosVistos.add(telNorm);

        // Buscar o crear persona
        const existing = await pool.query(
          'SELECT id FROM personas WHERE telefono = $1 OR telefono2 = $1 LIMIT 1', [telNorm]
        );

        let personaId;
        if (existing.rows.length > 0) {
          personaId = existing.rows[0].id;
        } else {
          const partes = nombreRaw.split(/\s+/).filter(Boolean);
          let nombres, apellidos;
          if (partes.length >= 3) {
            apellidos = partes.slice(0, Math.ceil(partes.length / 2)).join(' ');
            nombres = partes.slice(Math.ceil(partes.length / 2)).join(' ');
          } else if (partes.length === 2) {
            apellidos = partes[0]; nombres = partes[1];
          } else {
            nombres = nombreRaw; apellidos = '';
          }
          const pRes = await pool.query(
            'INSERT INTO personas (nombres, apellidos, telefono) VALUES ($1,$2,$3) RETURNING id',
            [toTitleCase(nombres), toTitleCase(apellidos), telNorm]
          );
          personaId = pRes.rows[0].id;
        }

        // Duplicado en BD
        const leadExist = await pool.query(
          'SELECT id FROM leads WHERE persona_id = $1 AND sala_id = $2 LIMIT 1',
          [personaId, sala_id]
        );
        if (leadExist.rows.length > 0) {
          stats.duplicados++;
          if (stats.duplicados_detalle.length < 100) {
            stats.duplicados_detalle.push({ fila: i + 2, nombre: nombreRaw, telefono: telNorm, motivo: 'Ya existe en la base de datos' });
          }
          continue;
        }

        // Parsear fecha si existe
        let fechaCita = null;
        if (fechaRaw) {
          // Intentar parsear varios formatos
          const parsed = new Date(fechaRaw);
          if (!isNaN(parsed.getTime())) {
            fechaCita = parsed.toISOString();
          } else {
            // Intentar DD/MM/YYYY o DD-MM-YYYY
            const match = fechaRaw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
            if (match) {
              fechaCita = new Date(`${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}T09:00:00`).toISOString();
            }
          }
        }

        // Crear lead
        await pool.query(
          `INSERT INTO leads (persona_id, sala_id, outsourcing_id, tipificacion_id, fecha_cita, patologia, estado, observacion, outsourcing_empresa_id)
           VALUES ($1,$2,$3,2,$4,$5,'confirmada',$6,$7)`,
          [personaId, sala_id, outsourcingUserId, fechaCita, patologiaRaw || null,
           obsRaw || `Carga masiva: ${nombreArchivo}`, outsourcing_empresa_id || null]
        );

        stats.importados++;
      } catch (rowErr) {
        stats.errores++;
        if (stats.detalles_errores.length < 10) {
          stats.detalles_errores.push(`Fila ${i + 2}: ${rowErr.message}`);
        }
      }

      // Pausa cada 50 registros
      if (i % 50 === 0 && i > 0) await new Promise(r => setTimeout(r, 10));
    }

    res.json({
      ok: true,
      archivo_nombre: nombreArchivo,
      total_procesadas: datos.length,
      importados: stats.importados,
      duplicados: stats.duplicados,
      errores: stats.errores,
      detalles_errores: stats.detalles_errores,
      duplicados_detalle: stats.duplicados_detalle,
    });
  } catch (err) {
    console.error('Carga masiva outsourcing error:', err);
    res.status(500).json({ error: 'Error al procesar archivo: ' + err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/outsourcing/salas — Listar salas activas (para select en formulario)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/salas', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, nombre, ciudad FROM salas WHERE activo = true ORDER BY nombre');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener salas' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/outsourcing/mis-leads
// Leads donde outsourcing_id = req.user.id, con JOINs a personas,
// visitas_sala, contratos. Filtro por mes.
// ─────────────────────────────────────────────────────────────
router.get('/mis-leads', async (req, res) => {
  const { id: userId } = req.user;
  const { mes } = req.query;
  const mesFiltro = mes || new Date().toISOString().slice(0, 7);

  try {
    const result = await pool.query(`
      SELECT
        l.id AS lead_id,
        l.estado,
        l.fecha_cita,
        l.patologia,
        l.created_at,
        p.nombres,
        p.apellidos,
        p.telefono,
        p.email,
        vs.id AS visita_id,
        vs.calificacion,
        vs.fecha AS fecha_visita,
        ct.id AS contrato_id,
        ct.numero_contrato,
        ct.monto_total,
        ct.estado AS contrato_estado,
        ct.fecha_contrato,
        COALESCE(rec.total_pagado, 0) AS total_pagado,
        CASE WHEN ct.id IS NOT NULL
          THEN ct.monto_total - COALESCE(rec.total_pagado, 0)
          ELSE 0
        END AS saldo
      FROM leads l
      JOIN personas p ON l.persona_id = p.id
      LEFT JOIN visitas_sala vs ON vs.lead_id = l.id
      LEFT JOIN contratos ct ON ct.visita_sala_id = vs.id
      LEFT JOIN (
        SELECT contrato_id, SUM(valor) AS total_pagado
        FROM recibos
        WHERE estado = 'activo'
        GROUP BY contrato_id
      ) rec ON rec.contrato_id = ct.id
      WHERE l.outsourcing_id = $1
        AND TO_CHAR(l.created_at, 'YYYY-MM') = $2
      ORDER BY l.created_at DESC
      LIMIT 500
    `, [userId, mesFiltro]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error en GET /api/outsourcing/mis-leads:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/outsourcing/mi-resumen
// KPIs del outsourcing: leads_mes, citas_agendadas, tours,
// ventas_cerradas, monto_vendido, total_cobrado
// Query params: mes (YYYY-MM)
// ─────────────────────────────────────────────────────────────
router.get('/mi-resumen', async (req, res) => {
  const { id: userId } = req.user;
  const mesFiltro = req.query.mes || new Date().toISOString().slice(0, 7);

  try {
    // Leads y citas del mes
    const leadsRes = await pool.query(`
      SELECT
        COUNT(*) AS leads_mes,
        COUNT(*) FILTER (WHERE l.estado IN ('confirmada','tentativa')) AS citas_agendadas,
        COUNT(*) FILTER (WHERE l.estado IN ('tour','no_tour','inasistencia')) AS asistencias,
        COUNT(*) FILTER (WHERE l.estado = 'tour') AS tours
      FROM leads l
      WHERE l.outsourcing_id = $1
        AND TO_CHAR(l.created_at, 'YYYY-MM') = $2
    `, [userId, mesFiltro]);

    // Ventas y cobros (contratos vinculados a mis leads via visitas_sala)
    const ventasRes = await pool.query(`
      SELECT
        COUNT(DISTINCT ct.id) AS ventas_cerradas,
        COALESCE(SUM(ct.monto_total), 0) AS monto_vendido,
        COALESCE(SUM(rec.total_pagado), 0) AS total_cobrado
      FROM leads l
      JOIN visitas_sala vs ON vs.lead_id = l.id
      JOIN contratos ct ON ct.visita_sala_id = vs.id AND ct.estado != 'cancelado'
      LEFT JOIN (
        SELECT contrato_id, SUM(valor) AS total_pagado
        FROM recibos
        WHERE estado = 'activo'
        GROUP BY contrato_id
      ) rec ON rec.contrato_id = ct.id
      WHERE l.outsourcing_id = $1
        AND TO_CHAR(l.created_at, 'YYYY-MM') = $2
    `, [userId, mesFiltro]);

    const l = leadsRes.rows[0] || {};
    const v = ventasRes.rows[0] || {};

    res.json({
      leads_mes: parseInt(l.leads_mes || 0, 10),
      citas_agendadas: parseInt(l.citas_agendadas || 0, 10),
      asistencias: parseInt(l.asistencias || 0, 10),
      tours: parseInt(l.tours || 0, 10),
      ventas_cerradas: parseInt(v.ventas_cerradas || 0, 10),
      monto_vendido: parseFloat(v.monto_vendido || 0),
      total_cobrado: parseFloat(v.total_cobrado || 0),
    });
  } catch (err) {
    console.error('Error en GET /api/outsourcing/mi-resumen:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
