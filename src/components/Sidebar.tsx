import Link from 'next/link';

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/plantillas', label: 'Plantillas' },
  { href: '/mes-actual', label: 'Mes actual' },
  { href: '/extras', label: 'Extras' },
  { href: '/fondo', label: 'Fondo mutuo' },
  { href: '/previsiones', label: 'Previsiones' },
  { href: '/extracto', label: 'Extracto' },
  { href: '/configuracion/metodos-pago', label: 'Métodos de pago' },
  { href: '/configuracion/categorias', label: 'Categorías' },
  { href: '/configuracion/telegram', label: 'Telegram' },
];

export default function Sidebar() {
  return (
    <aside className="w-60 shrink-0 border-r border-gray-200 bg-white p-4">
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
    </aside>
  );
}
