'use client';

import { useState, useMemo } from 'react';

type Metodo = { id: string; nombre: string };
type GastoResumen = { dia: number; payment_method_id: string | null; estado: string };

/**
 * Corre el día de pago de todos los gastos pendientes de un método que caen
 * en un día dado. Sirve para cuando el banco mueve la fecha de corte de una
 * tarjeta y hay que reacomodar varios gastos de una.
 */
export default function CambioDiaMasivo({
  metodos,
  gastos,
  cambiarDiaMasivo,
}: {
  metodos: Metodo[];
  gastos: GastoResumen[];
  cambiarDiaMasivo: (formData: FormData) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [metodoId, setMetodoId] = useState('');
  const [diaActual, setDiaActual] = useState('');

  // Días que realmente tienen gastos pendientes en el método elegido
  const diasDisponibles = useMemo(() => {
    if (!metodoId) return [];
    const dias = new Set(
      gastos
        .filter((g) => g.payment_method_id === metodoId && g.estado === 'pendiente')
        .map((g) => g.dia)
    );
    return Array.from(dias).sort((a, b) => a - b);
  }, [gastos, metodoId]);

  const cuantos = useMemo(() => {
    if (!metodoId || !diaActual) return 0;
    return gastos.filter(
      (g) =>
        g.payment_method_id === metodoId &&
        g.estado === 'pendiente' &&
        g.dia === Number(diaActual)
    ).length;
  }, [gastos, metodoId, diaActual]);

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="btn-secondary w-full justify-between sm:w-auto sm:justify-start"
      >
        <span className="flex items-center gap-2">
          <svg
            viewBox="0 0 24 24"
            className="h-[18px] w-[18px]"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
            <path d="M3.5 10h17M8.5 3v4M15.5 3v4" />
            <path d="M10 15l2 2 3-3" />
          </svg>
          Mover día de pago en bloque
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 transition-transform ${abierto ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {abierto && (
        <div className="card mt-3 p-4">
          <p className="mb-4 text-sm text-ink-500">
            Cambia el día de todos los gastos pendientes de un método que caen en la misma fecha.
            Solo afecta al período vigente — no toca la plantilla ni los gastos ya rescatados o
            pagados.
          </p>

          <form action={cambiarDiaMasivo} className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:items-end">
            <div className="col-span-2 sm:col-span-1">
              <label className="label" htmlFor="bulk-metodo">
                Método de pago
              </label>
              <select
                id="bulk-metodo"
                name="payment_method_id"
                value={metodoId}
                onChange={(e) => {
                  setMetodoId(e.target.value);
                  setDiaActual('');
                }}
                className="field"
                required
              >
                <option value="">Elegir…</option>
                {metodos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="bulk-dia-actual">
                Día actual
              </label>
              <select
                id="bulk-dia-actual"
                name="dia_actual"
                value={diaActual}
                onChange={(e) => setDiaActual(e.target.value)}
                className="field"
                disabled={!metodoId}
                required
              >
                <option value="">{metodoId ? 'Elegir…' : '—'}</option>
                {diasDisponibles.map((d) => (
                  <option key={d} value={d}>
                    Día {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="bulk-dia-nuevo">
                Día nuevo
              </label>
              <input
                id="bulk-dia-nuevo"
                name="dia_nuevo"
                type="number"
                min={1}
                max={31}
                placeholder="22"
                className="field"
                required
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <button className="btn-primary w-full" disabled={!metodoId || !diaActual}>
                Mover {cuantos > 0 ? `${cuantos} gasto${cuantos === 1 ? '' : 's'}` : ''}
              </button>
            </div>
          </form>

          {metodoId && diasDisponibles.length === 0 && (
            <p className="mt-3 text-xs text-ink-400">
              Este método no tiene gastos pendientes en el período vigente.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
