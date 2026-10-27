import { fechaDeEntry, getInicioPeriodoActual, sumarPeriodos, toISODate } from '@/lib/period';

/**
 * Descuentos de salario: lo que se paga con el salario ANTES de
 * transferir al fondo mutuo (cuotas de préstamos y la propia
 * transferencia). Es un módulo de registro y recordatorio, aparte del
 * fondo: nada de acá lee ni escribe fund_movements/income_entries, así
 * que no mueve el saldo, las previsiones ni el extracto mensual.
 *
 * Lo pendiente se calcula al vuelo (concepto activo sin registro en el
 * período) en vez de generar filas por adelantado como /mes-actual: no
 * hace falta period_generations ni entry_omisiones, y un concepto nuevo
 * aparece como pendiente en el acto.
 */

export type TipoDescuento = 'prestamo' | 'transferencia_fondo' | 'otro';
export type EstadoDescuento = 'pendiente' | 'pagado' | 'omitido' | 'terminado' | 'inactivo';

export const TIPO_DESCUENTO_LABEL: Record<TipoDescuento, string> = {
  prestamo: 'Préstamo',
  transferencia_fondo: 'Transferencia al fondo',
  otro: 'Otro',
};

export type PagoDescuento = {
  id: string;
  monto: number;
  cuotasCubiertas: number;
  estado: 'pagado' | 'omitido';
  fechaPago: string | null;
};

export type DescuentoResumen = {
  id: string;
  salarySourceId: string;
  nombre: string;
  tipo: TipoDescuento;
  montoCuota: number;
  cuotasTotal: number | null;
  cuotasPagadasInicial: number;
  activo: boolean;
  orden: number;
  estado: EstadoDescuento;
  /** Registro del período consultado (pagado u omitido), si existe. */
  pago: PagoDescuento | null;
  /** Solo préstamos con cuotas_total; null = sin fin definido. */
  cuotasRestantes: number | null;
  /** Fecha de cobro del período en que cae la última cuota restante. */
  fechaFinISO: string | null;
  /** Monto a precargar al marcar pagado (1 cuota). Para la transferencia
   *  al fondo es el saldo del salario (ver saldoPendiente). */
  montoSugerido: number;
};

export type SalarioResumen = {
  id: string;
  nombre: string;
  titularUserId: string | null;
  titularNombre: string | null;
  diaCobro: number;
  montoBruto: number;
  activo: boolean;
  orden: number;
  /** Fecha de cobro dentro del período consultado (ciclo 27→26). */
  fechaCobroISO: string;
  descuentos: DescuentoResumen[];
  /** Suma de lo pagado este período en conceptos que no son la transferencia. */
  totalDescontado: number;
  /** Cuotas de los conceptos (no transferencia) todavía pendientes este período. */
  totalADebitar: number;
  /** Bruto − debitado − a debitar − ya transferido: lo que falta
   *  transferir al fondo. */
  saldoPendiente: number;
  /** Suma de lo pagado este período en conceptos de transferencia al fondo. */
  netoTransferido: number;
};

export type PendienteSalario = {
  id: string;
  salarioId: string;
  salarioNombre: string;
  nombre: string;
  tipo: TipoDescuento;
  monto: number;
  fechaCobroISO: string;
  cuotasRestantes: number | null;
};

/** dd/mm/aaaa, el formato con el que se leen las fechas en Paraguay. Se arma
 *  del string ISO a mano para no pasar por Date y evitar corrimientos de
 *  zona horaria (un 2026-11-25 nunca se muestra como 24/11). */
