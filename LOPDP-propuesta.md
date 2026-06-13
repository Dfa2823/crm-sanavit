# Propuesta LOPDP — CRM Sanavit (referencia, NO implementada)

> Estado (jun-2026): **no urgente** para la etapa actual del sistema. Este documento
> queda como referencia para cuando el volumen/escrutinio legal lo amerite. La
> auditoría técnica (Tandas A/B/C/E/F) ya cubrió acceso, validación de dinero,
> integridad de BD y trazabilidad. Lo de abajo es **política/diseño**, no quick-fix.

## Qué ya está cubierto (no requiere acción)

- **Trazabilidad (audit_log)**: se registran login, crear/anular contrato, registrar/anular
  recibo, condonar intereses, suspender comisión, calcular/aprobar nómina, crear/modificar/
  inactivar usuario, cambiar permisos, agregar comentario, refinanciar, y **eliminar
  importación** (añadido jun-2026). Cobertura completa de mutaciones sensibles.
- **Acceso por sala (IDOR)**: cada usuario solo ve datos de su sala (Tanda A).
- **No fuga de errores**: en producción no se exponen `err.message` de Postgres (Tanda E).

## Datos sensibles en el sistema

- **`personas.patologia` / `leads.patologia`** (dato de salud). Es el campo **central del
  embudo de ventas** (Sanavit vende productos de salud): lo capturan TMK y outsourcing, lo
  ven/editan confirmadores, sala, Premanifiesto, Venta360 y se exporta en reportes.
  → **NO se puede ocultar a los roles operativos sin romper la operación.**
- ~142.000 leads, muchos sin convertir, retenidos indefinidamente.

## Recomendaciones (cuando se decida abordarlo, con asesoría legal)

1. **Responsable de datos y base legal**: definir quién es el responsable del tratamiento y
   con qué base legal se trata la patología (consentimiento explícito vs. interés legítimo).
2. **Consentimiento**: añadir captura de consentimiento al crear lead/persona (checkbox +
   fecha + versión de política). Tabla `consentimientos (persona_id, tipo, otorgado, fecha,
   version_politica)`. No bloquea la operación si se diseña como registro, no como gate.
3. **Control de exportaciones**: las exportaciones a Excel que incluyen patología (reportes,
   Premanifiesto) son el punto de mayor exposición. Opciones: (a) auditar cada exportación
   (quién, cuándo, cuántas filas), (b) limitar la columna patología en exports a roles
   autorizados. Verificar caso por caso para no romper el uso operativo.
4. **Retención**: definir política (p.ej. anonimizar/eliminar leads no convertidos tras N
   meses sin actividad). Job programado + audit. Requiere decisión de negocio.
5. **Derechos ARCO**: procedimiento para acceso/rectificación/eliminación a pedido del titular
   (hoy el soft-delete/eliminación ya existe parcialmente; faltaría el flujo formal).

## Esfuerzo estimado

- Consentimiento + tabla + UI mínima: ~2-3 días.
- Auditoría de exportaciones: ~1 día.
- Política de retención + job: ~1-2 días + decisión de negocio.
- Total como proyecto aparte: ~1 semana, con aval legal previo.
