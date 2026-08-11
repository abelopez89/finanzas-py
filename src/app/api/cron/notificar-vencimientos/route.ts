import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { sendTelegramBroadcast, sendTelegramDocumentBroadcast } from '@/lib/telegram';
import { construirAvisoDiario } from '@/lib/avisos';
import { construirExtractoMensual, construirBufferExtracto } from '@/lib/extractoMensual';
import { getPeriodosAnteriores, toISODate } from '@/lib/period';

// Sin caché: cada llamada tiene que leer el estado real del día.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Aviso diario de vencimientos por Telegram. La invoca cron-job.org.
 *
 * Además, el día 27 de cada mes (el día que arranca un ciclo nuevo) manda
 * el extracto en Excel del ciclo que acaba de cerrar — no del mes
 * calendario, sino del período 27-26 completo.
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

  // Todo el cuerpo va envuelto: si algo revienta antes de armar la
  // respuesta (cliente mal configurado, variable de entorno faltante),
  // Vercel devolvía un 500 genérico sin detalle. Ahora se captura y se
  // informa qué pasó, además de quedar en los logs con console.error.
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en las variables de entorno');
    }
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      throw new Error('Falta TELEGRAM_BOT_TOKEN en las variables de entorno');
    }

    const supabase = createSupabaseServiceClient();

    // Cuentas que tienen al menos un destinatario activo
    const { data: destinatarios, error: errorDest } = await supabase
      .from('telegram_recipients')
      .select('account_id, chat_id')
      .eq('activo', true);

    if (errorDest) {
      throw new Error(`Consultando destinatarios: ${errorDest.message}`);
    }

    const porCuenta = new Map<string, string[]>();
    for (const d of destinatarios ?? []) {
      porCuenta.set(d.account_id, [...(porCuenta.get(d.account_id) ?? []), d.chat_id]);
    }

    // Hoy es el primer día de un ciclo nuevo: el período anterior (27-26)
    // ya cerró del todo. getPeriodosAnteriores(2) devuelve [anterior,
    // vigente] en orden ascendente, así que el [0] es el que acaba de
    // cerrar.
    const esInicioDeCiclo = new Date().getDate() === 27;
    const periodoRecienCerradoISO = esInicioDeCiclo
      ? toISODate(getPeriodosAnteriores(2)[0])
      : null;

    const resumen: Array<Record<string, unknown>> = [];

    for (const [accountId, chatIds] of porCuenta) {
      try {
        const mensaje = await construirAvisoDiario(supabase, accountId);
        const { enviados, fallidos } = await sendTelegramBroadcast(chatIds, mensaje);
        resumen.push({ accountId, avisoDiario: { enviados, fallidos } });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido';
        console.error(`Error con aviso diario, cuenta ${accountId}:`, err);
        resumen.push({ accountId, avisoDiario: { error: message } });
      }

      if (periodoRecienCerradoISO) {
        try {
          const extracto = await construirExtractoMensual(accountId, periodoRecienCerradoISO);
          const buffer = construirBufferExtracto(extracto);
          const caption =
            `<b>Extracto — ${extracto.periodoLabel}</b>\n` +
            `Saldo anterior: ₲ ${extracto.saldoAnterior.toLocaleString('es-PY')}\n` +
            `Saldo final: ₲ ${extracto.saldoFinal.toLocaleString('es-PY')}`;

          const { enviados, fallidos } = await sendTelegramDocumentBroadcast(
            chatIds,
            buffer,
            `extracto_${periodoRecienCerradoISO}.xlsx`,
            caption
          );
          resumen.push({ accountId, extractoMensual: { enviados, fallidos } });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Error desconocido';
          console.error(`Error con extracto mensual, cuenta ${accountId}:`, err);
          resumen.push({ accountId, extractoMensual: { error: message } });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      ejecutado: new Date().toISOString(),
      esInicioDeCiclo,
      cuentas: resumen.length,
      resumen,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Error en cron notificar-vencimientos:', err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
