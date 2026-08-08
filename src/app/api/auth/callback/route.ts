import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensureAccountForUser, syncIdentidadesDelUsuario } from '@/lib/supabase/onboarding';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const isLinking = searchParams.get('link') === '1';

  if (code) {
    try {
      const supabase = createSupabaseServerClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) throw error;

      if (data.user) {
        const email = data.user.email!;
        const userId = data.user.id;

        if (isLinking) {
          // Registra todos los correos vinculados al usuario, no solo el
          // principal (ver comentario en syncIdentidadesDelUsuario).
          await syncIdentidadesDelUsuario(supabase);
        } else {
          await ensureAccountForUser(supabase, userId, email);
        }
      }
    } catch (err) {
      const message =
        (err as { message?: string })?.message ??
        (typeof err === 'string' ? err : JSON.stringify(err));
      console.error('Error en callback de auth:', err);
      // Si el fallo fue al vincular, el usuario ya tiene sesión: mandarlo
      // a /login lo dejaría en un limbo. Vuelve a la pantalla de cuenta.
      const destino = isLinking ? '/configuracion/cuenta' : '/login';
      return NextResponse.redirect(`${origin}${destino}?error=${encodeURIComponent(message)}`);
    }
  }

  return NextResponse.redirect(`${origin}${isLinking ? '/configuracion/cuenta?vinculado=1' : '/'}`);
}
