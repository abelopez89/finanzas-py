/**
 * Escapa los caracteres que Telegram interpreta como HTML. Sin esto, un
 * gasto llamado "Colegio & Útiles" rompería el mensaje entero.
 */
export function escapeHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Envía un mensaje por Telegram usando el bot ya existente.
 * Requiere TELEGRAM_BOT_TOKEN en las variables de entorno.
 */
export async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Falta TELEGRAM_BOT_TOKEN en las variables de entorno');

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram respondió ${res.status}: ${body}`);
  }
}

/**
 * Envía a varios destinatarios sin cortar el proceso si uno falla (por
 * ejemplo, si alguien bloqueó el bot). Devuelve el detalle por destinatario.
 */
export async function sendTelegramBroadcast(chatIds: string[], text: string) {
  const resultados = await Promise.allSettled(
    chatIds.map((chatId) => sendTelegramMessage(chatId, text))
  );

  const enviados = resultados.filter((r) => r.status === 'fulfilled').length;
  const fallidos = resultados
    .map((r, i) => ({ r, chatId: chatIds[i] }))
    .filter(({ r }) => r.status === 'rejected')
    .map(({ r, chatId }) => ({
      chatId,
      error: (r as PromiseRejectedResult).reason?.message ?? 'Error desconocido',
    }));

  return { enviados, fallidos };
}
