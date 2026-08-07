import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensureAccountForUser, linkAdditionalEmail } from '@/lib/supabase/onboarding';

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
          const { data: existing } = await supabase
            .from('account_users')
            .select('account_id')
            .eq('auth_user_id', userId)
            .limit(1)
            .maybeSingle();

          if (existing) {
            await linkAdditionalEmail(supabase, existing.account_id, userId, email);
          }
        } else {
          await ensureAccountForUser(supabase, userId, email);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido al iniciar sesión';
      console.error('Error en callback de auth:', err);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
