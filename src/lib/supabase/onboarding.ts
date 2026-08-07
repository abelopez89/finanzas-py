import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Se ejecuta después de un login exitoso. Crea la cuenta familiar del
 * usuario si todavía no tiene una (o devuelve la existente).
 *
 * Usa una función de base de datos (SECURITY DEFINER) en vez de inserts
 * directos: al insertar la primera fila de un usuario nuevo con
 * `.select().single()`, Postgres exige que esa fila también cumpla la
 * política de SELECT antes de poder devolverla — pero en el primer login
 * todavía no existe nada que la satisfaga (problema de huevo y gallina).
 * La función de base de datos evita ese problema por completo.
 */
export async function ensureAccountForUser(
  supabase: SupabaseClient,
  userId: string,
  email: string
) {
  const { data, error } = await supabase.rpc('create_account_for_user', {
    p_email: email,
  });

  if (error) throw error;
  return data as string;
}

/**
 * Vincula un correo Gmail ADICIONAL a la cuenta familiar existente del
 * usuario autenticado (mismo mecanismo, misma razón).
 */
export async function linkAdditionalEmail(
  supabase: SupabaseClient,
  userId: string,
  email: string,
  nombre?: string
) {
  const { error } = await supabase.rpc('link_email_to_my_account', {
    p_email: email,
    p_nombre: nombre ?? null,
  });
  if (error) throw error;
}
