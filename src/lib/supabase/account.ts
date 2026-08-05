import { createSupabaseServerClient } from './server';

/**
 * Devuelve el account_id de la cuenta familiar del usuario autenticado.
 * Se usa en todas las páginas/acciones que necesitan filtrar por cuenta.
 */
export async function getCurrentAccountId(): Promise<string | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from('account_users')
    .select('account_id')
    .eq('auth_user_id', user.id)
    .limit(1)
    .maybeSingle();

  return data?.account_id ?? null;
}
