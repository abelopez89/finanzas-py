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
 * usuario autenticado.
 */
export async function linkAdditionalEmail(
  supabase: SupabaseClient,
  email: string,
  nombre?: string
) {
  const { error } = await supabase.rpc('link_email_to_my_account', {
    p_email: email,
    p_nombre: nombre ?? null,
  });
  if (error) throw error;
}

/**
 * Registra en la cuenta familiar TODOS los correos de las identidades
 * vinculadas al usuario autenticado.
 *
 * Hace falta porque `linkIdentity` suma la identidad al mismo usuario de
 * Supabase, pero `user.email` sigue siendo el correo principal: el segundo
 * Gmail solo aparece dentro de `user.identities`. Sin recorrerlas, el
 * correo nuevo nunca quedaría registrado.
 */
export async function syncIdentidadesDelUsuario(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const correos = new Set<string>();
  if (user.email) correos.add(user.email);
  for (const identidad of user.identities ?? []) {
    const email = (identidad.identity_data as { email?: string } | null)?.email;
    if (email) correos.add(email);
  }

  for (const email of correos) {
    await linkAdditionalEmail(supabase, email);
  }
}
