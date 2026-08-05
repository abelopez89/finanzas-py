import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Se ejecuta después de un login exitoso.
 * Si el usuario autenticado (por su auth_user_id) todavía no pertenece
 * a ninguna cuenta familiar, crea una nueva. Si ya pertenece, no hace nada.
 * Esto es lo que permite que, más adelante, un segundo correo se vincule
 * a la MISMA cuenta usando linkIdentity() en vez de crear una cuenta nueva.
 */
export async function ensureAccountForUser(
  supabase: SupabaseClient,
  userId: string,
  email: string
) {
  const { data: existing } = await supabase
    .from('account_users')
    .select('account_id')
    .eq('auth_user_id', userId)
    .limit(1)
    .maybeSingle();

  if (existing) return existing.account_id;

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .insert({ nombre: 'Familia' })
    .select('id')
    .single();

  if (accountError || !account) {
    throw accountError ?? new Error('No se pudo crear la cuenta familiar');
  }

  const { error: linkError } = await supabase.from('account_users').insert({
    account_id: account.id,
    auth_user_id: userId,
    email,
    is_owner: true,
  });

  if (linkError) throw linkError;

  return account.id;
}

/**
 * Vincula un correo Gmail ADICIONAL a la cuenta familiar existente.
 * Se usa después de supabase.auth.linkIdentity() para que el segundo
 * correo quede asociado a la misma cuenta (mismo fondo mutuo).
 */
export async function linkAdditionalEmail(
  supabase: SupabaseClient,
  accountId: string,
  userId: string,
  email: string,
  nombre?: string
) {
  const { error } = await supabase.from('account_users').upsert(
    { account_id: accountId, auth_user_id: userId, email, nombre },
    { onConflict: 'account_id,email' }
  );
  if (error) throw error;
}
