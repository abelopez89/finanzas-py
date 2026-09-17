'use client';

import { useState, useMemo } from 'react';
import MontoInput from '@/components/MontoInput';
import Money from '@/components/ui/Money';
import StatusPill, { ESTADO_BARRA } from '@/components/ui/StatusPill';
import SearchInput from '@/components/ui/SearchInput';
import { EmptyState } from '@/components/ui/Layout';
import { estaVencido, estaPorVencer, diasParaVencer } from '@/lib/period';
import { useFilasOptimistas, datosDe, type AccionServidor } from '@/components/useFilasOptimistas';

type Metodo = { id: string; nombre: string };

export type Extra = {
  id: string;
  nombre: string;
  monto: number;
  estado: string;
  fecha: string | null;
  metodoId: string | null;
  metodoNombre: string | null;
  periodo: string;
  dia: number;
};

/** Vencido = fecha pasada y todavía sin pagar. Solo aplica a gastos: los
 *  ingresos no tienen el concepto de "urgencia de rescate". */
function vencido(it: Extra, esGasto: boolean) {
  return esGasto && it.estado !== 'pagado' && estaVencido(it.periodo, it.dia);
}

function porVencer(it: Extra, esGasto: boolean) {
  return esGasto && it.estado === 'pendiente' && estaPorVencer(it.periodo, it.dia);
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

function EtiquetaPorVencer({ it }: { it: Extra }) {
  const dias = diasParaVencer(it.periodo, it.dia);
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

/** Indicador chico de "esto se está guardando" — igual al de las grillas de Mes actual. */
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

/**
 * Grilla de extras, con el mismo diseño que las tablas de Mes actual
 * (GastosEntriesTable/IngresosEntriesTable): tarjetas en móvil, tabla en
 * escritorio, actualización optimista al cambiar de estado.
 *
 * Difiere de Mes actual en dos cosas, porque un extra no viene de una
 * plantilla: la fecha es completa (no un simple "día" del período vigente) y
 * el método de pago se puede editar por extra, junto con el monto y la
 * fecha, en un único formulario mientras está pendiente.
 */
export default function ExtrasList({
  items,
  tipo,
  metodos = [],
  cambiarEstado,
  updateExtra,
  deleteEntry,
}: {
  items: Extra[];
  tipo: 'gasto' | 'ingreso';
  metodos?: Metodo[];
  cambiarEstado: AccionServidor;
  updateExtra: AccionServidor;
  deleteEntry: AccionServidor;
}) {
  const [busqueda, setBusqueda] = useState('');
  const esGasto = tipo === 'gasto';
  const campoFecha = esGasto ? 'fecha_vencimiento' : 'fecha_aplicacion';
  const { visibles, enCurso, ejecutar } = useFilasOptimistas(items);

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return visibles;
    const q = busqueda.trim().toLowerCase();
    return visibles.filter((i) => i.nombre.toLowerCase().includes(q));
  }, [visibles, busqueda]);

  const total = filtrados.reduce((a, i) => a + Number(i.monto), 0);

  const cambiarEstadoDe = (it: Extra, nuevoEstado: string) =>
    ejecutar(
      it.id,
      cambiarEstado,
      datosDe({ id: it.id, _path: '/extras', nuevo_estado: nuevoEstado }),
      { estado: nuevoEstado }
    );

  const eliminar = (it: Extra) =>
    ejecutar(it.id, deleteEntry, datosDe({ id: it.id, _path: '/extras' }), { eliminado: true });

  const guardar = (it: Extra, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set('id', it.id);
    const fecha = String(fd.get(campoFecha) || it.fecha || '');
    const metodoIdNuevo = esGasto ? String(fd.get('payment_method_id') || '') || null : it.metodoId;
    const metodoNombreNuevo = esGasto
      ? (metodos.find((m) => m.id === metodoIdNuevo)?.nombre ?? null)
      : it.metodoNombre;
    ejecutar(it.id, updateExtra, fd, {
      monto: Number(fd.get('monto')) || 0,
      fecha,
      metodoId: metodoIdNuevo,
      metodoNombre: metodoNombreNuevo,
    });
  };

  const CamposEdicion = ({ it, compacto }: { it: Extra; compacto?: boolean }) => (
    <form onSubmit={(e) => guardar(it, e)} className="flex flex-wrap items-center gap-2">
      <input
        name={campoFecha}
        type="date"
        defaultValue={it.fecha ?? ''}
        key={`fecha-${it.fecha}`}
        aria-label="Fecha"
        className={`field-sm ${compacto ? 'w-full' : 'w-36'}`}
        required
      />
      <MontoInput
        name="monto"
        defaultValue={it.monto}
        key={`monto-${it.monto}`}
        className={`field-sm ${compacto ? 'w-full' : 'w-32'}`}
      />
      {esGasto && (
        <select
          name="payment_method_id"
          defaultValue={it.metodoId ?? ''}
          key={`metodo-${it.metodoId}`}
          aria-label="Método de pago"
          className={`field-sm ${compacto ? 'w-full' : ''}`}
        >
          <option value="">Sin método</option>
          {metodos.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </select>
      )}
      <button
        type="submit"
        disabled={Boolean(enCurso[it.id])}
        className={`btn-row shrink-0 ${
          compacto ? 'w-full bg-canvas text-ink-700' : 'text-pine-700 hover:bg-pine-50'
        } disabled:opacity-50`}
      >
        Guardar
      </button>
    </form>
  );

  const Acciones = ({ it, compacto }: { it: Extra; compacto?: boolean }) => {
    const ocupado = Boolean(enCurso[it.id]);
    return (
      <div className={`flex flex-wrap items-center gap-1 ${compacto ? '' : 'justify-end'}`}>
        {esGasto ? (
          <>
            {it.estado === 'pendiente' && (
              <button
                type="button"
                disabled={ocupado}
                onClick={() => cambiarEstadoDe(it, 'rescatado')}
                className="btn-row bg-ochre-50 text-ochre-700 hover:bg-ochre-100 disabled:opacity-50"
              >
                Rescatar
              </button>
            )}
            {it.estado !== 'pagado' && (
              <button
                type="button"
                disabled={ocupado}
                onClick={() => cambiarEstadoDe(it, 'pagado')}
                className="btn-row bg-pine-50 text-pine-700 hover:bg-pine-100 disabled:opacity-50"
              >
                Pagar
              </button>
            )}
            {it.estado !== 'pendiente' && (
              <button
                type="button"
                disabled={ocupado}
                onClick={() => cambiarEstadoDe(it, 'pendiente')}
                className="btn-row text-ink-500 hover:bg-canvas disabled:opacity-50"
              >
                Revertir
              </button>
            )}
          </>
        ) : it.estado !== 'confirmado' ? (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => cambiarEstadoDe(it, 'confirmado')}
            className="btn-row bg-pine-50 text-pine-700 hover:bg-pine-100 disabled:opacity-50"
          >
            Confirmar
          </button>
        ) : (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => cambiarEstadoDe(it, 'pendiente')}
            className="btn-row text-ink-500 hover:bg-canvas disabled:opacity-50"
          >
            Revertir
          </button>
        )}
        {it.estado === 'pendiente' && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => eliminar(it)}
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

      {/* ---------- Móvil: fichas ---------- */}
      <ul className="space-y-2 md:hidden">
        {filtrados.map((it) => (
          <li
            key={it.id}
            className={`card flex overflow-hidden transition-opacity ${
              enCurso[it.id] ? 'opacity-60' : ''
            } ${
              vencido(it, esGasto)
                ? 'border-brick-100 bg-brick-50/30'
                : porVencer(it, esGasto)
                  ? 'border-ochre-100 bg-ochre-50/30'
                  : ''
            }`}
          >
            <span
              className={`w-1 shrink-0 ${
                vencido(it, esGasto)
                  ? 'bg-brick-600'
                  : porVencer(it, esGasto)
                    ? 'bg-ochre-600'
                    : ESTADO_BARRA[it.estado] ?? ESTADO_BARRA.pendiente
              }`}
            />
            <div className="min-w-0 flex-1 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{it.nombre}</p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    {it.fecha ?? '—'}
                    {esGasto && it.metodoNombre && ` · ${it.metodoNombre}`}
                  </p>
                  {(vencido(it, esGasto) || porVencer(it, esGasto)) && (
                    <div className="mt-1.5">
                      {vencido(it, esGasto) ? <EtiquetaVencido /> : <EtiquetaPorVencer it={it} />}
                    </div>
                  )}
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

              {it.estado === 'pendiente' && (
                <div className="mt-3">
                  <CamposEdicion it={it} compacto />
                </div>
              )}

              <div className="mt-3 border-t border-line pt-2.5">
                <Acciones it={it} compacto />
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

      {/* ---------- Escritorio: tabla ---------- */}
      <div className="hidden overflow-hidden rounded-card border border-line bg-surface shadow-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas/60 text-left text-[11px] uppercase tracking-wider text-ink-500">
              <th className="px-4 py-2.5 font-semibold">Nombre</th>
              {esGasto && <th className="px-4 py-2.5 font-semibold">Método</th>}
              <th className="px-4 py-2.5 font-semibold">Fecha / Monto</th>
              <th className="px-4 py-2.5 font-semibold">Estado</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtrados.map((it) => (
              <tr
                key={it.id}
                className={`transition-colors ${enCurso[it.id] ? 'opacity-60' : ''} ${
                  vencido(it, esGasto)
                    ? 'bg-brick-50/50 hover:bg-brick-50'
                    : porVencer(it, esGasto)
                      ? 'bg-ochre-50/40 hover:bg-ochre-50'
                      : 'hover:bg-canvas/50'
                }`}
              >
                <td className="px-4 py-3 align-middle font-medium text-ink">
                  <span className="flex items-center gap-2">
                    {vencido(it, esGasto) ? (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brick-600" title="Vencido" />
                    ) : porVencer(it, esGasto) ? (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ochre-600" title="Por vencer" />
                    ) : null}
                    {it.nombre}
                  </span>
                </td>
                {esGasto && (
                  <td className="px-4 py-3 align-middle text-ink-500">{it.metodoNombre ?? '—'}</td>
                )}
                <td className="px-4 py-3 align-middle">
                  {it.estado !== 'pendiente' ? (
                    <span className="text-ink-500">
                      {it.fecha ?? '—'} · <Money value={it.monto} className="text-ink" />
                    </span>
                  ) : (
                    <CamposEdicion it={it} />
                  )}
                </td>
                <td className="px-4 py-3 align-middle">
                  {vencido(it, esGasto) ? (
                    <EtiquetaVencido />
                  ) : porVencer(it, esGasto) ? (
                    <EtiquetaPorVencer it={it} />
                  ) : (
                    <StatusPill estado={it.estado} />
                  )}
                </td>
                <td className="px-4 py-3 align-middle">
                  <Acciones it={it} />
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={esGasto ? 5 : 4}>
                  <EmptyState
                    mensaje={
                      items.length === 0
                        ? `Todavía no cargaste ${esGasto ? 'gastos' : 'ingresos'} extra.`
                        : 'Nada coincide con la búsqueda.'
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
