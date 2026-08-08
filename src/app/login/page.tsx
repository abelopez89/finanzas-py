'use client';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  async function handleLogin() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-5">
      <div className="w-full max-w-sm">
        {/* Marca: la misma cifra grande que domina la app, en vacío */}
        <div className="mb-10 text-center">
          <p className="font-mono text-[52px] font-semibold leading-none text-ink-300">₲</p>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-ink">
            finanzas<span className="text-pine-600">·py</span>
          </h1>
          <p className="mt-2 text-sm text-ink-500">Control del fondo mutuo familiar</p>
        </div>

        {searchParams.error && (
          <div className="mb-4 rounded-lg bg-brick-50 px-3.5 py-3 text-sm text-brick-700 ring-1 ring-inset ring-brick-100">
            {searchParams.error}
          </div>
        )}

        <button onClick={handleLogin} className="btn-primary w-full">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
            <path
              fill="currentColor"
              d="M21.35 11.1h-9.17v2.96h5.27c-.23 1.37-1.63 4.02-5.27 4.02-3.17 0-5.76-2.63-5.76-5.87s2.59-5.87 5.76-5.87c1.8 0 3.01.77 3.7 1.43l2.52-2.43C16.78 3.79 14.66 2.9 12.18 2.9 7.13 2.9 3.05 6.98 3.05 12s4.08 9.1 9.13 9.1c5.27 0 8.76-3.7 8.76-8.92 0-.6-.06-1.06-.15-1.5z"
            />
          </svg>
          Entrar con Google
        </button>

        <p className="mt-6 text-center text-xs leading-relaxed text-ink-400">
          Podés vincular un segundo correo a la misma cuenta familiar desde Configuración.
        </p>
      </div>
    </div>
  );
}
