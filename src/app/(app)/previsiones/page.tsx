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

export default async function PrevisionesPage() {
  const accountId = await getCurrentAccountId();
  const supabase = createSupabaseServerClient();

  if (!accountId) {
    return (
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
        No se encontró una cuenta vinculada a tu sesión. Probá cerrar sesión y volver a entrar.
      </p>
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
    <div className="space-y-8">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Previsiones a 12 meses</h1>
        <p className="text-sm text-gray-500">
          Proyección del saldo del fondo asumiendo que las plantillas activas se repiten cada período,
          más cualquier gasto o ingreso extra que hayas cargado con una fecha futura.
        </p>
      </div>

      <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
        💡 Para que un gasto o ingreso puntual afecte una previsión futura (por ejemplo, un viaje
        dentro de 4 meses), cargalo en <strong>Extras</strong> con la fecha correspondiente — se va a
        sumar automáticamente al período que le toca.
      </p>

      {primerNegativo && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          ⚠️ El saldo proyectado se vuelve negativo en{' '}
          <strong>{formatPeriodoLabel(primerNegativo.periodo)}</strong>.
        </p>
      )}

      <section>
        <h2 className="mb-3 text-lg font-medium">Evolución del saldo proyectado</h2>
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <LineChartSaldoProyectado data={chartData} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Detalle por período</h2>
        <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Período</th>
                <th className="px-4 py-2">Ingresos esperados</th>
                <th className="px-4 py-2">Gastos esperados</th>
                <th className="px-4 py-2">Saldo resultante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filas.map((f, idx) => (
                <tr key={idx} className={f.saldo < 0 ? 'bg-red-50' : ''}>
                  <td className="px-4 py-2">
                    {idx === 0 ? 'Actual' : formatPeriodoCorto(f.periodo)}
                    {f.tieneExtra && (
                      <span
                        title="Este período incluye un extra cargado con fecha futura"
                        className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700"
                      >
                        + extra
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-brand-700">
                    +₲ {f.ingresos.toLocaleString('es-PY')}
                  </td>
                  <td className="px-4 py-2 text-red-600">-₲ {f.gastos.toLocaleString('es-PY')}</td>
                  <td
                    className={`px-4 py-2 font-medium ${
                      f.saldo < 0 ? 'text-red-700' : 'text-gray-800'
                    }`}
                  >
                    ₲ {f.saldo.toLocaleString('es-PY')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
