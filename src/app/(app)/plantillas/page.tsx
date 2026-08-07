import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { revalidatePath } from 'next/cache';

// ------------------------- Server actions: gastos -------------------------

async function addExpenseTemplate(formData: FormData) {
  'use server';
  const accountId = await getCurrentAccountId();
  if (!accountId) return;

  const nombre = String(formData.get('nombre') ?? '').trim();
  const dia_mes = Number(formData.get('dia_mes'));
  const monto = Number(formData.get('monto')) || 0;
  const payment_method_id = String(formData.get('payment_method_id') || '') || null;
  const category_id = String(formData.get('category_id') || '') || null;
  if (!nombre || !dia_mes) return;

  const supabase = createSupabaseServerClient();
  await supabase.from('expense_templates').insert({
    account_id: accountId,
    nombre,
    dia_mes,
    monto,
    payment_method_id,
    category_id,
  });
  revalidatePath('/plantillas');
}

async function updateExpenseTemplate(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const dia_mes = Number(formData.get('dia_mes'));
  const monto = Number(formData.get('monto')) || 0;
  const payment_method_id = String(formData.get('payment_method_id') || '') || null;
  const category_id = String(formData.get('category_id') || '') || null;

  const supabase = createSupabaseServerClient();
  await supabase
    .from('expense_templates')
    .update({ dia_mes, monto, payment_method_id, category_id })
    .eq('id', id);
  revalidatePath('/plantillas');
}

async function toggleExpenseTemplate(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const activo = formData.get('activo') === 'true';

  const supabase = createSupabaseServerClient();
  await supabase.from('expense_templates').update({ activo: !activo }).eq('id', id);
  revalidatePath('/plantillas');
}

// ------------------------- Server actions: ingresos ------------------------

async function addIncomeTemplate(formData: FormData) {
  'use server';
  const accountId = await getCurrentAccountId();
  if (!accountId) return;

  const nombre = String(formData.get('nombre') ?? '').trim();
  const dia_mes = Number(formData.get('dia_mes'));
  const monto = Number(formData.get('monto')) || 0;
  if (!nombre || !dia_mes) return;

  const supabase = createSupabaseServerClient();
  await supabase.from('income_templates').insert({
    account_id: accountId,
    nombre,
    dia_mes,
    monto,
  });
  revalidatePath('/plantillas');
}

async function updateIncomeTemplate(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const dia_mes = Number(formData.get('dia_mes'));
  const monto = Number(formData.get('monto')) || 0;

  const supabase = createSupabaseServerClient();
  await supabase.from('income_templates').update({ dia_mes, monto }).eq('id', id);
  revalidatePath('/plantillas');
}

async function toggleIncomeTemplate(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const activo = formData.get('activo') === 'true';

  const supabase = createSupabaseServerClient();
  await supabase.from('income_templates').update({ activo: !activo }).eq('id', id);
  revalidatePath('/plantillas');
}

// ------------------------------- Página -------------------------------

