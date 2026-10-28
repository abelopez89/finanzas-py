'use client';

import { useState, useTransition } from 'react';
import MontoInput from '@/components/MontoInput';
import FechaInput from '@/components/FechaInput';
import Money from '@/components/ui/Money';
import StatusPill, { ESTADO_BARRA } from '@/components/ui/StatusPill';
import NuevoPanel from '@/components/ui/NuevoPanel';
import FormularioAlta from '@/components/ui/FormularioAlta';
import { EmptyState } from '@/components/ui/Layout';
import { useFilasOptimistas, datosDe, type AccionServidor } from '@/components/useFilasOptimistas';
import {
  TIPO_DESCUENTO_LABEL,
  type DescuentoResumen,
  type SalarioResumen,
  type TipoDescuento,
} from '@/lib/salario';
import { formatFechaDMA } from '@/lib/period';

type Usuario = { id: string; nombre: string };

export type AccionesSalario = {
  marcarPagado: AccionServidor;
  omitir: AccionServidor;
  revertir: AccionServidor;
  updateSource: AccionServidor;
  deleteSource: AccionServidor;
  addDeduction: AccionServidor;
  updateDeduction: AccionServidor;
  deleteDeduction: AccionServidor;
};

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
 * Formulario de "marcar pagado". Vive como componente propio (y no
 * definido adentro de TarjetaSalario) porque guarda en estado las cuotas
 * elegidas: definido adentro se remontaría en cada render de la tarjeta y
 * perdería el valor.
 *
 * El monto se precarga como cuota × cuotas cubiertas y se recalcula al
 * cambiar las cuotas (key del MontoInput), pero queda editable: el banco
 * a veces cobra distinto por intereses o redondeo.
 */
function FormPago({
  d,
  hoyISO,
  compacto,
  ocupado,
  onSubmit,
}: {
  d: DescuentoResumen;
  hoyISO: string;
  compacto?: boolean;
  ocupado: boolean;
  onSubmit: (fd: FormData) => void;
}) {
  const [cuotas, setCuotas] = useState(1);
  const admiteAdelanto = d.tipo === 'prestamo';
  const montoPrecargado = d.tipo === 'transferencia_fondo' ? d.montoSugerido : d.montoCuota * cuotas;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      className={`flex items-center gap-2 ${compacto ? 'flex-wrap' : 'flex-nowrap'}`}
    >
      {admiteAdelanto ? (
        <label className={`flex items-center gap-1.5 text-xs text-ink-500 ${compacto ? 'w-full' : 'shrink-0'}`}>
          Cuotas
          <input
            name="cuotas_cubiertas"
            type="number"
            min={1}
            max={d.cuotasRestantes ?? undefined}
            value={cuotas}
            onChange={(e) => setCuotas(Math.max(1, Number(e.target.value) || 1))}
            className={`field-sm ${compacto ? 'flex-1' : 'w-16'}`}
          />
        </label>
      ) : (
        <input type="hidden" name="cuotas_cubiertas" value="1" />
      )}
      <MontoInput
        name="monto"
        defaultValue={montoPrecargado}
        key={`monto-${montoPrecargado}`}
        className={`field-sm ${compacto ? 'w-full' : 'w-32 shrink-0'}`}
      />
      <FechaInput
        name="fecha_pago"
        defaultValue={hoyISO}
        required
        aria-label="Fecha de pago"
        className={compacto ? 'w-full' : 'w-40 shrink-0'}
      />
      <button
        type="submit"
        disabled={ocupado}
        className={`btn-row shrink-0 bg-pine-50 text-pine-700 hover:bg-pine-100 disabled:opacity-50 ${
          compacto ? 'w-full justify-center' : ''
        }`}
      >
        Marcar pagado
      </button>
    </form>
  );
}

