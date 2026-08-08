'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type Item = { categoria: string; monto: number };

/** Escala derivada del acento pino, con ocre y ladrillo como contrapuntos. */
const COLORES = [
  '#17603F',
  '#2E7D57',
  '#A66A15',
  '#B4322B',
  '#2A3648',
  '#4E8C6E',
  '#C99A4A',
  '#7A8899',
];

export default function PieChartCategorias({ data }: { data: Item[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="monto"
          nameKey="categoria"
          cx="50%"
          cy="45%"
          innerRadius={52}
          outerRadius={88}
          paddingAngle={2}
          stroke="#FFFFFF"
          strokeWidth={2}
        >
          {data.map((_, index) => (
            <Cell key={index} fill={COLORES[index % COLORES.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v: number) => `₲ ${v.toLocaleString('es-PY')}`}
          contentStyle={{
            borderRadius: 10,
            border: '1px solid #E2E7ED',
            fontSize: 13,
            boxShadow: '0 4px 16px rgba(11,18,32,0.08)',
          }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: '#556479' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
