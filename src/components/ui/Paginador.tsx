import Link from 'next/link';

/**
 * Paginador que conserva los filtros activos en el enlace, para no perder
 * el contexto al cambiar de página.
 */
export default function Paginador({
  paginaActual,
  totalPaginas,
  totalItems,
  baseParams,
  basePath,
}: {
  paginaActual: number;
  totalPaginas: number;
  totalItems: number;
  baseParams: Record<string, string | undefined>;
  basePath: string;
}) {
  if (totalPaginas <= 1) {
    return (
      <p className="mt-3 text-xs text-ink-400">
        {totalItems} {totalItems === 1 ? 'movimiento' : 'movimientos'}
      </p>
    );
  }

  const link = (pagina: number) => {
    const params = new URLSearchParams(
      Object.entries(baseParams).filter(([, v]) => v) as [string, string][]
    );
    if (pagina > 1) params.set('pagina', String(pagina));
    else params.delete('pagina');
    const qs = params.toString();
    return `${basePath}${qs ? `?${qs}` : ''}`;
  };

  const hayAnterior = paginaActual > 1;
  const haySiguiente = paginaActual < totalPaginas;

  return (
    <div className="mt-3 flex items-center justify-between gap-3">
      <p className="text-xs text-ink-400">
        Página {paginaActual} de {totalPaginas} · {totalItems}{' '}
        {totalItems === 1 ? 'movimiento' : 'movimientos'}
      </p>
      <div className="flex gap-2">
        {hayAnterior ? (
          <Link href={link(paginaActual - 1)} className="btn-row border border-line text-ink-700">
            Anterior
          </Link>
        ) : (
          <span className="btn-row border border-line text-ink-300">Anterior</span>
        )}
        {haySiguiente ? (
          <Link href={link(paginaActual + 1)} className="btn-row border border-line text-ink-700">
            Siguiente
          </Link>
        ) : (
          <span className="btn-row border border-line text-ink-300">Siguiente</span>
        )}
      </div>
    </div>
  );
}
