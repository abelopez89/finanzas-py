import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fechaDeEntry, toISODate } from '@/lib/period';

export type MovimientoUnificado = {
  id: string;
  tipo: 'Gasto' | 'Ingreso' | 'Interés' | 'Saldo inicial';
  origen: 'Regular' | 'Extra' | 'Fondo';
  nombre: string;
  fecha: Date;
  monto: number;
  estado: string;
  // Solo los gastos tienen categoría; ingresos e intereses/saldo inicial
  // quedan en null.
  categoriaId: string | null;
  categoriaNombre: string | null;
};

/** Valor de filtro para "sin categoría asignada" (un gasto sin category_id). */
export const SIN_CATEGORIA = 'sin-categoria';

export type FiltrosMovimientos = {
  q?: string;
  tipo?: MovimientoUnificado['tipo'] | '';
  origen?: MovimientoUnificado['origen'] | '';
  estado?: string;
  categoria?: string;
  desde?: string;
  hasta?: string;
};

/**
 * Trae y unifica los movimientos CONFIRMADOS de la cuenta: gastos pagados,
 * ingresos confirmados (regulares y extra), más los intereses y el saldo
 * inicial registrados en el libro mayor del fondo. Aplica los filtros en
 * memoria. Pensado para una cantidad de datos modesta (uso familiar), no
 * para volúmenes grandes.
 */
export async function getMovimientosUnificados(
  accountId: string,
  filtros: FiltrosMovimientos = {}
): Promise<MovimientoUnificado[]> {
  const supabase = createSupabaseServerClient();

  const [{ data: gastos }, { data: ingresos }, { data: fondoMovs }] = await Promise.all([
    supabase
      .from('expense_entries')
      .select('*, categories(nombre)')
      .eq('account_id', accountId)
      .eq('estado', 'pagado'),
    supabase.from('income_entries').select('*').eq('account_id', accountId).eq('estado', 'confirmado'),
    supabase
      .from('fund_movements')
      .select('*')
      .eq('account_id', accountId)
      .in('tipo', ['interes', 'saldo_inicial']),
  ]);

  const movimientos: MovimientoUnificado[] = [];

  for (const g of gastos ?? []) {
    const fecha = g.es_extra && g.fecha_vencimiento
      ? new Date(`${g.fecha_vencimiento}T00:00:00Z`)
      : fechaDeEntry(g.periodo, g.dia);
    movimientos.push({
      id: g.id,
      tipo: 'Gasto',
      origen: g.es_extra ? 'Extra' : 'Regular',
      nombre: g.nombre,
      fecha,
      monto: Number(g.monto),
      estado: g.estado,
      categoriaId: g.category_id ?? null,
      categoriaNombre: g.categories?.nombre ?? null,
    });
  }

  for (const i of ingresos ?? []) {
    const fecha = i.es_extra && i.fecha_aplicacion
      ? new Date(`${i.fecha_aplicacion}T00:00:00Z`)
      : fechaDeEntry(i.periodo, i.dia);
    movimientos.push({
      id: i.id,
      tipo: 'Ingreso',
      origen: i.es_extra ? 'Extra' : 'Regular',
      nombre: i.nombre,
      fecha,
      monto: Number(i.monto),
      estado: i.estado,
      categoriaId: null,
      categoriaNombre: null,
    });
  }

  for (const f of fondoMovs ?? []) {
    movimientos.push({
      id: f.id,
      tipo: f.tipo === 'interes' ? 'Interés' : 'Saldo inicial',
      origen: 'Fondo',
      nombre: f.descripcion ?? (f.tipo === 'interes' ? 'Interés' : 'Saldo inicial'),
      fecha: new Date(`${f.fecha}T00:00:00Z`),
      monto: Number(f.monto),
      estado: 'confirmado',
      categoriaId: null,
      categoriaNombre: null,
    });
  }

  const filtrados = movimientos.filter((m) => {
    if (filtros.q && !m.nombre.toLowerCase().includes(filtros.q.toLowerCase())) return false;
    if (filtros.tipo && m.tipo !== filtros.tipo) return false;
    if (filtros.origen && m.origen !== filtros.origen) return false;
    if (filtros.estado && m.estado !== filtros.estado) return false;
    if (filtros.categoria) {
      if (filtros.categoria === SIN_CATEGORIA ? m.categoriaId !== null : m.categoriaId !== filtros.categoria) {
        return false;
      }
    }
    const fechaISO = toISODate(m.fecha);
    if (filtros.desde && fechaISO < filtros.desde) return false;
    if (filtros.hasta && fechaISO > filtros.hasta) return false;
    return true;
  });

  filtrados.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  return filtrados;
}
