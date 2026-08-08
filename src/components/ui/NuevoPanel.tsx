'use client';

import { useState } from 'react';

/** Formulario de alta plegable: en móvil el listado es lo importante, el
 *  formulario aparece solo cuando se lo pide. */
export default function NuevoPanel({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className={abierto ? 'btn-secondary w-full sm:w-auto' : 'btn-primary w-full sm:w-auto'}
      >
        {abierto ? (
          'Cancelar'
        ) : (
          <>
            <svg
              viewBox="0 0 24 24"
              className="h-[18px] w-[18px]"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            {etiqueta}
          </>
        )}
      </button>
      {abierto && <div className="card mt-3 p-4">{children}</div>}
    </div>
  );
}
