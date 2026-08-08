'use client';

import { useState, useMemo } from 'react';
import MontoInput from '@/components/MontoInput';
import { formatPeriodoCorto } from '@/lib/period';

const ESTADO_STYLES: Record<string, string> = {
  pendiente: 'bg-gray-100 text-gray-600',
  rescatado: 'bg-amber-100 text-amber-700',
  pagado: 'bg-brand-100 text-brand-700',
};

type Gasto = {
  id: string;
  nombre: string;
  dia: number;
  monto: number;
  estado: string;
  periodo: string;
};

export default function GastosEntriesTable({
  gastos,
  mostrarPeriodo = false,
  updateExpenseEntry,
  cambiarEstadoGasto,
  deleteExpenseEntry,
}: {
  gastos: Gasto[];
  mostrarPeriodo?: boolean;
  updateExpenseEntry: (formData: FormData) => void;
  cambiarEstadoGasto: (formData: FormData) => void;
  deleteExpenseEntry: (formData: FormData) => void;
}) {
  const [busqueda, setBusqueda] = useState('');

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return gastos;
    const q = busqueda.trim().toLowerCase();
    return gastos.filter((g) => g.nombre.toLowerCase().includes(q));
  }, [gastos, busqueda]);

  const total = filtrados.reduce((a, g) => a + Number(g.monto), 0);

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre..."
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <p className="whitespace-nowrap text-sm text-gray-500">
          Total: <strong className="text-gray-800">₲ {total.toLocaleString('es-PY')}</strong>
        </p>
      </div>

      <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Nombre</th>
              {mostrarPeriodo && <th className="px-4 py-2">Período</th>}
              <th className="px-4 py-2">Día / Monto</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtrados.map((g) => (
              <tr key={g.id}>
                <td className="px-4 py-2 align-top">{g.nombre}</td>
                {mostrarPeriodo && (
                  <td className="px-4 py-2 align-top text-gray-500">
                    {formatPeriodoCorto(new Date(`${g.periodo}T00:00:00Z`))}
                  </td>
                )}
                <td className="px-4 py-2 align-top">
                  {g.estado !== 'pendiente' ? (
                    <span className="text-gray-500">
                      Día {g.dia} — ₲ {Number(g.monto).toLocaleString('es-PY')}
                    </span>
                  ) : (
                    <form action={updateExpenseEntry} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={g.id} />
                      <input type="hidden" name="_path" value="/mes-actual" />
                      <input
                        name="dia"
                        type="number"
                        min={1}
                        max={31}
                        defaultValue={g.dia}
                        className="w-16 rounded-md border border-gray-300 px-2 py-1"
                      />
                      <MontoInput
                        name="monto"
                        defaultValue={g.monto}
                        className="w-32 rounded-md border border-gray-300 px-2 py-1"
                      />
                      <button className="text-xs text-brand-600 hover:underline">Guardar</button>
                    </form>
                  )}
                </td>
                <td className="px-4 py-2 align-top">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${ESTADO_STYLES[g.estado]}`}>
                    {g.estado}
                  </span>
                </td>
                <td className="px-4 py-2 align-top text-right">
                  <div className="flex justify-end gap-2">
                    {g.estado === 'pendiente' && (
                      <form action={cambiarEstadoGasto}>
                        <input type="hidden" name="id" value={g.id} />
                        <input type="hidden" name="_path" value="/mes-actual" />
                        <input type="hidden" name="nuevo_estado" value="rescatado" />
                        <button className="text-xs text-amber-600 hover:underline">Rescatado</button>
                      </form>
                    )}
                    {g.estado !== 'pagado' && (
                      <form action={cambiarEstadoGasto}>
                        <input type="hidden" name="id" value={g.id} />
                        <input type="hidden" name="_path" value="/mes-actual" />
                        <input type="hidden" name="nuevo_estado" value="pagado" />
                        <button className="text-xs text-brand-600 hover:underline">Pagado</button>
                      </form>
                    )}
                    {g.estado !== 'pendiente' && (
                      <form action={cambiarEstadoGasto}>
                        <input type="hidden" name="id" value={g.id} />
                        <input type="hidden" name="_path" value="/mes-actual" />
                        <input type="hidden" name="nuevo_estado" value="pendiente" />
                        <button className="text-xs text-gray-400 hover:underline">Revertir</button>
                      </form>
                    )}
                    {g.estado === 'pendiente' && (
                      <form action={deleteExpenseEntry}>
                        <input type="hidden" name="id" value={g.id} />
                        <input type="hidden" name="_path" value="/mes-actual" />
                        <button className="text-xs text-red-400 hover:underline">Eliminar</button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={mostrarPeriodo ? 5 : 4} className="px-4 py-3 text-sm text-gray-400">
                  {gastos.length === 0 ? 'No hay gastos para mostrar.' : 'Ningún gasto coincide con la búsqueda.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
