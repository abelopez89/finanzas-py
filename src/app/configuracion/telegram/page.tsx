import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { revalidatePath } from 'next/cache';

async function addRecipient(formData: FormData) {
  'use server';
  const accountId = await getCurrentAccountId();
  if (!accountId) return;

  const nombre = String(formData.get('nombre') ?? '').trim();
  const chatId = String(formData.get('chat_id') ?? '').trim();
  if (!nombre || !chatId) return;

  const supabase = createSupabaseServerClient();
  await supabase.from('telegram_recipients').insert({
    account_id: accountId,
    nombre,
    chat_id: chatId,
  });
  revalidatePath('/configuracion/telegram');
}

async function toggleRecipient(formData: FormData) {
  'use server';
  const id = String(formData.get('id'));
  const activo = formData.get('activo') === 'true';

  const supabase = createSupabaseServerClient();
  await supabase.from('telegram_recipients').update({ activo: !activo }).eq('id', id);
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
      <h1 className="mb-1 text-2xl font-semibold">Notificaciones Telegram</h1>
      <p className="mb-4 text-sm text-gray-500">
        El bot ya existente se reutiliza (token en variable de entorno del
        servidor). Acá solo se configura a quién avisarle: cada persona debe
        pasarte su <code>chat_id</code> de Telegram (se obtiene hablándole al
        bot y consultando <code>/getUpdates</code> en la API de Telegram, o
        con un bot como @userinfobot).
      </p>

      <form action={addRecipient} className="mb-6 flex gap-2">
        <input
          name="nombre"
          placeholder="Nombre"
          className="w-1/3 rounded-md border border-gray-300 px-3 py-2 text-sm"
          required
        />
        <input
          name="chat_id"
          placeholder="Chat ID de Telegram"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          required
        />
        <button className="rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-700">
          Agregar
        </button>
      </form>

      <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 bg-white">
        {(destinatarios ?? []).map((d) => (
          <li key={d.id} className="flex items-center justify-between px-4 py-3">
            <span className={d.activo ? '' : 'text-gray-400 line-through'}>
              {d.nombre} <span className="text-gray-400">({d.chat_id})</span>
            </span>
            <form action={toggleRecipient}>
              <input type="hidden" name="id" value={d.id} />
              <input type="hidden" name="activo" value={String(d.activo)} />
              <button className="text-xs text-brand-600 hover:underline">
                {d.activo ? 'Desactivar' : 'Activar'}
              </button>
            </form>
          </li>
        ))}
        {(destinatarios ?? []).length === 0 && (
          <li className="px-4 py-3 text-sm text-gray-400">Todavía no hay destinatarios cargados.</li>
        )}
      </ul>
    </div>
  );
}
