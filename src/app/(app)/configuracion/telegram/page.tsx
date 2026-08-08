import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { revalidatePath } from 'next/cache';
import { EmptyState } from '@/components/ui/Layout';

async function addRecipient(formData: FormData) {
  'use server';
  const accountId = await getCurrentAccountId();
  if (!accountId) throw new Error('No se encontró la cuenta del usuario');

  const nombre = String(formData.get('nombre') ?? '').trim();
  const chatId = String(formData.get('chat_id') ?? '').trim();
  if (!nombre || !chatId) return;

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('telegram_recipients')
    .insert({ account_id: accountId, nombre, chat_id: chatId });
  if (error) throw new Error(error.message);
  revalidatePath('/configuracion/telegram');
}

async function toggleRecipient(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const activo = formData.get('activo') === 'true';

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from('telegram_recipients').update({ activo: !activo }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/configuracion/telegram');
}

export default async function TelegramPage() {
  const accountId = await getCurrentAccountId();
  const supabase = createSupabaseServerClient();

  const { data: destinatarios } = accountId
    ? await supabase
        .from('telegram_recipients')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at')
    : { data: [] };

  return (
    <div>
      <p className="mb-5 text-sm text-ink-500">
        Quién recibe el aviso diario de vencimientos. Cada persona necesita su{' '}
        <span className="font-mono text-[13px]">chat_id</span>, que se obtiene escribiéndole a
        @userinfobot en Telegram.
      </p>

      <form action={addRecipient} className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input name="nombre" placeholder="Nombre" className="field" required />
        <input name="chat_id" placeholder="Chat ID" className="field amount" required />
        <button className="btn-primary">Agregar</button>
      </form>

      <ul className="card divide-y divide-line overflow-hidden">
        {(destinatarios ?? []).map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className={d.activo ? 'text-ink' : 'text-ink-400 line-through'}>{d.nombre}</p>
              <p className="mt-0.5 font-mono text-xs text-ink-400">{d.chat_id}</p>
            </div>
            <form action={toggleRecipient}>
              <input type="hidden" name="id" value={d.id} />
              <input type="hidden" name="activo" value={String(d.activo)} />
              <button className="btn-row text-ink-500 hover:bg-canvas">
                {d.activo ? 'Desactivar' : 'Activar'}
              </button>
            </form>
          </li>
        ))}
        {(destinatarios ?? []).length === 0 && (
          <EmptyState mensaje="Todavía no hay destinatarios configurados." />
        )}
      </ul>
    </div>
  );
}
