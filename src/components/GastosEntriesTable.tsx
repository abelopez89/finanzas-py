'use client';

import { useState, useMemo } from 'react';
import MontoInput from '@/components/MontoInput';
import Money from '@/components/ui/Money';
import StatusPill, { ESTADO_BARRA } from '@/components/ui/StatusPill';
import SearchInput from '@/components/ui/SearchInput';
import { EmptyState } from '@/components/ui/Layout';
import { formatPeriodoCorto } from '@/lib/period';

type Gasto = {
  id: string;
  nombre: string;
  dia: number;
  monto: number;
  estado: string;
  periodo: string;
};

export default function GastosEntriesTable({
  gastos,
  mostrarPeriodo = false,
  updateExpenseEntry,
  cambiarEstadoGasto,
  deleteExpenseEntry,
}: {
  gastos: Gasto[];
  mostrarPeriodo?: boolean;
  updateExpenseEntry: (formData: FormData) => void;
  cambiarEstadoGasto: (formData: FormData) => void;
  deleteExpenseEntry: (formData: FormData) => void;
}) {
  const [busqueda, setBusqueda] = useState('');

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return gastos;
    const q = busqueda.trim().toLowerCase();
    return gastos.filter((g) => g.nombre.toLowerCase().includes(q));
  }, [gastos, busqueda]);

  const total = filtrados.reduce((a, g) => a + Number(g.monto), 0);

  const periodoLabel = (p: string) => formatPeriodoCorto(new Date(`${p}T00:00:00Z`));

  const Acciones = ({ g, compacto }: { g: Gasto; compacto?: boolean }) => (
    <div className={`flex flex-wrap items-center gap-1 ${compacto ? '' : 'justify-end'}`}>
      {g.estado === 'pendiente' && (
        <form action={cambiarEstadoGasto}>
          <input type="hidden" name="id" value={g.id} />
          <input type="hidden" name="_path" value="/mes-actual" />
          <input type="hidden" name="nuevo_estado" value="rescatado" />
          <button className="btn-row bg-ochre-50 text-ochre-700 hover:bg-ochre-100">Rescatar</button>
        </form>
      )}
      {g.estado !== 'pagado' && (
        <form action={cambiarEstadoGasto}>
          <input type="hidden" name="id" value={g.id} />
          <input type="hidden" name="_path" value="/mes-actual" />
          <input type="hidden" name="nuevo_estado" value="pagado" />
          <button className="btn-row bg-pine-50 text-pine-700 hover:bg-pine-100">Pagar</button>
        </form>
      )}
      {g.estado !== 'pendiente' && (
        <form action={cambiarEstadoGasto}>
          <input type="hidden" name="id" value={g.id} />
          <input type="hidden" name="_path" value="/mes-actual" />
          <input type="hidden" name="nuevo_estado" value="pendiente" />
          <button className="btn-row text-ink-500 hover:bg-canvas">Revertir</button>
        </form>
      )}
      {g.estado === 'pendiente' && (
        <form action={deleteExpenseEntry}>
          <input type="hidden" name="id" value={g.id} />
          <input type="hidden" name="_path" value="/mes-actual" />
          <button className="btn-row text-ink-400 hover:bg-brick-50 hover:text-brick-600">
            Eliminar
          </button>
        </form>
      )}
    </div>
  );

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar gasto…" />
        <div className="shrink-0 text-right">
          <p className="text-[11px] uppercase tracking-wide text-ink-400">Total</p>
          <Money value={total} className="font-semibold text-ink" />
        </div>
      </div>

      {/* ---------- Móvil: fichas con pestaña de estado ---------- */}
      <ul className="space-y-2 md:hidden">
        {filtrados.map((g) => (
          <li key={g.id} className="card flex overflow-hidden">
            <span className={`w-1 shrink-0 ${ESTADO_BARRA[g.estado] ?? ESTADO_BARRA.pendiente}`} />
            <div className="min-w-0 flex-1 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{g.nombre}</p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    Día {g.dia}
                    {mostrarPeriodo && ` · ${periodoLabel(g.periodo)}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <Money value={g.monto} className="font-semibold text-ink" />
                  <div className="mt-1">
                    <StatusPill estado={g.estado} />
                  </div>
                </div>
              </div>

              {g.estado === 'pendiente' && (
                <form action={updateExpenseEntry} className="mt-3 flex items-center gap-2">
                  <input type="hidden" name="id" value={g.id} />
                  <input type="hidden" name="_path" value="/mes-actual" />
                  <input
                    name="dia"
                    type="number"
                    min={1}
                    max={31}
                    defaultValue={g.dia}
                    aria-label="Día"
                    className="field-sm w-16"
                  />
                  <MontoInput name="monto" defaultValue={g.monto} className="field-sm w-full" />
                  <button className="btn-row shrink-0 bg-canvas text-ink-700">Guardar</button>
                </form>
              )}

              <div className="mt-3 border-t border-line pt-2.5">
                <Acciones g={g} compacto />
              </div>
            </div>
          </li>
        ))}
        {filtrados.length === 0 && (
          <li className="card">
            <EmptyState
              mensaje={
                gastos.length === 0 ? 'No hay gastos para mostrar.' : 'Ningún gasto coincide.'
              }
            />
          </li>
        )}
      </ul>

      {/* ---------- Escritorio: tabla ---------- */}
      <div className="hidden overflow-hidden rounded-card border border-line bg-surface shadow-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas/60 text-left text-[11px] uppercase tracking-wider text-ink-500">
              <th className="px-4 py-2.5 font-semibold">Nombre</th>
              {mostrarPeriodo && <th className="px-4 py-2.5 font-semibold">Período</th>}
              <th className="px-4 py-2.5 font-semibold">Día / Monto</th>
              <th className="px-4 py-2.5 font-semibold">Estado</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtrados.map((g) => (
              <tr key={g.id} className="transition-colors hover:bg-canvas/50">
                <td className="px-4 py-3 align-middle font-medium text-ink">{g.nombre}</td>
                {mostrarPeriodo && (
                  <td className="px-4 py-3 align-middle text-ink-500">{periodoLabel(g.periodo)}</td>
                )}
                <td className="px-4 py-3 align-middle">
                  {g.estado !== 'pendiente' ? (
                    <span className="text-ink-500">
                      Día {g.dia} · <Money value={g.monto} className="text-ink" />
                    </span>
                  ) : (
                    <form action={updateExpenseEntry} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={g.id} />
                      <input type="hidden" name="_path" value="/mes-actual" />
                      <input
                        name="dia"
                        type="number"
                        min={1}
                        max={31}
                        defaultValue={g.dia}
                        aria-label="Día"
                        className="field-sm w-16"
                      />
                      <MontoInput name="monto" defaultValue={g.monto} className="field-sm w-36" />
                      <button className="btn-row text-pine-700 hover:bg-pine-50">Guardar</button>
                    </form>
                  )}
                </td>
                <td className="px-4 py-3 align-middle">
                  <StatusPill estado={g.estado} />
                </td>
                <td className="px-4 py-3 align-middle">
                  <Acciones g={g} />
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={mostrarPeriodo ? 5 : 4}>
                  <EmptyState
                    mensaje={
                      gastos.length === 0 ? 'No hay gastos para mostrar.' : 'Ningún gasto coincide.'
                    }
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
