import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import {
  getInicioPeriodoActual,
  formatPeriodoLabel,
  toISODate,
  ordenDiaPeriodo,
  estaVencido,
} from '@/lib/period';
import {
  generarMovimientosDelMes,
  generarMovimientosParaPeriodo,
  updateExpenseEntry,
  updateIncomeEntry,
  cambiarEstadoGasto,
  cambiarEstadoIngreso,
  deleteExpenseEntry,
  deleteIncomeEntry,
  cambiarDiaMasivo,
  restaurarEliminadosDelMes,
} from '@/lib/actions/entries';
import { COLS_GASTO, COLS_INGRESO } from '@/lib/columns';
import GastosEntriesTable from '@/components/GastosEntriesTable';
import IngresosEntriesTable from '@/components/IngresosEntriesTable';
import FiltrosPanel from '@/components/ui/FiltrosPanel';
import CambioDiaMasivo from '@/components/CambioDiaMasivo';
import { PageHeader, Section, Aviso } from '@/components/ui/Layout';

type Filtros = {
  estado?: string;
  metodo?: string;
  dia_desde?: string;
  dia_hasta?: string;
};

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

  if (accountId) await generarMovimientosParaPeriodo(accountId, periodo);

  const diaDesde = searchParams.dia_desde ? Number(searchParams.dia_desde) : null;
  const diaHasta = searchParams.dia_hasta ? Number(searchParams.dia_hasta) : null;
  const estado = searchParams.estado ?? '';

  let gastosQuery = accountId
    ? supabase
        .from('expense_entries')
        .select(COLS_GASTO)
        .eq('account_id', accountId)
        .eq('periodo', periodo)
        .eq('es_extra', false)
    : null;
  let ingresosQuery = accountId
    ? supabase
        .from('income_entries')
        .select(COLS_INGRESO)
        .eq('account_id', accountId)
        .eq('periodo', periodo)
        .eq('es_extra', false)
    : null;

  if (gastosQuery && ingresosQuery) {
    // Por defecto solo se muestra lo que queda por resolver. Lo ya pagado
    // o confirmado se trae solo si se pide explícitamente.
    if (estado === '') {
      gastosQuery = gastosQuery.in('estado', ['pendiente', 'rescatado']);
      ingresosQuery = ingresosQuery.eq('estado', 'pendiente');
    } else if (estado !== 'todos') {
      gastosQuery = gastosQuery.eq('estado', estado);
      ingresosQuery = ingresosQuery.eq('estado', estado);
    }

    // El método de pago solo aplica a gastos; los ingresos no lo tienen.
    if (searchParams.metodo) {
      gastosQuery = gastosQuery.eq('payment_method_id', searchParams.metodo);
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
    { data: metodos },
    { data: gastosDelPeriodoSinFiltrar },
    { data: omisionesDelPeriodo },
  ] = accountId
    ? await Promise.all([
        gastosQuery!,
        ingresosQuery!,
        supabase
          .from('expense_entries')
          .select(COLS_GASTO)
          .eq('account_id', accountId)
          .eq('es_extra', false)
          .neq('estado', 'pagado')
          .lt('periodo', periodo),
        supabase
          .from('income_entries')
          .select(COLS_INGRESO)
          .eq('account_id', accountId)
          .eq('es_extra', false)
          .neq('estado', 'confirmado')
          .lt('periodo', periodo),
        supabase.from('payment_methods').select('*').eq('account_id', accountId).eq('activo', true),
        // Sin filtros: el panel de cambio masivo necesita ver todo el período
        supabase
          .from('expense_entries')
          .select('dia, payment_method_id, estado')
          .eq('account_id', accountId)
          .eq('periodo', periodo)
          .eq('es_extra', false),
        // Movimientos regulares que se borraron a mano en este período:
        // se listan para poder deshacer el borrado si fue sin querer.
        supabase
          .from('entry_omisiones')
          .select('id')
          .eq('account_id', accountId)
          .eq('periodo', periodo),
      ])
    : [
        { data: [] as any[] },
        { data: [] as any[] },
        { data: [] as any[] },
        { data: [] as any[] },
        { data: [] as any[] },
        { data: [] as any[] },
        { data: [] as any[] },
      ];

  const gastos = ordenarGastos(gastosRaw ?? []);
  const ingresos = ordenarIngresos(ingresosRaw ?? []);
  const gastosAnteriores = ordenarGastos(gastosAnterioresRaw ?? []);
  const ingresosAnteriores = ordenarIngresos(ingresosAnterioresRaw ?? []);

  const hayFiltros = Boolean(
    searchParams.estado || searchParams.metodo || searchParams.dia_desde || searchParams.dia_hasta
  );
  const hayAtrasados = gastosAnteriores.length > 0 || ingresosAnteriores.length > 0;
  const eliminadosDelPeriodo = (omisionesDelPeriodo ?? []).length;

  const vencidosDelPeriodo = gastos.filter(
    (g) => g.estado !== 'pagado' && estaVencido(g.periodo, g.dia)
  );

  return (
    <div>
      <PageHeader titulo="Mes actual" descripcion={formatPeriodoLabel(inicio)} />

      {vencidosDelPeriodo.length > 0 && (
        <div className="mb-6">
          <Aviso tono="error">
            {vencidosDelPeriodo.length === 1
              ? 'Hay 1 gasto vencido sin pagar en este período.'
              : `Hay ${vencidosDelPeriodo.length} gastos vencidos sin pagar en este período.`}{' '}
            Están marcados en rojo más abajo.
          </Aviso>
        </div>
      )}

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
        <form method="GET" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="label" htmlFor="estado">
              Estado
            </label>
            <select id="estado" name="estado" defaultValue={estado} className="field">
              <option value="">Pendientes y rescatados</option>
              <option value="todos">Todos</option>
              <option value="pendiente">Solo pendientes</option>
              <option value="rescatado">Solo rescatados</option>
              <option value="pagado">Solo pagados</option>
              <option value="confirmado">Solo confirmados</option>
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="label" htmlFor="metodo">
              Método de pago
            </label>
            <select id="metodo" name="metodo" defaultValue={searchParams.metodo ?? ''} className="field">
              <option value="">Todos</option>
              {(metodos ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-1">
            <div className="grid grid-cols-2 gap-2">
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
            </div>
          </div>
          <div className="col-span-2 flex gap-2 sm:col-span-3">
            <button className="btn-primary flex-1 sm:flex-none">Aplicar</button>
            {hayFiltros && (
              <a href="/mes-actual" className="btn-secondary">
                Limpiar
              </a>
            )}
          </div>
          <p className="col-span-2 text-xs text-ink-400 sm:col-span-3">
            El método de pago solo filtra gastos — los ingresos no lo tienen.
          </p>
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

      <div className="mt-2 space-y-4">
        <CambioDiaMasivo
          metodos={metodos ?? []}
          gastos={gastosDelPeriodoSinFiltrar ?? []}
          cambiarDiaMasivo={cambiarDiaMasivo}
        />

        <form action={generarMovimientosDelMes}>
          <button className="btn-secondary w-full sm:w-auto">Regenerar desde plantillas</button>
          <p className="mt-2 text-xs text-ink-400">
            Los movimientos se generan solos al abrir un período nuevo. Usá esto si agregaste una
            plantilla después. Lo que borraste a mano no vuelve.
          </p>
        </form>

        {eliminadosDelPeriodo > 0 && (
          <form action={restaurarEliminadosDelMes}>
            <button className="btn-secondary w-full sm:w-auto">
              Restaurar {eliminadosDelPeriodo === 1 ? 'el movimiento eliminado' : `los ${eliminadosDelPeriodo} movimientos eliminados`}
            </button>
            <p className="mt-2 text-xs text-ink-400">
              En este período borraste {eliminadosDelPeriodo === 1 ? '1 movimiento generado' : `${eliminadosDelPeriodo} movimientos generados`} desde plantilla. Con esto vuelven a
              aparecer.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
