export default function ExtractoPage() {
  const hoy = new Date().toISOString().slice(0, 10);
  const haceUnMes = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Extracto</h1>
        <p className="text-sm text-gray-500">
          Descarga en CSV de los movimientos confirmados del fondo (ingresos, egresos, intereses y
          saldo inicial) en el rango de fechas que elijas.
        </p>
      </div>

      <form action="/api/extracto" method="GET" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Desde</label>
          <input
            name="desde"
            type="date"
            defaultValue={haceUnMes}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Hasta</label>
          <input
            name="hasta"
            type="date"
            defaultValue={hoy}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <button className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
          Descargar CSV
        </button>
      </form>
    </div>
  );
}
