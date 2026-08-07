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

/** Etiqueta legible: "27 de julio — 26 de agosto de 2026" */
export function formatPeriodoLabel(inicio: Date): string {
  const fin = getFinPeriodo(inicio);
  return `${format(inicio, "d 'de' MMMM", { locale: es })} — ${format(
    fin,
    "d 'de' MMMM 'de' yyyy",
    { locale: es }
  )}`;
}

/** Etiqueta corta para gráficos: "jul '26" */
export function formatPeriodoCorto(inicio: Date): string {
  return format(inicio, "MMM ''yy", { locale: es });
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
