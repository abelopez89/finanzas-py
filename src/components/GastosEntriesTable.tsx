'use client';

import { useState, useMemo } from 'react';
import MontoInput from '@/components/MontoInput';
import Money from '@/components/ui/Money';
import StatusPill, { ESTADO_BARRA } from '@/components/ui/StatusPill';
import SearchInput from '@/components/ui/SearchInput';
import { EmptyState } from '@/components/ui/Layout';
import { formatPeriodoCorto, estaVencido, estaPorVencer, diasParaVencer } from '@/lib/period';
import { useFilasOptimistas, datosDe, type AccionServidor } from '@/components/useFilasOptimistas';

type Gasto = {
  id: string;
  nombre: string;
  dia: number;
  monto: number;
  estado: string;
  periodo: string;
  payment_methods?: { nombre: string } | null;
};

/** Vencido = fecha pasada y todavía sin pagar. */
function vencido(g: Gasto) {
  return g.estado !== 'pagado' && estaVencido(g.periodo, g.dia);
}

/**
 * Por vencer = vence hoy o en los próximos días y todavía está pendiente
 * de rescate. Una vez rescatado la plata ya salió del fondo, así que deja
 * de ser urgente.
 */
function porVencer(g: Gasto) {
  return g.estado === 'pendiente' && estaPorVencer(g.periodo, g.dia);
}

function EtiquetaPorVencer({ g }: { g: Gasto }) {
  const dias = diasParaVencer(g.periodo, g.dia);
  const texto = dias === 0 ? 'Vence hoy' : dias === 1 ? 'Vence mañana' : `Vence en ${dias} días`;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ochre-50 px-2 py-0.5 text-[11px] font-medium text-ochre-700 ring-1 ring-inset ring-ochre-100">
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5V12l2.5 2" />
      </svg>
      {texto}
    </span>
  );
}

function EtiquetaVencido() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brick-50 px-2 py-0.5 text-[11px] font-medium text-brick-700 ring-1 ring-inset ring-brick-100">
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <path d="M12 8v5M12 16.5v.01" />
        <circle cx="12" cy="12" r="9" />
      </svg>
      Vencido
    </span>
  );
}

/** Indicador chico de "esto se está guardando". */
function Guardando() {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-400">
      <svg viewBox="0 0 24 24" className="h-3 w-3 animate-spin" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
        <path d="M12 3a9 9 0 1 0 9 9" />
      </svg>
      Guardando…
    </span>
  );
}

