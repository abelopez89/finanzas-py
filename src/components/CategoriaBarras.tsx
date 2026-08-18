import Money from '@/components/ui/Money';

type Item = { categoria: string; monto: number };

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

/**
 * Ranking horizontal de categorías: más fácil de leer y comparar que una
 * torta cuando hay varias categorías, y deja el monto exacto siempre a la
 * vista (en la torta había que pasar el mouse para verlo).
 */
export default function CategoriaBarras({ data }: { data: Item[] }) {
  const max = Math.max(...data.map((d) => d.monto), 1);
  const total = data.reduce((a, d) => a + d.monto, 0);

  return (
    <ul className="space-y-4">
      {data.map((d, i) => {
        const porcentaje = total > 0 ? (d.monto / total) * 100 : 0;
        const anchoBarra = (d.monto / max) * 100;
        return (
          <li key={d.categoria}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="truncate text-sm font-medium text-ink">{d.categoria}</span>
              <span className="shrink-0 text-xs text-ink-400">{porcentaje.toFixed(0)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-canvas">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${anchoBarra}%`, backgroundColor: COLORES[i % COLORES.length] }}
                />
              </div>
              <Money value={d.monto} size="sm" className="w-28 shrink-0 text-right font-medium text-ink" />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
