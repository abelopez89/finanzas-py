import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
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

  revalidatePath('/configuracion/saldo-inicial');
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

  revalidatePath('/configuracion/saldo-inicial');
  revalidatePath('/fondo');
}

export default async function SaldoInicialPage() {
  const accountId = await getCurrentAccountId();
  const supabase = createSupabaseServerClient();

  const { data: saldoInicial } = accountId
    ? await supabase.from('fund_initial_balance').select('*').eq('account_id', accountId).maybeSingle()
    : { data: null };

  return (
    <div className="max-w-lg">
      <p className="mb-5 text-sm text-ink-500">
        {saldoInicial
          ? 'El punto de partida del fondo. Podés corregirlo si lo cargaste mal — el saldo se recalcula solo.'
          : 'El saldo con el que arranca el fondo. Se carga una vez y sirve de punto de partida para todos los cálculos.'}
      </p>

      <form
        action={saldoInicial ? updateSaldoInicial : setSaldoInicial}
        className="card space-y-4 p-4"
      >
        <div>
          <label className="label" htmlFor="monto">
            Monto
          </label>
          <MontoInput
            name="monto"
            defaultValue={saldoInicial?.monto}
            placeholder="0"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="fecha">
            Fecha
          </label>
          <input
            id="fecha"
            name="fecha"
            type="date"
            defaultValue={saldoInicial?.fecha}
            className="field"
            required
          />
        </div>
        <button className="btn-primary w-full sm:w-auto">
          {saldoInicial ? 'Guardar cambios' : 'Guardar saldo inicial'}
        </button>
      </form>
    </div>
  );
}
