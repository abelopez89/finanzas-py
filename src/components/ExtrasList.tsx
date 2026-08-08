'use client';

import { useState, useMemo } from 'react';
import MontoInput from '@/components/MontoInput';
import Money from '@/components/ui/Money';
import StatusPill, { ESTADO_BARRA } from '@/components/ui/StatusPill';
import SearchInput from '@/components/ui/SearchInput';
import { EmptyState } from '@/components/ui/Layout';

type Extra = {
  id: string;
  nombre: string;
  monto: number;
  estado: string;
  fecha: string | null;
  dia: number;
};

/** Lista de extras (gastos o ingresos) con búsqueda en vivo. */
export default function ExtrasList({
  items,
  tipo,
  cambiarEstado,
  updateEntry,
  deleteEntry,
}: {
  items: Extra[];
  tipo: 'gasto' | 'ingreso';
  cambiarEstado: (formData: FormData) => void;
  updateEntry: (formData: FormData) => void;
  deleteEntry: (formData: FormData) => void;
}) {
  const [busqueda, setBusqueda] = useState('');

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return items;
    const q = busqueda.trim().toLowerCase();
    return items.filter((i) => i.nombre.toLowerCase().includes(q));
  }, [items, busqueda]);

  const total = filtrados.reduce((a, i) => a + Number(i.monto), 0);
  const esGasto = tipo === 'gasto';
  const editable = (estado: string) => estado === 'pendiente';

  const Acciones = ({ it }: { it: Extra }) => (
    <div className="flex flex-wrap items-center gap-1">
      {esGasto ? (
        <>
          {it.estado === 'pendiente' && (
            <form action={cambiarEstado}>
              <input type="hidden" name="id" value={it.id} />
              <input type="hidden" name="_path" value="/extras" />
              <input type="hidden" name="nuevo_estado" value="rescatado" />
              <button className="btn-row bg-ochre-50 text-ochre-700 hover:bg-ochre-100">
                Rescatar
              </button>
            </form>
          )}
          {it.estado !== 'pagado' && (
            <form action={cambiarEstado}>
              <input type="hidden" name="id" value={it.id} />
              <input type="hidden" name="_path" value="/extras" />
              <input type="hidden" name="nuevo_estado" value="pagado" />
              <button className="btn-row bg-pine-50 text-pine-700 hover:bg-pine-100">Pagar</button>
            </form>
          )}
          {it.estado !== 'pendiente' && (
            <form action={cambiarEstado}>
              <input type="hidden" name="id" value={it.id} />
              <input type="hidden" name="_path" value="/extras" />
              <input type="hidden" name="nuevo_estado" value="pendiente" />
              <button className="btn-row text-ink-500 hover:bg-canvas">Revertir</button>
            </form>
          )}
        </>
      ) : (
        <>
          {it.estado !== 'confirmado' && (
            <form action={cambiarEstado}>
              <input type="hidden" name="id" value={it.id} />
              <input type="hidden" name="_path" value="/extras" />
              <input type="hidden" name="nuevo_estado" value="confirmado" />
              <button className="btn-row bg-pine-50 text-pine-700 hover:bg-pine-100">
                Confirmar
              </button>
            </form>
          )}
          {it.estado === 'confirmado' && (
            <form action={cambiarEstado}>
              <input type="hidden" name="id" value={it.id} />
              <input type="hidden" name="_path" value="/extras" />
              <input type="hidden" name="nuevo_estado" value="pendiente" />
              <button className="btn-row text-ink-500 hover:bg-canvas">Revertir</button>
            </form>
          )}
        </>
      )}
      {it.estado === 'pendiente' && (
        <form action={deleteEntry}>
          <input type="hidden" name="id" value={it.id} />
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
        <SearchInput
          value={busqueda}
          onChange={setBusqueda}
          placeholder={esGasto ? 'Buscar gasto extra…' : 'Buscar ingreso extra…'}
        />
        <div className="shrink-0 text-right">
          <p className="text-[11px] uppercase tracking-wide text-ink-400">Total</p>
          <Money
            value={total}
            className={`font-semibold ${esGasto ? 'text-ink' : 'text-pine-700'}`}
          />
        </div>
      </div>

      <ul className="space-y-2">
        {filtrados.map((it) => (
          <li key={it.id} className="card flex overflow-hidden">
            <span className={`w-1 shrink-0 ${ESTADO_BARRA[it.estado] ?? ESTADO_BARRA.pendiente}`} />
            <div className="min-w-0 flex-1 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{it.nombre}</p>
                  <p className="mt-0.5 text-xs text-ink-400">{it.fecha ?? '—'}</p>
                </div>
                <div className="shrink-0 text-right">
                  <Money
                    value={it.monto}
                    className={`font-semibold ${esGasto ? 'text-ink' : 'text-pine-700'}`}
                  />
                  <div className="mt-1">
                    <StatusPill estado={it.estado} />
                  </div>
                </div>
              </div>

              {editable(it.estado) && (
                <form action={updateEntry} className="mt-3 flex items-center gap-2">
                  <input type="hidden" name="id" value={it.id} />
                  <input type="hidden" name="_path" value="/extras" />
                  <input type="hidden" name="dia" value={it.dia} />
                  <MontoInput name="monto" defaultValue={it.monto} className="field-sm w-full" />
                  <button className="btn-row shrink-0 bg-canvas text-ink-700">Guardar</button>
                </form>
              )}

              <div className="mt-3 border-t border-line pt-2.5">
                <Acciones it={it} />
              </div>
            </div>
          </li>
        ))}
        {filtrados.length === 0 && (
          <li className="card">
            <EmptyState
              mensaje={
                items.length === 0
                  ? `Todavía no cargaste ${esGasto ? 'gastos' : 'ingresos'} extra.`
                  : 'Nada coincide con la búsqueda.'
              }
            />
          </li>
        )}
      </ul>
    </div>
  );
}
