import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { getInicioPeriodoActual, formatPeriodoLabel, toISODate, ordenDiaPeriodo } from '@/lib/period';
import {
  generarMovimientosDelMes,
  generarMovimientosParaPeriodo,
  updateExpenseEntry,
  updateIncomeEntry,
  cambiarEstadoGasto,
  cambiarEstadoIngreso,
  deleteExpenseEntry,
  deleteIncomeEntry,
} from '@/lib/actions/entries';
import GastosEntriesTable from '@/components/GastosEntriesTable';
import IngresosEntriesTable from '@/components/IngresosEntriesTable';

type Filtros = {
  estado?: string;
  dia_desde?: string;
  dia_hasta?: string;
};

function ordenarGastos(gastos: any[]) {
  return [...gastos].sort((a, b) => {
    const porDia = ordenDiaPeriodo(a.dia) - ordenDiaPeriodo(b.dia);
    if (porDia !== 0) return porDia;
    const metodoA = a.payment_methods?.nombre ?? '';
    const metodoB = b.payment_methods?.nombre ?? '';
    const porMetodo = metodoA.localeCompare(metodoB, 'es');
    if (porMetodo !== 0) return porMetodo;
    return a.nombre.localeCompare(b.nombre, 'es');
  });
}

function ordenarIngresos(ingresos: any[]) {
  return [...ingresos].sort((a, b) => {
    const porDia = ordenDiaPeriodo(a.dia) - ordenDiaPeriodo(b.dia);
    if (porDia !== 0) return porDia;
    return a.nombre.localeCompare(b.nombre, 'es');
  });
}

