/**
 * Envía un mensaje de texto por Telegram usando el bot ya existente.
 * Requiere la variable de entorno TELEGRAM_BOT_TOKEN (el token de TU bot,
 * el mismo que ya usás para otras notificaciones).
 */
export async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Falta TELEGRAM_BOT_TOKEN en las variables de entorno');

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Error enviando mensaje de Telegram: ${res.status} ${body}`);
  }
}
