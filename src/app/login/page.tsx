'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

// Evita que Next.js intente prerenderizar esta página como estática en
// build time. No es estrictamente necesario después de mover la creación
// del cliente a los handlers, pero es una red de seguridad adicional.
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  async function handleLogin() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    });
  }

  // Se usa DESPUÉS de haber iniciado sesión con el primer correo,
  // desde una pantalla de configuración de cuenta (no en este login inicial).
  async function handleLinkSecondEmail() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/api/auth/callback?link=1` },
    });
  }

  return (
    <div className="mx-auto mt-24 max-w-sm text-center">
      <h1 className="mb-2 text-2xl font-semibold text-brand-700">finanzas-py</h1>
      <p className="mb-8 text-sm text-gray-500">
        Ingresá con tu cuenta de Google para gestionar el fondo familiar.
      </p>
      <button
        onClick={handleLogin}
        className="w-full rounded-md bg-brand-600 px-4 py-2 text-white hover:bg-brand-700"
      >
        Ingresar con Google
      </button>
      <p className="mt-6 text-xs text-gray-400">
        ¿Ya tenés una cuenta y querés vincular otro correo? Hacelo desde
        Configuración una vez que iniciaste sesión.
      </p>
      {/* handleLinkSecondEmail se conecta desde la pantalla de configuración de cuenta (Etapa 2) */}
    </div>
  );
}
