'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Vincula otro Gmail al MISMO usuario de Supabase, de modo que ambos
 * correos entren a la misma cuenta familiar y vean el mismo fondo.
 * Es distinto de crear un usuario nuevo: acá se suma una identidad.
 */
export default function VincularCorreoButton() {
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function vincular() {
    setError(null);
    setCargando(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/api/auth/callback?link=1` },
      });
      if (error) throw error;
      // Si sale bien, el navegador se va a Google; no vuelve por acá.
    } catch (err) {
      const detalle = err instanceof Error ? err.message : String(err);
      setError(
        detalle.toLowerCase().includes('manual linking')
          ? 'Supabase tiene deshabilitada la vinculación manual de identidades. Activala en Authentication → Sign In / Providers → "Allow manual linking" y volvé a intentar.'
          : detalle
      );
      setCargando(false);
    }
  }

  return (
    <div>
      <button onClick={vincular} disabled={cargando} className="btn-primary w-full sm:w-auto">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
          <path
            fill="currentColor"
            d="M21.35 11.1h-9.17v2.96h5.27c-.23 1.37-1.63 4.02-5.27 4.02-3.17 0-5.76-2.63-5.76-5.87s2.59-5.87 5.76-5.87c1.8 0 3.01.77 3.7 1.43l2.52-2.43C16.78 3.79 14.66 2.9 12.18 2.9 7.13 2.9 3.05 6.98 3.05 12s4.08 9.1 9.13 9.1c5.27 0 8.76-3.7 8.76-8.92 0-.6-.06-1.06-.15-1.5z"
          />
        </svg>
        {cargando ? 'Redirigiendo a Google…' : 'Vincular otro correo de Google'}
      </button>

      {error && (
        <p className="mt-3 rounded-lg bg-brick-50 px-3.5 py-3 text-sm text-brick-700 ring-1 ring-inset ring-brick-100">
          {error}
        </p>
      )}
    </div>
  );
}
