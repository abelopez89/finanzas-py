import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { revalidatePath } from 'next/cache';

async function addPaymentMethod(formData: FormData) {
  'use server';
  const accountId = await getCurrentAccountId();
  if (!accountId) throw new Error('No se encontró la cuenta del usuario (¿sesión vencida?)');

  const nombre = String(formData.get('nombre') ?? '').trim();
  if (!nombre) return;

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from('payment_methods').insert({ account_id: accountId, nombre });
  if (error) {
    console.error('Error al agregar método de pago:', error);
    throw new Error(error.message);
  }
  revalidatePath('/configuracion/metodos-pago');
}

async function togglePaymentMethod(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const activo = formData.get('activo') === 'true';

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from('payment_methods').update({ activo: !activo }).eq('id', id);
  if (error) {
    console.error('Error al actualizar método de pago:', error);
    throw new Error(error.message);
  }
  revalidatePath('/configuracion/metodos-pago');
}

export default async function MetodosPagoPage() {
  const accountId = await getCurrentAccountId();
  const supabase = createSupabaseServerClient();

  const { data: metodos, error } = accountId
    ? await supabase
        .from('payment_methods')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at')
    : { data: [], error: null };

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Métodos de pago</h1>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Error al leer métodos de pago: {error.message}. Revisá que el esquema{' '}
          <code>finanzas_py</code> esté expuesto en Supabase (Project Settings → API → Exposed schemas).
        </p>
      )}
      {!accountId && (
        <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          No se encontró una cuenta vinculada a tu sesión. Probá cerrar sesión y volver a entrar.
        </p>
      )}

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
