import Link from 'next/link';

const tabs = [
  { href: '/configuracion/plantillas', label: 'Plantillas' },
  { href: '/configuracion/metodos-pago', label: 'Métodos de pago' },
  { href: '/configuracion/categorias', label: 'Categorías' },
  { href: '/configuracion/saldo-inicial', label: 'Saldo inicial' },
  { href: '/configuracion/telegram', label: 'Telegram' },
];

export default function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Configuración</h1>
      <div className="mb-6 flex gap-1 border-b border-gray-200">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="rounded-t-md px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 hover:text-brand-700"
          >
            {tab.label}
          </Link>
        ))}
      </div>
      {children}
    </div>
  );
}