export default async function PlantillasPage() {
  const accountId = await getCurrentAccountId();
  const supabase = createSupabaseServerClient();

  const gastosQ = accountId
    ? supabase.from('expense_templates').select('*').eq('account_id', accountId).order('dia_mes')
    : Promise.resolve({ data: [] as any[] });
  const ingresosQ = accountId
    ? supabase.from('income_templates').select('*').eq('account_id', accountId).order('dia_mes')
    : Promise.resolve({ data: [] as any[] });
  const metodosQ = accountId
    ? supabase.from('payment_methods').select('*').eq('account_id', accountId).eq('activo', true)
    : Promise.resolve({ data: [] as any[] });
  const categoriasQ = accountId
    ? supabase.from('categories').select('*').eq('account_id', accountId).eq('activo', true)
    : Promise.resolve({ data: [] as any[] });

  const [{ data: gastos }, { data: ingresos }, { data: metodos }, { data: categorias }] =
    await Promise.all([gastosQ, ingresosQ, metodosQ, categoriasQ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Plantillas</h1>
        <p className="text-sm text-gray-500">
          Estos son los gastos e ingresos habituales de cada mes, con el día y
          monto que normalmente se aplican. Después, desde "Mes actual" se
          generan los movimientos reales del período, que se pueden ajustar
          sin tocar la plantilla.
        </p>
      </div>

      {/* ------------------------- Gastos ------------------------- */}
      <section>
        <h2 className="mb-3 text-lg font-medium">Gastos mensuales</h2>

        <form action={addExpenseTemplate} className="mb-4 grid grid-cols-[2fr_70px_130px_150px_150px_1fr] gap-2">
          <input
            name="nombre"
            placeholder="Nombre (ej: Alquiler, Internet)"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            required
          />
          <input
            name="dia_mes"
            type="number"
            min={1}
            max={31}
            placeholder="Día"
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
          <select
            name="payment_method_id"
            className="rounded-md border border-gray-300 px-2 py-2 text-sm"
          >
            <option value="">Método de pago</option>
            {(metodos ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
          <select
            name="category_id"
            className="rounded-md border border-gray-300 px-2 py-2 text-sm"
          >
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
          <div className="grid grid-cols-[2fr_70px_130px_150px_150px_80px_80px] gap-2 bg-gray-50 px-4 py-2 text-xs uppercase text-gray-500">
            <div>Nombre</div>
            <div>Día</div>
            <div>Monto</div>
            <div>Método</div>
            <div>Categoría</div>
            <div></div>
            <div></div>
          </div>
          <div className="divide-y divide-gray-100">
            {(gastos ?? []).map((g) => (
              <form
                key={g.id}
                action={updateExpenseTemplate}
                className={`grid grid-cols-[2fr_70px_130px_150px_150px_80px_80px] items-center gap-2 px-4 py-2 ${
                  g.activo ? '' : 'opacity-40'
                }`}
              >
                <input type="hidden" name="id" value={g.id} />
                <span className="truncate">{g.nombre}</span>
                <input
                  name="dia_mes"
                  type="number"
                  min={1}
                  max={31}
                  defaultValue={g.dia_mes}
                  className="w-full rounded-md border border-gray-300 px-2 py-1"
                />
                <input
                  name="monto"
                  type="number"
                  step="0.01"
                  defaultValue={g.monto}
                  className="w-full rounded-md border border-gray-300 px-2 py-1"
                />
                <select
                  name="payment_method_id"
                  defaultValue={g.payment_method_id ?? ''}
                  className="w-full rounded-md border border-gray-300 px-2 py-1"
                >
                  <option value="">Método</option>
                  {(metodos ?? []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </select>
                <select
                  name="category_id"
                  defaultValue={g.category_id ?? ''}
                  className="w-full rounded-md border border-gray-300 px-2 py-1"
                >
                  <option value="">Categoría</option>
                  {(categorias ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
                <button
                  formAction={updateExpenseTemplate}
                  className="text-xs text-brand-600 hover:underline"
                >
                  Guardar
                </button>
                <input type="hidden" name="activo" value={String(g.activo)} />
                <button
                  formAction={toggleExpenseTemplate}
                  className="text-xs text-gray-500 hover:underline"
                >
                  {g.activo ? 'Desact.' : 'Activar'}
                </button>
              </form>
            ))}
            {(gastos ?? []).length === 0 && (
              <p className="px-4 py-3 text-sm text-gray-400">
                Todavía no hay gastos mensuales cargados.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------- Ingresos ------------------------- */}
      <section>
        <h2 className="mb-3 text-lg font-medium">Ingresos mensuales</h2>

        <form action={addIncomeTemplate} className="mb-4 grid grid-cols-12 gap-2">
          <input
            name="nombre"
            placeholder="Nombre (ej: Sueldo)"
            className="col-span-6 rounded-md border border-gray-300 px-3 py-2 text-sm"
            required
          />
          <input
            name="dia_mes"
            type="number"
            min={1}
            max={31}
            placeholder="Día"
            className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
            required
          />
          <input
            name="monto"
            type="number"
            step="0.01"
            placeholder="Monto ₲"
            className="col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button className="col-span-2 rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
            Agregar
          </button>
        </form>

        <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Día / Monto</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(ingresos ?? []).map((i) => (
                <tr key={i.id} className={i.activo ? '' : 'opacity-40'}>
                  <td className="px-4 py-2">{i.nombre}</td>
                  <td className="px-4 py-2">
                    <form action={updateIncomeTemplate} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={i.id} />
                      <input
                        name="dia_mes"
                        type="number"
                        min={1}
                        max={31}
                        defaultValue={i.dia_mes}
                        className="w-16 rounded-md border border-gray-300 px-2 py-1"
                      />
                      <input
                        name="monto"
                        type="number"
                        step="0.01"
                        defaultValue={i.monto}
                        className="w-28 rounded-md border border-gray-300 px-2 py-1"
                      />
                      <button className="text-xs text-brand-600 hover:underline">Guardar</button>
                    </form>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <form action={toggleIncomeTemplate}>
                      <input type="hidden" name="id" value={i.id} />
                      <input type="hidden" name="activo" value={String(i.activo)} />
                      <button className="text-xs text-gray-500 hover:underline">
                        {i.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {(ingresos ?? []).length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-sm text-gray-400">
                    Todavía no hay ingresos mensuales cargados.
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
