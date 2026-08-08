import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Sidebar, BottomNav, TopBar } from '@/components/Nav';

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
    <div className="min-h-screen">
      <Sidebar email={user?.email ?? undefined} logout={logout} />
      <TopBar email={user?.email ?? undefined} logout={logout} />

      {/* pb-24 en móvil deja aire sobre la barra inferior fija */}
      <main className="px-4 pb-24 pt-5 md:ml-60 md:px-8 md:pb-10 md:pt-8">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>

      <BottomNav />
    </div>
  );
}
