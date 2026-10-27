import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAccountId } from '@/lib/supabase/account';
import { calcularSaldoFondo } from '@/lib/fund';
import {
  getInicioPeriodoActual,
  getPeriodosSiguientes,
  toISODate,
  formatPeriodoCorto,
  formatPeriodoLabel,
} from '@/lib/period';
import PrevisionesSimulador, { type FilaPrevision } from '@/components/PrevisionesSimulador';
import { PageHeader, Aviso } from '@/components/ui/Layout';
import { plantillasVigentes } from '@/lib/vigencias';
import { contarCuotas, numeroDeCuota, tieneCuotas } from '@/lib/cuotas';

export default async function PrevisionesPage() {
  const accountId = await getCurrentAccountId();
  const supabase = createSupabaseServerClient();

  if (!accountId) {
    return (
      <Aviso tono="alerta">
        No encontramos una cuenta vinculada a esta sesión. Cerrá sesión y volvé a entrar.
      </Aviso>
    );
  }

  const periodoActual = getInicioPeriodoActual();
  const periodoActualISO = toISODate(periodoActual);

  const [
    { data: movimientos },
    { data: gastosPendientesActual },
    { data: ingresosPendientesActual },
    { data: gastoTemplates },
    { data: ingresoTemplates },
    { data: extrasGastoFuturos },
    { data: extrasIngresoFuturos },
    { data: vigenciasGasto },
    { data: vigenciasIngreso },
  ] = await Promise.all([
    supabase.from('fund_movements').select('tipo, monto').eq('account_id', accountId),
    // No solo el período vigente: un gasto/ingreso que quedó pendiente de
    // un período anterior (nunca se rescató/pagó/confirmó, así que nunca
    // impactó fund_movements) igual va a salir/entrar del fondo en algún
    // momento y tiene que restar/sumar en la proyección.
    supabase
      .from('expense_entries')
      .select('monto')
      .eq('account_id', accountId)
      .lte('periodo', periodoActualISO)
      .eq('estado', 'pendiente'),
    supabase
      .from('income_entries')
      .select('monto')
      .eq('account_id', accountId)
      .lte('periodo', periodoActualISO)
      .eq('estado', 'pendiente'),
    // Se traen todas las plantillas y sus vigencias: el monto y si aplica
    // se resuelven período por período, no una sola vez.
    supabase
      .from('expense_templates')
      .select('id, monto, activo, cuotas_total, cuotas_pagadas_inicial')
      .eq('account_id', accountId),
    supabase.from('income_templates').select('id, monto, activo').eq('account_id', accountId),
    supabase
      .from('expense_entries')
      .select('monto, periodo')
      .eq('account_id', accountId)
      .eq('es_extra', true)
      .eq('estado', 'pendiente')
      .gt('periodo', periodoActualISO),
    supabase
      .from('income_entries')
      .select('monto, periodo')
      .eq('account_id', accountId)
      .eq('es_extra', true)
      .eq('estado', 'pendiente')
      .gt('periodo', periodoActualISO),
    supabase.from('expense_template_vigencias').select('*').eq('account_id', accountId),
    supabase.from('income_template_vigencias').select('*').eq('account_id', accountId),
  ]);

  const saldoActual = calcularSaldoFondo(movimientos ?? []);
  const gastosPendientes = (gastosPendientesActual ?? []).reduce((a, g) => a + Number(g.monto), 0);
  const ingresosPendientes = (ingresosPendientesActual ?? []).reduce((a, i) => a + Number(i.monto), 0);
  // Totales por período, resolviendo la vigencia de cada plantilla en ese
  // momento: así un aumento programado o un gasto estacional se reflejan
  // solo desde el período que corresponde.
  const periodosFuturos = getPeriodosSiguientes(11);

  // Préstamos en cuotas: se proyectan solo mientras queden cuotas. Se
  // cuenta lo generado hasta el período vigente inclusive, y cada período
  // futuro en que la plantilla aplica consume una cuota más; pasada la
  // última, el préstamo deja de restar en la proyección.
  const conteoCuotas = await contarCuotas(
    supabase,
    accountId,
    gastoTemplates ?? [],
    toISODate(periodosFuturos[0])
  );
  const proximaCuota = new Map<string, number>();
  for (const t of gastoTemplates ?? []) {
    if (tieneCuotas(t)) proximaCuota.set(t.id, numeroDeCuota(t, conteoCuotas.get(t.id)));
  }

  // Se llama una vez por período futuro, en orden: va avanzando las cuotas.
  const totalGastosEn = (periodoISO: string) =>
    plantillasVigentes(gastoTemplates ?? [], vigenciasGasto ?? [], periodoISO).reduce((a, t) => {
      if (!tieneCuotas(t)) return a + t.montoVigente;
      const numero = proximaCuota.get(t.id) ?? 1;
      proximaCuota.set(t.id, numero + 1);
      return numero <= Number(t.cuotas_total) ? a + t.montoVigente : a;
    }, 0);
  const totalIngresosEn = (periodoISO: string) =>
    plantillasVigentes(ingresoTemplates ?? [], vigenciasIngreso ?? [], periodoISO).reduce(
      (a, t) => a + t.montoVigente,
      0
    );

  const extraGastoPorPeriodo = new Map<string, number>();
  for (const e of extrasGastoFuturos ?? []) {
    extraGastoPorPeriodo.set(e.periodo, (extraGastoPorPeriodo.get(e.periodo) ?? 0) + Number(e.monto));
  }
  const extraIngresoPorPeriodo = new Map<string, number>();
  for (const e of extrasIngresoFuturos ?? []) {
    extraIngresoPorPeriodo.set(
      e.periodo,
      (extraIngresoPorPeriodo.get(e.periodo) ?? 0) + Number(e.monto)
    );
  }

  // Saldo al cierre del período vigente: lo confirmado, menos lo pendiente
  // de rescatar/pagar, más lo que falta confirmar de ingresos.
  const saldoFinPeriodoActual = saldoActual - gastosPendientes + ingresosPendientes;

  const filas: FilaPrevision[] = [
    {
      periodoISO: periodoActualISO,
      label: 'Actual',
      labelLargo: formatPeriodoLabel(periodoActual),
      ingresos: ingresosPendientes,
      gastos: gastosPendientes,
      tieneExtra: false,
    },
    ...periodosFuturos.map((p) => {
      const key = toISODate(p);
      const extraGastos = extraGastoPorPeriodo.get(key) ?? 0;
      const extraIngresos = extraIngresoPorPeriodo.get(key) ?? 0;
      return {
        periodoISO: key,
        label: formatPeriodoCorto(p),
        labelLargo: formatPeriodoLabel(p),
        ingresos: totalIngresosEn(key) + extraIngresos,
        gastos: totalGastosEn(key) + extraGastos,
        tieneExtra: extraGastos > 0 || extraIngresos > 0,
      };
    }),
  ];

  return (
    <div>
      <PageHeader
        titulo="Previsiones"
        descripcion="Proyección a 12 períodos, asumiendo que las plantillas activas se repiten. Incluye los extras cargados con fecha futura."
      />
      <PrevisionesSimulador
        filas={filas}
        saldoInicialProyeccion={saldoFinPeriodoActual}
        saldoHoy={saldoActual}
      />
    </div>
  );
}
