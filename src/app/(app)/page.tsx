import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { calcularSaldoFondo } from '@/lib/fund';
import {
  getInicioPeriodoActual,
  getPeriodosAnteriores,
  toISODate,
  formatPeriodoCorto,
  formatPeriodoLabel,
  ordenDiaPeriodo,
  fechaDeEntry,
} from '@/lib/period';
import BarChartIngresosEgresos from '@/components/BarChartIngresosEgresos';
import PieChartCategorias from '@/components/PieChartCategorias';
import Money from '@/components/ui/Money';
import StatusPill, { ESTADO_BARRA } from '@/components/ui/StatusPill';
import { Section, EmptyState, Aviso } from '@/components/ui/Layout';
import Link from 'next/link';

function periodoKeyFor(fechaStr: string): string {
  return toISODate(getInicioPeriodoActual(new Date(`${fechaStr}T00:00:00Z`)));
}

export default async function DashboardPage() {
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
  const hoyISO = toISODate(new Date());

  const [
    { data: movimientos },
    { data: pendientes },
    { data: gastosPeriodoConCategoria },
    { data: pagadosDelMes },
    { data: pendientesTodos },
  ] = await Promise.all([
    supabase.from('fund_movements').select('*').eq('account_id', accountId).order('fecha'),
    supabase
      .from('expense_entries')
      .select('*')
      .eq('account_id', accountId)
      .eq('periodo', periodoActualISO)
      .neq('estado', 'pagado'),
    supabase
      .from('expense_entries')
      .select('monto, category_id, categories(nombre)')
      .eq('account_id', accountId)
      .eq('periodo', periodoActualISO),
    supabase
      .from('expense_entries')
      .select('monto')
      .eq('account_id', accountId)
      .eq('periodo', periodoActualISO)
      .eq('estado', 'pagado'),
    // Sin filtro de período: acá es donde se detectan los atrasados de
    // meses anteriores, no solo lo del período vigente.
    supabase
      .from('expense_entries')
      .select('*, payment_methods(nombre)')
      .eq('account_id', accountId)
      .eq('estado', 'pendiente'),
  ]);

  const saldoActual = calcularSaldoFondo(movimientos ?? []);

  const pendientesOrdenados = [...(pendientes ?? [])].sort(
    (a, b) => ordenDiaPeriodo(a.dia) - ordenDiaPeriodo(b.dia)
  );
  const totalPendiente = pendientesOrdenados.reduce((a, g) => a + Number(g.monto), 0);
  const totalPagado = (pagadosDelMes ?? []).reduce((a, g) => a + Number(g.monto), 0);

  // Fecha real de cada pendiente: los extras la tienen explícita, los
  // regulares se derivan del período (ciclo 27-26) y el día.
  const pendientesConFecha = (pendientesTodos ?? []).map((g: any) => ({
    ...g,
    fechaISO:
      g.es_extra && g.fecha_vencimiento
        ? g.fecha_vencimiento
        : toISODate(fechaDeEntry(g.periodo, g.dia)),
  }));

  const vencenHoy = pendientesConFecha
    .filter((g) => g.fechaISO === hoyISO)
    .sort((a, b) => (a.payment_methods?.nombre ?? '').localeCompare(b.payment_methods?.nombre ?? '', 'es'));
  const atrasados = pendientesConFecha.filter((g) => g.fechaISO < hoyISO);
  const totalARescatarHoy = [...vencenHoy, ...atrasados].reduce((a, g) => a + Number(g.monto), 0);

  // "Próximos" excluye lo que ya está en el resumen de rescate de hoy.
  const proximosOrdenados = pendientesOrdenados.filter(
    (g) => g.estado !== 'pendiente' || !vencenHoy.some((v) => v.id === g.id)
  );

  // Ingresos vs egresos por período de facturación (no mes calendario)
  const buckets = new Map<string, { ingresos: number; egresos: number }>();
  for (const m of movimientos ?? []) {
    const key = periodoKeyFor(m.fecha);
    const b = buckets.get(key) ?? { ingresos: 0, egresos: 0 };
    if (m.tipo === 'egreso') b.egresos += Number(m.monto);
    else b.ingresos += Number(m.monto);
    buckets.set(key, b);
  }
  const chartData = getPeriodosAnteriores(6).map((p) => {
    const b = buckets.get(toISODate(p)) ?? { ingresos: 0, egresos: 0 };
    return { periodo: formatPeriodoCorto(p), ingresos: b.ingresos, egresos: b.egresos };
  });

  // Gastos del período por categoría
  const categoriaBuckets = new Map<string, number>();
  for (const g of gastosPeriodoConCategoria ?? []) {
    const nombre = (g as any).categories?.nombre ?? 'Sin categoría';
    categoriaBuckets.set(nombre, (categoriaBuckets.get(nombre) ?? 0) + Number(g.monto));
  }
  const categoriaChartData = Array.from(categoriaBuckets.entries())
    .map(([categoria, monto]) => ({ categoria, monto }))
    .sort((a, b) => b.monto - a.monto);

  return (
    <div>
      {/* ---------- Saldo del fondo: la cifra que se viene a ver ---------- */}
      <section className="mb-6 overflow-hidden rounded-card bg-ink px-5 py-6 text-white sm:px-7 sm:py-8">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-300">Saldo del fondo</p>
        <p className="mt-2 font-mono text-[34px] font-semibold leading-none tracking-tight sm:text-[44px]">
          <span className="mr-2 text-[0.5em] font-normal text-ink-300">₲</span>
          {new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 }).format(
            Math.round(saldoActual)
          )}
        </p>
        <p className="mt-3 text-[13px] text-ink-300">{formatPeriodoLabel(periodoActual)}</p>
      </section>

      {/* ---------- Rescate de hoy: lo primero que hay que resolver ---------- */}
      {(vencenHoy.length > 0 || atrasados.length > 0) && (
        <section className="mb-8 overflow-hidden rounded-card border border-ochre-100 bg-ochre-50/40">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ochre-100 px-5 py-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-ochre-700">
                Para rescatar antes del mediodía
              </p>
              <Money value={totalARescatarHoy} size="lg" className="mt-1 block font-semibold text-ochre-700" />
            </div>
            <div className="text-right text-xs text-ink-500">
              {vencenHoy.length > 0 && (
                <p>
                  {vencenHoy.length} vence{vencenHoy.length === 1 ? '' : 'n'} hoy
                </p>
              )}
              {atrasados.length > 0 && (
                <p className="font-medium text-brick-600">
                  {atrasados.length} atrasado{atrasados.length === 1 ? '' : 's'}
                </p>
              )}
            </div>
          </div>

          {vencenHoy.length > 0 && (
            <ul className="divide-y divide-ochre-100">
              {vencenHoy.map((g) => (
                <li key={g.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {g.nombre}
                      {g.es_extra && <span className="ml-1.5 text-xs text-ink-400">extra</span>}
                    </p>
                    {g.payment_methods?.nombre && (
                      <p className="text-xs text-ink-400">{g.payment_methods.nombre}</p>
                    )}
                  </div>
                  <Money value={g.monto} className="shrink-0 font-medium text-ink" />
                </li>
              ))}
            </ul>
          )}

          {atrasados.length > 0 && (
            <div className="border-t border-ochre-100 px-5 py-3">
              <Link href="/mes-actual" className="text-sm font-medium text-brick-600 hover:underline">
                Ver {atrasados.length} atrasado{atrasados.length === 1 ? '' : 's'} de meses anteriores →
              </Link>
            </div>
          )}
        </section>
      )}

      {/* ---------- Dos cifras de contexto ---------- */}
      <div className="mb-8 grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-[11px] uppercase tracking-wide text-ink-400">Pendiente del mes</p>
          <Money value={totalPendiente} size="lg" className="mt-1.5 block font-semibold text-ink" />
          <p className="mt-1 text-xs text-ink-400">
            {pendientesOrdenados.length} sin pagar
          </p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] uppercase tracking-wide text-ink-400">Pagado del mes</p>
          <Money value={totalPagado} size="lg" className="mt-1.5 block font-semibold text-pine-700" />
          <p className="mt-1 text-xs text-ink-400">
            {(pagadosDelMes ?? []).length} {(pagadosDelMes ?? []).length === 1 ? 'gasto' : 'gastos'}
          </p>
        </div>
      </div>

      {/* ---------- Próximos vencimientos (sin lo que ya está en "rescate de hoy") ---------- */}
      <Section titulo="Próximos vencimientos">
        <ul className="card divide-y divide-line overflow-hidden">
          {proximosOrdenados.slice(0, 6).map((g) => (
            <li key={g.id} className="flex items-center gap-3 px-4 py-3">
              <span
                className={`h-8 w-1 shrink-0 rounded-full ${ESTADO_BARRA[g.estado] ?? ESTADO_BARRA.pendiente}`}
              />
              <span className="w-8 shrink-0 text-center font-mono text-sm font-semibold text-ink-500">
                {g.dia}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {g.nombre}
                  {g.es_extra && <span className="ml-1.5 text-xs text-ink-400">extra</span>}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <Money value={g.monto} className="font-medium text-ink" />
                <div className="mt-0.5">
                  <StatusPill estado={g.estado} />
                </div>
              </div>
            </li>
          ))}
          {proximosOrdenados.length === 0 && (
            <EmptyState mensaje="No queda nada pendiente en este período." />
          )}
        </ul>
      </Section>

      {/* ---------- Gráficos ---------- */}
      <Section titulo="Ingresos y egresos · últimos 6 períodos">
        <div className="card p-3 sm:p-4">
          <BarChartIngresosEgresos data={chartData} />
        </div>
      </Section>

      <Section titulo="Gastos del período por categoría">
        <div className="card p-3 sm:p-4">
          {categoriaChartData.length > 0 ? (
            <PieChartCategorias data={categoriaChartData} />
          ) : (
            <EmptyState mensaje="Todavía no hay gastos categorizados en este período." />
          )}
        </div>
      </Section>
    </div>
  );
}
