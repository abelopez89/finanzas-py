'use client';

import { useState, useMemo } from 'react';
import MontoInput from '@/components/MontoInput';
import Money from '@/components/ui/Money';
import SearchInput from '@/components/ui/SearchInput';
import { EmptyState } from '@/components/ui/Layout';
import { ordenDiaPeriodo } from '@/lib/period';

type IngresoTemplate = {
  id: string;
  nombre: string;
  dia_mes: number;
  monto: number;
  activo: boolean;
};

export default function IngresosTemplateTable({
  ingresos,
  updateIncomeTemplate,
  toggleIncomeTemplate,
}: {
  ingresos: IngresoTemplate[];
  updateIncomeTemplate: (formData: FormData) => void;
  toggleIncomeTemplate: (formData: FormData) => void;
}) {
  const [busqueda, setBusqueda] = useState('');

  const ordenados = useMemo(
    () =>
      [...ingresos].sort((a, b) => {
        const porDia = ordenDiaPeriodo(a.dia_mes) - ordenDiaPeriodo(b.dia_mes);
        if (porDia !== 0) return porDia;
        return a.nombre.localeCompare(b.nombre, 'es');
      }),
    [ingresos]
  );

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return ordenados;
    const q = busqueda.trim().toLowerCase();
    return ordenados.filter((i) => i.nombre.toLowerCase().includes(q));
  }, [ordenados, busqueda]);

  const totalActivos = filtrados.filter((i) => i.activo).reduce((a, i) => a + Number(i.monto), 0);

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar ingreso…" />
        <div className="shrink-0 text-right">
          <p className="text-[11px] uppercase tracking-wide text-ink-400">Mensual</p>
          <Money value={totalActivos} className="font-semibold text-pine-700" />
        </div>
      </div>

      <ul className="space-y-2 md:hidden">
        {filtrados.map((i) => (
          <li
            key={`${i.id}-${i.dia_mes}-${i.monto}-${i.activo}`}
            className={`card p-3.5 ${i.activo ? '' : 'opacity-55'}`}
          >
            <form action={updateIncomeTemplate}>
              <input type="hidden" name="id" value={i.id} />
              <input type="hidden" name="activo" value={String(i.activo)} />
              <div className="mb-3 flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 truncate font-medium text-ink">{i.nombre}</p>
                <button
                  formAction={toggleIncomeTemplate}
                  className="btn-row shrink-0 text-ink-500 hover:bg-canvas"
                >
                  {i.activo ? 'Desactivar' : 'Activar'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Día</label>
                  <input
                    name="dia_mes"
                    type="number"
                    min={1}
                    max={31}
                    defaultValue={i.dia_mes}
                    className="field-sm w-full"
                  />
                </div>
                <div>
                  <label className="label">Monto</label>
                  <MontoInput name="monto" defaultValue={i.monto} className="field-sm w-full" />
                </div>
              </div>
              <button className="btn-row mt-3 w-full bg-canvas text-ink-700">Guardar</button>
            </form>
          </li>
        ))}
        {filtrados.length === 0 && (
          <li className="card">
            <EmptyState
              mensaje={ingresos.length === 0 ? 'Todavía no hay ingresos.' : 'Ningún ingreso coincide.'}
            />
          </li>
        )}
      </ul>

      <div className="hidden overflow-hidden rounded-card border border-line bg-surface shadow-card md:block">
        <div className="grid grid-cols-[minmax(0,2fr)_64px_140px_76px_84px] gap-2 border-b border-line bg-canvas/60 px-4 py-2.5 text-[11px] uppercase tracking-wider text-ink-500">
          <span className="font-semibold">Nombre</span>
          <span className="font-semibold">Día</span>
          <span className="font-semibold">Monto</span>
          <span />
          <span />
        </div>
        <div className="divide-y divide-line">
          {filtrados.map((i) => (
            <form
              key={`${i.id}-${i.dia_mes}-${i.monto}-${i.activo}`}
              action={updateIncomeTemplate}
              className={`grid grid-cols-[minmax(0,2fr)_64px_140px_76px_84px] items-center gap-2 px-4 py-2.5 transition-colors hover:bg-canvas/40 ${
                i.activo ? '' : 'opacity-55'
              }`}
            >
              <input type="hidden" name="id" value={i.id} />
              <input type="hidden" name="activo" value={String(i.activo)} />
              <span className="truncate text-sm font-medium text-ink">{i.nombre}</span>
              <input
                name="dia_mes"
                type="number"
                min={1}
                max={31}
                defaultValue={i.dia_mes}
                aria-label="Día"
                className="field-sm w-full"
              />
              <MontoInput name="monto" defaultValue={i.monto} className="field-sm w-full" />
              <button className="btn-row text-pine-700 hover:bg-pine-50">Guardar</button>
              <button
                formAction={toggleIncomeTemplate}
                className="btn-row text-ink-500 hover:bg-canvas"
              >
                {i.activo ? 'Desact.' : 'Activar'}
              </button>
            </form>
          ))}
          {filtrados.length === 0 && (
            <EmptyState
              mensaje={ingresos.length === 0 ? 'Todavía no hay ingresos.' : 'Ningún ingreso coincide.'}
            />
          )}
        </div>
      </div>
    </div>
  );
}
