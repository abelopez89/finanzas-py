import { fechaDeEntry, sumarPeriodos, toISODate } from '@/lib/period';

/**
 * Préstamos en cuotas dentro de las plantillas de gastos mensuales: una
 * plantilla con `cuotas_total` deja de generarse sola al llegar a la última
 * cuota, la previsión la proyecta solo por las cuotas que quedan, y cada
 * gasto generado guarda su número de cuota (`numero_cuota`).
 *
 * Dos conteos distintos, a propósito:
 * - Para NUMERAR y cortar la generación cuentan los gastos generados, en el
 *   estado que estén: un gasto atrasado sin pagar ya ocupa su número de
 *   cuota, y no por eso hay que generar una de más.
 * - Para "cuotas restantes" cuentan las pagadas: un gasto cuenta la primera
 *   vez que llega a rescatado o pagado, igual que la regla del fondo (es
 *   cuando la plata sale). Si se revierte a pendiente, vuelve a sumar.
 *
 * Un gasto borrado a mano (omisión) no cuenta en ninguno de los dos: esa
 * cuota no se pagó, así que el préstamo se corre un mes.
 */

export type PlantillaConCuotas = {
  id: string;
  cuotas_total?: number | null;
  cuotas_pagadas_inicial?: number | null;
};

export type ConteoCuotas = {
  /** Gastos generados en períodos anteriores al de referencia. */
  generadasAntes: number;
  /** Gastos de la plantilla en rescatado o pagado (cualquier período). */
  pagadas: number;
};

export type ResumenCuotas = {
  total: number;
  pagadas: number;
  restantes: number;
  /** Número de cuota que corresponde al período de referencia. */
  numeroEnPeriodo: number;
  /** Fecha de la última cuota (día de la plantilla en su período). */
  fechaFinISO: string | null;
  terminado: boolean;
};

export function tieneCuotas(t: PlantillaConCuotas): boolean {
  return t.cuotas_total !== null && t.cuotas_total !== undefined && Number(t.cuotas_total) > 0;
}

/**
 * Cuenta, por plantilla, los gastos generados antes de `periodoISO` y los ya
 * pagados. Recibe el cliente de Supabase por parámetro (ver CLAUDE.md:
 * funciones compartidas entre página y cron). Solo consulta las plantillas
 * que tienen cuotas, y no hace nada si no hay ninguna.
 */
export async function contarCuotas(
  supabase: any,
  accountId: string,
  plantillas: PlantillaConCuotas[],
  periodoISO: string
): Promise<Map<string, ConteoCuotas>> {
  const conteo = new Map<string, ConteoCuotas>();
  const ids = plantillas.filter(tieneCuotas).map((t) => t.id);
  if (ids.length === 0) return conteo;

  const { data } = await supabase
    .from('expense_entries')
    .select('template_id, periodo, estado')
    .eq('account_id', accountId)
    .in('template_id', ids);

  for (const id of ids) conteo.set(id, { generadasAntes: 0, pagadas: 0 });
  for (const e of data ?? []) {
    const c = conteo.get(e.template_id);
    if (!c) continue;
    if (e.periodo < periodoISO) c.generadasAntes += 1;
    if (e.estado === 'rescatado' || e.estado === 'pagado') c.pagadas += 1;
  }
  return conteo;
}

/** Número de cuota que le toca al período de referencia del conteo. */
export function numeroDeCuota(t: PlantillaConCuotas, c: ConteoCuotas | undefined): number {
  return Number(t.cuotas_pagadas_inicial ?? 0) + (c?.generadasAntes ?? 0) + 1;
}

export function resumirCuotas(
  t: PlantillaConCuotas & { dia_mes: number },
  c: ConteoCuotas | undefined,
  periodoISO: string
): ResumenCuotas | null {
  if (!tieneCuotas(t)) return null;
  const total = Number(t.cuotas_total);
  const pagadas = Number(t.cuotas_pagadas_inicial ?? 0) + (c?.pagadas ?? 0);
  const numeroEnPeriodo = numeroDeCuota(t, c);
  // La última cuota cae (total − número actual) períodos después del de
  // referencia, asumiendo una por mes sin saltos de vigencia.
  const faltanPeriodos = total - numeroEnPeriodo;
  const fechaFinISO =
    faltanPeriodos >= 0
      ? toISODate(fechaDeEntry(sumarPeriodos(periodoISO, faltanPeriodos), t.dia_mes))
      : null;
  return {
    total,
    pagadas,
    restantes: Math.max(0, total - pagadas),
    numeroEnPeriodo,
    fechaFinISO,
    terminado: pagadas >= total,
  };
}
