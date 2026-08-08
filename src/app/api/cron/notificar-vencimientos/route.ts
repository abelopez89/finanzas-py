import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { sendTelegramBroadcast } from '@/lib/telegram';
import { construirAvisoDiario } from '@/lib/avisos';

// Sin caché: cada llamada tiene que leer el estado real del día.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Aviso diario de vencimientos por Telegram. La invoca cron-job.org.
 *
 * Configuración en cron-job.org:
 *   URL:      https://<tu-dominio>.vercel.app/api/cron/notificar-vencimientos
 *   Horario:  el que prefieras (ej. 8:00, con zona horaria America/Asuncion)
 *   Auth:     header  Authorization: Bearer <CRON_SECRET>
 *             o bien  ?token=<CRON_SECRET> en la URL, si te resulta más
 *             cómodo que configurar headers.
 *
 * Usa el cliente con service role porque corre sin sesión de usuario, así
 * que NO pasa por RLS: por eso filtra explícitamente por cada account_id.
 */
export async function GET(request: NextRequest) {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    return NextResponse.json(
      { error: 'Falta CRON_SECRET en las variables de entorno' },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('authorization');
  const tokenQuery = request.nextUrl.searchParams.get('token');
  const autorizado = authHeader === `Bearer ${secreto}` || tokenQuery === secreto;

  if (!autorizado) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();

  // Cuentas que tienen al menos un destinatario activo
  const { data: destinatarios, error: errorDest } = await supabase
    .from('telegram_recipients')
    .select('account_id, chat_id')
    .eq('activo', true);

  if (errorDest) {
    return NextResponse.json({ error: errorDest.message }, { status: 500 });
  }

  const porCuenta = new Map<string, string[]>();
  for (const d of destinatarios ?? []) {
    porCuenta.set(d.account_id, [...(porCuenta.get(d.account_id) ?? []), d.chat_id]);
  }

  const resumen: Array<Record<string, unknown>> = [];

  for (const [accountId, chatIds] of porCuenta) {
    try {
      const mensaje = await construirAvisoDiario(supabase, accountId);

      // Sin vencimientos ni atrasados: no se manda nada, para que el aviso
      // diario no se vuelva ruido que se ignora.
      if (!mensaje) {
        resumen.push({ accountId, enviados: 0, omitido: 'sin vencimientos' });
        continue;
      }

      const { enviados, fallidos } = await sendTelegramBroadcast(chatIds, mensaje);
      resumen.push({ accountId, enviados, fallidos });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      console.error(`Error notificando cuenta ${accountId}:`, err);
      resumen.push({ accountId, error: message });
    }
  }

  return NextResponse.json({
    ok: true,
    ejecutado: new Date().toISOString(),
    cuentas: resumen.length,
    resumen,
  });
}
