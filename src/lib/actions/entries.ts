'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { getInicioPeriodoActual, toISODate } from '@/lib/period';
import { revalidatePath } from 'next/cache';
import { plantillasVigentes } from '@/lib/vigencias';

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

/**
 * Cambio de estado de un gasto.
 *
 * Antes esto eran 4 viajes SECUENCIALES a Supabase (select entry → update →
 * select fund_movement → insert/delete). Ahora son 2: el update devuelve la
 * fila con `.select()` y en paralelo se busca el movimiento del fondo.
 * Sobre una conexión móvil eso es la diferencia entre ~1,2s y ~0,4s.
 */
export async function cambiarEstadoGasto(formData: FormData) {
  const id = String(formData.get('id'));
  const nuevoEstado = String(formData.get('nuevo_estado'));
  const path = String(formData.get('_path') || '/mes-actual');
  const fechaElegida = String(formData.get('fecha') || '');

  const supabase = createSupabaseServerClient();

  const hoy = new Date().toISOString().slice(0, 10);
  // Si se indicó una fecha (ej: se está cargando con atraso algo que en
  // realidad pasó otro día), se usa esa. Si no, "hoy".
  const fecha = fechaElegida || hoy;

  const [{ data: entry }, { data: existente }] = await Promise.all([
    supabase
      .from('expense_entries')
      .update({
        estado: nuevoEstado,
        fecha_pago: nuevoEstado === 'pagado' ? fecha : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, account_id, monto, nombre')
      .maybeSingle(),
    supabase
      .from('fund_movements')
      .select('id')
      .eq('referencia_tipo', 'expense_entries')
      .eq('referencia_id', id)
      .maybeSingle(),
  ]);

  if (!entry) return;

  // La plata sale realmente del fondo en el RESCATE, no en el pago — "pagado"
  // solo confirma que esa plata (ya retirada) se usó. Por eso el movimiento
  // del libro mayor se crea la primera vez que el gasto llega a "rescatado"
  // O "pagado" (por si se salta directo de pendiente a pagado), y no se
  // duplica ni se mueve de fecha si ya existía.
  if (nuevoEstado === 'rescatado' || nuevoEstado === 'pagado') {
    if (!existente) {
      await supabase.from('fund_movements').insert({
        account_id: entry.account_id,
        tipo: 'egreso',
        monto: entry.monto,
        fecha,
        referencia_tipo: 'expense_entries',
        referencia_id: id,
        descripcion: entry.nombre,
      });
    }
  } else if (existente) {
    // Se revirtió a "pendiente": el rescate se deshace, el movimiento se
    // elimina. Si no había movimiento, ni siquiera se manda el DELETE.
    await supabase.from('fund_movements').delete().eq('id', existente.id);
  }

  revalidarMesActual(path);
}

export async function cambiarEstadoIngreso(formData: FormData) {
  const id = String(formData.get('id'));
  const nuevoEstado = String(formData.get('nuevo_estado'));
  const path = String(formData.get('_path') || '/mes-actual');
  const fechaElegida = String(formData.get('fecha') || '');

  const supabase = createSupabaseServerClient();
  const hoy = new Date().toISOString().slice(0, 10);
  const fecha = fechaElegida || hoy;

  const [{ data: entry }, { data: existente }] = await Promise.all([
    supabase
      .from('income_entries')
      .update({
        estado: nuevoEstado,
        fecha_aplicacion: nuevoEstado === 'confirmado' ? fecha : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, account_id, monto, nombre')
      .maybeSingle(),
    supabase
      .from('fund_movements')
      .select('id')
      .eq('referencia_tipo', 'income_entries')
      .eq('referencia_id', id)
      .maybeSingle(),
  ]);

  if (!entry) return;

  if (nuevoEstado === 'confirmado') {
    if (!existente) {
      await supabase.from('fund_movements').insert({
        account_id: entry.account_id,
        tipo: 'ingreso',
        monto: entry.monto,
        fecha,
        referencia_tipo: 'income_entries',
        referencia_id: id,
        descripcion: entry.nombre,
      });
    }
  } else if (existente) {
    await supabase.from('fund_movements').delete().eq('id', existente.id);
  }

  revalidarMesActual(path);
}

/** Un cambio de estado mueve el saldo del fondo, así que además de la
 * pantalla donde se hizo hay que invalidar el dashboard y el fondo. */
function revalidarMesActual(path: string) {
  revalidatePath(path);
  if (path !== '/') revalidatePath('/');
  revalidatePath('/fondo');
}

// ------------------------------ Generación mensual ------------------------------

/**
 * Crea los movimientos del período que todavía no existen, a partir de las
 * plantillas activas. No duplica lo que ya existe.
 *
 * Dos cosas importantes:
 *
 * 1) MARCADOR DE PERÍODO. Se llama en cada render de /mes-actual, pero un
 *    período solo hace falta generarlo una vez. Ahora se consulta primero
 *    `period_generations`: si el período ya está marcado, se sale con UNA
 *    consulta liviana en vez de las 6 que hacía antes.
 *
 * 2) OMISIONES. Si el usuario borró a mano un gasto generado desde plantilla,
 *    esa plantilla queda anotada en `entry_omisiones` para ese período y no
 *    se vuelve a generar. Sin esto, el borrado "no funcionaba": el próximo
 *    render lo recreaba al instante.
 */
export async function generarMovimientosParaPeriodo(
  accountId: string,
  periodo: string,
  opciones: { forzar?: boolean } = {}
) {
  const supabase = createSupabaseServerClient();

  if (!opciones.forzar) {
    const { data: marca } = await supabase
      .from('period_generations')
      .select('periodo')
      .eq('account_id', accountId)
      .eq('periodo', periodo)
      .maybeSingle();
    if (marca) return { gastosCreados: 0, ingresosCreados: 0, salteado: true };
  }

  // Las 6 consultas van juntas (antes eran dos tandas secuenciales).
  const [
    { data: plantillasGasto },
    { data: existentesGasto },
    { data: vigenciasGasto },
    { data: plantillasIngreso },
    { data: existentesIngreso },
    { data: vigenciasIngreso },
    { data: omisiones },
  ] = await Promise.all([
    // Se traen TODAS las plantillas (no solo activo=true): una regla de
    // vigencia puede reactivar una plantilla que está apagada por defecto.
    supabase.from('expense_templates').select('*').eq('account_id', accountId),
    supabase
      .from('expense_entries')
      .select('template_id')
      .eq('account_id', accountId)
      .eq('periodo', periodo),
    supabase.from('expense_template_vigencias').select('*').eq('account_id', accountId),
    supabase.from('income_templates').select('*').eq('account_id', accountId),
    supabase
      .from('income_entries')
      .select('template_id')
      .eq('account_id', accountId)
      .eq('periodo', periodo),
    supabase.from('income_template_vigencias').select('*').eq('account_id', accountId),
    supabase
      .from('entry_omisiones')
      .select('tipo, template_id')
      .eq('account_id', accountId)
      .eq('periodo', periodo),
  ]);

  const omitidosGasto = new Set(
    (omisiones ?? []).filter((o) => o.tipo === 'gasto').map((o) => o.template_id)
  );
  const omitidosIngreso = new Set(
    (omisiones ?? []).filter((o) => o.tipo === 'ingreso').map((o) => o.template_id)
  );

  const yaCreadosGasto = new Set((existentesGasto ?? []).map((e) => e.template_id));

  const nuevosGastos = plantillasVigentes(plantillasGasto ?? [], vigenciasGasto ?? [], periodo)
    .filter((t) => !yaCreadosGasto.has(t.id) && !omitidosGasto.has(t.id))
    .map((t) => ({
      account_id: accountId,
      template_id: t.id,
      es_extra: false,
      nombre: t.nombre,
      periodo,
      dia: t.dia_mes,
      monto: t.montoVigente,
      payment_method_id: t.payment_method_id,
      category_id: t.category_id,
      estado: 'pendiente',
    }));

  const yaCreadosIngreso = new Set((existentesIngreso ?? []).map((e) => e.template_id));

  const nuevosIngresos = plantillasVigentes(plantillasIngreso ?? [], vigenciasIngreso ?? [], periodo)
    .filter((t) => !yaCreadosIngreso.has(t.id) && !omitidosIngreso.has(t.id))
    .map((t) => ({
      account_id: accountId,
      template_id: t.id,
      es_extra: false,
      nombre: t.nombre,
      periodo,
      dia: t.dia_mes,
      monto: t.montoVigente,
      estado: 'pendiente',
    }));

  await Promise.all([
    nuevosGastos.length
      ? supabase.from('expense_entries').insert(nuevosGastos)
      : Promise.resolve(null),
    nuevosIngresos.length
      ? supabase.from('income_entries').insert(nuevosIngresos)
      : Promise.resolve(null),
    // Se marca el período como generado para que las próximas visitas
    // salteen todo este bloque.
    supabase
      .from('period_generations')
      .upsert({ account_id: accountId, periodo }, { onConflict: 'account_id,periodo' }),
  ]);

  return { gastosCreados: nuevosGastos.length, ingresosCreados: nuevosIngresos.length };
}

/** Botón manual: fuerza la pasada completa aunque el período ya esté
 * marcado (para cuando aparecen plantillas nuevas después). Respeta las
 * omisiones: lo que se borró a mano sigue borrado. */
export async function generarMovimientosDelMes() {
  const accountId = await getCurrentAccountId();
  if (!accountId) return;

  const periodo = toISODate(getInicioPeriodoActual());
  await generarMovimientosParaPeriodo(accountId, periodo, { forzar: true });
  revalidatePath('/mes-actual');
}

/** Deshace todas las omisiones del período vigente y vuelve a generar:
 * trae de vuelta los movimientos regulares que se habían borrado. */
export async function restaurarEliminadosDelMes() {
  const accountId = await getCurrentAccountId();
  if (!accountId) return;

  const periodo = toISODate(getInicioPeriodoActual());
  const supabase = createSupabaseServerClient();

  await supabase
    .from('entry_omisiones')
    .delete()
    .eq('account_id', accountId)
    .eq('periodo', periodo);

  await generarMovimientosParaPeriodo(accountId, periodo, { forzar: true });
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
  revalidatePath('/previsiones');
}

export async function deleteIncomeExtra(formData: FormData) {
  const id = String(formData.get('id'));
  const supabase = createSupabaseServerClient();
  await supabase.from('income_entries').delete().eq('id', id).eq('estado', 'pendiente');
  revalidatePath('/extras');
  revalidatePath('/previsiones');
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
 *
 * FIX: si el movimiento venía de una plantilla, además se anota la omisión.
 * /mes-actual regenera desde plantillas en cada render, así que sin esta
 * anotación el gasto borrado reaparecía enseguida y el borrado parecía no
 * funcionar. El DELETE devuelve la fila con `.select()`, o sea que sigue
 * siendo un solo viaje para borrar + averiguar de qué plantilla venía.
 */
export async function deleteExpenseEntry(formData: FormData) {
  const id = String(formData.get('id'));
  const path = String(formData.get('_path') || '/mes-actual');
  const supabase = createSupabaseServerClient();

  const { data: borrado } = await supabase
    .from('expense_entries')
    .delete()
    .eq('id', id)
    .eq('estado', 'pendiente')
    .select('account_id, template_id, periodo')
    .maybeSingle();

  if (borrado?.template_id) {
    await supabase.from('entry_omisiones').upsert(
      {
        account_id: borrado.account_id,
        tipo: 'gasto',
        template_id: borrado.template_id,
        periodo: borrado.periodo,
      },
      { onConflict: 'account_id,tipo,template_id,periodo' }
    );
  }

  revalidatePath(path);
  revalidatePath('/previsiones');
}

export async function deleteIncomeEntry(formData: FormData) {
  const id = String(formData.get('id'));
  const path = String(formData.get('_path') || '/mes-actual');
  const supabase = createSupabaseServerClient();

  const { data: borrado } = await supabase
    .from('income_entries')
    .delete()
    .eq('id', id)
    .eq('estado', 'pendiente')
    .select('account_id, template_id, periodo')
    .maybeSingle();

  if (borrado?.template_id) {
    await supabase.from('entry_omisiones').upsert(
      {
        account_id: borrado.account_id,
        tipo: 'ingreso',
        template_id: borrado.template_id,
        periodo: borrado.periodo,
      },
      { onConflict: 'account_id,tipo,template_id,periodo' }
    );
  }

  revalidatePath(path);
  revalidatePath('/previsiones');
}
