import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { revalidatePath } from 'next/cache';
import { Aviso, EmptyState } from '@/components/ui/Layout';
import FormularioAlta from '@/components/ui/FormularioAlta';

async function invitarCorreo(formData: FormData) {
  'use server';
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const nombre = String(formData.get('nombre') ?? '').trim() || null;
  if (!email) return;

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc('invitar_correo', { p_email: email, p_nombre: nombre });
  if (error) throw new Error(error.message);

  revalidatePath('/configuracion/cuenta');
}

async function quitarCorreo(formData: FormData) {
  'use server';
  const email = String(formData.get('email') ?? '');
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc('quitar_correo', { p_email: email });
  if (error) throw new Error(error.message);

  revalidatePath('/configuracion/cuenta');
}

export default async function CuentaPage() {
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
        Los correos habilitados entran a la misma cuenta familiar y ven el mismo fondo, los mismos
        gastos y las mismas plantillas. Agregá el correo acá y, cuando esa persona entre con Google,
        va a caer directamente en esta cuenta.
      </p>

      <ul className="card mb-5 divide-y divide-line overflow-hidden">
        {(correos ?? []).map((c) => {
          const esSesionActual = user?.email?.toLowerCase() === c.email?.toLowerCase();
          const pendiente = !c.auth_user_id;
          return (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-ink">{c.email}</p>
                <p className="mt-0.5 text-xs text-ink-400">
                  {c.is_owner ? 'Creó la cuenta' : pendiente ? 'Habilitado, todavía no entró' : 'Activo'}
                  {esSesionActual && ' · sesión actual'}
                </p>
              </div>
              {!c.is_owner && !esSesionActual && (
                <form action={quitarCorreo}>
                  <input type="hidden" name="email" value={c.email} />
                  <button className="btn-row text-ink-400 hover:bg-brick-50 hover:text-brick-600">
                    Quitar
                  </button>
                </form>
              )}
            </li>
          );
        })}
        {(correos ?? []).length === 0 && <EmptyState mensaje="No hay correos registrados." />}
      </ul>

      <FormularioAlta
        action={invitarCorreo}
        className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]"
      >
        <input
          name="email"
          type="email"
          placeholder="correo@gmail.com"
          className="field"
          required
        />
        <input name="nombre" placeholder="Nombre (opcional)" className="field" />
        <button className="btn-primary">Habilitar</button>
      </FormularioAlta>

      <Aviso>
        <p className="mb-2 font-medium">Si esa persona ya entró antes</p>
        <p>
          Al entrar por primera vez sin estar habilitada, se le crea una cuenta familiar propia y
          vacía. En ese caso habilitar el correo acá no alcanza: hay que moverla a esta cuenta desde
          el SQL Editor de Supabase. Está explicado en{' '}
          <span className="font-mono text-xs">supabase/vinculacion_correos.sql</span>.
        </p>
      </Aviso>
    </div>
  );
}
