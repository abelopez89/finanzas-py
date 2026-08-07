'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type Item = { categoria: string; monto: number };

const COLORES = ['#1f9d5a', '#178048', '#f59e0b', '#dc2626', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'];

export default function PieChartCategorias({ data }: { data: Item[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="monto"
          nameKey="categoria"
          cx="50%"
          cy="50%"
          outerRadius={90}
          label={(entry) => entry.categoria}
        >
          {data.map((_, index) => (
            <Cell key={index} fill={COLORES[index % COLORES.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => `₲ ${v.toLocaleString('es-PY')}`} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
