import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { getInicioPeriodoActual, formatPeriodoLabel, toISODate } from '@/lib/period';
import {
  generarMovimientosDelMes,
  generarMovimientosParaPeriodo,
  updateExpenseEntry,
  updateIncomeEntry,
  cambiarEstadoGasto,
  cambiarEstadoIngreso,
} from '@/lib/actions/entries';
import MontoInput from '@/components/MontoInput';

const ESTADO_STYLES: Record<string, string> = {
  pendiente: 'bg-gray-100 text-gray-600',
  rescatado: 'bg-amber-100 text-amber-700',
  pagado: 'bg-brand-100 text-brand-700',
  confirmado: 'bg-brand-100 text-brand-700',
};

type Filtros = {
  q?: string;
  estado?: string;
  dia_desde?: string;
  dia_hasta?: string;
};

export default async function MesActualPage({ searchParams }: { searchParams: Filtros }) {
  const accountId = await getCurrentAccountId();
  const supabase = createSupabaseServerClient();
  const inicio = getInicioPeriodoActual();
  const periodo = toISODate(inicio);

  // Auto-generación: si es la primera vez que se entra a un período nuevo,
  // los movimientos de las plantillas activas se crean solos. El botón de
  // abajo sigue disponible por si aparecen plantillas nuevas más tarde.
  if (accountId) {
    await generarMovimientosParaPeriodo(accountId, periodo);
  }

  const diaDesde = searchParams.dia_desde ? Number(searchParams.dia_desde) : null;
  const diaHasta = searchParams.dia_hasta ? Number(searchParams.dia_hasta) : null;

  let gastosQuery = accountId
    ? supabase
        .from('expense_entries')
        .select('*')
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
    if (searchParams.q) {
      gastosQuery = gastosQuery.ilike('nombre', `%${searchParams.q}%`);
      ingresosQuery = ingresosQuery.ilike('nombre', `%${searchParams.q}%`);
    }
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

  const [{ data: gastos }, { data: ingresos }] =
    gastosQuery && ingresosQuery
      ? await Promise.all([gastosQuery.order('dia'), ingresosQuery.order('dia')])
      : [{ data: [] as any[] }, { data: [] as any[] }];

  const totalGastos = (gastos ?? []).reduce((a, g) => a + Number(g.monto), 0);
  const totalIngresos = (ingresos ?? []).reduce((a, i) => a + Number(i.monto), 0);

  const hayFiltros = Boolean(
    searchParams.q || searchParams.estado || searchParams.dia_desde || searchParams.dia_hasta
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Mes actual</h1>
        <p className="text-sm text-gray-500">
          Período vigente: <strong>{formatPeriodoLabel(inicio)}</strong>
        </p>
      </div>

      <form action={generarMovimientosDelMes}>
        <button className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
          Generar movimientos del mes desde las plantillas
        </button>
        <p className="mt-1 text-xs text-gray-400">
          Los movimientos ya se generan solos al entrar por primera vez a un período nuevo. Usá este
          botón si agregaste una plantilla nueva después.
        </p>
      </form>

      {/* ------------------------- Filtros ------------------------- */}
      <form method="GET" className="flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Nombre</label>
          <input
            name="q"
            defaultValue={searchParams.q ?? ''}
            placeholder="Buscar..."
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
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
      </form>

      {/* ------------------------- Gastos del período ------------------------- */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-medium">Gastos</h2>
          <p className="text-sm text-gray-500">
            Total filtrado: <strong className="text-gray-800">₲ {totalGastos.toLocaleString('es-PY')}</strong>
          </p>
        </div>
        <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Día / Monto</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(gastos ?? []).map((g) => (
                <tr key={g.id}>
                  <td className="px-4 py-2 align-top">{g.nombre}</td>
                  <td className="px-4 py-2 align-top">
                    {g.estado !== 'pendiente' ? (
                      <span className="text-gray-500">
                        Día {g.dia} — ₲ {Number(g.monto).toLocaleString('es-PY')}
                      </span>
                    ) : (
                      <form action={updateExpenseEntry} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={g.id} />
                        <input type="hidden" name="_path" value="/mes-actual" />
                        <input
                          name="dia"
                          type="number"
                          min={1}
                          max={31}
                          defaultValue={g.dia}
                          className="w-16 rounded-md border border-gray-300 px-2 py-1"
                        />
                        <MontoInput
                          name="monto"
                          defaultValue={g.monto}
                          className="w-32 rounded-md border border-gray-300 px-2 py-1"
                        />
                        <button className="text-xs text-brand-600 hover:underline">Guardar</button>
                      </form>
                    )}
                  </td>
                  <td className="px-4 py-2 align-top">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${ESTADO_STYLES[g.estado]}`}
                    >
                      {g.estado}
                    </span>
                  </td>
                  <td className="px-4 py-2 align-top text-right">
                    <div className="flex justify-end gap-2">
                      {g.estado === 'pendiente' && (
                        <form action={cambiarEstadoGasto}>
                          <input type="hidden" name="id" value={g.id} />
                          <input type="hidden" name="_path" value="/mes-actual" />
                          <input type="hidden" name="nuevo_estado" value="rescatado" />
                          <button className="text-xs text-amber-600 hover:underline">Rescatado</button>
                        </form>
                      )}
                      {g.estado !== 'pagado' && (
                        <form action={cambiarEstadoGasto}>
                          <input type="hidden" name="id" value={g.id} />
                          <input type="hidden" name="_path" value="/mes-actual" />
                          <input type="hidden" name="nuevo_estado" value="pagado" />
                          <button className="text-xs text-brand-600 hover:underline">Pagado</button>
                        </form>
                      )}
                      {g.estado !== 'pendiente' && (
                        <form action={cambiarEstadoGasto}>
                          <input type="hidden" name="id" value={g.id} />
                          <input type="hidden" name="_path" value="/mes-actual" />
                          <input type="hidden" name="nuevo_estado" value="pendiente" />
                          <button className="text-xs text-gray-400 hover:underline">Revertir</button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(gastos ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm text-gray-400">
                    No hay gastos que coincidan con los filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ------------------------- Ingresos del período ------------------------- */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-medium">Ingresos</h2>
          <p className="text-sm text-gray-500">
            Total filtrado:{' '}
            <strong className="text-gray-800">₲ {totalIngresos.toLocaleString('es-PY')}</strong>
          </p>
        </div>
        <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Día / Monto</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(ingresos ?? []).map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-2 align-top">{i.nombre}</td>
                  <td className="px-4 py-2 align-top">
                    {i.estado === 'confirmado' ? (
                      <span className="text-gray-500">
                        Día {i.dia} — ₲ {Number(i.monto).toLocaleString('es-PY')}
                      </span>
                    ) : (
                      <form action={updateIncomeEntry} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={i.id} />
                        <input type="hidden" name="_path" value="/mes-actual" />
                        <input
                          name="dia"
                          type="number"
                          min={1}
                          max={31}
                          defaultValue={i.dia}
                          className="w-16 rounded-md border border-gray-300 px-2 py-1"
                        />
                        <MontoInput
                          name="monto"
                          defaultValue={i.monto}
                          className="w-32 rounded-md border border-gray-300 px-2 py-1"
                        />
                        <button className="text-xs text-brand-600 hover:underline">Guardar</button>
                      </form>
                    )}
                  </td>
                  <td className="px-4 py-2 align-top">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${ESTADO_STYLES[i.estado]}`}
                    >
                      {i.estado}
                    </span>
                  </td>
                  <td className="px-4 py-2 align-top text-right">
                    <div className="flex justify-end gap-2">
                      {i.estado !== 'confirmado' && (
                        <form action={cambiarEstadoIngreso}>
                          <input type="hidden" name="id" value={i.id} />
                          <input type="hidden" name="_path" value="/mes-actual" />
                          <input type="hidden" name="nuevo_estado" value="confirmado" />
                          <button className="text-xs text-brand-600 hover:underline">Confirmado</button>
                        </form>
                      )}
                      {i.estado === 'confirmado' && (
                        <form action={cambiarEstadoIngreso}>
                          <input type="hidden" name="id" value={i.id} />
                          <input type="hidden" name="_path" value="/mes-actual" />
                          <input type="hidden" name="nuevo_estado" value="pendiente" />
                          <button className="text-xs text-gray-400 hover:underline">Revertir</button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(ingresos ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm text-gray-400">
                    No hay ingresos que coincidan con los filtros.
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
