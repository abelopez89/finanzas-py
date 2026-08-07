'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts';

type Item = { periodo: string; ingresos: number; egresos: number };

export default function BarChartIngresosEgresos({ data }: { data: Item[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="periodo" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₲${(v / 1_000_000).toFixed(1)}M`} />
        <Tooltip formatter={(v: number) => `₲ ${v.toLocaleString('es-PY')}`} />
        <Legend />
        <Bar dataKey="ingresos" fill="#1f9d5a" name="Ingresos" radius={[4, 4, 0, 0]} />
        <Bar dataKey="egresos" fill="#dc2626" name="Egresos" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
