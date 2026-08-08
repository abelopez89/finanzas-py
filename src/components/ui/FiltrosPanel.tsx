'use client';

import { useState } from 'react';

/**
 * Panel de filtros plegable. En móvil arranca cerrado para no comerse la
 * pantalla; en escritorio arranca abierto. Si hay filtros activos, arranca
 * abierto siempre (para que se vea por qué la lista está recortada).
 */
export default function FiltrosPanel({
  hayFiltrosActivos,
  children,
}: {
  hayFiltrosActivos: boolean;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(hayFiltrosActivos);

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="btn-secondary w-full justify-between sm:w-auto sm:justify-start"
      >
        <span className="flex items-center gap-2">
          <svg
            viewBox="0 0 24 24"
            className="h-[18px] w-[18px]"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
          >
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          Filtros
          {hayFiltrosActivos && (
            <span className="rounded-full bg-pine-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              activos
            </span>
          )}
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 transition-transform ${abierto ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {abierto && <div className="card mt-3 p-4">{children}</div>}
    </div>
  );
}
