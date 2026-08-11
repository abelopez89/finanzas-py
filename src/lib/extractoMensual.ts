import * as XLSX from 'xlsx';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { calcularSaldoFondo } from '@/lib/fund';
import { getFinPeriodo, toISODate, formatPeriodoLabel } from '@/lib/period';
import { formatearColumnaMiles } from '@/lib/xlsxFormato';

const TIPO_LABEL: Record<string, string> = {
  ingreso: 'Ingreso',
  egreso: 'Egreso',
  interes: 'Interés',
  saldo_inicial: 'Saldo inicial',
};

export type FilaExtracto = {
  fecha: string;
  tipo: string;
  descripcion: string;
  monto: number;
  saldo: number;
};

export type ExtractoMensual = {
  periodoISO: string;
  finISO: string;
  periodoLabel: string;
  saldoAnterior: number;
  filas: FilaExtracto[];
  saldoFinal: number;
};

/**
 * Extracto de un período (ciclo 27-26): saldo anterior a la fecha de
 * inicio, cada movimiento confirmado del período con su saldo corrido, y
 * el saldo final. El saldo final coincide con el saldo real del fondo solo
 * si el período elegido es el vigente; para períodos pasados es el saldo
 * histórico a esa fecha.
 */
export async function construirExtractoMensual(
  accountId: string,
  periodoISO: string
): Promise<ExtractoMensual> {
  const supabase = createSupabaseServerClient();
  const inicio = new Date(`${periodoISO}T00:00:00Z`);
  const finISO = toISODate(getFinPeriodo(inicio));

  const { data: movimientos } = await supabase
    .from('fund_movements')
    .select('*')
    .eq('account_id', accountId)
    .order('fecha', { ascending: true });

  const todos = movimientos ?? [];
  const anteriores = todos.filter((m) => m.fecha < periodoISO);
  const delPeriodo = todos
    .filter((m) => m.fecha >= periodoISO && m.fecha <= finISO)
    // Dentro del mismo día, los ingresos van antes que los egresos: así el
    // saldo corrido no muestra un sobregiro que en la realidad nunca
    // ocurrió (la plata entró y salió el mismo día, en ese orden).
    .sort((a, b) => {
      if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
      const aEsEgreso = a.tipo === 'egreso' ? 1 : 0;
      const bEsEgreso = b.tipo === 'egreso' ? 1 : 0;
      return aEsEgreso - bEsEgreso;
    });

  const saldoAnterior = calcularSaldoFondo(anteriores);

  let acumulado = saldoAnterior;
  const filas: FilaExtracto[] = delPeriodo.map((m) => {
    const montoConSigno = m.tipo === 'egreso' ? -Number(m.monto) : Number(m.monto);
    acumulado += montoConSigno;
    return {
      fecha: m.fecha,
      tipo: TIPO_LABEL[m.tipo] ?? m.tipo,
      descripcion: m.descripcion ?? '',
      monto: montoConSigno,
      saldo: acumulado,
    };
  });

  return {
    periodoISO,
    finISO,
    periodoLabel: formatPeriodoLabel(inicio),
    saldoAnterior,
    filas,
    saldoFinal: acumulado,
  };
}

/** Arma el .xlsx del extracto: saldo anterior, movimientos con saldo corrido, saldo final. */
export function construirBufferExtracto(extracto: ExtractoMensual): Buffer {
  const filas = [
    { Fecha: '', Tipo: '', Descripción: 'Saldo anterior', Monto: '', Saldo: extracto.saldoAnterior },
    ...extracto.filas.map((f) => ({
      Fecha: f.fecha,
      Tipo: f.tipo,
      Descripción: f.descripcion,
      Monto: f.monto,
      Saldo: f.saldo,
    })),
    { Fecha: '', Tipo: '', Descripción: 'Saldo final', Monto: '', Saldo: extracto.saldoFinal },
  ];

  const hoja = XLSX.utils.json_to_sheet(filas);
  hoja['!cols'] = [{ wch: 12 }, { wch: 14 }, { wch: 32 }, { wch: 15 }, { wch: 15 }];
  // Monto (índice 3) y Saldo (índice 4): separador de miles.
  formatearColumnaMiles(hoja, 3, filas.length);
  formatearColumnaMiles(hoja, 4, filas.length);

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Extracto mensual');

  return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
