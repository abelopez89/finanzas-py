'use client';

import { useMemo, useState } from 'react';
import Money from '@/components/ui/Money';
import { useFilasOptimistas, datosDe, type AccionServidor } from '@/components/useFilasOptimistas';

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

type GastoConGrupo = GastoRescatado & { grupoId: string; grupoNombre: string };

function Guardando() {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-400">
      <svg
        viewBox="0 0 24 24"
        className="h-3 w-3 animate-spin"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
      >
        <path d="M12 3a9 9 0 1 0 9 9" />
      </svg>
      Guardando…
    </span>
  );
}

/**
 * Compacto por defecto (un renglón con el total por método): clic para
 * desplegar el detalle de los gastos rescatados de ese método sin salir
 * del dashboard. Cada gasto tiene su botón Pagar — rescatar y pagar quedan
 * separados en sus propias secciones del dashboard (ver PanelRescateHoy).
 *
 * Los grupos y totales se recalculan acá en el cliente a partir de la lista
 * aplanada (con el patch optimista aplicado), en vez de usar los `total`
 * que llegan por props: así, al pagar un gasto, el grupo y el total general
 * se achican al instante sin esperar el refetch del servidor.
 */
export default function RescatadoPorMetodo({
  grupos,
  cambiarEstadoGasto,
}: {
  grupos: GrupoRescatadoPorMetodo[];
  cambiarEstadoGasto: AccionServidor;
}) {
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());

  // useFilasOptimistas suelta sus parches cada vez que esta lista cambia de
  // referencia (ver avisos en el hook). flatMap arma un array nuevo en cada
  // render — sin memoizar, cualquier re-render local (incluso el que
  // dispara el propio clic en Pagar) lo invalidaba y borraba el parche
  // recién aplicado antes de que llegaran los datos frescos del servidor,
  // así que el gasto nunca desaparecía.
  const planos = useMemo<GastoConGrupo[]>(
    () => grupos.flatMap((g) => g.gastos.map((gasto) => ({ ...gasto, grupoId: g.id, grupoNombre: g.nombre }))),
    [grupos]
  );
  const { visibles, enCurso, ejecutar } = useFilasOptimistas(planos);

  const gruposVisibles = grupos
    .map((g) => ({ ...g, gastos: visibles.filter((v) => v.grupoId === g.id) }))
    .filter((g) => g.gastos.length > 0)
    .map((g) => ({ ...g, total: g.gastos.reduce((a, gasto) => a + gasto.monto, 0) }));
  const totalVisible = gruposVisibles.reduce((a, g) => a + g.total, 0);

  if (gruposVisibles.length === 0) return null;

  function toggle(id: string) {
    setAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const pagar = (gasto: GastoConGrupo) =>
    ejecutar(
      gasto.id,
      cambiarEstadoGasto,
      datosDe({
        id: gasto.id,
        _path: gasto.es_extra ? '/extras' : '/mes-actual',
        nuevo_estado: 'pagado',
      }),
      { eliminado: true }
    );

  return (
    <ul className="card divide-y divide-line overflow-hidden">
      {gruposVisibles.map((g) => {
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
                {g.gastos.map((gasto) => {
                  const ocupado = Boolean(enCurso[gasto.id]);
                  return (
                    <li key={gasto.id} className="flex flex-wrap items-center gap-3 py-2.5 pl-11 pr-4">
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
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => pagar(gasto)}
                        className="btn-row shrink-0 bg-pine-50 text-pine-700 hover:bg-pine-100 disabled:opacity-50"
                      >
                        Pagar
                      </button>
                      {ocupado && <Guardando />}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
      <li className="flex items-center justify-between gap-3 bg-canvas/60 px-4 py-3">
        <span className="text-sm font-semibold text-ink">Total rescatado</span>
        <Money value={totalVisible} className="font-semibold text-ink" />
      </li>
    </ul>
  );
}
