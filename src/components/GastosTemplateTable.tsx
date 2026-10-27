'use client';

import { useState, useMemo } from 'react';
import MontoInput from '@/components/MontoInput';
import Money from '@/components/ui/Money';
import SearchInput from '@/components/ui/SearchInput';
import { EmptyState } from '@/components/ui/Layout';
import { ordenDiaPeriodo, formatFechaDMA } from '@/lib/period';
import type { ResumenCuotas } from '@/lib/cuotas';

type Metodo = { id: string; nombre: string };
type Categoria = { id: string; nombre: string };
type GastoTemplate = {
  id: string;
  nombre: string;
  dia_mes: number;
  monto: number;
  payment_method_id: string | null;
  category_id: string | null;
  activo: boolean;
  cuotas_total?: number | null;
};

/**
 * Estado del préstamo y su configuración, detrás de un botón "Cuotas":
 * se toca una vez al cargar el préstamo, no hace falta que esté siempre
 * a la vista en una grilla que ya tiene 5 campos por fila. Vive fuera del
 * <form> de la fila porque los formularios no se pueden anidar.
 */
function CuotasPlantilla({
  g,
  resumen,
  abierto,
  alternar,
  updateCuotas,
}: {
  g: GastoTemplate;
  resumen: ResumenCuotas | null;
  abierto: boolean;
  alternar: () => void;
  updateCuotas: (formData: FormData) => void;
}) {
  return (
    <div className="text-xs text-ink-400">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {resumen &&
          (resumen.terminado ? (
            <span className="font-medium text-pine-700">Préstamo terminado · {resumen.total} cuotas</span>
          ) : (
            <span>
              Préstamo · quedan <span className="font-medium text-ink-700">{resumen.restantes}</span> de{' '}
              {resumen.total} cuotas
              {resumen.fechaFinISO && ` · fin estimado ${formatFechaDMA(resumen.fechaFinISO)}`}
            </span>
          ))}
        <button type="button" onClick={alternar} className="btn-row min-h-[28px] px-1.5 text-ink-400 hover:bg-canvas">
          {abierto ? 'Cerrar' : resumen ? 'Editar cuotas' : 'Cuotas'}
        </button>
      </div>
      {abierto && (
        <form
          action={async (fd) => {
            await updateCuotas(fd);
            alternar();
          }}
          className="mt-2 flex flex-wrap items-end gap-2 rounded-lg bg-canvas/60 p-3"
        >
          <input type="hidden" name="id" value={g.id} />
          <label className="flex flex-col gap-1">
            <span className="label mb-0">Cuotas totales</span>
            <input
              name="cuotas_total"
              type="number"
              min={1}
              defaultValue={resumen?.total ?? ''}
              placeholder="Sin cuotas"
              className="field-sm w-28"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label mb-0">Ya pagadas</span>
            <input
              name="cuotas_pagadas"
              type="number"
              min={0}
              defaultValue={resumen?.pagadas ?? 0}
              className="field-sm w-28"
            />
          </label>
          <button className="btn-row bg-pine-50 text-pine-700 hover:bg-pine-100">Guardar</button>
          <p className="w-full text-[11px] text-ink-400">
            &quot;Ya pagadas&quot; es el total pagado hasta hoy, incluidas las que ya figuran rescatadas o
            pagadas en la app. Dejá &quot;Cuotas totales&quot; vacío para que vuelva a ser un gasto sin fin.
          </p>
        </form>
      )}
    </div>
  );
}

