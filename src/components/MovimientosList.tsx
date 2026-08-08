'use client';

import Money from '@/components/ui/Money';
import { EmptyState } from '@/components/ui/Layout';

export type MovimientoVista = {
  id: string;
  tipo: string;
  origen: string;
  nombre: string;
  fecha: string;
  monto: number;
};

const TIPO_COLOR: Record<string, string> = {
  Gasto: 'bg-brick-600',
  Ingreso: 'bg-pine-600',
  Interés: 'bg-pine-200',
  'Saldo inicial': 'bg-ink-300',
};

export default function MovimientosList({ movimientos }: { movimientos: MovimientoVista[] }) {
  const esEgreso = (t: string) => t === 'Gasto';

  return (
    <>
      {/* ---------- Móvil ---------- */}
      <ul className="card divide-y divide-line overflow-hidden md:hidden">
        {movimientos.map((m) => (
          <li key={`${m.tipo}-${m.id}`} className="flex items-center gap-3 px-4 py-3">
            <span className={`h-8 w-1 shrink-0 rounded-full ${TIPO_COLOR[m.tipo] ?? 'bg-ink-300'}`} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{m.nombre}</p>
              <p className="mt-0.5 text-xs text-ink-400">
                {m.fecha} · {m.tipo}
                {m.origen !== 'Fondo' && ` · ${m.origen}`}
              </p>
            </div>
            <Money
              value={m.monto}
              signo={esEgreso(m.tipo) ? 'egreso' : 'ingreso'}
              className={`shrink-0 font-medium ${esEgreso(m.tipo) ? 'text-brick-600' : 'text-pine-700'}`}
            />
          </li>
        ))}
        {movimientos.length === 0 && <EmptyState mensaje="No hay movimientos que coincidan." />}
      </ul>

      {/* ---------- Escritorio ---------- */}
      <div className="hidden overflow-hidden rounded-card border border-line bg-surface shadow-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas/60 text-left text-[11px] uppercase tracking-wider text-ink-500">
              <th className="px-4 py-2.5 font-semibold">Fecha</th>
              <th className="px-4 py-2.5 font-semibold">Tipo</th>
              <th className="px-4 py-2.5 font-semibold">Origen</th>
              <th className="px-4 py-2.5 font-semibold">Detalle</th>
              <th className="px-4 py-2.5 text-right font-semibold">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {movimientos.map((m) => (
              <tr key={`${m.tipo}-${m.id}`} className="transition-colors hover:bg-canvas/50">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-[13px] text-ink-500">
                  {m.fecha}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${TIPO_COLOR[m.tipo] ?? 'bg-ink-300'}`}
                    />
                    {m.tipo}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink-500">{m.origen}</td>
                <td className="px-4 py-3 font-medium text-ink">{m.nombre}</td>
                <td className="px-4 py-3 text-right">
                  <Money
                    value={m.monto}
                    signo={esEgreso(m.tipo) ? 'egreso' : 'ingreso'}
                    className={`font-medium ${esEgreso(m.tipo) ? 'text-brick-600' : 'text-pine-700'}`}
                  />
                </td>
              </tr>
            ))}
            {movimientos.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EmptyState mensaje="No hay movimientos que coincidan." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
