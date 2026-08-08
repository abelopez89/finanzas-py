import { addMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';

const DIA_CORTE = 27;

/**
 * Devuelve la fecha de inicio (día 27) del período de facturación vigente
 * para la fecha dada (por defecto, hoy). El período va del 27 al 26 del
 * mes siguiente — respeta el ciclo de facturación de la familia, no el
 * mes calendario.
 */
export function getInicioPeriodoActual(fecha: Date = new Date()): Date {
  const dia = fecha.getDate();
  const inicio = new Date(fecha.getFullYear(), fecha.getMonth(), DIA_CORTE);
  if (dia < DIA_CORTE) {
    inicio.setMonth(inicio.getMonth() - 1);
  }
  inicio.setHours(0, 0, 0, 0);
  return inicio;
}

/** Último día del período (26 del mes siguiente al inicio). */
export function getFinPeriodo(inicio: Date): Date {
  const fin = addMonths(inicio, 1);
  fin.setDate(DIA_CORTE - 1);
  return fin;
}

export function toISODate(fecha: Date): string {
  return format(fecha, 'yyyy-MM-dd');
}

/**
 * El período se nombra por el mes en que TERMINA, no en que empieza: el
 * ciclo 27/07–26/08 es "agosto", porque es el mes donde cae casi todo y
 * donde efectivamente se paga.
 */
export function getMesDelPeriodo(inicio: Date): Date {
  return getFinPeriodo(inicio);
}

/** Etiqueta completa: "Agosto 2026 · 27 jul — 26 ago" */
export function formatPeriodoLabel(inicio: Date): string {
  const fin = getFinPeriodo(inicio);
  const mes = format(fin, 'MMMM yyyy', { locale: es });
  const mesCapitalizado = mes.charAt(0).toUpperCase() + mes.slice(1);
  return `${mesCapitalizado} · ${format(inicio, 'd MMM', { locale: es })} — ${format(fin, 'd MMM', {
    locale: es,
  })}`;
}

/** Etiqueta corta para gráficos y tablas: "ago '26" */
export function formatPeriodoCorto(inicio: Date): string {
  return format(getFinPeriodo(inicio), "MMM ''yy", { locale: es });
}

/** Devuelve los últimos N períodos (inicio de cada uno), en orden ascendente,
 * terminando en el período vigente. */
export function getPeriodosAnteriores(n: number, desde: Date = new Date()): Date[] {
  const actual = getInicioPeriodoActual(desde);
  const periodos: Date[] = [];
  for (let i = n - 1; i >= 0; i--) {
    periodos.push(addMonths(actual, -i));
  }
  return periodos;
}

/** Devuelve los próximos N períodos (inicio de cada uno) DESPUÉS del vigente,
 * en orden ascendente. */
export function getPeriodosSiguientes(n: number, desde: Date = new Date()): Date[] {
  const actual = getInicioPeriodoActual(desde);
  const periodos: Date[] = [];
  for (let i = 1; i <= n; i++) {
    periodos.push(addMonths(actual, i));
  }
  return periodos;
}

/**
 * Convierte un "día" (1-31) en una clave de orden que respeta el ciclo de
 * facturación 27→26: el día 27 es el primero del período, el 26 el último.
 */
export function ordenDiaPeriodo(dia: number): number {
  return dia >= 27 ? dia - 27 : dia + 4;
}

/**
 * Reconstruye la fecha calendario real de un movimiento regular a partir de
 * su período (inicio del ciclo, día 27) y su día (1-31). Los días 27-31
 * pertenecen al mes del inicio del período; los días 1-26 pertenecen al mes
 * siguiente.
 */
export function fechaDeEntry(periodoISO: string, dia: number): Date {
  const inicio = new Date(`${periodoISO}T00:00:00Z`);
  if (dia >= 27) {
    return new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), dia));
  }
  return new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, dia));
}

/**
 * ¿La fecha de aplicación de este movimiento ya pasó? Se compara contra
 * hoy a medianoche, así un gasto que vence hoy todavía NO cuenta como
 * vencido (hay hasta el mediodía para rescatarlo).
 */
export function estaVencido(periodoISO: string, dia: number): boolean {
  const hoy = new Date();
  const hoyUTC = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return fechaDeEntry(periodoISO, dia).getTime() < hoyUTC;
}

/** Días que faltan para la fecha de aplicación (0 = vence hoy, negativo = vencido). */
export function diasParaVencer(periodoISO: string, dia: number): number {
  const hoy = new Date();
  const hoyUTC = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const MS_DIA = 86_400_000;
  return Math.round((fechaDeEntry(periodoISO, dia).getTime() - hoyUTC) / MS_DIA);
}

/** Ventana de atención: vence hoy o dentro de los próximos 3 días. */
export const DIAS_AVISO_VENCIMIENTO = 3;

export function estaPorVencer(periodoISO: string, dia: number): boolean {
  const dias = diasParaVencer(periodoISO, dia);
  return dias >= 0 && dias <= DIAS_AVISO_VENCIMIENTO;
}
