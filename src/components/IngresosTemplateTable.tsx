'use client';

import { useState, useMemo } from 'react';
import MontoInput from '@/components/MontoInput';
import { ordenDiaPeriodo } from '@/lib/period';

type IngresoTemplate = {
  id: string;
  nombre: string;
  dia_mes: number;
  monto: number;
  activo: boolean;
};

export default function IngresosTemplateTable({
  ingresos,
  updateIncomeTemplate,
  toggleIncomeTemplate,
}: {
  ingresos: IngresoTemplate[];
  updateIncomeTemplate: (formData: FormData) => void;
  toggleIncomeTemplate: (formData: FormData) => void;
}) {
  const [busqueda, setBusqueda] = useState('');

  const ingresosOrdenados = useMemo(() => {
    return [...ingresos].sort((a, b) => {
      const porDia = ordenDiaPeriodo(a.dia_mes) - ordenDiaPeriodo(b.dia_mes);
      if (porDia !== 0) return porDia;
      return a.nombre.localeCompare(b.nombre, 'es');
    });
  }, [ingresos]);

  const ingresosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return ingresosOrdenados;
    const q = busqueda.trim().toLowerCase();
    return ingresosOrdenados.filter((i) => i.nombre.toLowerCase().includes(q));
  }, [ingresosOrdenados, busqueda]);

  return (
    <div>
      <input
        type="text"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre..."
        className="mb-3 w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Día / Monto</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ingresosFiltrados.map((i) => (
              <tr key={i.id} className={i.activo ? '' : 'opacity-40'}>
                <td className="px-4 py-2">{i.nombre}</td>
                <td className="px-4 py-2">
                  <form action={updateIncomeTemplate} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={i.id} />
                    <input
                      name="dia_mes"
                      type="number"
                      min={1}
                      max={31}
                      defaultValue={i.dia_mes}
                      className="w-16 rounded-md border border-gray-300 px-2 py-1"
                    />
                    <MontoInput
                      name="monto"
                      defaultValue={i.monto}
                      className="w-28 rounded-md border border-gray-300 px-2 py-1"
                    />
                    <button className="text-xs text-brand-600 hover:underline">Guardar</button>
                  </form>
                </td>
                <td className="px-4 py-2 text-right">
                  <form action={toggleIncomeTemplate}>
                    <input type="hidden" name="id" value={i.id} />
                    <input type="hidden" name="activo" value={String(i.activo)} />
                    <button className="text-xs text-gray-500 hover:underline">
                      {i.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {ingresosFiltrados.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-3 text-sm text-gray-400">
                  {ingresos.length === 0
                    ? 'Todavía no hay ingresos mensuales cargados.'
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
