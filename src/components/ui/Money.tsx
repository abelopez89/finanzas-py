const nf = new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 });

export function formatGs(monto: number | string): string {
  return nf.format(Math.round(Number(monto)));
}

/**
 * Muestra un importe en guaraníes. El símbolo va en un tono más claro y
 * tamaño menor para que la cifra sea lo que domina visualmente.
 * Siempre en mono tabular: las columnas de montos quedan alineadas.
 */
export default function Money({
  value,
  signo,
  className = '',
  size = 'base',
}: {
  value: number | string;
  /** 'egreso' antepone −, 'ingreso' antepone +. Omitir para neutro. */
  signo?: 'egreso' | 'ingreso';
  className?: string;
  size?: 'sm' | 'base' | 'lg' | 'xl';
}) {
  const sizes = {
    sm: 'text-[13px]',
    base: 'text-[15px]',
    lg: 'text-xl',
    xl: 'text-[32px] leading-none sm:text-[40px]',
  };
  const prefijo = signo === 'egreso' ? '−' : signo === 'ingreso' ? '+' : '';

  return (
    <span className={`amount ${sizes[size]} ${className}`}>
      {prefijo}
      <span className={size === 'xl' ? 'mr-1.5 text-[0.5em] text-ink-400' : 'mr-1 text-[0.8em] text-ink-400'}>
        ₲
      </span>
      {formatGs(value)}
    </span>
  );
}
