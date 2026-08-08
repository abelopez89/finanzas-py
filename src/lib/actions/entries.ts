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
    .eq('estado', 'pendiente'); // una vez rescatado, el monto ya salió del fondo
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

  // La plata sale realmente del fondo en el RESCATE, no en el pago — "pagado"
  // solo confirma que esa plata (ya retirada) se usó. Por eso el movimiento
  // del libro mayor se crea la primera vez que el gasto llega a "rescatado"
  // O "pagado" (por si se salta directo de pendiente a pagado), y no se
  // duplica ni se mueve de fecha si ya existía.
  if (nuevoEstado === 'rescatado' || nuevoEstado === 'pagado') {
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
    // Se revirtió a "pendiente": el rescate se deshace, el movimiento se elimina.
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

/**
 * Crea los movimientos del período que todavía no existen, a partir de las
 * plantillas activas. No duplica lo que ya existe. Sin revalidatePath —
 * pensado para poder llamarse tanto desde el botón manual como
 * automáticamente al renderizar /mes-actual (ver comentario ahí).
 */
export async function generarMovimientosParaPeriodo(accountId: string, periodo: string) {
  const supabase = createSupabaseServerClient();

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

  return { gastosCreados: nuevosGastos.length, ingresosCreados: nuevosIngresos.length };
}

/** Botón manual: mismo efecto, pero revalida la página (para cuando aparecen
 * plantillas nuevas después de que el mes ya se generó). */
export async function generarMovimientosDelMes() {
  const accountId = await getCurrentAccountId();
  if (!accountId) return;

  const periodo = toISODate(getInicioPeriodoActual());
  await generarMovimientosParaPeriodo(accountId, periodo);
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
    // El período se calcula a partir de la fecha de vencimiento elegida
    // (no la fecha de hoy), así un extra cargado para dentro de 3 meses
    // queda ubicado en el período que le corresponde — esto es lo que
    // permite que aparezca en la previsión del período futuro correcto.
    periodo: toISODate(getInicioPeriodoActual(new Date(`${fecha_vencimiento}T00:00:00Z`))),
    dia: diaDeFecha(fecha_vencimiento),
    monto,
    payment_method_id,
    category_id,
    fecha_vencimiento,
    estado: 'pendiente',
  });
  revalidatePath('/extras');
  revalidatePath('/previsiones');
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
    periodo: toISODate(getInicioPeriodoActual(new Date(`${fecha_aplicacion}T00:00:00Z`))),
    dia: diaDeFecha(fecha_aplicacion),
    monto,
    fecha_aplicacion,
    estado: 'pendiente',
  });
  revalidatePath('/extras');
  revalidatePath('/previsiones');
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

/**
 * Edición completa de un gasto extra: monto, fecha de vencimiento y método
 * de pago. Al cambiar la fecha se recalcula el período, para que el extra
 * quede en el ciclo 27-26 que le corresponde y las previsiones lo ubiquen
 * bien.
 */
export async function updateExpenseExtra(formData: FormData) {
  const id = String(formData.get('id'));
  const monto = Number(formData.get('monto')) || 0;
  const fecha_vencimiento = String(formData.get('fecha_vencimiento') ?? '');
  const payment_method_id = String(formData.get('payment_method_id') || '') || null;
  if (!fecha_vencimiento) return;

  const supabase = createSupabaseServerClient();
  await supabase
    .from('expense_entries')
    .update({
      monto,
      fecha_vencimiento,
      payment_method_id,
      periodo: toISODate(getInicioPeriodoActual(new Date(`${fecha_vencimiento}T00:00:00Z`))),
      dia: diaDeFecha(fecha_vencimiento),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('estado', 'pendiente');

  revalidatePath('/extras');
  revalidatePath('/previsiones');
}

export async function updateIncomeExtra(formData: FormData) {
  const id = String(formData.get('id'));
  const monto = Number(formData.get('monto')) || 0;
  const fecha_aplicacion = String(formData.get('fecha_aplicacion') ?? '');
  if (!fecha_aplicacion) return;

  const supabase = createSupabaseServerClient();
  await supabase
    .from('income_entries')
    .update({
      monto,
      fecha_aplicacion,
      periodo: toISODate(getInicioPeriodoActual(new Date(`${fecha_aplicacion}T00:00:00Z`))),
      dia: diaDeFecha(fecha_aplicacion),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('estado', 'pendiente');

  revalidatePath('/extras');
  revalidatePath('/previsiones');
}

/**
 * Cambio masivo del día de pago dentro del período vigente: mueve todos los
 * gastos PENDIENTES de un método de pago que caen en `dia_actual` hacia
 * `dia_nuevo`. No toca los ya rescatados ni pagados (esos ya afectaron el
 * fondo) ni la plantilla de origen.
 */
export async function cambiarDiaMasivo(formData: FormData) {
  const accountId = await getCurrentAccountId();
  if (!accountId) return;

  const payment_method_id = String(formData.get('payment_method_id') || '');
  const diaActual = Number(formData.get('dia_actual'));
  const diaNuevo = Number(formData.get('dia_nuevo'));

  if (!payment_method_id || !diaActual || !diaNuevo) return;
  if (diaNuevo < 1 || diaNuevo > 31) return;

  const supabase = createSupabaseServerClient();
  const periodo = toISODate(getInicioPeriodoActual());

  const { error } = await supabase
    .from('expense_entries')
    .update({ dia: diaNuevo, updated_at: new Date().toISOString() })
    .eq('account_id', accountId)
    .eq('periodo', periodo)
    .eq('payment_method_id', payment_method_id)
    .eq('dia', diaActual)
    .eq('estado', 'pendiente');

  if (error) throw new Error(error.message);

  // 'layout' fuerza a revalidar la página entera, no solo el segmento:
  // así la grilla se redibuja con los días nuevos.
  revalidatePath('/mes-actual', 'layout');
  revalidatePath('/');
}

// ------------------------------ Eliminar movimientos del mes ------------------------------

/**
 * Borra un movimiento generado (regular o extra), solo si sigue en estado
 * "pendiente" — así nunca se borra algo que ya afectó el fondo. NO toca la
 * plantilla de la que se generó (son filas independientes).
 */
export async function deleteExpenseEntry(formData: FormData) {
  const id = String(formData.get('id'));
  const path = String(formData.get('_path') || '/mes-actual');
  const supabase = createSupabaseServerClient();
  await supabase.from('expense_entries').delete().eq('id', id).eq('estado', 'pendiente');
  revalidatePath(path);
}

export async function deleteIncomeEntry(formData: FormData) {
  const id = String(formData.get('id'));
  const path = String(formData.get('_path') || '/mes-actual');
  const supabase = createSupabaseServerClient();
  await supabase.from('income_entries').delete().eq('id', id).eq('estado', 'pendiente');
  revalidatePath(path);
}
