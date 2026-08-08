import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { calcularSaldoFondo } from '@/lib/fund';
import {
  getInicioPeriodoActual,
  getPeriodosSiguientes,
  toISODate,
  formatPeriodoCorto,
  formatPeriodoLabel,
} from '@/lib/period';
import PrevisionesSimulador, { type FilaPrevision } from '@/components/PrevisionesSimulador';
import { PageHeader, Aviso } from '@/components/ui/Layout';

export default async function PrevisionesPage() {
  const accountId = await getCurrentAccountId();
  const supabase = createSupabaseServerClient();

  if (!accountId) {
    return (
      <Aviso tono="alerta">
        No encontramos una cuenta vinculada a esta sesión. Cerrá sesión y volvé a entrar.
      </Aviso>
    );
  }

  const periodoActual = getInicioPeriodoActual();
  const periodoActualISO = toISODate(periodoActual);

  const [
    { data: movimientos },
    { data: gastosPendientesActual },
    { data: ingresosPendientesActual },
    { data: gastoTemplates },
    { data: ingresoTemplates },
    { data: extrasGastoFuturos },
    { data: extrasIngresoFuturos },
  ] = await Promise.all([
    supabase.from('fund_movements').select('tipo, monto').eq('account_id', accountId),
    supabase
      .from('expense_entries')
      .select('monto')
      .eq('account_id', accountId)
      .eq('periodo', periodoActualISO)
      .eq('estado', 'pendiente'),
    supabase
      .from('income_entries')
      .select('monto')
      .eq('account_id', accountId)
      .eq('periodo', periodoActualISO)
      .eq('estado', 'pendiente'),
    supabase.from('expense_templates').select('monto').eq('account_id', accountId).eq('activo', true),
    supabase.from('income_templates').select('monto').eq('account_id', accountId).eq('activo', true),
    supabase
      .from('expense_entries')
      .select('monto, periodo')
      .eq('account_id', accountId)
      .eq('es_extra', true)
      .eq('estado', 'pendiente')
      .gt('periodo', periodoActualISO),
    supabase
      .from('income_entries')
      .select('monto, periodo')
      .eq('account_id', accountId)
      .eq('es_extra', true)
      .eq('estado', 'pendiente')
      .gt('periodo', periodoActualISO),
  ]);

  const saldoActual = calcularSaldoFondo(movimientos ?? []);
  const gastosPendientes = (gastosPendientesActual ?? []).reduce((a, g) => a + Number(g.monto), 0);
  const ingresosPendientes = (ingresosPendientesActual ?? []).reduce((a, i) => a + Number(i.monto), 0);
  const totalGastosTemplate = (gastoTemplates ?? []).reduce((a, t) => a + Number(t.monto), 0);
  const totalIngresosTemplate = (ingresoTemplates ?? []).reduce((a, t) => a + Number(t.monto), 0);

  const extraGastoPorPeriodo = new Map<string, number>();
  for (const e of extrasGastoFuturos ?? []) {
    extraGastoPorPeriodo.set(e.periodo, (extraGastoPorPeriodo.get(e.periodo) ?? 0) + Number(e.monto));
  }
  const extraIngresoPorPeriodo = new Map<string, number>();
  for (const e of extrasIngresoFuturos ?? []) {
    extraIngresoPorPeriodo.set(
      e.periodo,
      (extraIngresoPorPeriodo.get(e.periodo) ?? 0) + Number(e.monto)
    );
  }

  // Saldo al cierre del período vigente: lo confirmado, menos lo pendiente
  // de rescatar/pagar, más lo que falta confirmar de ingresos.
  const saldoFinPeriodoActual = saldoActual - gastosPendientes + ingresosPendientes;

  const filas: FilaPrevision[] = [
    {
      periodoISO: periodoActualISO,
      label: 'Actual',
      labelLargo: formatPeriodoLabel(periodoActual),
      ingresos: ingresosPendientes,
      gastos: gastosPendientes,
      tieneExtra: false,
    },
    ...getPeriodosSiguientes(11).map((p) => {
      const key = toISODate(p);
      const extraGastos = extraGastoPorPeriodo.get(key) ?? 0;
      const extraIngresos = extraIngresoPorPeriodo.get(key) ?? 0;
      return {
        periodoISO: key,
        label: formatPeriodoCorto(p),
        labelLargo: formatPeriodoLabel(p),
        ingresos: totalIngresosTemplate + extraIngresos,
        gastos: totalGastosTemplate + extraGastos,
        tieneExtra: extraGastos > 0 || extraIngresos > 0,
      };
    }),
  ];

  return (
    <div>
      <PageHeader
        titulo="Previsiones"
        descripcion="Proyección a 12 períodos, asumiendo que las plantillas activas se repiten. Incluye los extras cargados con fecha futura."
      />
      <PrevisionesSimulador filas={filas} saldoInicialProyeccion={saldoFinPeriodoActual} />
    </div>
  );
}
