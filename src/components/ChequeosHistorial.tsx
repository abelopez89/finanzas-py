'use client';

import { useState } from 'react';
import Money from '@/components/ui/Money';

export type Chequeo = {
  id: string;
  fecha: string;
  monto_informado: number | string;
  interes_calculado: number | string;
};

function Fila({ c }: { c: Chequeo }) {
  const interes = Number(c.interes_calculado);
  return (
    <li className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="font-mono text-[13px] text-ink-500">{c.fecha}</span>
      <span className="flex-1 truncate text-right text-ink-400">
        <Money value={c.monto_informado} size="sm" className="text-ink-500" />
      </span>
      <span
        className={`w-24 shrink-0 text-right font-medium ${
          interes >= 0 ? 'text-pine-700' : 'text-brick-600'
        }`}
      >
        <Money
          value={Math.abs(interes)}
          signo={interes >= 0 ? 'ingreso' : 'egreso'}
          size="sm"
        />
      </span>
    </li>
  );
}

/**
 * Historial de registros de saldo. Es información de auditoría: se muestra
 * solo el último y el resto queda plegado, para que no compita con el
 * saldo y el formulario, que son lo que se usa a diario.
 */
export default function ChequeosHistorial({ chequeos }: { chequeos: Chequeo[] }) {
  const [abierto, setAbierto] = useState(false);

  if (chequeos.length === 0) return null;

  const [ultimo, ...resto] = chequeos;

  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
          Último registro
        </p>
        {resto.length > 0 && (
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-expanded={abierto}
            className="text-xs text-ink-400 transition-colors hover:text-ink"
          >
            {abierto ? 'Ocultar anteriores' : `Ver ${resto.length} anteriores`}
          </button>
        )}
      </div>

      <ul className="divide-y divide-line">
        <Fila c={ultimo} />
        {abierto && resto.map((c) => <Fila key={c.id} c={c} />)}
      </ul>
    </div>
  );
}
