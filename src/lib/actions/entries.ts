'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { getInicioPeriodoActual, toISODate } from '@/lib/period';
import { revalidatePath } from 'next/cache';

function diaDeFecha(fechaISO: string): number {
  return Number(fechaISO.slice(8, 10));
}

// ------------------------------ Edición de montos ------------------------------

export async function updateExpenseEntry(formData: FormData) {
  const id = String(formData.get('id'));
  const dia = Number(formData.get('dia'));
  const monto = Number(formData.get('monto')) || 0;
  const path = String(formData.get('_path') || '/mes-actual');

  const supabase = createSupabaseServerClient();
  await supabase
    .from('expense_entries')
    .update({ dia, monto, updated_at: new Date().toISOString() })
    .eq('id', id)
    .neq('estado', 'pagado');
  revalidatePath(path);
}

export async function updateIncomeEntry(formData: FormData) {
  const id = String(formData.get('id'));
  const dia = Number(formData.get('dia'));
  const monto = Number(formData.get('monto')) || 0;
  const path = String(formData.get('_path') || '/mes-actual');

  const supabase = createSupabaseServerClient();
  await supabase
    .from('income_entries')
    .update({ dia, monto, updated_at: new Date().toISOString() })
    .eq('id', id)
    .neq('estado', 'confirmado');
  revalidatePath(path);
}

// ------------------------------ Cambios de estado ------------------------------

export async function cambiarEstadoGasto(formData: FormData) {
  const id = String(formData.get('id'));
  const nuevoEstado = String(formData.get('nuevo_estado'));
  const path = String(formData.get('_path') || '/mes-actual');

  const supabase = createSupabaseServerClient();
  const { data: entry } = await supabase.from('expense_entries').select('*').eq('id', id).single();
  if (!entry) return;

  const hoy = new Date().toISOString().slice(0, 10);
  const updates: Record<string, unknown> = { estado: nuevoEstado };
  updates.fecha_pago = nuevoEstado === 'pagado' ? hoy : null;

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
    await supabase
      .from('fund_movements')
      .delete()
      .eq('referencia_tipo', 'expense_entries')
      .eq('referencia_id', id);
  }

  revalidatePath(path);
}

export async function cambiarEstadoIngreso(formData: FormData) {
  const id = String(formData.get('id'));
  const nuevoEstado = String(formData.get('nuevo_estado'));
  const path = String(formData.get('_path') || '/mes-actual');

  const supabase = createSupabaseServerClient();
  const { data: entry } = await supabase.from('income_entries').select('*').eq('id', id).single();
  if (!entry) return;

  const hoy = new Date().toISOString().slice(0, 10);
  const updates: Record<string, unknown> = { estado: nuevoEstado };
  updates.fecha_aplicacion = nuevoEstado === 'confirmado' ? hoy : null;

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

  revalidatePath(path);
}

// ------------------------------ Generación mensual ------------------------------

export async function generarMovimientosDelMes() {
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

// ------------------------------ Extras ------------------------------

export async function addExpenseExtra(formData: FormData) {
  const accountId = await getCurrentAccountId();
  if (!accountId) return;

  const nombre = String(formData.get('nombre') ?? '').trim();
  const monto = Number(formData.get('monto')) || 0;
  const fecha_vencimiento = String(formData.get('fecha_vencimiento') ?? '');
  const payment_method_id = String(formData.get('payment_method_id') || '') || null;
  const category_id = String(formData.get('category_id') || '') || null;
  if (!nombre || !fecha_vencimiento) return;

  const supabase = createSupabaseServerClient();
  await supabase.from('expense_entries').insert({
    account_id: accountId,
    es_extra: true,
    nombre,
    periodo: toISODate(getInicioPeriodoActual()),
    dia: diaDeFecha(fecha_vencimiento),
    monto,
    payment_method_id,
    category_id,
    fecha_vencimiento,
    estado: 'pendiente',
  });
  revalidatePath('/extras');
}

export async function addIncomeExtra(formData: FormData) {
  const accountId = await getCurrentAccountId();
  if (!accountId) return;

  const nombre = String(formData.get('nombre') ?? '').trim();
  const monto = Number(formData.get('monto')) || 0;
  const fecha_aplicacion = String(formData.get('fecha_aplicacion') ?? '');
  if (!nombre || !fecha_aplicacion) return;

  const supabase = createSupabaseServerClient();
  await supabase.from('income_entries').insert({
    account_id: accountId,
    es_extra: true,
    nombre,
    periodo: toISODate(getInicioPeriodoActual()),
    dia: diaDeFecha(fecha_aplicacion),
    monto,
    fecha_aplicacion,
    estado: 'pendiente',
  });
  revalidatePath('/extras');
}

export async function deleteExpenseExtra(formData: FormData) {
  const id = String(formData.get('id'));
  const supabase = createSupabaseServerClient();
  // Solo se puede borrar si todavía no generó movimiento en el fondo.
  await supabase.from('expense_entries').delete().eq('id', id).eq('estado', 'pendiente');
  revalidatePath('/extras');
}

export async function deleteIncomeExtra(formData: FormData) {
  const id = String(formData.get('id'));
  const supabase = createSupabaseServerClient();
  await supabase.from('income_entries').delete().eq('id', id).eq('estado', 'pendiente');
  revalidatePath('/extras');
}
