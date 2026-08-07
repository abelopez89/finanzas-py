import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { calcularSaldoFondo } from '@/lib/fund';
import { revalidatePath } from 'next/cache';
import MontoInput from '@/components/MontoInput';

async function setSaldoInicial(formData: FormData) {
  'use server';
  const accountId = await getCurrentAccountId();
  if (!accountId) throw new Error('No se encontró la cuenta del usuario');

  const monto = Number(formData.get('monto'));
  const fecha = String(formData.get('fecha') ?? '');
  if (!monto || !fecha) return;

  const supabase = createSupabaseServerClient();

  const { data: existente } = await supabase
    .from('fund_initial_balance')
    .select('id')
    .eq('account_id', accountId)
    .maybeSingle();
  if (existente) return; // ya se cargó una vez, no se puede volver a cargar

  const { data: inserted, error } = await supabase
    .from('fund_initial_balance')
    .insert({ account_id: accountId, monto, fecha })
    .select('id')
    .single();
  if (error) throw error;

  await supabase.from('fund_movements').insert({
    account_id: accountId,
    tipo: 'saldo_inicial',
    monto,
    fecha,
    referencia_tipo: 'fund_initial_balance',
    referencia_id: inserted.id,
    descripcion: 'Saldo inicial',
  });

  revalidatePath('/fondo');
}

async function updateSaldoInicial(formData: FormData) {
  'use server';
  const accountId = await getCurrentAccountId();
  if (!accountId) throw new Error('No se encontró la cuenta del usuario');

  const monto = Number(formData.get('monto'));
  const fecha = String(formData.get('fecha') ?? '');
  if (!monto || !fecha) return;

  const supabase = createSupabaseServerClient();

  const { data: existente } = await supabase
    .from('fund_initial_balance')
    .select('id')
    .eq('account_id', accountId)
    .maybeSingle();
  if (!existente) return;

  const { error } = await supabase
    .from('fund_initial_balance')
    .update({ monto, fecha })
    .eq('id', existente.id);
  if (error) throw error;

  // El movimiento del libro mayor que representa el saldo inicial se
  // actualiza junto con él, para que el saldo del fondo siga siendo consistente.
  await supabase
    .from('fund_movements')
    .update({ monto, fecha })
    .eq('referencia_tipo', 'fund_initial_balance')
    .eq('referencia_id', existente.id);

  revalidatePath('/fondo');
}

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

export default async function FondoPage() {
  const accountId = await getCurrentAccountId();
  const supabase = createSupabaseServerClient();

  const [{ data: saldoInicial }, { data: movimientos }, { data: chequeos }] = accountId
    ? await Promise.all([
        supabase.from('fund_initial_balance').select('*').eq('account_id', accountId).maybeSingle(),
        supabase
          .from('fund_movements')
          .select('*')
          .eq('account_id', accountId)
          .order('fecha', { ascending: false })
          .limit(30),
        supabase
          .from('fund_balance_checks')
          .select('*')
          .eq('account_id', accountId)
          .order('fecha', { ascending: false })
          .limit(10),
      ])
    : [{ data: null }, { data: [] as any[] }, { data: [] as any[] }];

  const saldoActual = calcularSaldoFondo(movimientos ?? []);

  const TIPO_LABEL: Record<string, string> = {
    ingreso: 'Ingreso',
    egreso: 'Egreso',
    interes: 'Interés',
    saldo_inicial: 'Saldo inicial',
  };

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

      {/* ------------------------- Saldo inicial ------------------------- */}
      <section>
        <h2 className="mb-3 text-lg font-medium">Saldo inicial</h2>
        {saldoInicial ? (
          <>
            <p className="mb-2 text-sm text-gray-500">
              Se cargó una vez para arrancar con el saldo correcto. Podés corregirlo acá si hace falta.
            </p>
            <form action={updateSaldoInicial} className="flex gap-2">
              <MontoInput
                name="monto"
                defaultValue={saldoInicial.monto}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                required
              />
              <input
                name="fecha"
                type="date"
                defaultValue={saldoInicial.fecha}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                required
              />
              <button className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
                Guardar cambios
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="mb-2 text-sm text-gray-500">
              Se carga una única vez, para arrancar con el saldo correcto del fondo.
            </p>
            <form action={setSaldoInicial} className="flex gap-2">
              <MontoInput
                name="monto"
                placeholder="Monto ₲"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                required
              />
              <input
                name="fecha"
                type="date"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                required
              />
              <button className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
                Guardar saldo inicial
              </button>
            </form>
          </>
        )}
      </section>

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

      {/* ------------------------- Libro mayor ------------------------- */}
      <section>
        <h2 className="mb-3 text-lg font-medium">Últimos movimientos del fondo</h2>
        <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Fecha</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Descripción</th>
                <th className="px-4 py-2 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(movimientos ?? []).map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2">{m.fecha}</td>
                  <td className="px-4 py-2">{TIPO_LABEL[m.tipo] ?? m.tipo}</td>
                  <td className="px-4 py-2 text-gray-500">{m.descripcion}</td>
                  <td
                    className={`px-4 py-2 text-right font-medium ${
                      m.tipo === 'egreso' ? 'text-red-600' : 'text-brand-700'
                    }`}
                  >
                    {m.tipo === 'egreso' ? '-' : '+'}₲ {Number(m.monto).toLocaleString('es-PY')}
                  </td>
                </tr>
              ))}
              {(movimientos ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-sm text-gray-400">
                    Todavía no hay movimientos registrados.
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
