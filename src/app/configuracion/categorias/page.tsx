import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { revalidatePath } from 'next/cache';

async function addCategory(formData: FormData) {
  'use server';
  const accountId = await getCurrentAccountId();
  if (!accountId) throw new Error('No se encontró la cuenta del usuario (¿sesión vencida?)');

  const nombre = String(formData.get('nombre') ?? '').trim();
  if (!nombre) return;

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from('categories').insert({ account_id: accountId, nombre });
  if (error) {
    console.error('Error al agregar categoría:', error);
    throw new Error(error.message);
  }
  revalidatePath('/configuracion/categorias');
}

async function toggleCategory(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const activo = formData.get('activo') === 'true';

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from('categories').update({ activo: !activo }).eq('id', id);
  if (error) {
    console.error('Error al actualizar categoría:', error);
    throw new Error(error.message);
  }
  revalidatePath('/configuracion/categorias');
}

export default async function CategoriasPage() {
  const accountId = await getCurrentAccountId();
  const supabase = createSupabaseServerClient();

  const { data: categorias, error } = accountId
    ? await supabase
        .from('categories')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at')
    : { data: [], error: null };

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Categorías</h1>

      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          Error al leer categorías: {error.message}. Revisá que el esquema{' '}
          <code>finanzas_py</code> esté expuesto en Supabase (Project Settings → API → Exposed schemas).
        </p>
      )}
      {!accountId && (
        <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          No se encontró una cuenta vinculada a tu sesión. Probá cerrar sesión y volver a entrar.
        </p>
      )}

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
