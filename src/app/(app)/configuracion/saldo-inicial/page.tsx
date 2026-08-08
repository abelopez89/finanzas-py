import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { revalidatePath } from 'next/cache';
import MontoInput from '@/components/MontoInput';

async function setSaldoInicial(formData: FormData) {
  'use server';
  const accountId = await getCurrentAccountId();
  if (!accountId) throw new Error('No se encontró la cuenta del usuario');

  const monto = Number(formData.get('monto'));
  const fecha = String(formData.get('fecha') ?? '');
  if (!monto || !fecha) return;

  const supabase = createSupabaseServerClient();

  const { data: existente } = await supabase
    .from('fund_initial_balance')
    .select('id')
    .eq('account_id', accountId)
    .maybeSingle();
  if (existente) return; // ya se cargó una vez, no se puede volver a cargar

  const { data: inserted, error } = await supabase
    .from('fund_initial_balance')
    .insert({ account_id: accountId, monto, fecha })
    .select('id')
    .single();
  if (error) throw error;

  await supabase.from('fund_movements').insert({
    account_id: accountId,
    tipo: 'saldo_inicial',
    monto,
    fecha,
    referencia_tipo: 'fund_initial_balance',
    referencia_id: inserted.id,
    descripcion: 'Saldo inicial',
  });

  revalidatePath('/configuracion/saldo-inicial');
  revalidatePath('/fondo');
}

async function updateSaldoInicial(formData: FormData) {
  'use server';
  const accountId = await getCurrentAccountId();
  if (!accountId) throw new Error('No se encontró la cuenta del usuario');

  const monto = Number(formData.get('monto'));
  const fecha = String(formData.get('fecha') ?? '');
  if (!monto || !fecha) return;

  const supabase = createSupabaseServerClient();

  const { data: existente } = await supabase
    .from('fund_initial_balance')
    .select('id')
    .eq('account_id', accountId)
    .maybeSingle();
  if (!existente) return;

  const { error } = await supabase
    .from('fund_initial_balance')
    .update({ monto, fecha })
    .eq('id', existente.id);
  if (error) throw error;

  // El movimiento del libro mayor que representa el saldo inicial se
  // actualiza junto con él, para que el saldo del fondo siga siendo consistente.
  await supabase
    .from('fund_movements')
    .update({ monto, fecha })
    .eq('referencia_tipo', 'fund_initial_balance')
    .eq('referencia_id', existente.id);

  revalidatePath('/configuracion/saldo-inicial');
  revalidatePath('/fondo');
}

export default async function SaldoInicialPage() {
  const accountId = await getCurrentAccountId();
  const supabase = createSupabaseServerClient();

  const { data: saldoInicial } = accountId
    ? await supabase.from('fund_initial_balance').select('*').eq('account_id', accountId).maybeSingle()
    : { data: null };

  return (
    <div>
      {saldoInicial ? (
        <>
          <p className="mb-2 text-sm text-gray-500">
            Se cargó una vez para arrancar con el saldo correcto. Podés corregirlo acá si hace falta.
          </p>
          <form action={updateSaldoInicial} className="flex gap-2">
            <MontoInput
              name="monto"
              defaultValue={saldoInicial.monto}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              required
            />
            <input
              name="fecha"
              type="date"
              defaultValue={saldoInicial.fecha}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              required
            />
            <button className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
              Guardar cambios
            </button>
          </form>
        </>
      ) : (
        <>
          <p className="mb-2 text-sm text-gray-500">
            Se carga una única vez, para arrancar con el saldo correcto del fondo.
          </p>
          <form action={setSaldoInicial} className="flex gap-2">
            <MontoInput
              name="monto"
              placeholder="Monto ₲"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              required
            />
            <input
              name="fecha"
              type="date"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              required
            />
            <button className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
              Guardar saldo inicial
            </button>
          </form>
        </>
      )}
    </div>
  );
}
