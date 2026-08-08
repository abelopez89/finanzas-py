'use client';

import { useState, useMemo } from 'react';
import MontoInput from '@/components/MontoInput';
import { formatPeriodoCorto } from '@/lib/period';

const ESTADO_STYLES: Record<string, string> = {
  pendiente: 'bg-gray-100 text-gray-600',
  confirmado: 'bg-brand-100 text-brand-700',
};

type Ingreso = {
  id: string;
  nombre: string;
  dia: number;
  monto: number;
  estado: string;
  periodo: string;
};

export default function IngresosEntriesTable({
  ingresos,
  mostrarPeriodo = false,
  updateIncomeEntry,
  cambiarEstadoIngreso,
  deleteIncomeEntry,
}: {
  ingresos: Ingreso[];
  mostrarPeriodo?: boolean;
  updateIncomeEntry: (formData: FormData) => void;
  cambiarEstadoIngreso: (formData: FormData) => void;
  deleteIncomeEntry: (formData: FormData) => void;
}) {
  const [busqueda, setBusqueda] = useState('');

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return ingresos;
    const q = busqueda.trim().toLowerCase();
    return ingresos.filter((i) => i.nombre.toLowerCase().includes(q));
  }, [ingresos, busqueda]);

  const total = filtrados.reduce((a, i) => a + Number(i.monto), 0);

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
            {filtrados.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-2 align-top">{i.nombre}</td>
                {mostrarPeriodo && (
                  <td className="px-4 py-2 align-top text-gray-500">
                    {formatPeriodoCorto(new Date(`${i.periodo}T00:00:00Z`))}
                  </td>
                )}
                <td className="px-4 py-2 align-top">
                  {i.estado === 'confirmado' ? (
                    <span className="text-gray-500">
                      Día {i.dia} — ₲ {Number(i.monto).toLocaleString('es-PY')}
                    </span>
                  ) : (
                    <form action={updateIncomeEntry} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={i.id} />
                      <input type="hidden" name="_path" value="/mes-actual" />
                      <input
                        name="dia"
                        type="number"
                        min={1}
                        max={31}
                        defaultValue={i.dia}
                        className="w-16 rounded-md border border-gray-300 px-2 py-1"
                      />
                      <MontoInput
                        name="monto"
                        defaultValue={i.monto}
                        className="w-32 rounded-md border border-gray-300 px-2 py-1"
                      />
                      <button className="text-xs text-brand-600 hover:underline">Guardar</button>
                    </form>
                  )}
                </td>
                <td className="px-4 py-2 align-top">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${ESTADO_STYLES[i.estado]}`}>
                    {i.estado}
                  </span>
                </td>
                <td className="px-4 py-2 align-top text-right">
                  <div className="flex justify-end gap-2">
                    {i.estado !== 'confirmado' && (
                      <form action={cambiarEstadoIngreso}>
                        <input type="hidden" name="id" value={i.id} />
                        <input type="hidden" name="_path" value="/mes-actual" />
                        <input type="hidden" name="nuevo_estado" value="confirmado" />
                        <button className="text-xs text-brand-600 hover:underline">Confirmado</button>
                      </form>
                    )}
                    {i.estado !== 'confirmado' && (
                      <form action={deleteIncomeEntry}>
                        <input type="hidden" name="id" value={i.id} />
                        <input type="hidden" name="_path" value="/mes-actual" />
                        <button className="text-xs text-red-400 hover:underline">Eliminar</button>
                      </form>
                    )}
                    {i.estado === 'confirmado' && (
                      <form action={cambiarEstadoIngreso}>
                        <input type="hidden" name="id" value={i.id} />
                        <input type="hidden" name="_path" value="/mes-actual" />
                        <input type="hidden" name="nuevo_estado" value="pendiente" />
                        <button className="text-xs text-gray-400 hover:underline">Revertir</button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={mostrarPeriodo ? 5 : 4} className="px-4 py-3 text-sm text-gray-400">
                  {ingresos.length === 0
                    ? 'No hay ingresos para mostrar.'
                    : 'Ningún ingreso coincide con la búsqueda.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
