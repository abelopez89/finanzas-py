export function PageHeader({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-ink sm:text-2xl">{titulo}</h1>
          {descripcion && <p className="mt-1 max-w-2xl text-sm text-ink-500">{descripcion}</p>}
        </div>
        {children}
      </div>
    </header>
  );
}

export function Section({
  titulo,
  aside,
  children,
}: {
  titulo?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      {(titulo || aside) && (
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          {titulo && (
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-500">
              {titulo}
            </h2>
          )}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ mensaje }: { mensaje: string }) {
  return <p className="px-4 py-8 text-center text-sm text-ink-400">{mensaje}</p>;
}

export function Aviso({
  tono = 'info',
  children,
}: {
  tono?: 'info' | 'alerta' | 'error';
  children: React.ReactNode;
}) {
  const tonos = {
    info: 'bg-canvas text-ink-700 ring-line',
    alerta: 'bg-ochre-50 text-ochre-700 ring-ochre-100',
    error: 'bg-brick-50 text-brick-700 ring-brick-100',
  };
  return (
    <div className={`rounded-lg px-3.5 py-3 text-sm ring-1 ring-inset ${tonos[tono]}`}>{children}</div>
  );
}
