import { fechaDeEntry, toISODate } from '@/lib/period';
import { calcularSaldoFondo } from '@/lib/fund';
import { escapeHtml } from '@/lib/telegram';

const fmtGs = (n: number) => `₲ ${new Intl.NumberFormat('es-PY').format(Math.round(n))}`;

function fmtFechaCorta(iso: string) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

type GastoAviso = {
  nombre: string;
  monto: number;
  estado: string;
  fechaISO: string;
  metodo: string | null;
};

/**
 * Arma el aviso diario de una cuenta: gastos que vencen hoy, los que ya
 * quedaron atrás sin pagar, y el saldo del fondo. Se manda siempre que haya
 * al menos un destinatario — incluso sin vencimientos, sirve como check-in
 * diario del saldo.
 */
export async function construirAvisoDiario(
  // Acepta cualquiera de los dos clientes (sesión de usuario o service
  // role): ambos apuntan al esquema finanzas_py, pero TypeScript los tipa
  // distinto y acá solo se usan métodos comunes.
  supabase: any,
  accountId: string,
  opciones: { forzar?: boolean } = {}
): Promise<string | null> {
  const hoyISO = toISODate(new Date());

  const [{ data: gastos }, { data: movimientos }] = await Promise.all([
    supabase
      .from('expense_entries')
      .select('nombre, monto, estado, dia, periodo, es_extra, fecha_vencimiento, payment_methods(nombre)')
      .eq('account_id', accountId)
      .neq('estado', 'pagado'),
    supabase.from('fund_movements').select('tipo, monto').eq('account_id', accountId),
  ]);

  const saldo = calcularSaldoFondo(movimientos ?? []);

  // Fecha real de cada gasto: los extras la tienen explícita, los regulares
  // se derivan del período (ciclo 27-26) y el día.
  const conFecha: GastoAviso[] = (gastos ?? []).map((g: any) => ({
    nombre: g.nombre,
    monto: Number(g.monto),
    estado: g.estado,
    fechaISO:
      g.es_extra && g.fecha_vencimiento
        ? g.fecha_vencimiento
        : toISODate(fechaDeEntry(g.periodo, g.dia)),
    metodo: g.payment_methods?.nombre ?? null,
  }));

  const vencenHoy = conFecha.filter((g) => g.fechaISO === hoyISO);
  // Solo los pendientes cuentan como atrasados: si ya está rescatado, la
  // plata salió del fondo y no requiere acción antes del mediodía.
  const atrasados = conFecha
    .filter((g) => g.fechaISO < hoyISO && g.estado === 'pendiente')
    .sort((a, b) => a.fechaISO.localeCompare(b.fechaISO));

  const linea = (g: GastoAviso, mostrarFecha = false) => {
    const partes = [`• <b>${escapeHtml(g.nombre)}</b> — ${fmtGs(g.monto)}`];
    if (g.metodo) partes.push(escapeHtml(g.metodo));
    if (mostrarFecha) partes.push(`venció el ${fmtFechaCorta(g.fechaISO)}`);
    if (g.estado === 'rescatado') partes.push('ya rescatado');
    return partes.join(' · ');
  };

  const bloques: string[] = [];
  bloques.push('<b>finanzas·py — vencimientos</b>');

  if (vencenHoy.length > 0) {
    const porRescatar = vencenHoy.filter((g) => g.estado === 'pendiente');
    bloques.push(
      `\n📅 <b>Vencen hoy (${vencenHoy.length})</b>\n` +
        vencenHoy.map((g) => linea(g)).join('\n')
    );
    if (porRescatar.length > 0) {
      const total = porRescatar.reduce((a, g) => a + g.monto, 0);
      bloques.push(`\n💧 A rescatar antes del mediodía: <b>${fmtGs(total)}</b>`);
    }
  }

  if (atrasados.length > 0) {
    const totalAtrasado = atrasados.reduce((a, g) => a + g.monto, 0);
    bloques.push(
      `\n⚠️ <b>Atrasados sin rescatar (${atrasados.length})</b>\n` +
        atrasados.map((g) => linea(g, true)).join('\n') +
        `\nTotal: <b>${fmtGs(totalAtrasado)}</b>`
    );
  }

  if (vencenHoy.length === 0 && atrasados.length === 0) {
    bloques.push('\n✅ No hay vencimientos para hoy ni pendientes atrasados.');
  }

  bloques.push(`\n🏦 Saldo del fondo: <b>${fmtGs(saldo)}</b>`);

  return bloques.join('\n');
}
