'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-5">
      <div className="w-full max-w-md rounded-card border border-brick-100 bg-surface p-6 shadow-card">
        <h2 className="text-lg font-semibold text-ink">Algo se rompió</h2>
        <p className="mt-2 text-sm text-ink-500">
          {/* En producción Next.js oculta el detalle de los errores de
              servidor; en ese caso mostramos una guía en vez del texto
              genérico en inglés. */}
          {error.message.includes('Server Components render')
            ? 'Hubo un error en el servidor. El detalle queda en los logs de Vercel: buscá la referencia de abajo en Logs → Runtime Logs.'
            : error.message}
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-ink-400">Referencia: {error.digest}</p>
        )}
        <button onClick={() => reset()} className="btn-primary mt-5 w-full">
          Reintentar
        </button>
      </div>
    </div>
  );
}
