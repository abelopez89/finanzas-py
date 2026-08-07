import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { getInicioPeriodoActual, formatPeriodoLabel, toISODate } from '@/lib/period';
import {
  generarMovimientosDelMes,
  updateExpenseEntry,
  updateIncomeEntry,
  cambiarEstadoGasto,
  cambiarEstadoIngreso,
} from '@/lib/actions/entries';

const ESTADO_STYLES: Record<string, string> = {
  pendiente: 'bg-gray-100 text-gray-600',
  rescatado: 'bg-amber-100 text-amber-700',
  pagado: 'bg-brand-100 text-brand-700',
  confirmado: 'bg-brand-100 text-brand-700',
};

export default async function MesActualPage() {
  const accountId = await getCurrentAccountId();
  const supabase = createSupabaseServerClient();
  const inicio = getInicioPeriodoActual();
  const periodo = toISODate(inicio);

  const [{ data: gastos }, { data: ingresos }] = accountId
    ? await Promise.all([
        supabase
          .from('expense_entries')
          .select('*')
          .eq('account_id', accountId)
          .eq('periodo', periodo)
          .eq('es_extra', false)
          .order('dia'),
        supabase
          .from('income_entries')
          .select('*')
          .eq('account_id', accountId)
          .eq('periodo', periodo)
          .eq('es_extra', false)
          .order('dia'),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }];

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
          Solo crea los que todavía no existen para este período — no duplica ni pisa lo que ya ajustaste.
        </p>
      </form>

      {/* ------------------------- Gastos del período ------------------------- */}
      <section>
        <h2 className="mb-3 text-lg font-medium">Gastos</h2>
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
                        <input
                          name="monto"
                          type="number"
                          step="0.01"
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
                    Todavía no hay gastos generados para este período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ------------------------- Ingresos del período ------------------------- */}
      <section>
        <h2 className="mb-3 text-lg font-medium">Ingresos</h2>
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
                        <input
                          name="monto"
                          type="number"
                          step="0.01"
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
                    Todavía no hay ingresos generados para este período.
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
