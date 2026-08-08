'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconInicio,
  IconMes,
  IconExtras,
  IconFondo,
  IconPrevision,
  IconAjustes,
  IconSalir,
} from './ui/Icons';

const NAV = [
  { href: '/', label: 'Inicio', Icon: IconInicio },
  { href: '/mes-actual', label: 'Mes', Icon: IconMes },
  { href: '/extras', label: 'Extras', Icon: IconExtras },
  { href: '/fondo', label: 'Fondo', Icon: IconFondo },
  { href: '/previsiones', label: 'Previsión', Icon: IconPrevision },
  { href: '/configuracion', label: 'Ajustes', Icon: IconAjustes },
];

// Etiquetas largas para el sidebar de escritorio, donde hay espacio
const LABEL_LARGO: Record<string, string> = {
  '/': 'Dashboard',
  '/mes-actual': 'Mes actual',
  '/extras': 'Extras',
  '/fondo': 'Fondo mutuo',
  '/previsiones': 'Previsiones',
  '/configuracion': 'Configuración',
};

function esActivo(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

/** Barra inferior fija — patrón nativo de iOS. Solo en móvil. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-lg md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex">
        {NAV.map(({ href, label, Icon }) => {
          const activo = esActivo(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={activo ? 'page' : undefined}
                className={`flex min-h-[52px] flex-col items-center justify-center gap-1 px-1 pt-2 pb-1.5 transition-colors ${
                  activo ? 'text-pine-600' : 'text-ink-400'
                }`}
              >
                <Icon className="h-[22px] w-[22px]" />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Sidebar de escritorio, con modo contraído (solo iconos). */
export function Sidebar({
  email,
  logout,
  contraido,
  alternar,
}: {
  email?: string;
  logout: () => void;
  contraido: boolean;
  alternar: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed inset-y-0 left-0 hidden flex-col justify-between border-r border-line bg-surface py-5 transition-[width] duration-200 md:flex ${
        contraido ? 'w-[68px] px-2' : 'w-60 px-3'
      }`}
    >
      <div>
        <div className={`mb-7 flex items-center ${contraido ? 'justify-center' : 'justify-between px-3'}`}>
          {!contraido && (
            <span className="text-[15px] font-semibold tracking-tight text-ink">
              finanzas<span className="text-pine-600">·py</span>
            </span>
          )}
          <button
            type="button"
            onClick={alternar}
            aria-label={contraido ? 'Expandir menú' : 'Contraer menú'}
            title={`${contraido ? 'Expandir' : 'Contraer'} menú  ( [ )`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-canvas text-ink-500 transition-colors hover:border-pine-200 hover:bg-pine-50 hover:text-pine-700"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-[18px] w-[18px]"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
              <path d="M9.5 4.5v15" />
              {contraido ? <path d="M13 9l3 3-3 3" /> : <path d="M16 9l-3 3 3 3" />}
            </svg>
          </button>
        </div>

        <ul className="space-y-0.5">
          {NAV.map(({ href, Icon }) => {
            const activo = esActivo(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={activo ? 'page' : undefined}
                  title={contraido ? LABEL_LARGO[href] : undefined}
                  className={`flex items-center gap-3 rounded-lg py-2.5 text-sm transition-colors ${
                    contraido ? 'justify-center px-0' : 'px-3'
                  } ${
                    activo ? 'bg-pine-50 font-medium text-pine-700' : 'text-ink-700 hover:bg-canvas'
                  }`}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {!contraido && LABEL_LARGO[href]}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {email && (
        <div className={`border-t border-line pt-4 ${contraido ? 'px-0' : 'px-3'}`}>
          {!contraido && (
            <p className="mb-2 truncate text-xs text-ink-400" title={email}>
              {email}
            </p>
          )}
          <form action={logout} className={contraido ? 'flex justify-center' : ''}>
            <button
              title={contraido ? 'Cerrar sesión' : undefined}
              aria-label={contraido ? 'Cerrar sesión' : undefined}
              className={`flex items-center gap-2 text-xs text-ink-500 transition-colors hover:text-brick-600 ${
                contraido ? 'h-8 w-8 justify-center rounded-lg hover:bg-canvas' : ''
              }`}
            >
              <IconSalir className="h-4 w-4 shrink-0" />
              {!contraido && 'Cerrar sesión'}
            </button>
          </form>
        </div>
      )}
    </aside>
  );
}

/** Barra superior de móvil: título de sección + salir. */
export function TopBar({ email, logout }: { email?: string; logout: () => void }) {
  const pathname = usePathname();
  const actual = NAV.find((n) => esActivo(pathname, n.href));

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur-lg md:hidden"
      style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
    >
      <span className="text-[15px] font-semibold tracking-tight text-ink">
        {actual ? LABEL_LARGO[actual.href] : 'finanzas·py'}
      </span>
      {email && (
        <form action={logout}>
          <button
            aria-label="Cerrar sesión"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-canvas hover:text-ink"
          >
            <IconSalir className="h-[18px] w-[18px]" />
          </button>
        </form>
      )}
    </header>
  );
}
