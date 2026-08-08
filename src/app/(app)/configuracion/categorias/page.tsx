import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { revalidatePath } from 'next/cache';
import ConfigListaSimple from '@/components/ConfigListaSimple';

async function addCategory(formData: FormData) {
  'use server';
  const accountId = await getCurrentAccountId();
  if (!accountId) throw new Error('No se encontró la cuenta del usuario');

  const nombre = String(formData.get('nombre') ?? '').trim();
  if (!nombre) return;

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from('categories').insert({ account_id: accountId, nombre });
  if (error) throw new Error(error.message);
  revalidatePath('/configuracion/categorias');
}

async function toggleCategory(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const activo = formData.get('activo') === 'true';

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from('categories').update({ activo: !activo }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/configuracion/categorias');
}

export default async function CategoriasPage() {
  const accountId = await getCurrentAccountId();
  const supabase = createSupabaseServerClient();

  const { data, error } = accountId
    ? await supabase.from('categories').select('*').eq('account_id', accountId).order('created_at')
    : { data: [], error: null };

  return (
    <ConfigListaSimple
      items={data ?? []}
      error={error?.message}
      sinCuenta={!accountId}
      placeholder="Ej: Supermercado, Colegio, Salud"
      vacio="Todavía no cargaste categorías."
      onAdd={addCategory}
      onToggle={toggleCategory}
    />
  );
}
