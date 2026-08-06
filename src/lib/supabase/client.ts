import { createBrowserClient } from '@supabase/ssr';

// Cliente de Supabase para usar en componentes de cliente ("use client").
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // El proyecto de Supabase es compartido con otras apps (vacamanager,
      // irp-py). Todas las tablas de esta app viven en su propio esquema
      // para no interferir con las demás.
      db: { schema: 'finanzas_py' },
    }
  );
}
