import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { revalidatePath } from 'next/cache';
import MontoInput from '@/components/MontoInput';
import GastosTemplateTable from '@/components/GastosTemplateTable';
import IngresosTemplateTable from '@/components/IngresosTemplateTable';
import NuevoPanel from '@/components/ui/NuevoPanel';
import FormularioAlta from '@/components/ui/FormularioAlta';
import { Section } from '@/components/ui/Layout';
import { getInicioPeriodoActual, toISODate } from '@/lib/period';
import { contarCuotas, resumirCuotas, type ResumenCuotas } from '@/lib/cuotas';

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

  // A diferencia del monto (que tiene vigencias y queda "congelado" en la
  // fecha de cada movimiento), método y categoría son solo clasificación:
  // no tiene sentido que un gasto ya generado quede con el método/categoría
  // viejo de la plantilla. Se propaga a TODOS los gastos generados desde
  // esta plantilla (históricos y del mes actual, sin importar el estado).
  await supabase
    .from('expense_entries')
    .update({ payment_method_id, category_id })
    .eq('template_id', id);

  revalidatePath('/configuracion/plantillas');
  revalidatePath('/mes-actual');
  revalidatePath('/');
  revalidatePath('/fondo');
}

/**
 * Configura un préstamo en cuotas en la plantilla (src/lib/cuotas.ts).
 *
 * El usuario carga cuántas cuotas lleva pagadas EN TOTAL, porque es el
 * número que conoce. Pero las que ya figuran rescatadas/pagadas en la app
 * se cuentan solas, así que se guarda solo la diferencia como
 * cuotas_pagadas_inicial; si no, una cuota pagada en la app contaría dos
 * veces.
 *
 * cuotas_total se lee siempre en vivo de la plantilla (como método y
 * categoría), pero el número de cuota de cada gasto queda congelado al
 * generarse. Al cambiar esta configuración se renumeran los gastos ya
 * generados de la plantilla, en orden de período, para que sigan
 * coincidiendo con el nuevo punto de partida.
 */
async function updateCuotasPlantilla(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const totalCrudo = String(formData.get('cuotas_total') ?? '').trim();
  const cuotasTotal = totalCrudo === '' ? null : Math.max(1, Math.trunc(Number(totalCrudo)) || 1);
  const pagadasDeclaradas = Math.max(0, Math.trunc(Number(formData.get('cuotas_pagadas'))) || 0);

  const supabase = createSupabaseServerClient();
  const { data: entries } = await supabase
    .from('expense_entries')
    .select('id, periodo, estado')
    .eq('template_id', id)
    .order('periodo');

  const pagadasEnApp = (entries ?? []).filter(
    (e) => e.estado === 'rescatado' || e.estado === 'pagado'
  ).length;
  const inicial = cuotasTotal === null ? 0 : Math.max(0, pagadasDeclaradas - pagadasEnApp);

  await supabase
    .from('expense_templates')
    .update({ cuotas_total: cuotasTotal, cuotas_pagadas_inicial: inicial })
    .eq('id', id);

  // Mismo criterio que la generación: el k-ésimo gasto generado es la
  // cuota inicial + k. Sin cuotas, se limpia la numeración.
  await Promise.all(
    (entries ?? []).map((e, i) =>
      supabase
        .from('expense_entries')
        .update({ numero_cuota: cuotasTotal === null ? null : inicial + i + 1 })
        .eq('id', e.id)
    )
  );

  revalidatePath('/configuracion/plantillas');
  revalidatePath('/mes-actual');
  revalidatePath('/previsiones');
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

  // Estado de los préstamos en cuotas, respecto del período vigente.
  const periodoActualISO = toISODate(getInicioPeriodoActual());
  const conteoCuotas = accountId
    ? await contarCuotas(supabase, accountId, gastos ?? [], periodoActualISO)
    : new Map();
  const cuotas: Record<string, ResumenCuotas> = {};
  for (const g of gastos ?? []) {
    const r = resumirCuotas(g, conteoCuotas.get(g.id), periodoActualISO);
    if (r) cuotas[g.id] = r;
  }

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
          updateCuotas={updateCuotasPlantilla}
          cuotas={cuotas}
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
