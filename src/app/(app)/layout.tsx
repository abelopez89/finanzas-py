import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';

async function logout() {
  'use server';
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AppShell email={user?.email ?? undefined} logout={logout}>
      {children}
    </AppShell>
  );
}
