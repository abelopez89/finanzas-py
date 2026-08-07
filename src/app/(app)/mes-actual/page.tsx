import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { getInicioPeriodoActual, formatPeriodoLabel, toISODate } from '@/lib/period';
import { revalidatePath } from 'next/cache';

// ------------------------------ Server actions ------------------------------

async function generarMovimientosDelMes() {
  'use server';
  const accountId = await getCurrentAccountId();
  if (!accountId) return;

  const supabase = createSupabaseServerClient();
  const periodo = toISODate(getInicioPeriodoActual());

  const [{ data: plantillasGasto }, { data: existentesGasto }] = await Promise.all([
    supabase.from('expense_templates').select('*').eq('account_id', accountId).eq('activo', true),
    supabase
      .from('expense_entries')
      .select('template_id')
      .eq('account_id', accountId)
      .eq('periodo', periodo),
  ]);
  const yaCreadosGasto = new Set((existentesGasto ?? []).map((e) => e.template_id));

  const nuevosGastos = (plantillasGasto ?? [])
    .filter((t) => !yaCreadosGasto.has(t.id))
    .map((t) => ({
      account_id: accountId,
      template_id: t.id,
      es_extra: false,
      nombre: t.nombre,
      periodo,
      dia: t.dia_mes,
      monto: t.monto,
      payment_method_id: t.payment_method_id,
      category_id: t.category_id,
      estado: 'pendiente',
    }));
  if (nuevosGastos.length) await supabase.from('expense_entries').insert(nuevosGastos);

  const [{ data: plantillasIngreso }, { data: existentesIngreso }] = await Promise.all([
    supabase.from('income_templates').select('*').eq('account_id', accountId).eq('activo', true),
    supabase
      .from('income_entries')
      .select('template_id')
      .eq('account_id', accountId)
      .eq('periodo', periodo),
  ]);
  const yaCreadosIngreso = new Set((existentesIngreso ?? []).map((e) => e.template_id));

  const nuevosIngresos = (plantillasIngreso ?? [])
    .filter((t) => !yaCreadosIngreso.has(t.id))
    .map((t) => ({
      account_id: accountId,
      template_id: t.id,
      es_extra: false,
      nombre: t.nombre,
      periodo,
      dia: t.dia_mes,
      monto: t.monto,
      estado: 'pendiente',
    }));
  if (nuevosIngresos.length) await supabase.from('income_entries').insert(nuevosIngresos);

  revalidatePath('/mes-actual');
}

async function updateExpenseEntry(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const dia = Number(formData.get('dia'));
  const monto = Number(formData.get('monto')) || 0;

  const supabase = createSupabaseServerClient();
  await supabase
    .from('expense_entries')
    .update({ dia, monto, updated_at: new Date().toISOString() })
    .eq('id', id)
    .neq('estado', 'pagado'); // seguridad extra: no tocar montos ya pagados
  revalidatePath('/mes-actual');
}

async function updateIncomeEntry(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const dia = Number(formData.get('dia'));
  const monto = Number(formData.get('monto')) || 0;

  const supabase = createSupabaseServerClient();
  await supabase
    .from('income_entries')
    .update({ dia, monto, updated_at: new Date().toISOString() })
    .eq('id', id)
    .neq('estado', 'confirmado');
  revalidatePath('/mes-actual');
}

async function cambiarEstadoGasto(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const nuevoEstado = String(formData.get('nuevo_estado'));

  const supabase = createSupabaseServerClient();
  const { data: entry } = await supabase.from('expense_entries').select('*').eq('id', id).single();
  if (!entry) return;

  const hoy = new Date().toISOString().slice(0, 10);
  const updates: Record<string, unknown> = { estado: nuevoEstado };
  if (nuevoEstado === 'pagado') updates.fecha_pago = hoy;
  if (nuevoEstado !== 'pagado') updates.fecha_pago = null;

  await supabase.from('expense_entries').update(updates).eq('id', id);

  if (nuevoEstado === 'pagado') {
    const { data: existente } = await supabase
      .from('fund_movements')
      .select('id')
      .eq('referencia_tipo', 'expense_entries')
      .eq('referencia_id', id)
      .maybeSingle();

    if (!existente) {
      await supabase.from('fund_movements').insert({
        account_id: entry.account_id,
        tipo: 'egreso',
        monto: entry.monto,
        fecha: hoy,
        referencia_tipo: 'expense_entries',
        referencia_id: id,
        descripcion: entry.nombre,
      });
    }
  } else {
    // Si se revierte desde "pagado", el movimiento del libro mayor se elimina
    // para que el saldo del fondo vuelva a reflejar la realidad.
    await supabase
      .from('fund_movements')
      .delete()
      .eq('referencia_tipo', 'expense_entries')
      .eq('referencia_id', id);
  }

  revalidatePath('/mes-actual');
}

async function cambiarEstadoIngreso(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const nuevoEstado = String(formData.get('nuevo_estado'));

  const supabase = createSupabaseServerClient();
  const { data: entry } = await supabase.from('income_entries').select('*').eq('id', id).single();
  if (!entry) return;

  const hoy = new Date().toISOString().slice(0, 10);
  const updates: Record<string, unknown> = { estado: nuevoEstado };
  if (nuevoEstado === 'confirmado') updates.fecha_aplicacion = hoy;
  if (nuevoEstado !== 'confirmado') updates.fecha_aplicacion = null;

  await supabase.from('income_entries').update(updates).eq('id', id);

  if (nuevoEstado === 'confirmado') {
    const { data: existente } = await supabase
      .from('fund_movements')
      .select('id')
      .eq('referencia_tipo', 'income_entries')
      .eq('referencia_id', id)
      .maybeSingle();

    if (!existente) {
      await supabase.from('fund_movements').insert({
        account_id: entry.account_id,
        tipo: 'ingreso',
        monto: entry.monto,
        fecha: hoy,
        referencia_tipo: 'income_entries',
        referencia_id: id,
        descripcion: entry.nombre,
      });
    }
  } else {
    await supabase
      .from('fund_movements')
      .delete()
      .eq('referencia_tipo', 'income_entries')
      .eq('referencia_id', id);
  }

  revalidatePath('/mes-actual');
}

// ---------------------------------- Página ----------------------------------

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
                    {g.estado === 'pagado' ? (
                      <span className="text-gray-500">
                        Día {g.dia} — ₲ {Number(g.monto).toLocaleString('es-PY')}
                      </span>
                    ) : (
                      <form action={updateExpenseEntry} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={g.id} />
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
                          <input type="hidden" name="nuevo_estado" value="rescatado" />
                          <button className="text-xs text-amber-600 hover:underline">Rescatado</button>
                        </form>
                      )}
                      {g.estado !== 'pagado' && (
                        <form action={cambiarEstadoGasto}>
                          <input type="hidden" name="id" value={g.id} />
                          <input type="hidden" name="nuevo_estado" value="pagado" />
                          <button className="text-xs text-brand-600 hover:underline">Pagado</button>
                        </form>
                      )}
                      {g.estado !== 'pendiente' && (
                        <form action={cambiarEstadoGasto}>
                          <input type="hidden" name="id" value={g.id} />
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
                          <input type="hidden" name="nuevo_estado" value="confirmado" />
                          <button className="text-xs text-brand-600 hover:underline">Confirmado</button>
                        </form>
                      )}
                      {i.estado === 'confirmado' && (
                        <form action={cambiarEstadoIngreso}>
                          <input type="hidden" name="id" value={i.id} />
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
