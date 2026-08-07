import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

async function logout() {
  'use server';
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/plantillas', label: 'Plantillas' },
  { href: '/mes-actual', label: 'Mes actual' },
  { href: '/extras', label: 'Extras' },
  { href: '/fondo', label: 'Fondo mutuo' },
  { href: '/previsiones', label: 'Previsiones' },
  { href: '/movimientos', label: 'Movimientos' },
  { href: '/configuracion', label: 'Configuración' },
];

export default async function Sidebar() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <aside className="flex w-60 shrink-0 flex-col justify-between border-r border-gray-200 bg-white p-4">
      <div>
        <div className="mb-6 text-lg font-semibold text-brand-700">finanzas-py</div>
        <nav className="space-y-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-brand-50 hover:text-brand-700"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      {user && (
        <div className="border-t border-gray-200 pt-4">
          <p className="mb-2 truncate text-xs text-gray-400" title={user.email ?? ''}>
            {user.email}
          </p>
          <form action={logout}>
            <button className="text-xs text-red-500 hover:underline">Cerrar sesión</button>
          </form>
        </div>
      )}
    </aside>
  );
}
