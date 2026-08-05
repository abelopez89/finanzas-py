import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { revalidatePath } from 'next/cache';

async function addCategory(formData: FormData) {
  'use server';
  const accountId = await getCurrentAccountId();
  if (!accountId) return;

  const nombre = String(formData.get('nombre') ?? '').trim();
  if (!nombre) return;

  const supabase = createSupabaseServerClient();
  await supabase.from('categories').insert({ account_id: accountId, nombre });
  revalidatePath('/configuracion/categorias');
}

async function toggleCategory(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const activo = formData.get('activo') === 'true';

  const supabase = createSupabaseServerClient();
  await supabase.from('categories').update({ activo: !activo }).eq('id', id);
  revalidatePath('/configuracion/categorias');
}

export default async function CategoriasPage() {
  const accountId = await getCurrentAccountId();
  const supabase = createSupabaseServerClient();

  const { data: categorias } = accountId
    ? await supabase
        .from('categories')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at')
    : { data: [] };

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Categorías</h1>

      <form action={addCategory} className="mb-6 flex gap-2">
        <input
          name="nombre"
          placeholder="Ej: Supermercado, Colegio, Salud"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          required
        />
        <button className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
          Agregar
        </button>
      </form>

      <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
        {(categorias ?? []).map((c) => (
          <li key={c.id} className="flex items-center justify-between px-4 py-3">
            <span className={c.activo ? '' : 'text-gray-400 line-through'}>{c.nombre}</span>
            <form action={toggleCategory}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="activo" value={String(c.activo)} />
              <button className="text-xs text-brand-600 hover:underline">
                {c.activo ? 'Desactivar' : 'Activar'}
              </button>
            </form>
          </li>
        ))}
        {(categorias ?? []).length === 0 && (
          <li className="px-4 py-3 text-sm text-gray-400">Todavía no hay categorías cargadas.</li>
        )}
      </ul>
    </div>
  );
}
