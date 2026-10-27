'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getAuthUser, getCurrentAccountId } from '@/lib/supabase/account';
import { getInicioPeriodoActual, toISODate } from '@/lib/period';

/**
 * Descuentos de salario. A propósito ninguna de estas acciones toca
 * fund_movements ni income_entries: el módulo es solo de registro y
 * recordatorio, y no debe mover el saldo del fondo, las previsiones ni el
 * extracto mensual (ver src/lib/salario.ts). Por eso solo revalidan
 * /salario y el dashboard (por el panel de pendientes), no /fondo.
 */
function revalidarSalario() {
  revalidatePath('/salario');
  revalidatePath('/');
}

function entero(formData: FormData, campo: string, porDefecto: number): number {
  const crudo = String(formData.get(campo) ?? '').trim();
  const n = Math.trunc(Number(crudo));
  return crudo !== '' && Number.isFinite(n) ? n : porDefecto;
}

function enteroONull(formData: FormData, campo: string): number | null {
  const crudo = String(formData.get(campo) ?? '').trim();
  if (crudo === '') return null;
  const n = Math.trunc(Number(crudo));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const TIPOS = ['prestamo', 'transferencia_fondo', 'otro'];

// ------------------------------ Fuentes de salario ------------------------------

export async function addSalarySource(formData: FormData) {
  const accountId = await getCurrentAccountId();
  if (!accountId) return;

  const supabase = createSupabaseServerClient();
  await supabase.from('salary_sources').insert({
    account_id: accountId,
    nombre: String(formData.get('nombre') || '').trim() || 'Salario',
    titular_user_id: String(formData.get('titular_user_id') || '') || null,
    dia_cobro: Math.min(31, Math.max(1, entero(formData, 'dia_cobro', 1))),
    monto_bruto: Number(formData.get('monto_bruto')) || 0,
    orden: entero(formData, 'orden', 0),
  });
  revalidarSalario();
}

export async function updateSalarySource(formData: FormData) {
  const id = String(formData.get('id'));
  const supabase = createSupabaseServerClient();
  await supabase
    .from('salary_sources')
    .update({
      nombre: String(formData.get('nombre') || '').trim() || 'Salario',
      titular_user_id: String(formData.get('titular_user_id') || '') || null,
      dia_cobro: Math.min(31, Math.max(1, entero(formData, 'dia_cobro', 1))),
      monto_bruto: Number(formData.get('monto_bruto')) || 0,
      activo: formData.get('activo') === 'on',
      orden: entero(formData, 'orden', 0),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  revalidarSalario();
}

/** Borra el salario con sus conceptos y su historial (on delete cascade). */
export async function deleteSalarySource(formData: FormData) {
  const id = String(formData.get('id'));
  const supabase = createSupabaseServerClient();
  await supabase.from('salary_sources').delete().eq('id', id);
  revalidarSalario();
}

// ------------------------------ Conceptos (descuentos) ------------------------------

export async function addSalaryDeduction(formData: FormData) {
  const accountId = await getCurrentAccountId();
  if (!accountId) return;

  const tipo = String(formData.get('tipo') || 'otro');
  const supabase = createSupabaseServerClient();
  await supabase.from('salary_deductions').insert({
    account_id: accountId,
    salary_source_id: String(formData.get('salary_source_id')),
    nombre: String(formData.get('nombre') || '').trim() || 'Descuento',
    tipo: TIPOS.includes(tipo) ? tipo : 'otro',
    monto_cuota: Number(formData.get('monto_cuota')) || 0,
    // Cuotas solo tienen sentido para préstamos: en los demás tipos se
    // ignoran para que nunca "terminen" por accidente.
    cuotas_total: tipo === 'prestamo' ? enteroONull(formData, 'cuotas_total') : null,
    cuotas_pagadas_inicial:
      tipo === 'prestamo' ? Math.max(0, entero(formData, 'cuotas_pagadas_inicial', 0)) : 0,
    orden: entero(formData, 'orden', 0),
  });
  revalidarSalario();
}

export async function updateSalaryDeduction(formData: FormData) {
  const id = String(formData.get('id'));
  const tipo = String(formData.get('tipo') || 'otro');
  const supabase = createSupabaseServerClient();
  await supabase
    .from('salary_deductions')
    .update({
      nombre: String(formData.get('nombre') || '').trim() || 'Descuento',
      tipo: TIPOS.includes(tipo) ? tipo : 'otro',
      monto_cuota: Number(formData.get('monto_cuota')) || 0,
      cuotas_total: tipo === 'prestamo' ? enteroONull(formData, 'cuotas_total') : null,
      cuotas_pagadas_inicial:
        tipo === 'prestamo' ? Math.max(0, entero(formData, 'cuotas_pagadas_inicial', 0)) : 0,
      activo: formData.get('activo') === 'on',
      orden: entero(formData, 'orden', 0),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  revalidarSalario();
}

export async function deleteSalaryDeduction(formData: FormData) {
  const id = String(formData.get('id'));
  const supabase = createSupabaseServerClient();
  await supabase.from('salary_deductions').delete().eq('id', id);
  revalidarSalario();
}

// ------------------------------ Registro por período ------------------------------

function periodoDe(formData: FormData): string {
  const periodo = String(formData.get('periodo') || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(periodo) ? periodo : toISODate(getInicioPeriodoActual());
}

/**
 * Registra el período de un concepto como pagado u omitido. Un solo
 * registro por (concepto, período): si ya había uno (ej. se omitió y
 * después sí se pagó), se reemplaza. Un adelanto de cuotas se anota con
 * cuotas_cubiertas > 1 en este mismo registro — acorta el préstamo, pero
 * el mes siguiente el concepto vuelve a figurar como pendiente.
 */
async function registrar(formData: FormData, estado: 'pagado' | 'omitido') {
  const accountId = await getCurrentAccountId();
  if (!accountId) return;
  const user = await getAuthUser();

  const supabase = createSupabaseServerClient();
  await supabase.from('salary_deduction_payments').upsert(
    {
      account_id: accountId,
      salary_deduction_id: String(formData.get('id')),
      periodo: periodoDe(formData),
      monto: estado === 'pagado' ? Number(formData.get('monto')) || 0 : 0,
      cuotas_cubiertas: estado === 'pagado' ? Math.max(1, entero(formData, 'cuotas_cubiertas', 1)) : 0,
      estado,
      fecha_pago:
        estado === 'pagado' ? String(formData.get('fecha_pago') || '') || toISODate(new Date()) : null,
      created_by: user?.id ?? null,
    },
    { onConflict: 'salary_deduction_id,periodo' }
  );
  revalidarSalario();
}

export async function marcarDescuentoPagado(formData: FormData) {
  await registrar(formData, 'pagado');
}

export async function omitirDescuento(formData: FormData) {
  await registrar(formData, 'omitido');
}

/** Borra el registro del período: el concepto vuelve a quedar pendiente. */
export async function revertirDescuento(formData: FormData) {
  const supabase = createSupabaseServerClient();
  await supabase
    .from('salary_deduction_payments')
    .delete()
    .eq('salary_deduction_id', String(formData.get('id')))
    .eq('periodo', periodoDe(formData));
  revalidarSalario();
}
