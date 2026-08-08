import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { revalidatePath } from 'next/cache';
import MontoInput from '@/components/MontoInput';
import GastosTemplateTable from '@/components/GastosTemplateTable';
import IngresosTemplateTable from '@/components/IngresosTemplateTable';
import NuevoPanel from '@/components/ui/NuevoPanel';
import FormularioAlta from '@/components/ui/FormularioAlta';
import { Section } from '@/components/ui/Layout';

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
  revalidatePath('/configuracion/plantillas');
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
  revalidatePath('/configuracion/plantillas');
}

async function toggleExpenseTemplate(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const activo = formData.get('activo') === 'true';

  const supabase = createSupabaseServerClient();
  await supabase.from('expense_templates').update({ activo: !activo }).eq('id', id);
  revalidatePath('/configuracion/plantillas');
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
  revalidatePath('/configuracion/plantillas');
}

async function updateIncomeTemplate(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const dia_mes = Number(formData.get('dia_mes'));
  const monto = Number(formData.get('monto')) || 0;

  const supabase = createSupabaseServerClient();
  await supabase.from('income_templates').update({ dia_mes, monto }).eq('id', id);
  revalidatePath('/configuracion/plantillas');
}

async function toggleIncomeTemplate(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const activo = formData.get('activo') === 'true';

  const supabase = createSupabaseServerClient();
  await supabase.from('income_templates').update({ activo: !activo }).eq('id', id);
  revalidatePath('/configuracion/plantillas');
}

// ------------------------------- Página -------------------------------

export default async function PlantillasPage() {
  const accountId = await getCurrentAccountId();
  const supabase = createSupabaseServerClient();

  const gastosQ = accountId
    ? supabase.from('expense_templates').select('*').eq('account_id', accountId)
    : Promise.resolve({ data: [] as any[] });
  const ingresosQ = accountId
    ? supabase.from('income_templates').select('*').eq('account_id', accountId)
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
    <div>
      <p className="mb-6 max-w-2xl text-sm text-ink-500">
        Los gastos e ingresos que se repiten cada mes. Al abrir un período nuevo, estos se copian
        automáticamente a Mes actual, donde podés ajustarlos sin tocar la plantilla.
      </p>

      <Section titulo="Gastos mensuales">
        <NuevoPanel etiqueta="Nuevo gasto">
          <FormularioAlta action={addExpenseTemplate} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="gt-nombre">
                Nombre
              </label>
              <input
                id="gt-nombre"
                name="nombre"
                placeholder="Ej: Alquiler, Internet"
                className="field"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="gt-dia">
                Día del mes
              </label>
              <input
                id="gt-dia"
                name="dia_mes"
                type="number"
                min={1}
                max={31}
                placeholder="15"
                className="field"
                required
              />
            </div>
            <div>
              <label className="label">Monto</label>
              <MontoInput name="monto" placeholder="0" />
            </div>
            <div>
              <label className="label" htmlFor="gt-metodo">
                Método de pago
              </label>
              <select id="gt-metodo" name="payment_method_id" className="field">
                <option value="">Sin método</option>
                {(metodos ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="gt-cat">
                Categoría
              </label>
              <select id="gt-cat" name="category_id" className="field">
                <option value="">Sin categoría</option>
                {(categorias ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <button className="btn-primary w-full sm:w-auto">Agregar gasto</button>
            </div>
          </FormularioAlta>
        </NuevoPanel>

        <GastosTemplateTable
          gastos={gastos ?? []}
          metodos={metodos ?? []}
          categorias={categorias ?? []}
          updateExpenseTemplate={updateExpenseTemplate}
          toggleExpenseTemplate={toggleExpenseTemplate}
        />
      </Section>

      <Section titulo="Ingresos mensuales">
        <NuevoPanel etiqueta="Nuevo ingreso">
          <FormularioAlta action={addIncomeTemplate} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="it-nombre">
                Nombre
              </label>
              <input
                id="it-nombre"
                name="nombre"
                placeholder="Ej: Sueldo"
                className="field"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="it-dia">
                Día del mes
              </label>
              <input
                id="it-dia"
                name="dia_mes"
                type="number"
                min={1}
                max={31}
                placeholder="30"
                className="field"
                required
              />
            </div>
            <div>
              <label className="label">Monto</label>
              <MontoInput name="monto" placeholder="0" />
            </div>
            <div className="sm:col-span-2">
              <button className="btn-primary w-full sm:w-auto">Agregar ingreso</button>
            </div>
          </FormularioAlta>
        </NuevoPanel>

        <IngresosTemplateTable
          ingresos={ingresos ?? []}
          updateIncomeTemplate={updateIncomeTemplate}
          toggleIncomeTemplate={toggleIncomeTemplate}
        />
      </Section>
    </div>
  );
}