export default function GastosEntriesTable({
  gastos,
  mostrarPeriodo = false,
  path = '/mes-actual',
  updateExpenseEntry,
  cambiarEstadoGasto,
  deleteExpenseEntry,
}: {
  gastos: Gasto[];
  mostrarPeriodo?: boolean;
  path?: string;
  updateExpenseEntry: AccionServidor;
  cambiarEstadoGasto: AccionServidor;
  deleteExpenseEntry: AccionServidor;
}) {
  const [busqueda, setBusqueda] = useState('');
  const { visibles, enCurso, ejecutar } = useFilasOptimistas(gastos);

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return visibles;
    const q = busqueda.trim().toLowerCase();
    return visibles.filter((g) => g.nombre.toLowerCase().includes(q));
  }, [visibles, busqueda]);

  const total = filtrados.reduce((a, g) => a + Number(g.monto), 0);

  const periodoLabel = (p: string) => formatPeriodoCorto(new Date(`${p}T00:00:00Z`));

  const cambiarEstado = (g: Gasto, nuevoEstado: string) =>
    ejecutar(
      g.id,
      cambiarEstadoGasto,
      datosDe({ id: g.id, _path: path, nuevo_estado: nuevoEstado }),
      { estado: nuevoEstado }
    );

  const eliminar = (g: Gasto) =>
    ejecutar(g.id, deleteExpenseEntry, datosDe({ id: g.id, _path: path }), { eliminado: true });

  const guardar = (g: Gasto, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('id', g.id);
    fd.set('_path', path);
    ejecutar(g.id, updateExpenseEntry, fd, {
      dia: Number(fd.get('dia')) || g.dia,
      monto: Number(fd.get('monto')) || 0,
    });
  };

  const Acciones = ({ g, compacto }: { g: Gasto; compacto?: boolean }) => {
    const ocupado = Boolean(enCurso[g.id]);
    return (
      <div className={`flex flex-wrap items-center gap-1 ${compacto ? '' : 'justify-end'}`}>
        {g.estado === 'pendiente' && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => cambiarEstado(g, 'rescatado')}
            className="btn-row bg-ochre-50 text-ochre-700 hover:bg-ochre-100 disabled:opacity-50"
          >
            Rescatar
          </button>
        )}
        {g.estado !== 'pagado' && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => cambiarEstado(g, 'pagado')}
            className="btn-row bg-pine-50 text-pine-700 hover:bg-pine-100 disabled:opacity-50"
          >
            Pagar
          </button>
        )}
        {g.estado !== 'pendiente' && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => cambiarEstado(g, 'pendiente')}
            className="btn-row text-ink-500 hover:bg-canvas disabled:opacity-50"
          >
            Revertir
          </button>
        )}
        {g.estado === 'pendiente' && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => eliminar(g)}
            className="btn-row text-ink-400 hover:bg-brick-50 hover:text-brick-600 disabled:opacity-50"
          >
            Eliminar
          </button>
        )}
        {ocupado && <Guardando />}
      </div>
    );
  };

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
          <li
            key={g.id}
            className={`card flex overflow-hidden transition-opacity ${
              enCurso[g.id] ? 'opacity-60' : ''
            } ${
              vencido(g)
                ? 'border-brick-100 bg-brick-50/30'
                : porVencer(g)
                  ? 'border-ochre-100 bg-ochre-50/30'
                  : ''
            }`}
          >
            <span
              className={`w-1 shrink-0 ${
                vencido(g)
                  ? 'bg-brick-600'
                  : porVencer(g)
                    ? 'bg-ochre-600'
                    : ESTADO_BARRA[g.estado] ?? ESTADO_BARRA.pendiente
              }`}
            />
            <div className="min-w-0 flex-1 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{g.nombre}</p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    Día {g.dia}
                    {g.payment_methods?.nombre && ` · ${g.payment_methods.nombre}`}
                    {mostrarPeriodo && ` · ${periodoLabel(g.periodo)}`}
                  </p>
                  {(vencido(g) || porVencer(g)) && (
                    <div className="mt-1.5">
                      {vencido(g) ? <EtiquetaVencido /> : <EtiquetaPorVencer g={g} />}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <Money value={g.monto} className="font-semibold text-ink" />
                  <div className="mt-1">
                    <StatusPill estado={g.estado} />
                  </div>
                </div>
              </div>

              {g.estado === 'pendiente' && (
                <form
                  onSubmit={(e) => guardar(g, e)}
                  className="mt-3 flex items-center gap-2"
                >
                  <input
                    name="dia"
                    type="number"
                    min={1}
                    max={31}
                    defaultValue={g.dia}
                    key={`dia-${g.dia}`}
                    aria-label="Día"
                    className="field-sm w-16"
                  />
                  <MontoInput
                    name="monto"
                    defaultValue={g.monto}
                    key={`monto-${g.monto}`}
                    className="field-sm w-full"
                  />
                  <button
                    type="submit"
                    disabled={Boolean(enCurso[g.id])}
                    className="btn-row shrink-0 bg-canvas text-ink-700 disabled:opacity-50"
                  >
                    Guardar
                  </button>
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
              <th className="px-4 py-2.5 font-semibold">Método</th>
              {mostrarPeriodo && <th className="px-4 py-2.5 font-semibold">Período</th>}
              <th className="px-4 py-2.5 font-semibold">Día / Monto</th>
              <th className="px-4 py-2.5 font-semibold">Estado</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtrados.map((g) => (
              <tr
                key={g.id}
                className={`transition-colors ${enCurso[g.id] ? 'opacity-60' : ''} ${
                  vencido(g)
                    ? 'bg-brick-50/50 hover:bg-brick-50'
                    : porVencer(g)
                      ? 'bg-ochre-50/40 hover:bg-ochre-50'
                      : 'hover:bg-canvas/50'
                }`}
              >
                <td className="px-4 py-3 align-middle font-medium text-ink">
                  <span className="flex items-center gap-2">
                    {vencido(g) ? (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brick-600" title="Vencido" />
                    ) : porVencer(g) ? (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ochre-600" title="Por vencer" />
                    ) : null}
                    {g.nombre}
                  </span>
                </td>
                <td className="px-4 py-3 align-middle text-ink-500">
                  {g.payment_methods?.nombre ?? '—'}
                </td>
                {mostrarPeriodo && (
                  <td className="px-4 py-3 align-middle text-ink-500">{periodoLabel(g.periodo)}</td>
                )}
                <td className="px-4 py-3 align-middle">
                  {g.estado !== 'pendiente' ? (
                    <span className="text-ink-500">
                      Día {g.dia} · <Money value={g.monto} className="text-ink" />
                    </span>
                  ) : (
                    <form onSubmit={(e) => guardar(g, e)} className="flex items-center gap-2">
                      <input
                        name="dia"
                        type="number"
                        min={1}
                        max={31}
                        defaultValue={g.dia}
                        key={`dia-${g.dia}`}
                        aria-label="Día"
                        className="field-sm w-16"
                      />
                      <MontoInput
                        name="monto"
                        defaultValue={g.monto}
                        key={`monto-${g.monto}`}
                        className="field-sm w-36"
                      />
                      <button
                        type="submit"
                        disabled={Boolean(enCurso[g.id])}
                        className="btn-row text-pine-700 hover:bg-pine-50 disabled:opacity-50"
                      >
                        Guardar
                      </button>
                    </form>
                  )}
                </td>
                <td className="px-4 py-3 align-middle">
                  {vencido(g) ? (
                    <EtiquetaVencido />
                  ) : porVencer(g) ? (
                    <EtiquetaPorVencer g={g} />
                  ) : (
                    <StatusPill estado={g.estado} />
                  )}
                </td>
                <td className="px-4 py-3 align-middle">
                  <Acciones g={g} />
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={mostrarPeriodo ? 6 : 5}>
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
