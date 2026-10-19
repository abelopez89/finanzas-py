'use client';

import { useState } from 'react';
import Money from '@/components/ui/Money';
import { useFilasOptimistas, datosDe, type AccionServidor } from '@/components/useFilasOptimistas';

export type GastoPendienteHoy = {
  id: string;
  nombre: string;
  monto: number;
  esExtra: boolean;
  metodoNombre: string | null;
  atrasado: boolean;
};

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
 * "Para rescatar antes del mediodía" del dashboard: lo que vence hoy y lo
 * atrasado de meses anteriores (gastos del mes actual o extras, las dos
 * fuentes que ya trae la página), agrupado por método de pago — mismo
 * formato compacto/desplegable que "Rescatado del mes, por método de pago",
 * para que las dos secciones se lean igual.
 *
 * Solo Rescatar: una vez rescatado, el siguiente paso (Pagar) se hace desde
 * esa otra sección — separar las dos acciones evita que esta quede
 * sobrecargada.
 */
export default function PanelRescateHoy({
  vencenHoy,
  atrasados,
  cambiarEstadoGasto,
}: {
  vencenHoy: GastoPendienteHoy[];
  atrasados: GastoPendienteHoy[];
  cambiarEstadoGasto: AccionServidor;
}) {
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const { visibles, enCurso, ejecutar } = useFilasOptimistas([...vencenHoy, ...atrasados]);

  const cantidadHoy = visibles.filter((g) => !g.atrasado).length;
  const cantidadAtrasados = visibles.filter((g) => g.atrasado).length;
  const total = visibles.reduce((a, g) => a + g.monto, 0);

  if (visibles.length === 0) return null;

  function toggle(id: string) {
    setAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const rescatar = (g: GastoPendienteHoy) =>
    ejecutar(
      g.id,
      cambiarEstadoGasto,
      datosDe({
        id: g.id,
        _path: g.esExtra ? '/extras' : '/mes-actual',
        nuevo_estado: 'rescatado',
      }),
      { eliminado: true }
    );

  // Mismo agrupamiento que RescatadoPorMetodo, armado acá porque la fuente
  // es otra (pendientes, no ya rescatados) y porque cada grupo necesita el
  // botón Rescatar en vez de Pagar.
  const grupos = new Map<string, { nombre: string; gastos: GastoPendienteHoy[] }>();
  for (const g of visibles) {
    const key = g.metodoNombre ?? 'sin-metodo';
    const actual = grupos.get(key) ?? { nombre: g.metodoNombre ?? 'Sin método', gastos: [] };
    actual.gastos.push(g);
    grupos.set(key, actual);
  }
  const gruposOrdenados = Array.from(grupos.entries())
    .map(([id, g]) => ({
      id,
      nombre: g.nombre,
      gastos: g.gastos,
      total: g.gastos.reduce((a, gasto) => a + gasto.monto, 0),
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <section className="mb-8 overflow-hidden rounded-card border border-ochre-100 bg-ochre-50/40">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ochre-100 px-5 py-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ochre-700">
            Para rescatar antes del mediodía
          </p>
          <Money value={total} size="lg" className="mt-1 block font-semibold text-ochre-700" />
        </div>
        <div className="text-right text-xs text-ink-500">
          {cantidadHoy > 0 && (
            <p>
              {cantidadHoy} vence{cantidadHoy === 1 ? '' : 'n'} hoy
            </p>
          )}
          {cantidadAtrasados > 0 && (
            <p className="font-medium text-brick-600">
              {cantidadAtrasados} atrasado{cantidadAtrasados === 1 ? '' : 's'}
            </p>
          )}
        </div>
      </div>

      <ul className="divide-y divide-ochre-100">
        {gruposOrdenados.map((grupo) => {
          const abierto = abiertos.has(grupo.id);
          return (
            <li key={grupo.id}>
              <button
                type="button"
                onClick={() => toggle(grupo.id)}
                aria-expanded={abierto}
                className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-ochre-100/40"
              >
                <span className="h-8 w-1 shrink-0 rounded-full bg-ochre-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{grupo.nombre}</p>
                  <p className="text-xs text-ink-400">
                    {grupo.gastos.length} {grupo.gastos.length === 1 ? 'gasto' : 'gastos'}
                  </p>
                </div>
                <Money value={grupo.total} className="shrink-0 font-medium text-ochre-700" />
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
                <ul className="divide-y divide-ochre-100 bg-ochre-50/60">
                  {grupo.gastos.map((g) => {
                    const ocupado = Boolean(enCurso[g.id]);
                    return (
                      <li
                        key={g.id}
                        className="flex flex-wrap items-center gap-3 py-2.5 pl-11 pr-5"
                      >
                        <p className="min-w-0 flex-1 truncate text-sm text-ink-500">
                          {g.nombre}
                          {g.esExtra && <span className="ml-1.5 text-xs text-ink-400">extra</span>}
                          {g.atrasado && (
                            <span className="ml-1.5 text-xs font-medium text-brick-600">atrasado</span>
                          )}
                        </p>
                        <Money value={g.monto} size="sm" className="shrink-0 text-ink-500" />
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => rescatar(g)}
                            className="btn-row bg-ochre-100 text-ochre-700 hover:bg-ochre-200 disabled:opacity-50"
                          >
                            Rescatar
                          </button>
                          {ocupado && <Guardando />}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
