import {
  diaFinDeSemana,
  fechaISODeEntry,
  formatFechaDMA,
  formatPeriodoLabel,
  type DiaFinDeSemana,
} from '@/lib/period';
import { plantillasVigentes } from '@/lib/vigencias';
import { contarCuotas, numeroDeCuota, tieneCuotas } from '@/lib/cuotas';
import { escapeHtml } from '@/lib/telegram';

/**
 * Gastos que vencen un sábado o domingo. Las plantillas tienen un día fijo
 * del mes, y según el mes ese día cae en fin de semana: esos días no se
 * pueden hacer los rescates del fondo, así que hay que mover la fecha a
 * mano en Mes actual / Extras. Por ahora es solo aviso: nada de acá cambia
 * fechas solo.
 */

export type GastoFinDeSemana = {
  nombre: string;
  fechaISO: string;
  dia: DiaFinDeSemana;
  monto: number;
  metodo: string | null;
  esExtra: boolean;
};

/**
 * Gastos PENDIENTES de un período que caen en fin de semana, para el aviso
 * del día 27 (primer día del ciclo).
 *
 * Ese día los gastos regulares del período nuevo todavía pueden no estar
 * generados (se generan al entrar a /mes-actual), así que se arman desde
 * las plantillas vigentes, con las mismas reglas que la generación:
 * vigencias, omisiones (lo borrado a mano en ese período no vuelve) y
 * préstamos en cuotas ya terminados. Si un gasto ya existe, manda el día
 * que tiene la entry (puede haberse corregido a mano). Los extras salen de
 * sus entries con fecha propia.
 *
 * Recibe el cliente de Supabase por parámetro: se usa desde el cron, sin
 * sesión (ver CLAUDE.md).
 */
export async function gastosEnFinDeSemana(
  supabase: any,
  accountId: string,
  periodoISO: string
): Promise<GastoFinDeSemana[]> {
  const [
    { data: plantillas },
    { data: vigencias },
    { data: entries },
    { data: omisiones },
    { data: metodos },
  ] = await Promise.all([
    supabase.from('expense_templates').select('*').eq('account_id', accountId),
    supabase.from('expense_template_vigencias').select('*').eq('account_id', accountId),
    supabase
      .from('expense_entries')
      .select('template_id, nombre, monto, dia, estado, es_extra, fecha_vencimiento, payment_methods(nombre)')
      .eq('account_id', accountId)
      .eq('periodo', periodoISO),
    supabase
      .from('entry_omisiones')
      .select('template_id')
      .eq('account_id', accountId)
      .eq('tipo', 'gasto')
      .eq('periodo', periodoISO),
    supabase.from('payment_methods').select('id, nombre').eq('account_id', accountId),
  ]);

  const nombreMetodo = new Map<string, string>(
    (metodos ?? []).map((m: any) => [m.id, m.nombre])
  );
  const conEntry = new Set((entries ?? []).map((e: any) => e.template_id).filter(Boolean));
  const omitidas = new Set((omisiones ?? []).map((o: any) => o.template_id));

  const resultado: GastoFinDeSemana[] = [];
  const agregar = (g: Omit<GastoFinDeSemana, 'dia'>) => {
    const dia = diaFinDeSemana(g.fechaISO);
    if (dia) resultado.push({ ...g, dia });
  };

  // Lo ya generado (regular o extra): solo lo pendiente requiere acción.
  for (const e of entries ?? []) {
    if (e.estado !== 'pendiente') continue;
    agregar({
      nombre: e.nombre,
      fechaISO:
        e.es_extra && e.fecha_vencimiento
          ? e.fecha_vencimiento
          : fechaISODeEntry(periodoISO, e.dia),
      monto: Number(e.monto),
      metodo: e.payment_methods?.nombre ?? null,
      esExtra: Boolean(e.es_extra),
    });
  }

  // Lo que la generación todavía va a crear para este período.
  const porGenerar = plantillasVigentes(plantillas ?? [], vigencias ?? [], periodoISO).filter(
    (t: any) => !conEntry.has(t.id) && !omitidas.has(t.id)
  );
  const conteoCuotas = await contarCuotas(supabase, accountId, porGenerar, periodoISO);
  for (const t of porGenerar as any[]) {
    if (tieneCuotas(t) && numeroDeCuota(t, conteoCuotas.get(t.id)) > Number(t.cuotas_total)) {
      continue;
    }
    agregar({
      nombre: t.nombre,
      fechaISO: fechaISODeEntry(periodoISO, t.dia_mes),
      monto: t.montoVigente,
      metodo: t.payment_method_id ? (nombreMetodo.get(t.payment_method_id) ?? null) : null,
      esExtra: false,
    });
  }

  return resultado.sort(
    (a, b) => a.fechaISO.localeCompare(b.fechaISO) || a.nombre.localeCompare(b.nombre, 'es')
  );
}

/**
 * Mensaje de Telegram con los gastos del período que caen en fin de semana.
 * `null` si no hay ninguno: no se manda nada (mismo criterio de silencio
 * que el aviso diario).
 */
export async function construirAvisoFinesDeSemana(
  supabase: any,
  accountId: string,
  periodoISO: string
): Promise<string | null> {
  const gastos = await gastosEnFinDeSemana(supabase, accountId, periodoISO);
  if (gastos.length === 0) return null;

  const fmtGs = (n: number) => `₲ ${new Intl.NumberFormat('es-PY').format(Math.round(n))}`;
  const periodo = formatPeriodoLabel(new Date(`${periodoISO}T00:00:00`));

  const lineas = gastos.map((g) => {
    const partes = [
      `• <b>${escapeHtml(g.nombre)}</b> — ${g.dia} ${formatFechaDMA(g.fechaISO)}`,
      fmtGs(g.monto),
    ];
    if (g.metodo) partes.push(escapeHtml(g.metodo));
    if (g.esExtra) partes.push('extra');
    return partes.join(' · ');
  });

  return (
    `📅 <b>Caen en fin de semana (${gastos.length})</b>\n` +
    `${escapeHtml(periodo)}\n` +
    `Esos días no se puede rescatar: conviene mover la fecha en Mes actual / Extras.\n\n` +
    lineas.join('\n')
  );
}
