'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';

type Item = { periodo: string; saldo: number };

export default function LineChartSaldoProyectado({ data }: { data: Item[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
        <XAxis dataKey="periodo" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₲${(v / 1_000_000).toFixed(1)}M`} />
        <Tooltip formatter={(v: number) => `₲ ${v.toLocaleString('es-PY')}`} />
        <ReferenceLine y={0} stroke="#dc2626" strokeDasharray="4 4" />
        <Line
          type="monotone"
          dataKey="saldo"
          stroke="#178048"
          strokeWidth={2}
          dot={{ r: 3 }}
          name="Saldo proyectado"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
