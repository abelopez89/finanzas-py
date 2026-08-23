import { cache } from 'react';
import { createSupabaseServerClient } from './server';

/**
 * Usuario autenticado, memoizado por request.
 *
 * `supabase.auth.getUser()` es una llamada de red al servidor de Supabase.
 * Antes se llamaba una vez en el layout y otra en cada página (vía
 * getCurrentAccountId), o sea 2-3 viajes por navegación. `cache()` de React
 * hace que, dentro de un mismo request, todos compartan el primer resultado.
 */
export const getAuthUser = cache(async () => {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Devuelve el account_id de la cuenta familiar del usuario autenticado.
 * Se usa en todas las páginas/acciones que necesitan filtrar por cuenta.
 *
 * También memoizado: si una página lo pide y además lo pide una función
 * auxiliar en el mismo request, se paga una sola consulta.
 */
export const getCurrentAccountId = cache(async (): Promise<string | null> => {
  const user = await getAuthUser();
  if (!user) return null;

  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('account_users')
    .select('account_id')
    .eq('auth_user_id', user.id)
    .limit(1)
    .maybeSingle();

  return data?.account_id ?? null;
});
