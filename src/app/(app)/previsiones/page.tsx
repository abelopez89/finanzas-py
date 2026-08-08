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
import LineChartSaldoProyectado from '@/components/LineChartSaldoProyectado';
import Money from '@/components/ui/Money';
import { PageHeader, Section, Aviso } from '@/components/ui/Layout';

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

  // Extras futuros pendientes, agrupados por período (gracias a que el
  // período de un extra se calcula en base a su fecha real, no a la fecha
  // en que se cargó).
  const extraGastoPorPeriodo = new Map<string, number>();
  for (const e of extrasGastoFuturos ?? []) {
    extraGastoPorPeriodo.set(e.periodo, (extraGastoPorPeriodo.get(e.periodo) ?? 0) + Number(e.monto));
  }
  const extraIngresoPorPeriodo = new Map<string, number>();
  for (const e of extrasIngresoFuturos ?? []) {
    extraIngresoPorPeriodo.set(e.periodo, (extraIngresoPorPeriodo.get(e.periodo) ?? 0) + Number(e.monto));
  }

  // Saldo al cierre del período vigente: lo ya confirmado, menos lo que
  // todavía está pendiente de rescatar/pagar, más lo que falta confirmar de ingresos.
  const saldoFinPeriodoActual = saldoActual - gastosPendientes + ingresosPendientes;

  const periodosFuturos = getPeriodosSiguientes(11);

  const filas: {
    periodo: Date;
    label: string;
    ingresos: number;
    gastos: number;
    saldo: number;
    tieneExtra: boolean;
  }[] = [
    {
      periodo: periodoActual,
      label: 'Actual',
      ingresos: ingresosPendientes,
      gastos: gastosPendientes,
      saldo: saldoFinPeriodoActual,
      tieneExtra: false,
    },
  ];

  let saldoAcumulado = saldoFinPeriodoActual;
  for (const p of periodosFuturos) {
    const key = toISODate(p);
    const extraGastos = extraGastoPorPeriodo.get(key) ?? 0;
    const extraIngresos = extraIngresoPorPeriodo.get(key) ?? 0;
    const ingresosPeriodo = totalIngresosTemplate + extraIngresos;
    const gastosPeriodo = totalGastosTemplate + extraGastos;

    saldoAcumulado = saldoAcumulado + ingresosPeriodo - gastosPeriodo;
    filas.push({
      periodo: p,
      label: formatPeriodoCorto(p),
      ingresos: ingresosPeriodo,
      gastos: gastosPeriodo,
      saldo: saldoAcumulado,
      tieneExtra: extraGastos > 0 || extraIngresos > 0,
    });
  }

  const chartData = filas.map((f) => ({ periodo: f.label, saldo: f.saldo }));
  const primerNegativo = filas.find((f) => f.saldo < 0);

  return (
    <div>
      <PageHeader
        titulo="Previsiones"
        descripcion="Proyección a 12 períodos, asumiendo que las plantillas activas se repiten. Incluye los extras cargados con fecha futura."
      />

      {primerNegativo && (
        <div className="mb-6">
          <Aviso tono="error">
            El saldo proyectado se vuelve negativo en{' '}
            <strong className="font-semibold">{formatPeriodoLabel(primerNegativo.periodo)}</strong>.
          </Aviso>
        </div>
      )}

      <Section titulo="Evolución del saldo">
        <div className="card p-3 sm:p-4">
          <LineChartSaldoProyectado data={chartData} />
        </div>
      </Section>

      <Section titulo="Detalle por período">
        {/* Móvil: fichas */}
        <ul className="space-y-2 md:hidden">
          {filas.map((f, idx) => (
            <li
              key={idx}
              className={`card p-4 ${f.saldo < 0 ? 'border-brick-100 bg-brick-50/40' : ''}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">
                    {idx === 0 ? 'Actual' : formatPeriodoCorto(f.periodo)}
                  </span>
                  {f.tieneExtra && (
                    <span className="rounded-full bg-ochre-50 px-2 py-0.5 text-[10px] font-medium text-ochre-700 ring-1 ring-inset ring-ochre-100">
                      extra
                    </span>
                  )}
                </div>
                <Money
                  value={f.saldo}
                  className={`font-semibold ${f.saldo < 0 ? 'text-brick-600' : 'text-ink'}`}
                />
              </div>
              <div className="mt-2.5 flex gap-4 border-t border-line pt-2.5 text-xs">
                <span className="text-ink-400">
                  Ingresos <Money value={f.ingresos} size="sm" className="text-pine-700" />
                </span>
                <span className="text-ink-400">
                  Gastos <Money value={f.gastos} size="sm" className="text-brick-600" />
                </span>
              </div>
            </li>
          ))}
        </ul>

        {/* Escritorio: tabla */}
        <div className="hidden overflow-hidden rounded-card border border-line bg-surface shadow-card md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas/60 text-left text-[11px] uppercase tracking-wider text-ink-500">
                <th className="px-4 py-2.5 font-semibold">Período</th>
                <th className="px-4 py-2.5 text-right font-semibold">Ingresos</th>
                <th className="px-4 py-2.5 text-right font-semibold">Gastos</th>
                <th className="px-4 py-2.5 text-right font-semibold">Saldo resultante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filas.map((f, idx) => (
                <tr key={idx} className={f.saldo < 0 ? 'bg-brick-50/50' : 'hover:bg-canvas/50'}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-ink">
                      {idx === 0 ? 'Actual' : formatPeriodoCorto(f.periodo)}
                    </span>
                    {f.tieneExtra && (
                      <span
                        title="Este período incluye un extra con fecha futura"
                        className="ml-2 rounded-full bg-ochre-50 px-2 py-0.5 text-[10px] font-medium text-ochre-700 ring-1 ring-inset ring-ochre-100"
                      >
                        extra
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Money value={f.ingresos} signo="ingreso" className="text-pine-700" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Money value={f.gastos} signo="egreso" className="text-brick-600" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Money
                      value={f.saldo}
                      className={`font-semibold ${f.saldo < 0 ? 'text-brick-600' : 'text-ink'}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <p className="text-xs text-ink-400">
        Para que un gasto puntual afecte una previsión futura, cargalo en Extras con su fecha — se
        suma solo al período que le toca.
      </p>
    </div>
  );
}
