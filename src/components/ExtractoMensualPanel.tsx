'use client';

import { useState } from 'react';
import type { ResultadoPrueba } from '@/components/TestTelegramButton';
import EnviarExtractoTelegramButton from '@/components/EnviarExtractoTelegramButton';

type Periodo = { iso: string; label: string };

export default function ExtractoMensualPanel({
  periodos,
  hayDestinatarios,
  enviarPorTelegram,
}: {
  periodos: Periodo[];
  hayDestinatarios: boolean;
  enviarPorTelegram: (prev: ResultadoPrueba, formData: FormData) => Promise<ResultadoPrueba>;
}) {
  const [periodoISO, setPeriodoISO] = useState(periodos[0]?.iso ?? '');

  return (
    <div className="card p-4">
      <p className="mb-3 text-sm text-ink-500">
        Saldo anterior, movimientos del período con saldo corrido, y saldo final.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px] flex-1 sm:flex-none">
          <label className="label" htmlFor="extracto-periodo">
            Período
          </label>
          <select
            id="extracto-periodo"
            value={periodoISO}
            onChange={(e) => setPeriodoISO(e.target.value)}
            className="field"
          >
            {periodos.map((p) => (
              <option key={p.iso} value={p.iso}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <a href={`/api/fondo/extracto-mensual?periodo=${periodoISO}`} className="btn-primary">
          Descargar Excel
        </a>
      </div>

      {hayDestinatarios ? (
        <div className="mt-3">
          <EnviarExtractoTelegramButton accion={enviarPorTelegram} periodoISO={periodoISO} />
        </div>
      ) : (
        <p className="mt-3 text-xs text-ink-400">
          Para enviarlo por Telegram, configurá al menos un destinatario en Configuración →
          Telegram.
        </p>
      )}
    </div>
  );
}
