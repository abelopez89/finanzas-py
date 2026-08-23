import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/account';
import { redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';

async function logout() {
  'use server';
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // getAuthUser está memoizado por request: la página que renderiza abajo
  // reutiliza este mismo resultado en vez de volver a consultar a Supabase.
  const user = await getAuthUser();

  return (
    <AppShell email={user?.email ?? undefined} logout={logout}>
      {children}
    </AppShell>
  );
}