export function formatFechaSalario(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

const porOrden = (a: { orden: number; nombre: string }, b: { orden: number; nombre: string }) =>
  a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es');

/**
 * Arma el estado de todos los salarios de la cuenta para un período.
 *
 * Recibe el cliente de Supabase por parámetro (sesión de usuario o
 * service role): se usa tanto desde /salario y el dashboard como desde el
 * cron del aviso diario, que no tiene sesión. Si creara el cliente adentro,
 * el cron lo vería sin autenticar y RLS le devolvería todo vacío, sin error
 * — lo que ya pasó con construirAvisoDiario y construirExtractoMensual.
 */
export async function construirResumenSalarios(
  supabase: any,
  accountId: string,
  periodoISO: string = toISODate(getInicioPeriodoActual())
): Promise<SalarioResumen[]> {
  const [{ data: fuentes }, { data: conceptos }, { data: pagos }, { data: usuarios }] =
    await Promise.all([
      supabase.from('salary_sources').select('*').eq('account_id', accountId),
      supabase.from('salary_deductions').select('*').eq('account_id', accountId),
      // Todos los períodos, no solo el consultado: las cuotas restantes de
      // un préstamo se calculan sumando todo lo pagado hasta ahora.
      supabase
        .from('salary_deduction_payments')
        .select('id, salary_deduction_id, periodo, monto, cuotas_cubiertas, estado, fecha_pago')
        .eq('account_id', accountId),
      supabase.from('account_users').select('id, nombre, email').eq('account_id', accountId),
    ]);

  const nombreUsuario = new Map<string, string>();
  for (const u of usuarios ?? []) nombreUsuario.set(u.id, u.nombre || u.email);

  const cuotasPagadas = new Map<string, number>();
  const pagoDelPeriodo = new Map<string, PagoDescuento>();
  for (const p of pagos ?? []) {
    if (p.estado === 'pagado') {
      cuotasPagadas.set(
        p.salary_deduction_id,
        (cuotasPagadas.get(p.salary_deduction_id) ?? 0) + Number(p.cuotas_cubiertas)
      );
    }
    if (p.periodo === periodoISO) {
      pagoDelPeriodo.set(p.salary_deduction_id, {
        id: p.id,
        monto: Number(p.monto),
        cuotasCubiertas: Number(p.cuotas_cubiertas),
        estado: p.estado,
        fechaPago: p.fecha_pago,
      });
    }
  }

  return (fuentes ?? [])
    .map((f: any): SalarioResumen => {
      const diaCobro = Number(f.dia_cobro);
      const montoBruto = Number(f.monto_bruto);
      const propios = (conceptos ?? []).filter((d: any) => d.salary_source_id === f.id);

      const pagadoEnPeriodo = (d: any) => {
        const pago = pagoDelPeriodo.get(d.id);
        return pago?.estado === 'pagado' ? pago.monto : 0;
      };

      const descuentos: DescuentoResumen[] = propios
        .map((d: any): DescuentoResumen => {
          const tipo = d.tipo as TipoDescuento;
          const montoCuota = Number(d.monto_cuota);
          const cuotasTotal = d.cuotas_total === null ? null : Number(d.cuotas_total);
          const cuotasPagadasInicial = Number(d.cuotas_pagadas_inicial ?? 0);
          const pago = pagoDelPeriodo.get(d.id) ?? null;

          const cuotasRestantes =
            tipo === 'prestamo' && cuotasTotal !== null
              ? Math.max(0, cuotasTotal - cuotasPagadasInicial - (cuotasPagadas.get(d.id) ?? 0))
              : null;

          let estado: EstadoDescuento;
          if (pago) estado = pago.estado;
          else if (!f.activo || !d.activo) estado = 'inactivo';
          else if (cuotasRestantes !== null && cuotasRestantes <= 0) estado = 'terminado';
          else estado = 'pendiente';

          // Si este período ya tiene registro, la próxima cuota cae el
          // período siguiente; si no, la de este período es una de las
          // restantes. Un adelanto (cuotas_cubiertas > 1) ya está descontado
          // de cuotasRestantes, así que solo acorta el préstamo.
          let fechaFinISO: string | null = null;
          if (cuotasRestantes !== null && cuotasRestantes > 0) {
            const offset = pago ? cuotasRestantes : cuotasRestantes - 1;
            fechaFinISO = toISODate(fechaDeEntry(sumarPeriodos(periodoISO, offset), diaCobro));
          }

          // La transferencia al fondo se completa abajo, cuando ya se
          // conoce el saldo del salario.
          const montoSugerido = montoCuota;

          return {
            id: d.id,
            salarySourceId: f.id,
            nombre: d.nombre,
            tipo,
            montoCuota,
            cuotasTotal,
            cuotasPagadasInicial,
            activo: d.activo,
            orden: Number(d.orden ?? 0),
            estado,
            pago,
            cuotasRestantes,
            fechaFinISO,
            montoSugerido,
          };
        })
        .sort(porOrden);

      // Saldo del salario = bruto − lo ya debitado − lo que falta debitar
      // este período (todo menos la transferencia al fondo, que es justamente
      // lo que sobra). Lo pendiente cuenta por su cuota; lo omitido, inactivo
      // o terminado no se va a debitar y no resta.
      const noTransferencia = descuentos.filter((d) => d.tipo !== 'transferencia_fondo');
      const totalDebitado = noTransferencia.reduce(
        (a, d) => a + (d.estado === 'pagado' ? (d.pago?.monto ?? 0) : 0),
        0
      );
      const totalADebitar = noTransferencia.reduce(
        (a, d) => a + (d.estado === 'pendiente' ? d.montoCuota : 0),
        0
      );
      const saldoParaFondo = montoBruto - totalDebitado - totalADebitar;

      const netoTransferido = propios
        .filter((d: any) => d.tipo === 'transferencia_fondo')
        .reduce((a: number, d: any) => a + pagadoEnPeriodo(d), 0);

      // Ese saldo es el sugerido para la transferencia al fondo. Si hubiera
      // más de un concepto de transferencia, cada uno descuenta lo que ya se
      // transfirió por los otros.
      for (const d of descuentos) {
        if (d.tipo !== 'transferencia_fondo') continue;
        const transferidoPorOtros = netoTransferido - pagadoEnPeriodo(d);
        d.montoSugerido = Math.max(0, saldoParaFondo - transferidoPorOtros);
      }

      return {
        id: f.id,
        nombre: f.nombre,
        titularUserId: f.titular_user_id,
        titularNombre: f.titular_user_id ? (nombreUsuario.get(f.titular_user_id) ?? null) : null,
        diaCobro,
        montoBruto,
        activo: f.activo,
        orden: Number(f.orden ?? 0),
        fechaCobroISO: toISODate(fechaDeEntry(periodoISO, diaCobro)),
        descuentos,
        totalDescontado: totalDebitado,
        totalADebitar,
        // Lo que todavía no se transfirió: llega a 0 una vez hecha la
        // transferencia (y queda negativo si se transfirió de más).
        saldoPendiente: saldoParaFondo - netoTransferido,
        netoTransferido,
      };
    })
    .sort(porOrden);
}

/** Pendientes del período, aplanados, para el dashboard y el aviso diario. */
export function pendientesDeResumen(salarios: SalarioResumen[]): PendienteSalario[] {
  return salarios.flatMap((s) =>
    s.descuentos
      .filter((d) => d.estado === 'pendiente')
      .map((d) => ({
        id: d.id,
        salarioId: s.id,
        salarioNombre: s.nombre,
        nombre: d.nombre,
        tipo: d.tipo,
        monto: d.montoSugerido,
        fechaCobroISO: s.fechaCobroISO,
        cuotasRestantes: d.cuotasRestantes,
      }))
  );
}

/** Mismo requisito que construirResumenSalarios: el cliente llega por parámetro. */
export async function obtenerPendientesSalario(
  supabase: any,
  accountId: string,
  periodoISO?: string
): Promise<PendienteSalario[]> {
  return pendientesDeResumen(await construirResumenSalarios(supabase, accountId, periodoISO));
}
