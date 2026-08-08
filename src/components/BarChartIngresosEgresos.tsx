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

const fmtCorto = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`;

export default function BarChartIngresosEgresos({ data }: { data: Item[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#E2E7ED" />
        <XAxis
          dataKey="periodo"
          tick={{ fontSize: 11, fill: '#7A8899' }}
          axisLine={{ stroke: '#E2E7ED' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#7A8899' }}
          tickFormatter={fmtCorto}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          formatter={(v: number) => `₲ ${v.toLocaleString('es-PY')}`}
          contentStyle={{
            borderRadius: 10,
            border: '1px solid #E2E7ED',
            fontSize: 13,
            boxShadow: '0 4px 16px rgba(11,18,32,0.08)',
          }}
          cursor={{ fill: 'rgba(11,18,32,0.04)' }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, paddingTop: 8, color: '#556479' }}
        />
        <Bar dataKey="ingresos" fill="#17603F" name="Ingresos" radius={[3, 3, 0, 0]} maxBarSize={28} />
        <Bar dataKey="egresos" fill="#B4322B" name="Egresos" radius={[3, 3, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
