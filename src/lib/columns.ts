/**
 * Listas de columnas para las consultas calientes.
 *
 * `select('*')` traía campos que la grilla nunca muestra (created_at,
 * updated_at, fecha_pago, category_id…). En un listado de 40 movimientos no
 * es dramático, pero es payload que se serializa, viaja y se vuelve a
 * deserializar en cada render del server component.
 *
 * Viven en su propio archivo porque un archivo con 'use server' solo puede
 * exportar funciones async.
 */
export const COLS_GASTO =
  'id, nombre, dia, monto, estado, periodo, es_extra, template_id, payment_method_id, payment_methods(nombre)';

export const COLS_INGRESO = 'id, nombre, dia, monto, estado, periodo, es_extra, template_id';
