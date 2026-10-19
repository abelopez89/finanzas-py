'use client';

import Link from 'next/link';
import Money from '@/components/ui/Money';
import { useFilasOptimistas, datosDe, type AccionServidor } from '@/components/useFilasOptimistas';

export type GastoPendienteHoy = {
  id: string;
  nombre: string;
  monto: number;
  esExtra: boolean;
  metodoNombre: string | null;
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
 * "Para rescatar antes del mediodía" del dashboard, con Rescatar/Pagar
 * directos: resuelve lo que vence hoy (sea un gasto del mes o un extra, las
 * dos fuentes que ya trae la página) sin saltar a Mes actual o Extras. El
 * resto de las acciones (editar, revertir, eliminar) se queda en esas
 * pantallas — acá solo lo urgente del momento.
 *
 * Los atrasados de meses anteriores siguen como enlace: son un caso menos
 * frecuente y ya tienen su propia pantalla para resolverse con más contexto.
 */
export default function PanelRescateHoy({
  vencenHoy,
  atrasados,
  cambiarEstadoGasto,
}: {
  vencenHoy: GastoPendienteHoy[];
  atrasados: { cantidad: number; total: number };
  cambiarEstadoGasto: AccionServidor;
}) {
  const { visibles, enCurso, ejecutar } = useFilasOptimistas(vencenHoy);
  const total = visibles.reduce((a, g) => a + g.monto, 0) + atrasados.total;

  if (visibles.length === 0 && atrasados.cantidad === 0) return null;

  const cambiarEstado = (g: GastoPendienteHoy, nuevoEstado: string) =>
    ejecutar(
      g.id,
      cambiarEstadoGasto,
      datosDe({
        id: g.id,
        _path: g.esExtra ? '/extras' : '/mes-actual',
        nuevo_estado: nuevoEstado,
      }),
      { eliminado: true }
    );

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
          {visibles.length > 0 && (
            <p>
              {visibles.length} vence{visibles.length === 1 ? '' : 'n'} hoy
            </p>
          )}
          {atrasados.cantidad > 0 && (
            <p className="font-medium text-brick-600">
              {atrasados.cantidad} atrasado{atrasados.cantidad === 1 ? '' : 's'}
            </p>
          )}
        </div>
      </div>

      {visibles.length > 0 && (
        <ul className="divide-y divide-ochre-100">
          {visibles.map((g) => {
            const ocupado = Boolean(enCurso[g.id]);
            return (
              <li key={g.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
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
                    onClick={() => cambiarEstado(g, 'rescatado')}
                    className="btn-row bg-ochre-50 text-ochre-700 hover:bg-ochre-100 disabled:opacity-50"
                  >
                    Rescatar
                  </button>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => cambiarEstado(g, 'pagado')}
                    className="btn-row bg-pine-50 text-pine-700 hover:bg-pine-100 disabled:opacity-50"
                  >
                    Pagar
                  </button>
                  {ocupado && <Guardando />}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {atrasados.cantidad > 0 && (
        <div className="border-t border-ochre-100 px-5 py-3">
          <Link href="/mes-actual" className="text-sm font-medium text-brick-600 hover:underline">
            Ver {atrasados.cantidad} atrasado{atrasados.cantidad === 1 ? '' : 's'} de meses anteriores →
          </Link>
        </div>
      )}
    </section>
  );
}
