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

const fmtCorto = (v: number) =>
  Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${Math.round(v / 1000)}k`;

export default function LineChartSaldoProyectado({ data }: { data: Item[] }) {
  return (
    <ResponsiveContainer width="100%" height={270}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#E2E7ED" />
        <XAxis
          dataKey="periodo"
          tick={{ fontSize: 11, fill: '#7A8899' }}
          axisLine={{ stroke: '#E2E7ED' }}
          tickLine={false}
          interval="preserveStartEnd"
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
        />
        {/* La línea de cero es el dato crítico: cuándo el fondo se agota */}
        <ReferenceLine y={0} stroke="#B4322B" strokeDasharray="4 4" />
        <Line
          type="monotone"
          dataKey="saldo"
          stroke="#17603F"
          strokeWidth={2}
          dot={{ r: 2.5, fill: '#17603F', strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          name="Saldo proyectado"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
