import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { calcularSaldoFondo } from '@/lib/fund';
import {
  getInicioPeriodoActual,
  getPeriodosAnteriores,
  toISODate,
  formatPeriodoCorto,
  formatPeriodoLabel,
} from '@/lib/period';
import BarChartIngresosEgresos from '@/components/BarChartIngresosEgresos';

function periodoKeyFor(fechaStr: string): string {
  return toISODate(getInicioPeriodoActual(new Date(`${fechaStr}T00:00:00Z`)));
}

const ESTADO_STYLES: Record<string, string> = {
  pendiente: 'bg-gray-100 text-gray-600',
  rescatado: 'bg-amber-100 text-amber-700',
};

export default async function DashboardPage() {
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

  const [{ data: movimientos }, { data: pendientes }] = await Promise.all([
    supabase.from('fund_movements').select('*').eq('account_id', accountId).order('fecha'),
    supabase
      .from('expense_entries')
      .select('*')
      .eq('account_id', accountId)
      .eq('periodo', periodoActualISO)
      .neq('estado', 'pagado')
      .order('dia'),
  ]);

  const saldoActual = calcularSaldoFondo(movimientos ?? []);

  // Agrupar movimientos por período de facturación (no mes calendario)
  const buckets = new Map<string, { ingresos: number; egresos: number }>();
  for (const m of movimientos ?? []) {
    const key = periodoKeyFor(m.fecha);
    const b = buckets.get(key) ?? { ingresos: 0, egresos: 0 };
    if (m.tipo === 'egreso') b.egresos += Number(m.monto);
    else b.ingresos += Number(m.monto);
    buckets.set(key, b);
  }

  const ultimosPeriodos = getPeriodosAnteriores(6, new Date());
  const chartData = ultimosPeriodos.map((p) => {
    const key = toISODate(p);
    const b = buckets.get(key) ?? { ingresos: 0, egresos: 0 };
    return { periodo: formatPeriodoCorto(p), ingresos: b.ingresos, egresos: b.egresos };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-gray-500">
          Período vigente: <strong>{formatPeriodoLabel(periodoActual)}</strong>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-gray-200 bg-white p-6">
          <p className="text-xs uppercase text-gray-400">Saldo actual del fondo</p>
          <p className="mt-1 text-3xl font-semibold text-brand-700">
            ₲ {saldoActual.toLocaleString('es-PY')}
          </p>
        </div>
        <div className="rounded-md border border-gray-200 bg-white p-6">
          <p className="text-xs uppercase text-gray-400">Gastos pendientes este período</p>
          <p className="mt-1 text-3xl font-semibold text-gray-800">
            ₲{' '}
            {(pendientes ?? [])
              .reduce((acc, g) => acc + Number(g.monto), 0)
              .toLocaleString('es-PY')}
          </p>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-medium">Ingresos vs. egresos — últimos 6 períodos</h2>
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <BarChartIngresosEgresos data={chartData} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Próximos vencimientos</h2>
        <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Día</th>
                <th className="px-4 py-2">Monto</th>
                <th className="px-4 py-2">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(pendientes ?? []).slice(0, 8).map((g) => (
                <tr key={g.id}>
                  <td className="px-4 py-2">
                    {g.nombre} {g.es_extra && <span className="text-xs text-gray-400">(extra)</span>}
                  </td>
                  <td className="px-4 py-2">{g.dia}</td>
                  <td className="px-4 py-2">₲ {Number(g.monto).toLocaleString('es-PY')}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${ESTADO_STYLES[g.estado]}`}
                    >
                      {g.estado}
                    </span>
                  </td>
                </tr>
              ))}
              {(pendientes ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm text-gray-400">
                    No hay gastos pendientes en el período vigente. 🎉
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
