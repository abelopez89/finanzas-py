'use client';

import { useState, useMemo } from 'react';
import MontoInput from '@/components/MontoInput';
import { ordenDiaPeriodo } from '@/lib/period';

type Metodo = { id: string; nombre: string };
type Categoria = { id: string; nombre: string };
type GastoTemplate = {
  id: string;
  nombre: string;
  dia_mes: number;
  monto: number;
  payment_method_id: string | null;
  category_id: string | null;
  activo: boolean;
};

export default function GastosTemplateTable({
  gastos,
  metodos,
  categorias,
  updateExpenseTemplate,
  toggleExpenseTemplate,
}: {
  gastos: GastoTemplate[];
  metodos: Metodo[];
  categorias: Categoria[];
  updateExpenseTemplate: (formData: FormData) => void;
  toggleExpenseTemplate: (formData: FormData) => void;
}) {
  const [busqueda, setBusqueda] = useState('');

  const metodoPorId = useMemo(() => new Map(metodos.map((m) => [m.id, m.nombre])), [metodos]);

  const gastosOrdenados = useMemo(() => {
    return [...gastos].sort((a, b) => {
      const porDia = ordenDiaPeriodo(a.dia_mes) - ordenDiaPeriodo(b.dia_mes);
      if (porDia !== 0) return porDia;
      const metodoA = metodoPorId.get(a.payment_method_id ?? '') ?? '';
      const metodoB = metodoPorId.get(b.payment_method_id ?? '') ?? '';
      const porMetodo = metodoA.localeCompare(metodoB, 'es');
      if (porMetodo !== 0) return porMetodo;
      return a.nombre.localeCompare(b.nombre, 'es');
    });
  }, [gastos, metodoPorId]);

  const gastosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return gastosOrdenados;
    const q = busqueda.trim().toLowerCase();
    return gastosOrdenados.filter((g) => g.nombre.toLowerCase().includes(q));
  }, [gastosOrdenados, busqueda]);

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
        <div className="grid grid-cols-[2fr_70px_130px_150px_150px_80px_80px] gap-2 bg-gray-50 px-4 py-2 text-xs uppercase text-gray-500">
          <div>Nombre</div>
          <div>Día</div>
          <div>Monto</div>
          <div>Método</div>
          <div>Categoría</div>
          <div></div>
          <div></div>
        </div>
        <div className="divide-y divide-gray-100">
          {gastosFiltrados.map((g) => (
            <form
              key={g.id}
              action={updateExpenseTemplate}
              className={`grid grid-cols-[2fr_70px_130px_150px_150px_80px_80px] items-center gap-2 px-4 py-2 ${
                g.activo ? '' : 'opacity-40'
              }`}
            >
              <input type="hidden" name="id" value={g.id} />
              <span className="truncate">{g.nombre}</span>
              <input
                name="dia_mes"
                type="number"
                min={1}
                max={31}
                defaultValue={g.dia_mes}
                className="w-full rounded-md border border-gray-300 px-2 py-1"
              />
              <MontoInput
                name="monto"
                defaultValue={g.monto}
                className="w-full rounded-md border border-gray-300 px-2 py-1"
              />
              <select
                name="payment_method_id"
                defaultValue={g.payment_method_id ?? ''}
                className="w-full rounded-md border border-gray-300 px-2 py-1"
              >
                <option value="">Método</option>
                {metodos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
              <select
                name="category_id"
                defaultValue={g.category_id ?? ''}
                className="w-full rounded-md border border-gray-300 px-2 py-1"
              >
                <option value="">Categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <button formAction={updateExpenseTemplate} className="text-xs text-brand-600 hover:underline">
                Guardar
              </button>
              <input type="hidden" name="activo" value={String(g.activo)} />
              <button formAction={toggleExpenseTemplate} className="text-xs text-gray-500 hover:underline">
                {g.activo ? 'Desact.' : 'Activar'}
              </button>
            </form>
          ))}
          {gastosFiltrados.length === 0 && (
            <p className="px-4 py-3 text-sm text-gray-400">
              {gastos.length === 0
                ? 'Todavía no hay gastos mensuales cargados.'
                : 'Ningún gasto coincide con la búsqueda.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