export default function GastosTemplateTable({
  gastos,
  metodos,
  categorias,
  updateExpenseTemplate,
  toggleExpenseTemplate,
  updateCuotas,
  cuotas,
}: {
  gastos: GastoTemplate[];
  metodos: Metodo[];
  categorias: Categoria[];
  updateExpenseTemplate: (formData: FormData) => void;
  toggleExpenseTemplate: (formData: FormData) => void;
  updateCuotas: (formData: FormData) => void;
  /** Resumen de cuotas por id de plantilla (solo las que son préstamos). */
  cuotas: Record<string, ResumenCuotas>;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [cuotasAbierto, setCuotasAbierto] = useState<string | null>(null);
  const alternarCuotas = (id: string) => setCuotasAbierto((actual) => (actual === id ? null : id));
  const metodoPorId = useMemo(() => new Map(metodos.map((m) => [m.id, m.nombre])), [metodos]);

  const ordenados = useMemo(
    () =>
      [...gastos].sort((a, b) => {
        const porDia = ordenDiaPeriodo(a.dia_mes) - ordenDiaPeriodo(b.dia_mes);
        if (porDia !== 0) return porDia;
        const mA = metodoPorId.get(a.payment_method_id ?? '') ?? '';
        const mB = metodoPorId.get(b.payment_method_id ?? '') ?? '';
        const porMetodo = mA.localeCompare(mB, 'es');
        if (porMetodo !== 0) return porMetodo;
        return a.nombre.localeCompare(b.nombre, 'es');
      }),
    [gastos, metodoPorId]
  );

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return ordenados;
    const q = busqueda.trim().toLowerCase();
    return ordenados.filter((g) => g.nombre.toLowerCase().includes(q));
  }, [ordenados, busqueda]);

  const totalActivos = filtrados
    .filter((g) => g.activo)
    .reduce((a, g) => a + Number(g.monto), 0);

  const Campos = ({ g }: { g: GastoTemplate }) => (
    <>
      <input type="hidden" name="id" value={g.id} />
      <input type="hidden" name="activo" value={String(g.activo)} />
    </>
  );

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar gasto…" />
        <div className="shrink-0 text-right">
          <p className="text-[11px] uppercase tracking-wide text-ink-400">Mensual</p>
          <Money value={totalActivos} className="font-semibold text-ink" />
        </div>
      </div>

      {/* ---------- Móvil ---------- */}
      <ul className="space-y-2 md:hidden">
        {filtrados.map((g) => (
          <li
            key={`${g.id}-${g.dia_mes}-${g.monto}-${g.payment_method_id}-${g.category_id}-${g.activo}`}
            className={`card p-3.5 ${g.activo ? '' : 'opacity-55'}`}
          >
            <form action={updateExpenseTemplate}>
              <Campos g={g} />
              <div className="mb-3 flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 truncate font-medium text-ink">{g.nombre}</p>
                <button
                  formAction={toggleExpenseTemplate}
                  className="btn-row shrink-0 text-ink-500 hover:bg-canvas"
                >
                  {g.activo ? 'Desactivar' : 'Activar'}
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
                    defaultValue={g.dia_mes}
                    className="field-sm w-full"
                  />
                </div>
                <div>
                  <label className="label">Monto</label>
                  <MontoInput name="monto" defaultValue={g.monto} className="field-sm w-full" />
                </div>
                <div>
                  <label className="label">Método</label>
                  <select
                    name="payment_method_id"
                    defaultValue={g.payment_method_id ?? ''}
                    className="field-sm w-full"
                  >
                    <option value="">—</option>
                    {metodos.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Categoría</label>
                  <select
                    name="category_id"
                    defaultValue={g.category_id ?? ''}
                    className="field-sm w-full"
                  >
                    <option value="">—</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button className="btn-row mt-3 w-full bg-canvas text-ink-700">Guardar</button>
            </form>
            <div className="mt-2 border-t border-line pt-2">
              <CuotasPlantilla
                g={g}
                resumen={cuotas[g.id] ?? null}
                abierto={cuotasAbierto === g.id}
                alternar={() => alternarCuotas(g.id)}
                updateCuotas={updateCuotas}
              />
            </div>
          </li>
        ))}
        {filtrados.length === 0 && (
          <li className="card">
            <EmptyState
              mensaje={gastos.length === 0 ? 'Todavía no hay gastos.' : 'Ningún gasto coincide.'}
            />
          </li>
        )}
      </ul>

      {/* ---------- Escritorio ---------- */}
      <div className="hidden overflow-hidden rounded-card border border-line bg-surface shadow-card md:block">
        <div className="grid grid-cols-[minmax(0,2fr)_64px_130px_150px_150px_76px_84px] gap-2 border-b border-line bg-canvas/60 px-4 py-2.5 text-[11px] uppercase tracking-wider text-ink-500">
          <span className="font-semibold">Nombre</span>
          <span className="font-semibold">Día</span>
          <span className="font-semibold">Monto</span>
          <span className="font-semibold">Método</span>
          <span className="font-semibold">Categoría</span>
          <span />
          <span />
        </div>
        <div className="divide-y divide-line">
          {filtrados.map((g) => (
            <div
              key={`${g.id}-${g.dia_mes}-${g.monto}-${g.payment_method_id}-${g.category_id}-${g.activo}`}
              className={`px-4 py-2.5 transition-colors hover:bg-canvas/40 ${g.activo ? '' : 'opacity-55'}`}
            >
              <form
                action={updateExpenseTemplate}
                className="grid grid-cols-[minmax(0,2fr)_64px_130px_150px_150px_76px_84px] items-center gap-2"
              >
                <Campos g={g} />
                <span className="truncate text-sm font-medium text-ink">{g.nombre}</span>
                <input
                  name="dia_mes"
                  type="number"
                  min={1}
                  max={31}
                  defaultValue={g.dia_mes}
                  aria-label="Día"
                  className="field-sm w-full"
                />
                <MontoInput name="monto" defaultValue={g.monto} className="field-sm w-full" />
                <select
                  name="payment_method_id"
                  defaultValue={g.payment_method_id ?? ''}
                  aria-label="Método"
                  className="field-sm w-full"
                >
                  <option value="">—</option>
                  {metodos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </select>
                <select
                  name="category_id"
                  defaultValue={g.category_id ?? ''}
                  aria-label="Categoría"
                  className="field-sm w-full"
                >
                  <option value="">—</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
                <button className="btn-row text-pine-700 hover:bg-pine-50">Guardar</button>
                <button
                  formAction={toggleExpenseTemplate}
                  className="btn-row text-ink-500 hover:bg-canvas"
                >
                  {g.activo ? 'Desact.' : 'Activar'}
                </button>
              </form>
              <div className="mt-1">
                <CuotasPlantilla
                  g={g}
                  resumen={cuotas[g.id] ?? null}
                  abierto={cuotasAbierto === g.id}
                  alternar={() => alternarCuotas(g.id)}
                  updateCuotas={updateCuotas}
                />
              </div>
            </div>
          ))}
          {filtrados.length === 0 && (
            <EmptyState
              mensaje={gastos.length === 0 ? 'Todavía no hay gastos.' : 'Ningún gasto coincide.'}
            />
          )}
        </div>
      </div>
    </div>
  );
}
