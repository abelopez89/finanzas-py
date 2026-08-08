'use client';

import { useState, useMemo } from 'react';
import LineChartSaldoProyectado from '@/components/LineChartSaldoProyectado';
import Money from '@/components/ui/Money';
import MontoInput from '@/components/MontoInput';
import { Section, Aviso } from '@/components/ui/Layout';

export type FilaPrevision = {
  periodoISO: string;
  label: string;
  labelLargo: string;
  ingresos: number;
  gastos: number;
  tieneExtra: boolean;
};

type Simulacion = {
  id: number;
  nombre: string;
  monto: number;
  periodoISO: string;
  tipo: 'gasto' | 'ingreso';
};

/**
 * Proyección con simulaciones temporales. Las simulaciones viven solo en
 * memoria: sirven para tantear una compra futura sin ensuciar Extras, y
 * desaparecen al recargar la página.
 */
export default function PrevisionesSimulador({
  filas,
  saldoInicialProyeccion,
}: {
  filas: FilaPrevision[];
  saldoInicialProyeccion: number;
}) {
  const [simulaciones, setSimulaciones] = useState<Simulacion[]>([]);
  const [nombre, setNombre] = useState('');
  const [montoTexto, setMontoTexto] = useState('');
  const [periodoISO, setPeriodoISO] = useState(filas[1]?.periodoISO ?? filas[0]?.periodoISO ?? '');
  const [tipo, setTipo] = useState<'gasto' | 'ingreso'>('gasto');
  // Se usa para reiniciar el MontoInput después de agregar
  const [formKey, setFormKey] = useState(0);

  function agregar() {
    const monto = Number(montoTexto);
    if (!monto || !periodoISO) return;
    setSimulaciones((prev) => [
      ...prev,
      { id: Date.now(), nombre: nombre.trim() || 'Simulación', monto, periodoISO, tipo },
    ]);
    setNombre('');
    setMontoTexto('');
    setFormKey((k) => k + 1);
  }

  function quitar(id: number) {
    setSimulaciones((prev) => prev.filter((s) => s.id !== id));
  }

  // Recalcula el saldo acumulado incluyendo las simulaciones del período
  const proyeccion = useMemo(() => {
    let acumulado = saldoInicialProyeccion;
    return filas.map((f, idx) => {
      const simsDelPeriodo = simulaciones.filter((s) => s.periodoISO === f.periodoISO);
      const simGastos = simsDelPeriodo
        .filter((s) => s.tipo === 'gasto')
        .reduce((a, s) => a + s.monto, 0);
      const simIngresos = simsDelPeriodo
        .filter((s) => s.tipo === 'ingreso')
        .reduce((a, s) => a + s.monto, 0);

      const ingresos = f.ingresos + simIngresos;
      const gastos = f.gastos + simGastos;

      // El primer período ya parte del saldo real; los siguientes acumulan
      if (idx === 0) {
        acumulado = saldoInicialProyeccion - simGastos + simIngresos;
      } else {
        acumulado = acumulado + ingresos - gastos;
      }

      return {
        ...f,
        ingresos,
        gastos,
        saldo: acumulado,
        tieneSimulacion: simsDelPeriodo.length > 0,
      };
    });
  }, [filas, simulaciones, saldoInicialProyeccion]);

  const chartData = proyeccion.map((f) => ({ periodo: f.label, saldo: f.saldo }));
  const primerNegativo = proyeccion.find((f) => f.saldo < 0);
  const totalSimulado = simulaciones.reduce(
    (a, s) => a + (s.tipo === 'gasto' ? s.monto : -s.monto),
    0
  );

  return (
    <div>
      {primerNegativo && (
        <div className="mb-6">
          <Aviso tono="error">
            El saldo proyectado se vuelve negativo en{' '}
            <strong className="font-semibold">{primerNegativo.labelLargo}</strong>.
          </Aviso>
        </div>
      )}

      <Section titulo="Evolución del saldo">
        <div className="card p-3 sm:p-4">
          <LineChartSaldoProyectado data={chartData} />
        </div>
      </Section>

      {/* ---------------- Simulador ---------------- */}
      <Section titulo="Simular una compra">
        <div className="card p-4">
          <p className="mb-4 text-sm text-ink-500">
            Probá cómo impactaría un gasto o ingreso futuro. Es solo un cálculo: no se guarda en
            ningún lado y se borra al recargar.
          </p>

          <div key={formKey} className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:items-end">
            <div className="col-span-2 sm:col-span-1">
              <label className="label" htmlFor="sim-nombre">
                Concepto
              </label>
              <input
                id="sim-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Viaje"
                className="field"
              />
            </div>
            <div>
              <label className="label">Monto</label>
              <MontoInputControlado value={montoTexto} onChange={setMontoTexto} />
            </div>
            <div>
              <label className="label" htmlFor="sim-tipo">
                Tipo
              </label>
              <select
                id="sim-tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as 'gasto' | 'ingreso')}
                className="field"
              >
                <option value="gasto">Gasto</option>
                <option value="ingreso">Ingreso</option>
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="label" htmlFor="sim-periodo">
                Período
              </label>
              <select
                id="sim-periodo"
                value={periodoISO}
                onChange={(e) => setPeriodoISO(e.target.value)}
                className="field"
              >
                {filas.map((f, idx) => (
                  <option key={f.periodoISO} value={f.periodoISO}>
                    {idx === 0 ? 'Actual' : f.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <button type="button" onClick={agregar} className="btn-primary w-full">
                Simular
              </button>
            </div>
          </div>

          {simulaciones.length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <div className="mb-3 flex items-baseline justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                  Simulaciones activas
                </p>
                <button
                  type="button"
                  onClick={() => setSimulaciones([])}
                  className="btn-row text-ink-400 hover:bg-canvas"
                >
                  Quitar todas
                </button>
              </div>
              <ul className="space-y-2">
                {simulaciones.map((s) => {
                  const fila = filas.find((f) => f.periodoISO === s.periodoISO);
                  return (
                    <li
                      key={s.id}
                      className="flex items-center gap-3 rounded-lg bg-canvas px-3 py-2.5"
                    >
                      <span
                        className={`h-7 w-1 shrink-0 rounded-full ${
                          s.tipo === 'gasto' ? 'bg-brick-600' : 'bg-pine-600'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{s.nombre}</p>
                        <p className="text-xs text-ink-400">
                          {fila?.periodoISO === filas[0]?.periodoISO ? 'Actual' : fila?.label}
                        </p>
                      </div>
                      <Money
                        value={s.monto}
                        signo={s.tipo === 'gasto' ? 'egreso' : 'ingreso'}
                        className={`shrink-0 font-medium ${
                          s.tipo === 'gasto' ? 'text-brick-600' : 'text-pine-700'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => quitar(s.id)}
                        aria-label={`Quitar ${s.nombre}`}
                        className="shrink-0 rounded-md p-1.5 text-ink-400 transition-colors hover:bg-brick-50 hover:text-brick-600"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                        >
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-right text-sm text-ink-500">
                Impacto neto{' '}
                <Money
                  value={Math.abs(totalSimulado)}
                  signo={totalSimulado > 0 ? 'egreso' : 'ingreso'}
                  className={`font-semibold ${
                    totalSimulado > 0 ? 'text-brick-600' : 'text-pine-700'
                  }`}
                />
              </p>
            </div>
          )}
        </div>
      </Section>

      {/* ---------------- Detalle ---------------- */}
      <Section titulo="Detalle por período">
        <ul className="space-y-2 md:hidden">
          {proyeccion.map((f, idx) => (
            <li
              key={f.periodoISO}
              className={`card p-4 ${f.saldo < 0 ? 'border-brick-100 bg-brick-50/40' : ''}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">{idx === 0 ? 'Actual' : f.label}</span>
                  {f.tieneExtra && <Etiqueta tono="ochre">extra</Etiqueta>}
                  {f.tieneSimulacion && <Etiqueta tono="ink">simulado</Etiqueta>}
                </div>
                <Money
                  value={f.saldo}
                  className={`font-semibold ${f.saldo < 0 ? 'text-brick-600' : 'text-ink'}`}
                />
              </div>
              <div className="mt-2.5 flex gap-4 border-t border-line pt-2.5 text-xs">
                <span className="text-ink-400">
                  Ingresos <Money value={f.ingresos} size="sm" className="text-pine-700" />
                </span>
                <span className="text-ink-400">
                  Gastos <Money value={f.gastos} size="sm" className="text-brick-600" />
                </span>
              </div>
            </li>
          ))}
        </ul>

        <div className="hidden overflow-hidden rounded-card border border-line bg-surface shadow-card md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-canvas/60 text-left text-[11px] uppercase tracking-wider text-ink-500">
                <th className="px-4 py-2.5 font-semibold">Período</th>
                <th className="px-4 py-2.5 text-right font-semibold">Ingresos</th>
                <th className="px-4 py-2.5 text-right font-semibold">Gastos</th>
                <th className="px-4 py-2.5 text-right font-semibold">Saldo resultante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {proyeccion.map((f, idx) => (
                <tr
                  key={f.periodoISO}
                  className={f.saldo < 0 ? 'bg-brick-50/50' : 'hover:bg-canvas/50'}
                >
                  <td className="px-4 py-3">
                    <span className="mr-2 font-medium text-ink">
                      {idx === 0 ? 'Actual' : f.label}
                    </span>
                    {f.tieneExtra && <Etiqueta tono="ochre">extra</Etiqueta>}
                    {f.tieneSimulacion && <Etiqueta tono="ink">simulado</Etiqueta>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Money value={f.ingresos} signo="ingreso" className="text-pine-700" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Money value={f.gastos} signo="egreso" className="text-brick-600" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Money
                      value={f.saldo}
                      className={`font-semibold ${f.saldo < 0 ? 'text-brick-600' : 'text-ink'}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <p className="text-xs text-ink-400">
        Para que un gasto puntual quede guardado y afecte la previsión de forma permanente, cargalo
        en Extras con su fecha.
      </p>
    </div>
  );
}

function Etiqueta({ tono, children }: { tono: 'ochre' | 'ink'; children: React.ReactNode }) {
  const tonos = {
    ochre: 'bg-ochre-50 text-ochre-700 ring-ochre-100',
    ink: 'bg-canvas text-ink-500 ring-line',
  };
  return (
    <span
      className={`mr-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${tonos[tono]}`}
    >
      {children}
    </span>
  );
}

/** Variante controlada del campo de monto, para el simulador. */
function MontoInputControlado({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const formateado = value ? Number(value).toLocaleString('es-PY') : '';
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-ink-400">
        ₲
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={formateado}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        placeholder="0"
        className="field amount pl-7"
      />
    </div>
  );
}
