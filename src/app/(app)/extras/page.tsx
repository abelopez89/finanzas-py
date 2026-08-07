import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import {
  addExpenseExtra,
  addIncomeExtra,
  deleteExpenseExtra,
  deleteIncomeExtra,
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

export default async function ExtrasPage() {
  const accountId = await getCurrentAccountId();
  const supabase = createSupabaseServerClient();

  const [{ data: gastos }, { data: ingresos }, { data: metodos }, { data: categorias }] = accountId
    ? await Promise.all([
        supabase
          .from('expense_entries')
          .select('*')
          .eq('account_id', accountId)
          .eq('es_extra', true)
          .order('fecha_vencimiento', { ascending: false }),
        supabase
          .from('income_entries')
          .select('*')
          .eq('account_id', accountId)
          .eq('es_extra', true)
          .order('fecha_aplicacion', { ascending: false }),
        supabase.from('payment_methods').select('*').eq('account_id', accountId).eq('activo', true),
        supabase.from('categories').select('*').eq('account_id', accountId).eq('activo', true),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }, { data: [] as any[] }, { data: [] as any[] }];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Extras</h1>
        <p className="text-sm text-gray-500">
          Gastos e ingresos puntuales que no forman parte de las plantillas mensuales.
        </p>
      </div>

      {/* ------------------------- Gastos extra ------------------------- */}
      <section>
        <h2 className="mb-3 text-lg font-medium">Gastos extra</h2>

        <form action={addExpenseExtra} className="mb-4 grid grid-cols-[2fr_130px_150px_150px_150px_1fr] gap-2">
          <input
            name="nombre"
            placeholder="Nombre del gasto"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            required
          />
          <input
            name="monto"
            type="number"
            step="0.01"
            placeholder="Monto ₲"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            name="fecha_vencimiento"
            type="date"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            required
          />
          <select name="payment_method_id" className="rounded-md border border-gray-300 px-2 py-2 text-sm">
            <option value="">Método</option>
            {(metodos ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
          <select name="category_id" className="rounded-md border border-gray-300 px-2 py-2 text-sm">
            <option value="">Categoría</option>
            {(categorias ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <button className="w-fit rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
            Agregar
          </button>
        </form>

        <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Vencimiento / Monto</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(gastos ?? []).map((g) => (
                <tr key={g.id}>
                  <td className="px-4 py-2 align-top">{g.nombre}</td>
                  <td className="px-4 py-2 align-top">
                    {g.estado === 'pagado' ? (
                      <span className="text-gray-500">
                        {g.fecha_vencimiento} — ₲ {Number(g.monto).toLocaleString('es-PY')}
                      </span>
                    ) : (
                      <form action={updateExpenseEntry} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={g.id} />
                        <input type="hidden" name="_path" value="/extras" />
                        <input
                          name="dia"
                          type="hidden"
                          value={g.dia}
                        />
                        <span className="text-xs text-gray-500">{g.fecha_vencimiento}</span>
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
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${ESTADO_STYLES[g.estado]}`}>
                      {g.estado}
                    </span>
                  </td>
                  <td className="px-4 py-2 align-top text-right">
                    <div className="flex justify-end gap-2">
                      {g.estado === 'pendiente' && (
                        <>
                          <form action={cambiarEstadoGasto}>
                            <input type="hidden" name="id" value={g.id} />
                            <input type="hidden" name="_path" value="/extras" />
                            <input type="hidden" name="nuevo_estado" value="rescatado" />
                            <button className="text-xs text-amber-600 hover:underline">Rescatado</button>
                          </form>
                          <form action={deleteExpenseExtra}>
                            <input type="hidden" name="id" value={g.id} />
                            <button className="text-xs text-red-400 hover:underline">Eliminar</button>
                          </form>
                        </>
                      )}
                      {g.estado !== 'pagado' && (
                        <form action={cambiarEstadoGasto}>
                          <input type="hidden" name="id" value={g.id} />
                          <input type="hidden" name="_path" value="/extras" />
                          <input type="hidden" name="nuevo_estado" value="pagado" />
                          <button className="text-xs text-brand-600 hover:underline">Pagado</button>
                        </form>
                      )}
                      {g.estado !== 'pendiente' && (
                        <form action={cambiarEstadoGasto}>
                          <input type="hidden" name="id" value={g.id} />
                          <input type="hidden" name="_path" value="/extras" />
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
                    Todavía no hay gastos extra cargados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ------------------------- Ingresos extra ------------------------- */}
      <section>
        <h2 className="mb-3 text-lg font-medium">Ingresos extra</h2>

        <form action={addIncomeExtra} className="mb-4 grid grid-cols-[2fr_150px_150px_1fr] gap-2">
          <input
            name="nombre"
            placeholder="Nombre del ingreso"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            required
          />
          <input
            name="monto"
            type="number"
            step="0.01"
            placeholder="Monto ₲"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            name="fecha_aplicacion"
            type="date"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            required
          />
          <button className="w-fit rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
            Agregar
          </button>
        </form>

        <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Fecha / Monto</th>
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
                        {i.fecha_aplicacion} — ₲ {Number(i.monto).toLocaleString('es-PY')}
                      </span>
                    ) : (
                      <form action={updateIncomeEntry} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={i.id} />
                        <input type="hidden" name="_path" value="/extras" />
                        <input type="hidden" name="dia" value={i.dia} />
                        <span className="text-xs text-gray-500">{i.fecha_aplicacion}</span>
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
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${ESTADO_STYLES[i.estado]}`}>
                      {i.estado}
                    </span>
                  </td>
                  <td className="px-4 py-2 align-top text-right">
                    <div className="flex justify-end gap-2">
                      {i.estado !== 'confirmado' && (
                        <>
                          <form action={cambiarEstadoIngreso}>
                            <input type="hidden" name="id" value={i.id} />
                            <input type="hidden" name="_path" value="/extras" />
                            <input type="hidden" name="nuevo_estado" value="confirmado" />
                            <button className="text-xs text-brand-600 hover:underline">Confirmado</button>
                          </form>
                          <form action={deleteIncomeExtra}>
                            <input type="hidden" name="id" value={i.id} />
                            <button className="text-xs text-red-400 hover:underline">Eliminar</button>
                          </form>
                        </>
                      )}
                      {i.estado === 'confirmado' && (
                        <form action={cambiarEstadoIngreso}>
                          <input type="hidden" name="id" value={i.id} />
                          <input type="hidden" name="_path" value="/extras" />
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
                    Todavía no hay ingresos extra cargados.
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
