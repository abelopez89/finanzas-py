import { getCurrentAccountId } from '@/lib/supabase/account';
import { getMovimientosUnificados, type FiltrosMovimientos } from '@/lib/movimientos';
import { toISODate } from '@/lib/period';

const ESTADO_STYLES: Record<string, string> = {
  pendiente: 'bg-gray-100 text-gray-600',
  rescatado: 'bg-amber-100 text-amber-700',
  pagado: 'bg-brand-100 text-brand-700',
  confirmado: 'bg-brand-100 text-brand-700',
};

export default async function MovimientosPage({ searchParams }: { searchParams: FiltrosMovimientos }) {
  const accountId = await getCurrentAccountId();

  const movimientos = accountId ? await getMovimientosUnificados(accountId, searchParams) : [];

  const totalGastos = movimientos.filter((m) => m.tipo === 'Gasto').reduce((a, m) => a + m.monto, 0);
  const totalIngresos = movimientos.filter((m) => m.tipo === 'Ingreso').reduce((a, m) => a + m.monto, 0);

  const hayFiltros = Boolean(
    searchParams.q ||
      searchParams.tipo ||
      searchParams.origen ||
      searchParams.estado ||
      searchParams.desde ||
      searchParams.hasta
  );

  const queryString = new URLSearchParams(
    Object.entries(searchParams).filter(([, v]) => v) as [string, string][]
  ).toString();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Movimientos</h1>
        <p className="text-sm text-gray-500">
          Todos los gastos e ingresos de la cuenta — regulares y extra — en un solo lugar.
        </p>
      </div>

      <form method="GET" className="flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Nombre</label>
          <input
            name="q"
            defaultValue={searchParams.q ?? ''}
            placeholder="Buscar..."
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Tipo</label>
          <select
            name="tipo"
            defaultValue={searchParams.tipo ?? ''}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="Gasto">Gasto</option>
            <option value="Ingreso">Ingreso</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Origen</label>
          <select
            name="origen"
            defaultValue={searchParams.origen ?? ''}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="Regular">Regular</option>
            <option value="Extra">Extra</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Estado</label>
          <select
            name="estado"
            defaultValue={searchParams.estado ?? ''}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="rescatado">Rescatado</option>
            <option value="pagado">Pagado</option>
            <option value="confirmado">Confirmado</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Desde</label>
          <input
            name="desde"
            type="date"
            defaultValue={searchParams.desde ?? ''}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Hasta</label>
          <input
            name="hasta"
            type="date"
            defaultValue={searchParams.hasta ?? ''}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <button className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
          Filtrar
        </button>
        {hayFiltros && (
          <a href="/movimientos" className="text-sm text-gray-400 hover:underline">
            Limpiar filtros
          </a>
        )}
        <a
          href={`/api/movimientos/export${queryString ? `?${queryString}` : ''}`}
          className="ml-auto rounded-md border border-brand-600 px-4 py-2 text-sm text-brand-700 hover:bg-brand-50"
        >
          Descargar Excel
        </a>
      </form>

      <div className="flex gap-6 text-sm text-gray-600">
        <p>
          Total gastos: <strong className="text-red-600">₲ {totalGastos.toLocaleString('es-PY')}</strong>
        </p>
        <p>
          Total ingresos:{' '}
          <strong className="text-brand-700">₲ {totalIngresos.toLocaleString('es-PY')}</strong>
        </p>
        <p>
          Neto:{' '}
          <strong className={totalIngresos - totalGastos >= 0 ? 'text-brand-700' : 'text-red-600'}>
            ₲ {(totalIngresos - totalGastos).toLocaleString('es-PY')}
          </strong>
        </p>
      </div>

      <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Tipo</th>
              <th className="px-4 py-2">Origen</th>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {movimientos.map((m) => (
              <tr key={`${m.tipo}-${m.id}`}>
                <td className="px-4 py-2">{toISODate(m.fecha)}</td>
                <td className="px-4 py-2">{m.tipo}</td>
                <td className="px-4 py-2 text-gray-500">{m.origen}</td>
                <td className="px-4 py-2">{m.nombre}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${ESTADO_STYLES[m.estado]}`}>
                    {m.estado}
                  </span>
                </td>
                <td
                  className={`px-4 py-2 text-right font-medium ${
                    m.tipo === 'Gasto' ? 'text-red-600' : 'text-brand-700'
                  }`}
                >
                  {m.tipo === 'Gasto' ? '-' : '+'}₲ {m.monto.toLocaleString('es-PY')}
                </td>
              </tr>
            ))}
            {movimientos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-3 text-sm text-gray-400">
                  No hay movimientos que coincidan con los filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
