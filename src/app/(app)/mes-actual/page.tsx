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
import FiltrosPanel from '@/components/ui/FiltrosPanel';
import { PageHeader, Section, Aviso } from '@/components/ui/Layout';

type Filtros = { estado?: string; dia_desde?: string; dia_hasta?: string };

function ordenarGastos(gastos: any[]) {
  return [...gastos].sort((a, b) => {
    const porDia = ordenDiaPeriodo(a.dia) - ordenDiaPeriodo(b.dia);
    if (porDia !== 0) return porDia;
    const mA = a.payment_methods?.nombre ?? '';
    const mB = b.payment_methods?.nombre ?? '';
    const porMetodo = mA.localeCompare(mB, 'es');
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

  // Al entrar por primera vez a un período nuevo, los movimientos de las
  // plantillas activas se crean solos.
  if (accountId) await generarMovimientosParaPeriodo(accountId, periodo);

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

  const [
    { data: gastosRaw },
    { data: ingresosRaw },
    { data: gastosAnterioresRaw },
    { data: ingresosAnterioresRaw },
  ] = accountId
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
  const hayAtrasados = gastosAnteriores.length > 0 || ingresosAnteriores.length > 0;

  return (
    <div>
      <PageHeader titulo="Mes actual" descripcion={formatPeriodoLabel(inicio)} />

      {hayAtrasados && (
        <div className="mb-8">
          <div className="mb-4">
            <Aviso tono="alerta">
              Quedaron movimientos sin resolver de períodos anteriores. Podés aplicarlos desde acá.
            </Aviso>
          </div>
          {gastosAnteriores.length > 0 && (
            <Section titulo="Gastos atrasados">
              <GastosEntriesTable
                gastos={gastosAnteriores}
                mostrarPeriodo
                updateExpenseEntry={updateExpenseEntry}
                cambiarEstadoGasto={cambiarEstadoGasto}
                deleteExpenseEntry={deleteExpenseEntry}
              />
            </Section>
          )}
          {ingresosAnteriores.length > 0 && (
            <Section titulo="Ingresos atrasados">
              <IngresosEntriesTable
                ingresos={ingresosAnteriores}
                mostrarPeriodo
                updateIncomeEntry={updateIncomeEntry}
                cambiarEstadoIngreso={cambiarEstadoIngreso}
                deleteIncomeEntry={deleteIncomeEntry}
              />
            </Section>
          )}
        </div>
      )}

      <FiltrosPanel hayFiltrosActivos={hayFiltros}>
        <form method="GET" className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:items-end">
          <div className="col-span-2 sm:col-span-1">
            <label className="label" htmlFor="estado">
              Estado
            </label>
            <select id="estado" name="estado" defaultValue={searchParams.estado ?? ''} className="field">
              <option value="">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="rescatado">Rescatado</option>
              <option value="pagado">Pagado</option>
              <option value="confirmado">Confirmado</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="dia_desde">
              Día desde
            </label>
            <input
              id="dia_desde"
              name="dia_desde"
              type="number"
              min={1}
              max={31}
              defaultValue={searchParams.dia_desde ?? ''}
              className="field"
            />
          </div>
          <div>
            <label className="label" htmlFor="dia_hasta">
              Día hasta
            </label>
            <input
              id="dia_hasta"
              name="dia_hasta"
              type="number"
              min={1}
              max={31}
              defaultValue={searchParams.dia_hasta ?? ''}
              className="field"
            />
          </div>
          <div className="col-span-2 flex gap-2 sm:col-span-1">
            <button className="btn-primary flex-1">Aplicar</button>
            {hayFiltros && (
              <a href="/mes-actual" className="btn-secondary">
                Limpiar
              </a>
            )}
          </div>
        </form>
      </FiltrosPanel>

      <Section titulo="Gastos">
        <GastosEntriesTable
          gastos={gastos}
          updateExpenseEntry={updateExpenseEntry}
          cambiarEstadoGasto={cambiarEstadoGasto}
          deleteExpenseEntry={deleteExpenseEntry}
        />
      </Section>

      <Section titulo="Ingresos">
        <IngresosEntriesTable
          ingresos={ingresos}
          updateIncomeEntry={updateIncomeEntry}
          cambiarEstadoIngreso={cambiarEstadoIngreso}
          deleteIncomeEntry={deleteIncomeEntry}
        />
      </Section>

      <form action={generarMovimientosDelMes} className="mt-2">
        <button className="btn-secondary w-full sm:w-auto">Regenerar desde plantillas</button>
        <p className="mt-2 text-xs text-ink-400">
          Los movimientos se generan solos al abrir un período nuevo. Usá esto si agregaste una
          plantilla después.
        </p>
      </form>
    </div>
  );
}
