import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { revalidatePath } from 'next/cache';
import { EmptyState, Aviso } from '@/components/ui/Layout';
import FormularioAlta from '@/components/ui/FormularioAlta';
import { sendTelegramBroadcast } from '@/lib/telegram';
import { construirAvisoDiario } from '@/lib/avisos';

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

/**
 * Manda el aviso real (el mismo que enviaría el cron) a los destinatarios
 * activos, forzándolo aunque hoy no haya vencimientos. Sirve para verificar
 * que el token y los chat_id estén bien sin esperar al horario del cron.
 */
async function enviarPrueba() {
  'use server';
  const accountId = await getCurrentAccountId();
  if (!accountId) throw new Error('No se encontró la cuenta del usuario');

  const supabase = createSupabaseServerClient();
  const { data: destinatarios } = await supabase
    .from('telegram_recipients')
    .select('chat_id')
    .eq('account_id', accountId)
    .eq('activo', true);

  const chatIds = (destinatarios ?? []).map((d) => d.chat_id);
  if (chatIds.length === 0) {
    throw new Error('No hay destinatarios activos a quienes enviar la prueba.');
  }

  const mensaje =
    (await construirAvisoDiario(supabase, accountId, { forzar: true })) ??
    'Prueba de finanzas·py';

  const { fallidos } = await sendTelegramBroadcast(chatIds, mensaje);

  if (fallidos.length > 0) {
    throw new Error(
      `No se pudo enviar a ${fallidos.length} destinatario(s): ${fallidos
        .map((f) => `${f.chatId} (${f.error})`)
        .join(', ')}`
    );
  }

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

  const activos = (destinatarios ?? []).filter((d) => d.activo).length;

  return (
    <div>
      <p className="mb-5 text-sm text-ink-500">
        Quién recibe el aviso diario de vencimientos. Cada persona necesita su{' '}
        <span className="font-mono text-[13px]">chat_id</span>, que se obtiene escribiéndole a
        @userinfobot en Telegram. Ojo: cada destinatario tiene que haberle escrito al menos una vez
        a tu bot, o Telegram no le deja enviar mensajes.
      </p>

      <FormularioAlta
        action={addRecipient}
        className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]"
      >
        <input name="nombre" placeholder="Nombre" className="field" required />
        <input name="chat_id" placeholder="Chat ID" className="field amount" required />
        <button className="btn-primary">Agregar</button>
      </FormularioAlta>

      <ul className="card mb-5 divide-y divide-line overflow-hidden">
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

      {activos > 0 && (
        <form action={enviarPrueba} className="mb-6">
          <button className="btn-secondary w-full sm:w-auto">Enviar aviso de prueba</button>
          <p className="mt-2 text-xs text-ink-400">
            Manda el mismo mensaje que enviaría el aviso diario, a los {activos} destinatario
            {activos === 1 ? '' : 's'} activo{activos === 1 ? '' : 's'}, aunque hoy no haya
            vencimientos.
          </p>
        </form>
      )}

      <Aviso>
        <p className="mb-2 font-medium">Programar el aviso diario</p>
        <p className="mb-2">
          En cron-job.org creá una tarea que llame a esta dirección, con la zona horaria de Asunción
          y el horario que prefieras (conviene bien temprano, para llegar antes del mediodía):
        </p>
        <p className="mb-2 break-all rounded-md bg-surface px-2.5 py-2 font-mono text-xs">
          https://finanzas-py.vercel.app/api/cron/notificar-vencimientos
        </p>
        <p>
          Autenticala con el header <span className="font-mono text-xs">Authorization: Bearer</span>{' '}
          seguido de tu <span className="font-mono text-xs">CRON_SECRET</span>, o agregando{' '}
          <span className="font-mono text-xs">?token=TU_CRON_SECRET</span> al final de la dirección
          si te resulta más simple.
        </p>
      </Aviso>
    </div>
  );
}
