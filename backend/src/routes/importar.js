const express = require('express');
const multer  = require('multer');
const XLSX    = require('xlsx');
const pool    = require('../db');
const auth    = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/importar/preview
// Recibe el archivo, devuelve primeras 20 filas para mapeo de columnas
// ─────────────────────────────────────────────────────────────────────────────
router.post('/preview', auth, upload.single('archivo'), async (req, res) => {
  const { rol } = req.user;
  if (!['admin', 'director', 'supervisor_cc'].includes(rol)) {
    return res.status(403).json({ error: 'Sin permiso para importar bases de datos' });
  }

  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellText: true, cellDates: true });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];

    // Convertir a array de arrays (filas x columnas)
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });

    // Filtrar filas completamente vacías
    const filas = raw.filter(fila => fila.some(c => c !== null && c !== undefined && String(c).trim() !== ''));

    const preview = filas.slice(0, 20);
    const totalFilas = filas.length;
    const totalCols = preview[0] ? preview[0].length : 0;

    // Auto-detectar si la primera fila parece encabezado
    const primerFila = preview[0] || [];
    const palabrasHeader = ['nombre','telefono','teléfono','celular','cedula','cédula','ciudad','genero','género','codigo','código','direccion','dirección','fuente'];
    const esEncabezado = primerFila.some(c =>
      palabrasHeader.some(p => String(c).toLowerCase().includes(p))
    );

    res.json({
      sheetName,
      totalFilas,
      totalCols,
      preview,
      esEncabezado,
    });
  } catch (err) {
    console.error('Preview error:', err);
    res.status(400).json({ error: 'No se pudo leer el archivo. Asegúrate de que sea un .xlsx o .xls válido.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/importar/ejecutar
// Ejecuta la importación con el mapeo y configuración del usuario
// Body: FormData con archivo + config JSON
// ─────────────────────────────────────────────────────────────────────────────
router.post('/ejecutar', auth, upload.single('archivo'), async (req, res) => {
  const { rol, id: userId } = req.user;
  if (!['admin', 'director', 'supervisor_cc'].includes(rol)) {
    return res.status(403).json({ error: 'Sin permiso para importar bases de datos' });
  }

  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

  let config;
  try {
    config = JSON.parse(req.body.config);
  } catch {
    return res.status(400).json({ error: 'Configuración inválida' });
  }

  const {
    sala_id,
    tmk_id,          // null = distribuir round-robin entre TMKs de la sala
    fuente_id,
    tipificacion_id,
    tiene_encabezado, // boolean
    mapeo,            // { nombre_completo: 0, nombres: null, apellidos: null, telefono: 1, telefono2: 2, ciudad: 3, ... }
  } = config;

  if (!sala_id || !fuente_id || !tipificacion_id) {
    return res.status(400).json({ error: 'Faltan campos requeridos: sala, fuente, tipificación' });
  }
  if (mapeo.nombre_completo === null && mapeo.nombres === null) {
    return res.status(400).json({ error: 'Debes mapear al menos la columna de nombre' });
  }
  if (mapeo.telefono === null && mapeo.telefono2 === null) {
    return res.status(400).json({ error: 'Debes mapear al menos una columna de teléfono' });
  }

  try {
    // Cargar archivo
    const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellText: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
    const filas = raw.filter(f => f.some(c => String(c).trim() !== ''));
    const datos = tiene_encabezado ? filas.slice(1) : filas;

    // Si hay round-robin, obtener TMKs activos de la sala
    let tmkIds = [];
    let tmkIndex = 0;
    if (!tmk_id) {
      const tmkRes = await pool.query(
        `SELECT u.id FROM usuarios u
         JOIN roles r ON u.rol_id = r.id
         WHERE r.nombre = 'tmk' AND u.sala_id = $1 AND u.activo = true ORDER BY u.id`,
        [sala_id]
      );
      tmkIds = tmkRes.rows.map(r => r.id);
      if (tmkIds.length === 0) tmkIds = [userId]; // fallback al importador
    }

    // Verificar tipificación para determinar estado inicial
    const tipRes = await pool.query('SELECT requiere_fecha_cita FROM tipificaciones WHERE id = $1', [tipificacion_id]);
    const estadoInicial = (tipRes.rows[0]?.requiere_fecha_cita) ? 'confirmada' : 'pendiente';

    const stats = { importados: 0, duplicados: 0, errores: 0, detalles_errores: [] };

    // Helpers
    function normalizarTelefono(val) {
      if (!val && val !== 0) return null;
      let t = String(val).trim().replace(/[\s\-\.]/g, '');
      // Formato internacional 00593XXXXXXXXX → 0XXXXXXXXX
      if (t.startsWith('00593')) t = '0' + t.slice(5);
      // Formato +593XXXXXXXXX → 0XXXXXXXXX
      if (t.startsWith('+593')) t = '0' + t.slice(4);
      // 9 dígitos sin cero inicial → agregar 0
      if (/^\d{9}$/.test(t)) t = '0' + t;
      // Validar: debe tener 10 dígitos y empezar con 0
      if (/^0\d{9}$/.test(t)) return t;
      // Teléfono fijo (7-8 dígitos)
      if (/^\d{7,8}$/.test(t)) return '0' + t;
      return t.length > 0 ? t : null;
    }

    function extraerNombreApellido(fila) {
      let nombres = '', apellidos = '';
      if (mapeo.nombre_completo !== null && mapeo.nombre_completo !== undefined) {
        const full = String(fila[mapeo.nombre_completo] || '').trim();
        const partes = full.split(/\s+/).filter(Boolean);
        if (partes.length >= 4) {
          // Convenio: 2 apellidos + 2 nombres
          apellidos = partes.slice(0, 2).join(' ');
          nombres   = partes.slice(2).join(' ');
        } else if (partes.length === 3) {
          apellidos = partes[0];
          nombres   = partes.slice(1).join(' ');
        } else if (partes.length === 2) {
          apellidos = partes[0];
          nombres   = partes[1];
        } else {
          nombres = full;
        }
      } else {
        nombres   = String(fila[mapeo.nombres]   || '').trim();
        apellidos = String(fila[mapeo.apellidos] || '').trim();
      }
      return {
        nombres:   toTitleCase(nombres),
        apellidos: toTitleCase(apellidos),
      };
    }

    function toTitleCase(str) {
      return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    }

    // Procesar en lotes de 50 para no saturar el pool
    const BATCH = 50;
    for (let i = 0; i < datos.length; i++) {
      const fila = datos[i];
      try {
        const { nombres, apellidos } = extraerNombreApellido(fila);
        if (!nombres && !apellidos) { stats.errores++; continue; }

        const telefono  = mapeo.telefono  !== null && mapeo.telefono  !== undefined ? normalizarTelefono(fila[mapeo.telefono])  : null;
        const telefono2 = mapeo.telefono2 !== null && mapeo.telefono2 !== undefined ? normalizarTelefono(fila[mapeo.telefono2]) : null;
        const ciudad    = mapeo.ciudad    !== null && mapeo.ciudad    !== undefined ? toTitleCase(String(fila[mapeo.ciudad] || '').trim())  : null;
        const genero    = mapeo.genero    !== null && mapeo.genero    !== undefined ? String(fila[mapeo.genero] || '').trim().toLowerCase() : null;
        const direccion = mapeo.direccion !== null && mapeo.direccion !== undefined ? String(fila[mapeo.direccion] || '').trim() : null;
        const cedula    = mapeo.cedula    !== null && mapeo.cedula    !== undefined ? String(fila[mapeo.cedula]   || '').trim() : null;

        if (!telefono && !telefono2) { stats.errores++; continue; }

        // Buscar persona existente por teléfono
        const telCheck = [telefono, telefono2].filter(Boolean);
        let personaId = null;
        const existing = await pool.query(
          `SELECT id FROM personas WHERE telefono = ANY($1) OR telefono2 = ANY($1) LIMIT 1`,
          [telCheck]
        );
        if (existing.rows.length > 0) {
          personaId = existing.rows[0].id;
        } else {
          // Crear persona nueva
          const pRes = await pool.query(
            `INSERT INTO personas (nombres, apellidos, telefono, telefono2, ciudad, genero, direccion, num_documento)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
            [nombres, apellidos, telefono, telefono2 || null, ciudad || null,
             genero || null, direccion || null, cedula || null]
          );
          personaId = pRes.rows[0].id;
        }

        // Verificar si ya existe un lead activo para esta persona en esta sala
        const leadExist = await pool.query(
          `SELECT id FROM leads WHERE persona_id = $1 AND sala_id = $2 LIMIT 1`,
          [personaId, sala_id]
        );
        if (leadExist.rows.length > 0) {
          stats.duplicados++;
          continue;
        }

        // Determinar TMK: fijo o round-robin
        const asignadoTmk = tmk_id || tmkIds[tmkIndex % tmkIds.length];
        if (!tmk_id) tmkIndex++;

        // Crear lead
        await pool.query(
          `INSERT INTO leads (persona_id, sala_id, tmk_id, fuente_id, tipificacion_id, estado)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [personaId, sala_id, asignadoTmk, fuente_id, tipificacion_id, estadoInicial]
        );

        stats.importados++;
      } catch (rowErr) {
        stats.errores++;
        if (stats.detalles_errores.length < 5) {
          stats.detalles_errores.push(`Fila ${i + 2}: ${rowErr.message}`);
        }
      }

      // Pausa ligera cada lote para no sobrecargar
      if (i % BATCH === 0 && i > 0) {
        await new Promise(r => setTimeout(r, 10));
      }
    }

    res.json({
      ok: true,
      total_procesadas: datos.length,
      importados: stats.importados,
      duplicados: stats.duplicados,
      errores: stats.errores,
      detalles_errores: stats.detalles_errores,
    });
  } catch (err) {
    console.error('Importar ejecutar error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
