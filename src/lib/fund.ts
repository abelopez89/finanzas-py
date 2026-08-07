export type FundMovement = { tipo: string; monto: number | string };

/**
 * Calcula el saldo del fondo sumando ingresos/intereses/saldo inicial y
 * restando egresos. El monto de "interes" puede ser negativo (si el saldo
 * informado resultó menor al esperado), por eso simplemente se suma.
 */
export function calcularSaldoFondo(movimientos: FundMovement[]): number {
  return movimientos.reduce((acc, m) => {
    const monto = Number(m.monto);
    return m.tipo === 'egreso' ? acc - monto : acc + monto;
  }, 0);
}
