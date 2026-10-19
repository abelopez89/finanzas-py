'use client';

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
 * fuentes que ya trae la página), con el botón Rescatar directo, sin saltar
 * a Mes actual o Extras.
 *
 * Solo Rescatar: una vez rescatado, el siguiente paso (Pagar) se hace desde
 * "Rescatado del mes, por método de pago" — separar las dos acciones en la
 * sección donde corresponde cada una evita que esta quede sobrecargada.
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
  const { visibles, enCurso, ejecutar } = useFilasOptimistas([...vencenHoy, ...atrasados]);
  const hoy = visibles.filter((g) => !g.atrasado);
  const vencidos = visibles.filter((g) => g.atrasado);
  const total = visibles.reduce((a, g) => a + g.monto, 0);

  if (visibles.length === 0) return null;

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

  const Fila = ({ g }: { g: GastoPendienteHoy }) => {
    const ocupado = Boolean(enCurso[g.id]);
    return (
      <li className="flex flex-wrap items-center gap-3 px-5 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">
            {g.nombre}
            {g.esExtra && <span className="ml-1.5 text-xs text-ink-400">extra</span>}
          </p>
          {g.metodoNombre && <p className="text-xs text-ink-400">{g.metodoNombre}</p>}
        </div>
        <Money value={g.monto} className="shrink-0 font-medium text-ink" />
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={ocupado}
            onClick={() => rescatar(g)}
            className="btn-row bg-ochre-50 text-ochre-700 hover:bg-ochre-100 disabled:opacity-50"
          >
            Rescatar
          </button>
          {ocupado && <Guardando />}
        </div>
      </li>
    );
  };

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
          {hoy.length > 0 && (
            <p>
              {hoy.length} vence{hoy.length === 1 ? '' : 'n'} hoy
            </p>
          )}
          {vencidos.length > 0 && (
            <p className="font-medium text-brick-600">
              {vencidos.length} atrasado{vencidos.length === 1 ? '' : 's'}
            </p>
          )}
        </div>
      </div>

      {hoy.length > 0 && (
        <ul className="divide-y divide-ochre-100">
          {hoy.map((g) => (
            <Fila key={g.id} g={g} />
          ))}
        </ul>
      )}

      {vencidos.length > 0 && (
        <ul className="divide-y divide-brick-100 border-t border-ochre-100 bg-brick-50/30">
          {vencidos.map((g) => (
            <Fila key={g.id} g={g} />
          ))}
        </ul>
      )}
    </section>
  );
}
