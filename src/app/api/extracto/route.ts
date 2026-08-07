import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';

function csvEscape(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const TIPO_LABEL: Record<string, string> = {
  ingreso: 'Ingreso',
  egreso: 'Egreso',
  interes: 'Interés',
  saldo_inicial: 'Saldo inicial',
};

export async function GET(request: NextRequest) {
  const accountId = await getCurrentAccountId();
  if (!accountId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');

  const supabase = createSupabaseServerClient();
  let query = supabase
    .from('fund_movements')
    .select('*')
    .eq('account_id', accountId)
    .order('fecha', { ascending: true });

  if (desde) query = query.gte('fecha', desde);
  if (hasta) query = query.lte('fecha', hasta);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const filas = [
    ['Fecha', 'Tipo', 'Descripción', 'Monto'],
    ...(data ?? []).map((m) => [
      m.fecha,
      TIPO_LABEL[m.tipo] ?? m.tipo,
      m.descripcion ?? '',
      (m.tipo === 'egreso' ? -Number(m.monto) : Number(m.monto)).toString(),
    ]),
  ];

  const csv = filas.map((fila) => fila.map(csvEscape).join(',')).join('\n');
  const nombreArchivo = `extracto_${desde ?? 'inicio'}_${hasta ?? 'hoy'}.csv`;

  return new NextResponse('\uFEFF' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
    },
  });
}
