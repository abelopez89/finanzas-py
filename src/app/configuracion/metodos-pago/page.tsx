import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { revalidatePath } from 'next/cache';

async function addPaymentMethod(formData: FormData) {
  'use server';
  const accountId = await getCurrentAccountId();
  if (!accountId) return;

  const nombre = String(formData.get('nombre') ?? '').trim();
  if (!nombre) return;

  const supabase = createSupabaseServerClient();
  await supabase.from('payment_methods').insert({ account_id: accountId, nombre });
  revalidatePath('/configuracion/metodos-pago');
}

async function togglePaymentMethod(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const activo = formData.get('activo') === 'true';

  const supabase = createSupabaseServerClient();
  await supabase.from('payment_methods').update({ activo: !activo }).eq('id', id);
  revalidatePath('/configuracion/metodos-pago');
}

export default async function MetodosPagoPage() {
  const accountId = await getCurrentAccountId();
  const supabase = createSupabaseServerClient();

  const { data: metodos } = accountId
    ? await supabase
        .from('payment_methods')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at')
    : { data: [] };

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Métodos de pago</h1>

      <form action={addPaymentMethod} className="mb-6 flex gap-2">
        <input
          name="nombre"
          placeholder="Ej: Tarjeta familiar, Efectivo, Transferencia"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          required
        />
        <button className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
          Agregar
        </button>
      </form>

      <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
        {(metodos ?? []).map((m) => (
          <li key={m.id} className="flex items-center justify-between px-4 py-3">
            <span className={m.activo ? '' : 'text-gray-400 line-through'}>{m.nombre}</span>
            <form action={togglePaymentMethod}>
              <input type="hidden" name="id" value={m.id} />
              <input type="hidden" name="activo" value={String(m.activo)} />
              <button className="text-xs text-brand-600 hover:underline">
                {m.activo ? 'Desactivar' : 'Activar'}
              </button>
            </form>
          </li>
        ))}
        {(metodos ?? []).length === 0 && (
          <li className="px-4 py-3 text-sm text-gray-400">Todavía no hay métodos de pago cargados.</li>
        )}
      </ul>
    </div>
  );
}
