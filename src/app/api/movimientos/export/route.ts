import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { getMovimientosUnificados, type FiltrosMovimientos } from '@/lib/movimientos';
import { toISODate } from '@/lib/period';

export async function GET(request: NextRequest) {
  const accountId = await getCurrentAccountId();
  if (!accountId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filtros: FiltrosMovimientos = {
    q: searchParams.get('q') ?? undefined,
    tipo: (searchParams.get('tipo') as FiltrosMovimientos['tipo']) ?? undefined,
    origen: (searchParams.get('origen') as FiltrosMovimientos['origen']) ?? undefined,
    estado: searchParams.get('estado') ?? undefined,
    desde: searchParams.get('desde') ?? undefined,
    hasta: searchParams.get('hasta') ?? undefined,
  };

  const movimientos = await getMovimientosUnificados(accountId, filtros);

  const filas = movimientos.map((m) => ({
    Fecha: toISODate(m.fecha),
    Tipo: m.tipo,
    Origen: m.origen,
    Nombre: m.nombre,
    Estado: m.estado,
    Monto: m.tipo === 'Gasto' ? -m.monto : m.monto,
  }));

  const hoja = XLSX.utils.json_to_sheet(filas);
  hoja['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 30 }, { wch: 12 }, { wch: 15 }];

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Movimientos');

  const buffer = XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="movimientos.xlsx"`,
    },
  });
}
