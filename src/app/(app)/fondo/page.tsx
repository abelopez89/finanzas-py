import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { calcularSaldoFondo } from '@/lib/fund';
import { getMovimientosUnificados, type FiltrosMovimientos } from '@/lib/movimientos';
import { toISODate } from '@/lib/period';
import MontoInput from '@/components/MontoInput';
import { revalidatePath } from 'next/cache';

async function registrarChequeoSaldo(formData: FormData) {
  'use server';
  const accountId = await getCurrentAccountId();
  if (!accountId) throw new Error('No se encontró la cuenta del usuario');

  const montoInformado = Number(formData.get('monto_informado'));
  const fecha = String(formData.get('fecha') ?? '');
  if (!montoInformado || !fecha) return;

  const supabase = createSupabaseServerClient();

  const { data: movimientos } = await supabase
    .from('fund_movements')
    .select('tipo, monto')
    .eq('account_id', accountId);

  const saldoEsperado = calcularSaldoFondo(movimientos ?? []);
  const interesCalculado = montoInformado - saldoEsperado;

  const { data: check, error } = await supabase
    .from('fund_balance_checks')
    .insert({
      account_id: accountId,
      fecha,
      monto_informado: montoInformado,
      saldo_esperado_sistema: saldoEsperado,
      interes_calculado: interesCalculado,
    })
    .select('id')
    .single();
  if (error) throw error;

  if (interesCalculado !== 0) {
    await supabase.from('fund_movements').insert({
      account_id: accountId,
      tipo: 'interes',
      monto: interesCalculado,
      fecha,
      referencia_tipo: 'fund_balance_checks',
      referencia_id: check.id,
      descripcion: 'Interés calculado por diferencia de saldo',
    });
  }

  revalidatePath('/fondo');
}

const ESTADO_STYLES: Record<string, string> = {
  pendiente: 'bg-gray-100 text-gray-600',
  rescatado: 'bg-amber-100 text-amber-700',
  pagado: 'bg-brand-100 text-brand-700',
  confirmado: 'bg-brand-100 text-brand-700',
};

export default async function FondoPage({ searchParams }: { searchParams: FiltrosMovimientos }) {
  const accountId = await getCurrentAccountId();
  const supabase = createSupabaseServerClient();

  if (!accountId) {
    return (
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
        No se encontró una cuenta vinculada a tu sesión. Probá cerrar sesión y volver a entrar.
      </p>
    );
  }

  const [{ data: movimientosFondo }, { data: chequeos }, movimientos] = await Promise.all([
    supabase.from('fund_movements').select('*').eq('account_id', accountId),
    supabase
      .from('fund_balance_checks')
      .select('*')
      .eq('account_id', accountId)
      .order('fecha', { ascending: false })
      .limit(10),
    getMovimientosUnificados(accountId, searchParams),
  ]);

  const saldoActual = calcularSaldoFondo(movimientosFondo ?? []);

  const totalGastos = movimientos.filter((m) => m.tipo === 'Gasto').reduce((a, m) => a + m.monto, 0);
  const totalIngresos = movimientos.filter((m) => m.tipo === 'Ingreso').reduce((a, m) => a + m.monto, 0);

  const hayFiltros = Boolean(
    searchParams.q ||
      searchParams.tipo ||
      searchParams.origen ||
      searchParams.desde ||
      searchParams.hasta
  );

  const queryString = new URLSearchParams(
    Object.entries(searchParams).filter(([, v]) => v) as [string, string][]
  ).toString();

  return (
    <div className="space-y-10">
      <div>
        <h1 className="mb-1 text-2xl font-semibold">Fondo mutuo</h1>
        <p className="text-sm text-gray-500">
          Saldo controlado por el sistema en base a todos los movimientos confirmados.
        </p>
      </div>

      <div className="rounded-md border border-gray-200 bg-white p-6">
        <p className="text-xs uppercase text-gray-400">Saldo actual (calculado)</p>
        <p className="mt-1 text-3xl font-semibold text-brand-700">
          ₲ {saldoActual.toLocaleString('es-PY')}
        </p>
      </div>

      {/* ------------------------- Chequeo de saldo / interés ------------------------- */}
      <section>
        <h2 className="mb-3 text-lg font-medium">Registrar saldo actual del fondo</h2>
        <p className="mb-2 text-sm text-gray-500">
          Ingresá el saldo que te muestra tu app/banco hoy. La diferencia contra el saldo calculado
          por el sistema se registra automáticamente como interés generado.
        </p>
        <form action={registrarChequeoSaldo} className="flex gap-2">
          <MontoInput
            name="monto_informado"
            placeholder="Saldo actual del fondo ₲"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            required
          />
          <input
            name="fecha"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            required
          />
          <button className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
            Registrar
          </button>
        </form>

        {(chequeos ?? []).length > 0 && (
          <div className="mt-4 overflow-hidden rounded-md border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2">Fecha</th>
                  <th className="px-4 py-2">Saldo informado</th>
                  <th className="px-4 py-2">Saldo esperado</th>
                  <th className="px-4 py-2">Interés</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(chequeos ?? []).map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2">{c.fecha}</td>
                    <td className="px-4 py-2">₲ {Number(c.monto_informado).toLocaleString('es-PY')}</td>
                    <td className="px-4 py-2">
                      ₲ {Number(c.saldo_esperado_sistema).toLocaleString('es-PY')}
                    </td>
                    <td
                      className={`px-4 py-2 font-medium ${
                        Number(c.interes_calculado) >= 0 ? 'text-brand-700' : 'text-red-600'
                      }`}
                    >
                      ₲ {Number(c.interes_calculado).toLocaleString('es-PY')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ------------------------- Movimientos confirmados ------------------------- */}
      <section>
        <h2 className="mb-3 text-lg font-medium">Movimientos</h2>
        <p className="mb-3 text-sm text-gray-500">
          Todo lo que ya afectó el saldo del fondo: gastos pagados, ingresos confirmados (regulares y
          extra), intereses y el saldo inicial.
        </p>

        <form
          method="GET"
          className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-gray-200 bg-white p-4"
        >
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
              <option value="Interés">Interés</option>
              <option value="Saldo inicial">Saldo inicial</option>
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
              <option value="Fondo">Fondo</option>
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
            <a href="/fondo" className="text-sm text-gray-400 hover:underline">
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

        <div className="mb-3 flex gap-6 text-sm text-gray-600">
          <p>
            Total gastos: <strong className="text-red-600">₲ {totalGastos.toLocaleString('es-PY')}</strong>
          </p>
          <p>
            Total ingresos:{' '}
            <strong className="text-brand-700">₲ {totalIngresos.toLocaleString('es-PY')}</strong>
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
                  <td colSpan={5} className="px-4 py-3 text-sm text-gray-400">
                    No hay movimientos que coincidan con los filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
