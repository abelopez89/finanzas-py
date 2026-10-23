'use client';

import { useState } from 'react';
import Money from '@/components/ui/Money';
import { EmptyState } from '@/components/ui/Layout';
import { useFilasOptimistas, datosDe, type AccionServidor } from '@/components/useFilasOptimistas';

export type MovimientoVista = {
  id: string;
  tipo: string;
  origen: string;
  nombre: string;
  fecha: string;
  monto: number;
  categoriaId: string | null;
  categoriaNombre: string | null;
};

type Categoria = { id: string; nombre: string };

const TIPO_COLOR: Record<string, string> = {
  Gasto: 'bg-brick-600',
  Ingreso: 'bg-pine-600',
  Interés: 'bg-pine-200',
  'Saldo inicial': 'bg-ink-300',
};

/**
 * Corregir la categoría de un gasto ya confirmado tiene que ser un gesto
 * puntual, no un campo siempre editable con el que sea fácil tropezar
 * revisando la lista. Por eso queda detrás de un botón "Editar" — solo un
 * movimiento a la vez puede estar en edición — en vez de un <select>
 * visible de entrada.
 */
export default function MovimientosList({
  movimientos,
  categorias = [],
  actualizarCategoria,
}: {
  movimientos: MovimientoVista[];
  categorias?: Categoria[];
  actualizarCategoria?: AccionServidor;
}) {
  const esEgreso = (t: string) => t === 'Gasto';
  const [editando, setEditando] = useState<string | null>(null);
  const { visibles, enCurso, ejecutar } = useFilasOptimistas(movimientos);

  const guardarCategoria = (m: MovimientoVista, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!actualizarCategoria) return;
    const fd = new FormData(e.currentTarget);
    const categoryId = String(fd.get('category_id') || '');
    fd.set('id', m.id);
    fd.set('_path', '/fondo');
    ejecutar(m.id, actualizarCategoria, fd, {
      categoriaId: categoryId || null,
      categoriaNombre: categorias.find((c) => c.id === categoryId)?.nombre ?? null,
    });
    setEditando(null);
  };

  const CategoriaCelda = ({ m }: { m: MovimientoVista }) => {
    if (m.tipo !== 'Gasto' || !actualizarCategoria) {
      return <>{m.categoriaNombre ?? '—'}</>;
    }
    if (editando !== m.id) {
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {m.categoriaNombre ?? '—'}
          <button
            type="button"
            onClick={() => setEditando(m.id)}
            className="text-xs font-medium text-ink-400 underline hover:text-ink-600"
          >
            Editar
          </button>
        </span>
      );
    }
    return (
      <form onSubmit={(e) => guardarCategoria(m, e)} className="flex flex-wrap items-center gap-1.5">
        <select
          name="category_id"
          defaultValue={m.categoriaId ?? ''}
          aria-label="Categoría"
          className="field-sm"
        >
          <option value="">Sin categoría</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-row bg-canvas text-ink-700">
          Guardar
        </button>
        <button type="button" onClick={() => setEditando(null)} className="btn-row text-ink-500">
          Cancelar
        </button>
      </form>
    );
  };

  return (
    <>
      {/* ---------- Móvil ---------- */}
      <ul className="card divide-y divide-line overflow-hidden md:hidden">
        {visibles.map((m) => (
          <li
            key={`${m.tipo}-${m.id}`}
            className={`flex items-center gap-3 px-4 py-3 transition-opacity ${
              enCurso[m.id] ? 'opacity-60' : ''
            }`}
          >
            <span className={`h-8 w-1 shrink-0 rounded-full ${TIPO_COLOR[m.tipo] ?? 'bg-ink-300'}`} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{m.nombre}</p>
              <p className="mt-0.5 text-xs text-ink-400">
                {m.fecha} · {m.tipo}
                {m.origen !== 'Fondo' && ` · ${m.origen}`}
              </p>
              {(m.tipo === 'Gasto' || m.categoriaNombre) && (
                <p className="mt-1 text-xs text-ink-500">
                  <CategoriaCelda m={m} />
                </p>
              )}
            </div>
            <Money
              value={m.monto}
              signo={esEgreso(m.tipo) ? 'egreso' : 'ingreso'}
              className={`shrink-0 font-medium ${esEgreso(m.tipo) ? 'text-brick-600' : 'text-pine-700'}`}
            />
          </li>
        ))}
        {visibles.length === 0 && <EmptyState mensaje="No hay movimientos que coincidan." />}
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
              <th className="px-4 py-2.5 font-semibold">Categoría</th>
              <th className="px-4 py-2.5 text-right font-semibold">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visibles.map((m) => (
              <tr
                key={`${m.tipo}-${m.id}`}
                className={`transition-colors hover:bg-canvas/50 ${enCurso[m.id] ? 'opacity-60' : ''}`}
              >
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
                <td className="px-4 py-3 text-ink-500">
                  <CategoriaCelda m={m} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Money
                    value={m.monto}
                    signo={esEgreso(m.tipo) ? 'egreso' : 'ingreso'}
                    className={`font-medium ${esEgreso(m.tipo) ? 'text-brick-600' : 'text-pine-700'}`}
                  />
                </td>
              </tr>
            ))}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={6}>
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
