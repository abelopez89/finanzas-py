'use client';

import { useState } from 'react';

/**
 * Sección con el mismo título que `Section`, pero plegada por defecto:
 * para bloques que se usan de vez en cuando (registrar el saldo del banco,
 * el extracto mensual) y no tienen que competir con lo que se mira a
 * diario. `resumen` se ve a la derecha del título mientras está plegada,
 * para no tener que abrirla solo para consultar un dato.
 */
export default function SeccionPlegable({
  titulo,
  resumen,
  children,
}: {
  titulo: string;
  resumen?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [abierta, setAbierta] = useState(false);

  return (
    <section className="mb-8">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        aria-expanded={abierta}
        className="card flex w-full flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-3 text-left transition-colors hover:bg-canvas/60"
      >
        <h2 className="flex-1 text-[13px] font-semibold uppercase tracking-wider text-ink-500 sm:flex-none">
          {titulo}
        </h2>
        {/* En móvil el resumen baja a su propia línea en vez de cortarse. */}
        {!abierta && resumen && (
          <span className="order-last w-full truncate text-xs text-ink-400 sm:order-none sm:w-auto sm:flex-1 sm:text-right sm:text-sm">
            {resumen}
          </span>
        )}
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 shrink-0 text-ink-400 transition-transform sm:ml-auto ${abierta ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {abierta && <div className="mt-3">{children}</div>}
    </section>
  );
}
