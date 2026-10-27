'use client';

import { useState } from 'react';
import Link from 'next/link';
import Money from '@/components/ui/Money';
import { useFilasOptimistas, datosDe, type AccionServidor } from '@/components/useFilasOptimistas';
import { formatFechaSalario, TIPO_DESCUENTO_LABEL, type PendienteSalario } from '@/lib/salario';

/**
 * "Pendientes del salario" del dashboard: conceptos del período sin
 * registrar, agrupados por salario con el mismo formato
 * compacto/desplegable que PanelRescateHoy. "Pagado" registra con el
 * monto precargado y una cuota; para un adelanto o un monto distinto se
 * va a /salario.
 *
 * Es solo recordatorio: marcar algo acá no toca el fondo.
 */
export default function PanelPendientesSalario({
  pendientes,
  periodoISO,
  hoyISO,
  marcarPagado,
}: {
  pendientes: PendienteSalario[];
  periodoISO: string;
  hoyISO: string;
  marcarPagado: AccionServidor;
}) {
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  // Se pasa la prop tal cual (ver nota en useFilasOptimistas/CLAUDE.md).
  const { visibles, enCurso, ejecutar } = useFilasOptimistas(pendientes);

  if (visibles.length === 0) return null;

  const total = visibles.reduce((a, p) => a + p.monto, 0);
  const yaCobrados = visibles.filter((p) => p.fechaCobroISO <= hoyISO).length;

  function toggle(id: string) {
    setAbiertos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const pagar = (p: PendienteSalario) =>
    ejecutar(
      p.id,
      marcarPagado,
      datosDe({
        id: p.id,
        periodo: periodoISO,
        monto: String(p.monto),
        cuotas_cubiertas: '1',
        fecha_pago: hoyISO,
      }),
      { eliminado: true }
    );

  const grupos = new Map<string, { nombre: string; items: PendienteSalario[] }>();
  for (const p of visibles) {
    const actual = grupos.get(p.salarioId) ?? { nombre: p.salarioNombre, items: [] };
    actual.items.push(p);
    grupos.set(p.salarioId, actual);
  }
  const gruposOrdenados = Array.from(grupos.entries()).map(([id, g]) => ({
    id,
    nombre: g.nombre,
    items: g.items,
    fechaCobroISO: g.items[0].fechaCobroISO,
    total: g.items.reduce((a, p) => a + p.monto, 0),
  }));

  return (
    <section className="mb-8 overflow-hidden rounded-card border border-ochre-100 bg-ochre-50/40">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ochre-100 px-5 py-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ochre-700">Pendientes del salario</p>
          <Money value={total} size="lg" className="mt-1 block font-semibold text-ochre-700" />
        </div>
        <div className="text-right text-xs text-ink-500">
          <p>
            {visibles.length} pendiente{visibles.length === 1 ? '' : 's'}
          </p>
          {yaCobrados > 0 && (
            <p className="font-medium text-ochre-700">
              {yaCobrados} con el salario ya cobrado
            </p>
          )}
          <Link href="/salario" className="mt-1 inline-block font-medium text-pine-700 hover:underline">
            Ver salario
          </Link>
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
                    {grupo.items.length} {grupo.items.length === 1 ? 'concepto' : 'conceptos'} · cobro el{' '}
                    {formatFechaSalario(grupo.fechaCobroISO)}
                  </p>
                </div>
                <Money value={grupo.total} className="shrink-0 font-medium text-ochre-700" />
                <svg
                  viewBox="0 0 24 24"
                  className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${abierto ? 'rotate-180' : ''}`}
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
                  {grupo.items.map((p) => {
                    const ocupado = Boolean(enCurso[p.id]);
                    return (
                      <li key={p.id} className="flex flex-wrap items-center gap-3 py-2.5 pl-11 pr-5">
                        <p className="min-w-0 flex-1 truncate text-sm text-ink-500">
                          {p.nombre}
                          <span className="ml-1.5 text-xs text-ink-400">{TIPO_DESCUENTO_LABEL[p.tipo]}</span>
                          {p.cuotasRestantes !== null && (
                            <span className="ml-1.5 text-xs text-ink-400">
                              quedan {p.cuotasRestantes}
                            </span>
                          )}
                        </p>
                        <Money value={p.monto} size="sm" className="shrink-0 text-ink-500" />
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => pagar(p)}
                          className="btn-row bg-ochre-100 text-ochre-700 hover:bg-ochre-200 disabled:opacity-50"
                        >
                          Pagado
                        </button>
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
