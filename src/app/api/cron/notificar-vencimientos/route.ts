import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { sendTelegramMessage } from '@/lib/telegram';

/**
 * Ruta invocada diariamente por cron-job.org.
 * Protegida con un secreto compartido (header Authorization) para que
 * nadie más pueda dispararla.
 *
 * Configurar en cron-job.org:
 *   URL: https://<tu-dominio>.vercel.app/api/cron/notificar-vencimientos
 *   Header: Authorization: Bearer <CRON_SECRET>
 *   Horario: el que prefieras (ej. 8:00 AM diario)
 *
 * NOTA: esta ruta usa el cliente con service role porque corre sin sesión
 * de usuario (server-to-server), por eso NO respeta RLS por sí sola —
 * se filtra explícitamente por cada account_id en el loop.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const hoy = new Date().toISOString().slice(0, 10);

  // Gastos normales cuyo "dia" de aplicación cae hoy dentro del período vigente,
  // y gastos extra cuya fecha_vencimiento es hoy. Ambos con estado != 'pagado'.
  const { data: vencenHoy, error } = await supabase
    .from('expense_entries')
    .select('id, account_id, nombre, monto, estado, fecha_vencimiento, es_extra')
    .neq('estado', 'pagado')
    .or(`fecha_vencimiento.eq.${hoy}`); // Etapa 5 completará el matching de "dia" para gastos no-extra

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const porCuenta = new Map<string, typeof vencenHoy>();
  for (const gasto of vencenHoy ?? []) {
    const lista = porCuenta.get(gasto.account_id) ?? [];
    lista.push(gasto);
    porCuenta.set(gasto.account_id, lista);
  }

  let notificacionesEnviadas = 0;

  for (const [accountId, gastos] of porCuenta) {
    const { data: destinatarios } = await supabase
      .from('telegram_recipients')
      .select('chat_id')
      .eq('account_id', accountId)
      .eq('activo', true);

    if (!destinatarios?.length || !gastos?.length) continue;

    const lineas = gastos
      .map((g) => `• ${g.nombre}: ₲ ${Number(g.monto).toLocaleString('es-PY')}`)
      .join('\n');

    const mensaje = `<b>Gastos que vencen hoy</b>\n${lineas}`;

    for (const dest of destinatarios) {
      await sendTelegramMessage(dest.chat_id, mensaje);
      notificacionesEnviadas++;
    }
  }

  return NextResponse.json({ ok: true, notificacionesEnviadas });
}
