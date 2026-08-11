'use client';

import { useState, useMemo } from 'react';
import MontoInput from '@/components/MontoInput';
import Money from '@/components/ui/Money';
import StatusPill, { ESTADO_BARRA } from '@/components/ui/StatusPill';
import SearchInput from '@/components/ui/SearchInput';
import { EmptyState } from '@/components/ui/Layout';
import { formatPeriodoCorto } from '@/lib/period';

type Ingreso = {
  id: string;
  nombre: string;
  dia: number;
  monto: number;
  estado: string;
  periodo: string;
};

export default function IngresosEntriesTable({
  ingresos,
  mostrarPeriodo = false,
  updateIncomeEntry,
  cambiarEstadoIngreso,
  deleteIncomeEntry,
}: {
  ingresos: Ingreso[];
  mostrarPeriodo?: boolean;
  updateIncomeEntry: (formData: FormData) => void;
  cambiarEstadoIngreso: (formData: FormData) => void;
  deleteIncomeEntry: (formData: FormData) => void;
}) {
  const [busqueda, setBusqueda] = useState('');

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return ingresos;
    const q = busqueda.trim().toLowerCase();
    return ingresos.filter((i) => i.nombre.toLowerCase().includes(q));
  }, [ingresos, busqueda]);

  const total = filtrados.reduce((a, i) => a + Number(i.monto), 0);
  const periodoLabel = (p: string) => formatPeriodoCorto(new Date(`${p}T00:00:00Z`));

  const Acciones = ({ i, compacto }: { i: Ingreso; compacto?: boolean }) => (
    <div className={`flex flex-wrap items-center gap-1 ${compacto ? '' : 'justify-end'}`}>
      {i.estado !== 'confirmado' ? (
        <>
          <form action={cambiarEstadoIngreso}>
            <input type="hidden" name="id" value={i.id} />
            <input type="hidden" name="_path" value="/mes-actual" />
            <input type="hidden" name="nuevo_estado" value="confirmado" />
            <button className="btn-row bg-pine-50 text-pine-700 hover:bg-pine-100">Confirmar</button>
          </form>
          <form action={deleteIncomeEntry}>
            <input type="hidden" name="id" value={i.id} />
            <input type="hidden" name="_path" value="/mes-actual" />
            <button className="btn-row text-ink-400 hover:bg-brick-50 hover:text-brick-600">
              Eliminar
            </button>
          </form>
        </>
      ) : (
        <form action={cambiarEstadoIngreso}>
          <input type="hidden" name="id" value={i.id} />
          <input type="hidden" name="_path" value="/mes-actual" />
          <input type="hidden" name="nuevo_estado" value="pendiente" />
          <button className="btn-row text-ink-500 hover:bg-canvas">Revertir</button>
        </form>
      )}
    </div>
  );

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar ingreso…" />
        <div className="shrink-0 text-right">
          <p className="text-[11px] uppercase tracking-wide text-ink-400">Total</p>
          <Money value={total} className="font-semibold text-ink" />
        </div>
      </div>

      {/* ---------- Móvil ---------- */}
      <ul className="space-y-2 md:hidden">
        {filtrados.map((i) => (
          <li key={`${i.id}-${i.dia}-${i.monto}-${i.estado}`} className="card flex overflow-hidden">
            <span className={`w-1 shrink-0 ${ESTADO_BARRA[i.estado] ?? ESTADO_BARRA.pendiente}`} />
            <div className="min-w-0 flex-1 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{i.nombre}</p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    Día {i.dia}
                    {mostrarPeriodo && ` · ${periodoLabel(i.periodo)}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <Money value={i.monto} className="font-semibold text-pine-700" />
                  <div className="mt-1">
                    <StatusPill estado={i.estado} />
                  </div>
                </div>
              </div>

              {i.estado !== 'confirmado' && (
                <form action={updateIncomeEntry} className="mt-3 flex items-center gap-2">
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="_path" value="/mes-actual" />
                  <input
                    name="dia"
                    type="number"
                    min={1}
                    max={31}
                    defaultValue={i.dia}
                    aria-label="Día"
                    className="field-sm w-16"
                  />
                  <MontoInput name="monto" defaultValue={i.monto} className="field-sm w-full" />
                  <button className="btn-row shrink-0 bg-canvas text-ink-700">Guardar</button>
                </form>
              )}

              <div className="mt-3 border-t border-line pt-2.5">
                <Acciones i={i} compacto />
              </div>
            </div>
          </li>
        ))}
        {filtrados.length === 0 && (
          <li className="card">
            <EmptyState
              mensaje={
                ingresos.length === 0 ? 'No hay ingresos para mostrar.' : 'Ningún ingreso coincide.'
              }
            />
          </li>
        )}
      </ul>

      {/* ---------- Escritorio ---------- */}
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
            {filtrados.map((i) => (
              <tr
                key={`${i.id}-${i.dia}-${i.monto}-${i.estado}`}
                className="transition-colors hover:bg-canvas/50"
              >
                <td className="px-4 py-3 align-middle font-medium text-ink">{i.nombre}</td>
                {mostrarPeriodo && (
                  <td className="px-4 py-3 align-middle text-ink-500">{periodoLabel(i.periodo)}</td>
                )}
                <td className="px-4 py-3 align-middle">
                  {i.estado === 'confirmado' ? (
                    <span className="text-ink-500">
                      Día {i.dia} · <Money value={i.monto} className="text-pine-700" />
                    </span>
                  ) : (
                    <form action={updateIncomeEntry} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={i.id} />
                      <input type="hidden" name="_path" value="/mes-actual" />
                      <input
                        name="dia"
                        type="number"
                        min={1}
                        max={31}
                        defaultValue={i.dia}
                        aria-label="Día"
                        className="field-sm w-16"
                      />
                      <MontoInput name="monto" defaultValue={i.monto} className="field-sm w-36" />
                      <button className="btn-row text-pine-700 hover:bg-pine-50">Guardar</button>
                    </form>
                  )}
                </td>
                <td className="px-4 py-3 align-middle">
                  <StatusPill estado={i.estado} />
                </td>
                <td className="px-4 py-3 align-middle">
                  <Acciones i={i} />
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={mostrarPeriodo ? 5 : 4}>
                  <EmptyState
                    mensaje={
                      ingresos.length === 0
                        ? 'No hay ingresos para mostrar.'
                        : 'Ningún ingreso coincide.'
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
