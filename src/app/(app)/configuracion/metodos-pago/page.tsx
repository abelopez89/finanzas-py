import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { revalidatePath } from 'next/cache';
import ConfigListaSimple from '@/components/ConfigListaSimple';

async function addPaymentMethod(formData: FormData) {
  'use server';
  const accountId = await getCurrentAccountId();
  if (!accountId) throw new Error('No se encontró la cuenta del usuario');

  const nombre = String(formData.get('nombre') ?? '').trim();
  if (!nombre) return;

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from('payment_methods').insert({ account_id: accountId, nombre });
  if (error) throw new Error(error.message);
  revalidatePath('/configuracion/metodos-pago');
}

async function togglePaymentMethod(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const activo = formData.get('activo') === 'true';

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from('payment_methods').update({ activo: !activo }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/configuracion/metodos-pago');
}

export default async function MetodosPagoPage() {
  const accountId = await getCurrentAccountId();
  const supabase = createSupabaseServerClient();

  const { data, error } = accountId
    ? await supabase
        .from('payment_methods')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at')
    : { data: [], error: null };

  return (
    <ConfigListaSimple
      items={data ?? []}
      error={error?.message}
      sinCuenta={!accountId}
      placeholder="Ej: Tarjeta familiar, Efectivo, Transferencia"
      vacio="Todavía no cargaste métodos de pago."
      onAdd={addPaymentMethod}
      onToggle={togglePaymentMethod}
    />
  );
}
