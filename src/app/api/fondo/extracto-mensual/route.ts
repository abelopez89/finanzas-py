import { NextRequest, NextResponse } from 'next/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { construirExtractoMensual, construirBufferExtracto } from '@/lib/extractoMensual';

export async function GET(request: NextRequest) {
  const accountId = await getCurrentAccountId();
  if (!accountId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const periodoISO = request.nextUrl.searchParams.get('periodo');
  if (!periodoISO) {
    return NextResponse.json({ error: 'Falta el parámetro periodo' }, { status: 400 });
  }

  const extracto = await construirExtractoMensual(accountId, periodoISO);
  const buffer = construirBufferExtracto(extracto);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="extracto_${periodoISO}.xlsx"`,
    },
  });
}
