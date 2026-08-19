'use client';

import { useState, useMemo } from 'react';
import MontoInput from '@/components/MontoInput';
import Money from '@/components/ui/Money';
import SearchInput from '@/components/ui/SearchInput';
import { EmptyState } from '@/components/ui/Layout';

export type PlantillaConVigencias = {
  id: string;
  nombre: string;
  monto: number;
  activo: boolean;
  tipo: 'gasto' | 'ingreso';
  vigencias: Array<{
    id: string;
    desde_periodo: string;
    activo: boolean;
    monto: number | null;
    nota: string | null;
  }>;
};

export default function VigenciasManager({
  plantillas,
  periodos,
  agregarVigencia,
  quitarVigencia,
}: {
  plantillas: PlantillaConVigencias[];
  periodos: Array<{ iso: string; label: string }>;
  agregarVigencia: (formData: FormData) => void;
  quitarVigencia: (formData: FormData) => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [abierta, setAbierta] = useState<string | null>(null);

  const filtradas = useMemo(() => {
    if (!busqueda.trim()) return plantillas;
    const q = busqueda.trim().toLowerCase();
    return plantillas.filter((p) => p.nombre.toLowerCase().includes(q));
  }, [plantillas, busqueda]);

  const etiquetaPeriodo = (iso: string) =>
    periodos.find((p) => p.iso === iso)?.label ?? iso;

  return (
    <div>
      <div className="mb-4">
        <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar plantilla…" />
      </div>

      <ul className="space-y-2">
        {filtradas.map((p) => {
          const expandida = abierta === p.id;
          const reglas = [...p.vigencias].sort((a, b) =>
            a.desde_periodo.localeCompare(b.desde_periodo)
          );

          return (
            <li key={p.id} className="card overflow-hidden">
              <button
                type="button"
                onClick={() => setAbierta(expandida ? null : p.id)}
                aria-expanded={expandida}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas/60"
              >
                <span
                  className={`h-8 w-1 shrink-0 rounded-full ${
                    p.tipo === 'ingreso' ? 'bg-pine-600' : 'bg-ink-300'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">
                    {p.nombre}
                    <span className="ml-2 text-xs font-normal text-ink-400">
                      {p.tipo === 'ingreso' ? 'ingreso' : 'gasto'}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-ink-400">
                    Base: <Money value={p.monto} size="sm" className="text-ink-500" />
                    {reglas.length > 0 && ` · ${reglas.length} regla${reglas.length === 1 ? '' : 's'}`}
                    {!p.activo && ' · desactivada'}
                  </p>
                </div>
                <svg
                  viewBox="0 0 24 24"
                  className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${
                    expandida ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {expandida && (
                <div className="border-t border-line bg-canvas/40 px-4 py-4">
                  {reglas.length > 0 ? (
                    <ul className="mb-4 space-y-2">
                      {reglas.map((r) => (
                        <li
                          key={r.id}
                          className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2.5"
                        >
                          <span
                            className={`h-6 w-1 shrink-0 rounded-full ${
                              r.activo ? 'bg-pine-600' : 'bg-ink-300'
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-ink">
                              Desde <strong>{etiquetaPeriodo(r.desde_periodo)}</strong>
                              {r.activo ? (
                                r.monto !== null ? (
                                  <>
                                    {' → '}
                                    <Money value={r.monto} size="sm" className="text-ink" />
                                  </>
                                ) : (
                                  ' → se reactiva'
                                )
                              ) : (
                                ' → no aplica'
                              )}
                            </p>
                            {r.nota && <p className="mt-0.5 text-xs text-ink-400">{r.nota}</p>}
                          </div>
                          <form action={quitarVigencia}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="tipo" value={p.tipo} />
                            <button className="btn-row text-ink-400 hover:bg-brick-50 hover:text-brick-600">
                              Quitar
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mb-4 text-sm text-ink-400">
                      Sin reglas: aplica siempre con el monto base.
                    </p>
                  )}

                  <form
                    action={agregarVigencia}
                    className="grid grid-cols-2 gap-2 border-t border-line pt-4 sm:grid-cols-5 sm:items-end"
                  >
                    <input type="hidden" name="template_id" value={p.id} />
                    <input type="hidden" name="tipo" value={p.tipo} />

                    <div className="col-span-2 sm:col-span-1">
                      <label className="label">Desde</label>
                      <select name="desde_periodo" className="field" required>
                        {periodos.map((per) => (
                          <option key={per.iso} value={per.iso}>
                            {per.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="label">Aplica</label>
                      <select name="activo" className="field" defaultValue="true">
                        <option value="true">Sí</option>
                        <option value="false">No</option>
                      </select>
                    </div>

                    <div>
                      <label className="label">Monto</label>
                      <MontoInput name="monto" placeholder="Sin cambio" />
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <label className="label">Nota</label>
                      <input name="nota" placeholder="Opcional" className="field" />
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <button className="btn-primary w-full">Agregar regla</button>
                    </div>
                  </form>

                  <p className="mt-2 text-xs text-ink-400">
                    Dejá el monto vacío para cambiar solo si aplica o no, conservando el importe que
                    ya venía rigiendo.
                  </p>
                </div>
              )}
            </li>
          );
        })}
        {filtradas.length === 0 && (
          <li className="card">
            <EmptyState mensaje="Ninguna plantilla coincide con la búsqueda." />
          </li>
        )}
      </ul>
    </div>
  );
}