function CamposDescuento({ d }: { d?: DescuentoResumen }) {
  const [tipo, setTipo] = useState<TipoDescuento>(d?.tipo ?? 'prestamo');
  return (
    <>
      <div className="sm:col-span-2">
        <label className="label">Nombre</label>
        <input
          name="nombre"
          defaultValue={d?.nombre ?? ''}
          placeholder="Ej: Préstamo cooperativa"
          className="field"
          required
        />
      </div>
      <div>
        <label className="label">Tipo</label>
        <select
          name="tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoDescuento)}
          className="field"
        >
          {(Object.keys(TIPO_DESCUENTO_LABEL) as TipoDescuento[]).map((t) => (
            <option key={t} value={t}>
              {TIPO_DESCUENTO_LABEL[t]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">{tipo === 'transferencia_fondo' ? 'Monto habitual' : 'Monto de la cuota'}</label>
        <MontoInput name="monto_cuota" defaultValue={d?.montoCuota} placeholder="0" />
      </div>
      {tipo === 'prestamo' && (
        <>
          <div>
            <label className="label">Cuotas totales</label>
            <input
              name="cuotas_total"
              type="number"
              min={1}
              defaultValue={d?.cuotasTotal ?? ''}
              placeholder="Sin fin definido"
              className="field"
            />
          </div>
          <div>
            <label className="label">Cuotas ya pagadas antes</label>
            <input
              name="cuotas_pagadas_inicial"
              type="number"
              min={0}
              defaultValue={d?.cuotasPagadasInicial ?? 0}
              className="field"
            />
          </div>
        </>
      )}
      <div>
        <label className="label">Orden</label>
        <input name="orden" type="number" defaultValue={d?.orden ?? 0} className="field" />
        <p className="mt-1 text-xs text-ink-400">Define la posición en la lista: el número más bajo aparece primero.</p>
      </div>
    </>
  );
}

/**
 * Tarjeta de un salario en /salario: bruto, descuentos del período con su
 * estado, cuotas restantes y fin estimado de cada préstamo, y lo
 * transferido al fondo.
 *
 * Mismo patrón de edición que Mes actual/Extras: en escritorio el
 * formulario de pago de un concepto pendiente está siempre visible; en la
 * ficha móvil queda detrás de "Editar"/"Cerrar" (o se paga directo con el
 * monto precargado). La configuración del concepto (cuota, cuotas totales)
 * va aparte, detrás de "Configurar", porque se toca muy de vez en cuando.
 */
export default function TarjetaSalario({
  salario,
  usuarios,
  periodoISO,
  hoyISO,
  acciones,
}: {
  salario: SalarioResumen;
  usuarios: Usuario[];
  periodoISO: string;
  hoyISO: string;
  acciones: AccionesSalario;
}) {
  const [editandoSalario, setEditandoSalario] = useState(false);
  const [configurando, setConfigurando] = useState<string | null>(null);
  const [editandoMovil, setEditandoMovil] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // Se pasa la prop tal cual: useFilasOptimistas suelta los parches cuando
  // la lista cambia de referencia (ver CLAUDE.md).
  const { visibles, enCurso, ejecutar } = useFilasOptimistas(salario.descuentos);

  const pagar = (d: DescuentoResumen, fd: FormData) => {
    fd.set('id', d.id);
    fd.set('periodo', periodoISO);
    ejecutar(d.id, acciones.marcarPagado, fd, {
      estado: 'pagado',
      monto: Number(fd.get('monto')) || 0,
    });
    setEditandoMovil(null);
  };

  const pagarDirecto = (d: DescuentoResumen) =>
    pagar(
      d,
      datosDe({
        monto: String(d.tipo === 'transferencia_fondo' ? d.montoSugerido : d.montoCuota),
        cuotas_cubiertas: '1',
        fecha_pago: hoyISO,
      })
    );

  const omitir = (d: DescuentoResumen) =>
    ejecutar(d.id, acciones.omitir, datosDe({ id: d.id, periodo: periodoISO }), { estado: 'omitido' });

  const revertir = (d: DescuentoResumen) =>
    ejecutar(d.id, acciones.revertir, datosDe({ id: d.id, periodo: periodoISO }), {
      estado: 'pendiente',
    });

  // Mientras viaja el "marcar pagado", el registro todavía no existe: se
  // muestra el monto del parche optimista.
  const montoVisible = (d: DescuentoResumen & { monto?: number }) =>
    d.estado === 'pagado' ? (d.pago?.monto ?? d.monto ?? 0) : d.tipo === 'transferencia_fondo' ? d.montoSugerido : d.montoCuota;

  return (
    <section className={`card mb-6 overflow-hidden ${salario.activo ? '' : 'opacity-70'}`}>
      {/* ---------- Encabezado: bruto y neto ---------- */}
      <div className="border-b border-line px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-ink">
              {salario.nombre}
              {!salario.activo && <span className="ml-2 text-xs font-normal text-ink-400">inactivo</span>}
            </p>
            <p className="mt-0.5 text-xs text-ink-400">
              {salario.titularNombre ? `${salario.titularNombre} · ` : ''}
              Cobro el {formatFechaDMA(salario.fechaCobroISO)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-ink-400">Bruto</p>
            <Money value={salario.montoBruto} size="lg" className="font-semibold text-ink" />
          </div>
        </div>

        {/* Bruto − debitado − a debitar − transferido = saldo pendiente: antes
            de transferir es lo sugerido para el fondo, después queda en 0.
            Negativo = los descuentos superan el bruto cargado. */}
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink-400">Debitado</p>
            <Money value={salario.totalDescontado} signo="egreso" className="font-medium text-brick-600" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink-400">A debitar</p>
            <Money value={salario.totalADebitar} signo="egreso" className="font-medium text-ochre-700" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink-400">Saldo pendiente</p>
            <Money
              value={salario.saldoPendiente}
              className={`font-semibold ${salario.saldoPendiente < 0 ? 'text-brick-600' : 'text-ink'}`}
            />
            <p className="text-[11px] text-ink-400">
              {salario.netoTransferido > 0 && salario.saldoPendiente <= 0
                ? 'ya transferido al fondo'
                : 'sugerido para el fondo'}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ink-400">Transferido al fondo</p>
            <Money value={salario.netoTransferido} className="font-medium text-pine-700" />
          </div>
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => setEditandoSalario((v) => !v)}
            className="btn-row text-ink-500 hover:bg-canvas"
          >
            {editandoSalario ? 'Cerrar' : 'Editar salario'}
          </button>
        </div>

        {editandoSalario && (
          <form
            action={async (fd) => {
              await acciones.updateSource(fd);
              setEditandoSalario(false);
            }}
            className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            <input type="hidden" name="id" value={salario.id} />
            <div className="sm:col-span-2">
              <label className="label">Nombre</label>
              <input name="nombre" defaultValue={salario.nombre} className="field" required />
            </div>
            <div>
              <label className="label">Titular</label>
              <select name="titular_user_id" defaultValue={salario.titularUserId ?? ''} className="field">
                <option value="">Sin titular</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Día de cobro</label>
              <input
                name="dia_cobro"
                type="number"
                min={1}
                max={31}
                defaultValue={salario.diaCobro}
                className="field"
                required
              />
            </div>
            <div>
              <label className="label">Monto bruto</label>
              <MontoInput name="monto_bruto" defaultValue={salario.montoBruto} />
            </div>
            <div>
              <label className="label">Orden</label>
              <input name="orden" type="number" defaultValue={salario.orden} className="field" />
              <p className="mt-1 text-xs text-ink-400">Define la posición en la lista: el número más bajo aparece primero.</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input type="checkbox" name="activo" defaultChecked={salario.activo} />
              Activo
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button className="btn-primary">Guardar</button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`¿Eliminar "${salario.nombre}" con todos sus descuentos e historial?`)) {
                    startTransition(() => {
                      acciones.deleteSource(datosDe({ id: salario.id }));
                    });
                  }
                }}
                className="btn-ghost text-brick-600 hover:bg-brick-50"
              >
                Eliminar salario
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ---------- Descuentos del período ---------- */}
      <ul className="divide-y divide-line">
        {visibles.map((d) => {
          const ocupado = Boolean(enCurso[d.id]);
          const pendiente = d.estado === 'pendiente';
          const registrado = d.estado === 'pagado' || d.estado === 'omitido';
          return (
            <li key={d.id} className={`flex transition-opacity ${ocupado ? 'opacity-60' : ''}`}>
              <span
                className={`w-1 shrink-0 ${pendiente ? 'bg-ochre-600' : ESTADO_BARRA[d.estado] ?? ESTADO_BARRA.pendiente}`}
              />
              <div className="min-w-0 flex-1 px-4 py-3 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{d.nombre}</p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {TIPO_DESCUENTO_LABEL[d.tipo]}
                      {d.tipo === 'prestamo' && d.cuotasTotal !== null && (
                        <>
                          {' · '}
                          {d.cuotasRestantes && d.cuotasRestantes > 0 ? (
                            <>
                              quedan <span className="font-medium text-ink-700">{d.cuotasRestantes}</span> de{' '}
                              {d.cuotasTotal} cuotas
                              {d.fechaFinISO && ` · fin estimado ${formatFechaDMA(d.fechaFinISO)}`}
                            </>
                          ) : (
                            'préstamo terminado'
                          )}
                        </>
                      )}
                      {d.tipo === 'prestamo' && d.cuotasTotal === null && ' · sin fin definido'}
                    </p>
                    {d.estado === 'pagado' && d.pago && (
                      <p className="mt-0.5 text-xs text-ink-400">
                        {d.pago.fechaPago && `Pagado el ${formatFechaDMA(d.pago.fechaPago)}`}
                        {d.pago.cuotasCubiertas > 1 && ` · ${d.pago.cuotasCubiertas} cuotas`}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <Money
                      value={montoVisible(d)}
                      signo={d.tipo === 'transferencia_fondo' ? undefined : 'egreso'}
                      className={`font-semibold ${
                        d.tipo === 'transferencia_fondo'
                          ? 'text-pine-700'
                          : pendiente
                            ? 'text-ochre-700'
                            : 'text-brick-600'
                      }`}
                    />
                    <div className="mt-1">
                      <StatusPill estado={d.estado} />
                    </div>
                  </div>
                </div>

                {/* Escritorio: formulario de pago siempre visible si está pendiente */}
                {pendiente && (
                  <div className="mt-3 hidden md:block">
                    <FormPago d={d} hoyISO={hoyISO} ocupado={ocupado} onSubmit={(fd) => pagar(d, fd)} />
                  </div>
                )}
                {/* Móvil: oculto detrás de Editar/Cerrar */}
                {pendiente && editandoMovil === d.id && (
                  <div className="mt-3 md:hidden">
                    <FormPago d={d} hoyISO={hoyISO} compacto ocupado={ocupado} onSubmit={(fd) => pagar(d, fd)} />
                  </div>
                )}

                <div className="mt-2.5 flex flex-wrap items-center gap-1">
                  {pendiente && (
                    <>
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => pagarDirecto(d)}
                        className="btn-row bg-pine-50 text-pine-700 hover:bg-pine-100 disabled:opacity-50 md:hidden"
                      >
                        Marcar pagado
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditandoMovil(editandoMovil === d.id ? null : d.id)}
                        className="btn-row text-ink-500 hover:bg-canvas md:hidden"
                      >
                        {editandoMovil === d.id ? 'Cerrar' : 'Editar'}
                      </button>
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => omitir(d)}
                        className="btn-row text-ink-500 hover:bg-canvas disabled:opacity-50"
                      >
                        Omitir este mes
                      </button>
                    </>
                  )}
                  {registrado && (
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => revertir(d)}
                      className="btn-row text-ink-500 hover:bg-canvas disabled:opacity-50"
                    >
                      Revertir
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfigurando(configurando === d.id ? null : d.id)}
                    className="btn-row text-ink-400 hover:bg-canvas"
                  >
                    {configurando === d.id ? 'Cerrar configuración' : 'Configurar'}
                  </button>
                  {ocupado && <Guardando />}
                </div>

                {configurando === d.id && (
                  <form
                    action={async (fd) => {
                      await acciones.updateDeduction(fd);
                      setConfigurando(null);
                    }}
                    className="mt-3 grid grid-cols-1 gap-3 rounded-lg bg-canvas/60 p-3 sm:grid-cols-2"
                  >
                    <input type="hidden" name="id" value={d.id} />
                    <CamposDescuento d={d} />
                    <label className="flex items-center gap-2 text-sm text-ink-700">
                      <input type="checkbox" name="activo" defaultChecked={d.activo} />
                      Activo
                    </label>
                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                      <button className="btn-primary">Guardar</button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`¿Eliminar "${d.nombre}" con todo su historial de pagos?`)) {
                            ejecutar(d.id, acciones.deleteDeduction, datosDe({ id: d.id }), {
                              eliminado: true,
                            });
                          }
                        }}
                        className="btn-ghost text-brick-600 hover:bg-brick-50"
                      >
                        Eliminar concepto
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </li>
          );
        })}
        {visibles.length === 0 && (
          <li>
            <EmptyState mensaje="Todavía no hay descuentos cargados para este salario." />
          </li>
        )}
      </ul>

      <div className="border-t border-line px-4 pt-4 sm:px-5">
        <NuevoPanel etiqueta="Nuevo descuento">
          <FormularioAlta action={acciones.addDeduction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input type="hidden" name="salary_source_id" value={salario.id} />
            <CamposDescuento />
            <div className="sm:col-span-2">
              <button className="btn-primary w-full sm:w-auto">Agregar descuento</button>
            </div>
          </FormularioAlta>
        </NuevoPanel>
      </div>
    </section>
  );
}