export default async function MesActualPage({ searchParams }: { searchParams: Filtros }) {
  const accountId = await getCurrentAccountId();
  const supabase = createSupabaseServerClient();
  const inicio = getInicioPeriodoActual();
  const periodo = toISODate(inicio);

  // Auto-generación: si es la primera vez que se entra a un período nuevo,
  // los movimientos de las plantillas activas se crean solos.
  if (accountId) {
    await generarMovimientosParaPeriodo(accountId, periodo);
  }

  const diaDesde = searchParams.dia_desde ? Number(searchParams.dia_desde) : null;
  const diaHasta = searchParams.dia_hasta ? Number(searchParams.dia_hasta) : null;

  let gastosQuery = accountId
    ? supabase
        .from('expense_entries')
        .select('*, payment_methods(nombre)')
        .eq('account_id', accountId)
        .eq('periodo', periodo)
        .eq('es_extra', false)
    : null;
  let ingresosQuery = accountId
    ? supabase
        .from('income_entries')
        .select('*')
        .eq('account_id', accountId)
        .eq('periodo', periodo)
        .eq('es_extra', false)
    : null;

  if (gastosQuery && ingresosQuery) {
    if (searchParams.estado) {
      gastosQuery = gastosQuery.eq('estado', searchParams.estado);
      ingresosQuery = ingresosQuery.eq('estado', searchParams.estado);
    }
    if (diaDesde !== null) {
      gastosQuery = gastosQuery.gte('dia', diaDesde);
      ingresosQuery = ingresosQuery.gte('dia', diaDesde);
    }
    if (diaHasta !== null) {
      gastosQuery = gastosQuery.lte('dia', diaHasta);
      ingresosQuery = ingresosQuery.lte('dia', diaHasta);
    }
  }

  const [{ data: gastosRaw }, { data: ingresosRaw }, { data: gastosAnterioresRaw }, { data: ingresosAnterioresRaw }] =
    accountId
      ? await Promise.all([
          gastosQuery!,
          ingresosQuery!,
          supabase
            .from('expense_entries')
            .select('*, payment_methods(nombre)')
            .eq('account_id', accountId)
            .eq('es_extra', false)
            .neq('estado', 'pagado')
            .lt('periodo', periodo),
          supabase
            .from('income_entries')
            .select('*')
            .eq('account_id', accountId)
            .eq('es_extra', false)
            .neq('estado', 'confirmado')
            .lt('periodo', periodo),
        ])
      : [{ data: [] as any[] }, { data: [] as any[] }, { data: [] as any[] }, { data: [] as any[] }];

  const gastos = ordenarGastos(gastosRaw ?? []);
  const ingresos = ordenarIngresos(ingresosRaw ?? []);
  const gastosAnteriores = ordenarGastos(gastosAnterioresRaw ?? []);
  const ingresosAnteriores = ordenarIngresos(ingresosAnterioresRaw ?? []);

  const hayFiltros = Boolean(searchParams.estado || searchParams.dia_desde || searchParams.dia_hasta);
  const hayPendientesAnteriores = gastosAnteriores.length > 0 || ingresosAnteriores.length > 0;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Mes actual</h1>
        <p className="text-sm text-gray-500">
          Período vigente: <strong>{formatPeriodoLabel(inicio)}</strong>
        </p>
      </div>

      {hayPendientesAnteriores && (
        <section>
          <div className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
            ⚠️ Tenés movimientos sin resolver de períodos anteriores — se quedaron pendientes cuando
            arrancó el período vigente. Podés aplicarlos acá mismo, no hace falta volver atrás.
          </div>
          {gastosAnteriores.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-lg font-medium">Gastos pendientes de meses anteriores</h2>
              <GastosEntriesTable
                gastos={gastosAnteriores}
                mostrarPeriodo
                updateExpenseEntry={updateExpenseEntry}
                cambiarEstadoGasto={cambiarEstadoGasto}
                deleteExpenseEntry={deleteExpenseEntry}
              />
            </div>
          )}
          {ingresosAnteriores.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-medium">Ingresos pendientes de meses anteriores</h2>
              <IngresosEntriesTable
                ingresos={ingresosAnteriores}
                mostrarPeriodo
                updateIncomeEntry={updateIncomeEntry}
                cambiarEstadoIngreso={cambiarEstadoIngreso}
                deleteIncomeEntry={deleteIncomeEntry}
              />
            </div>
          )}
        </section>
      )}

      <form action={generarMovimientosDelMes}>
        <button className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
          Generar movimientos del mes desde las plantillas
        </button>
        <p className="mt-1 text-xs text-gray-400">
          Los movimientos ya se generan solos al entrar por primera vez a un período nuevo. Usá este
          botón si agregaste una plantilla nueva después.
        </p>
      </form>

      {/* ------------------------- Filtros (estado / día) ------------------------- */}
      <form method="GET" className="flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Estado</label>
          <select
            name="estado"
            defaultValue={searchParams.estado ?? ''}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="rescatado">Rescatado</option>
            <option value="pagado">Pagado</option>
            <option value="confirmado">Confirmado</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Día desde</label>
          <input
            name="dia_desde"
            type="number"
            min={1}
            max={31}
            defaultValue={searchParams.dia_desde ?? ''}
            className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Día hasta</label>
          <input
            name="dia_hasta"
            type="number"
            min={1}
            max={31}
            defaultValue={searchParams.dia_hasta ?? ''}
            className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <button className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
          Filtrar
        </button>
        {hayFiltros && (
          <a href="/mes-actual" className="text-sm text-gray-400 hover:underline">
            Limpiar filtros
          </a>
        )}
        <p className="ml-auto text-xs text-gray-400">
          El buscador por nombre está en cada tabla de abajo — filtra al instante.
        </p>
      </form>

      {/* ------------------------- Gastos del período ------------------------- */}
      <section>
        <h2 className="mb-3 text-lg font-medium">Gastos</h2>
        <GastosEntriesTable
          gastos={gastos}
          updateExpenseEntry={updateExpenseEntry}
          cambiarEstadoGasto={cambiarEstadoGasto}
          deleteExpenseEntry={deleteExpenseEntry}
        />
      </section>

      {/* ------------------------- Ingresos del período ------------------------- */}
      <section>
        <h2 className="mb-3 text-lg font-medium">Ingresos</h2>
        <IngresosEntriesTable
          ingresos={ingresos}
          updateIncomeEntry={updateIncomeEntry}
          cambiarEstadoIngreso={cambiarEstadoIngreso}
          deleteIncomeEntry={deleteIncomeEntry}
        />
      </section>
    </div>
  );
}
