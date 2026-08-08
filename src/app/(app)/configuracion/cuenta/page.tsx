import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import VincularCorreoButton from '@/components/VincularCorreoButton';
import { Aviso, EmptyState } from '@/components/ui/Layout';

export default async function CuentaPage({
  searchParams,
}: {
  searchParams: { error?: string; vinculado?: string };
}) {
  const accountId = await getCurrentAccountId();
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: correos } = accountId
    ? await supabase
        .from('account_users')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at')
    : { data: [] };

  return (
    <div>
      <p className="mb-5 max-w-2xl text-sm text-ink-500">
        Los correos vinculados entran a la misma cuenta familiar y ven el mismo fondo, los mismos
        gastos y las mismas plantillas. No son cuentas separadas: es la misma cuenta con dos puertas
        de entrada.
      </p>

      {searchParams.vinculado && (
        <div className="mb-5">
          <Aviso>Correo vinculado. Ya podés entrar con cualquiera de los dos.</Aviso>
        </div>
      )}
      {searchParams.error && (
        <div className="mb-5">
          <Aviso tono="error">{searchParams.error}</Aviso>
        </div>
      )}

      <ul className="card mb-5 divide-y divide-line overflow-hidden">
        {(correos ?? []).map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-ink">{c.email}</p>
              <p className="mt-0.5 text-xs text-ink-400">
                {c.is_owner ? 'Creó la cuenta' : 'Vinculado'}
                {user?.email === c.email && ' · sesión actual'}
              </p>
            </div>
          </li>
        ))}
        {(correos ?? []).length === 0 && <EmptyState mensaje="No hay correos registrados." />}
      </ul>

      <VincularCorreoButton />

      <div className="mt-6 space-y-2 text-xs text-ink-400">
        <p>
          <strong className="font-medium text-ink-500">Cómo funciona:</strong> al vincular, Google te
          va a pedir que elijas la cuenta. Elegí el <em>otro</em> correo, no el que ya estás usando.
          Después volvés acá y aparece en la lista.
        </p>
        <p>
          Si Supabase rechaza la vinculación, hay que activar la opción en el panel: Authentication →
          Sign In / Providers → &quot;Allow manual linking&quot;.
        </p>
      </div>
    </div>
  );
}
