'use client';

import { useState } from 'react';
import Money from '@/components/ui/Money';

export type GastoRescatado = {
  id: string;
  nombre: string;
  monto: number;
  dia: number;
  es_extra: boolean;
};

export type GrupoRescatadoPorMetodo = {
  id: string;
  nombre: string;
  total: number;
  gastos: GastoRescatado[];
};

/**
 * Compacto por defecto (un renglón con el total por método): clic para
 * desplegar el detalle de los gastos rescatados de ese método sin salir
 * del dashboard.
 */
export default function RescatadoPorMetodo({
  grupos,
  total,
}: {
  grupos: GrupoRescatadoPorMetodo[];
  total: number;
}) {
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <ul className="card divide-y divide-line overflow-hidden">
      {grupos.map((g) => {
        const abierto = abiertos.has(g.id);
        return (
          <li key={g.id}>
            <button
              type="button"
              onClick={() => toggle(g.id)}
              aria-expanded={abierto}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas/50"
            >
              <span className="h-8 w-1 shrink-0 rounded-full bg-ochre-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{g.nombre}</p>
                <p className="text-xs text-ink-400">
                  {g.gastos.length} {g.gastos.length === 1 ? 'gasto' : 'gastos'}
                </p>
              </div>
              <Money value={g.total} className="shrink-0 font-medium text-ochre-700" />
              <svg
                viewBox="0 0 24 24"
                className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${
                  abierto ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {abierto && (
              <ul className="divide-y divide-line bg-canvas/40">
                {g.gastos.map((gasto) => (
                  <li key={gasto.id} className="flex items-center gap-3 py-2.5 pl-11 pr-4">
                    <span className="w-7 shrink-0 text-center font-mono text-xs font-semibold text-ink-400">
                      {gasto.dia}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm text-ink-500">
                      {gasto.nombre}
                      {gasto.es_extra && (
                        <span className="ml-1.5 text-xs text-ink-400">extra</span>
                      )}
                    </p>
                    <Money value={gasto.monto} size="sm" className="shrink-0 text-ink-500" />
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
      <li className="flex items-center justify-between gap-3 bg-canvas/60 px-4 py-3">
        <span className="text-sm font-semibold text-ink">Total rescatado</span>
        <Money value={total} className="font-semibold text-ink" />
      </li>
    </ul>
  );
}
