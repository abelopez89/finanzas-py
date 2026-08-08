import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensureAccountForUser } from '@/lib/supabase/onboarding';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    try {
      const supabase = createSupabaseServerClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) throw error;

      if (data.user) {
        const email = data.user.email!;
        const userId = data.user.id;

        // Engancha al usuario con su cuenta familiar: la propia si ya
        // tiene, la que lo haya habilitado por correo, o una nueva.
        await ensureAccountForUser(supabase, userId, email);
      }
    } catch (err) {
      const message =
        (err as { message?: string })?.message ??
        (typeof err === 'string' ? err : JSON.stringify(err));
      console.error('Error en callback de auth:', err);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
