'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/configuracion/plantillas', label: 'Plantillas' },
  { href: '/configuracion/metodos-pago', label: 'Métodos de pago' },
  { href: '/configuracion/categorias', label: 'Categorías' },
  { href: '/configuracion/saldo-inicial', label: 'Saldo inicial' },
  { href: '/configuracion/telegram', label: 'Telegram' },
  { href: '/configuracion/cuenta', label: 'Cuenta' },
];

/**
 * En móvil las pestañas se desplazan horizontalmente (no se apilan ni se
 * truncan), con scroll con inercia y sin barra visible.
 */
export default function ConfigTabs() {
  const pathname = usePathname();

  return (
    <nav className="-mx-4 mb-6 overflow-x-auto px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ul className="flex min-w-max gap-1 border-b border-line pb-px">
        {TABS.map((tab) => {
          const activo = pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={activo ? 'page' : undefined}
                className={`inline-flex min-h-[42px] items-center whitespace-nowrap border-b-2 px-3.5 text-sm transition-colors ${
                  activo
                    ? 'border-pine-600 font-medium text-pine-700'
                    : 'border-transparent text-ink-500 hover:text-ink'
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
