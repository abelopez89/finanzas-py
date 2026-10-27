/**
 * Sistema de color por estado, compartido por toda la app.
 * El color es el canal primario de lectura del estado; el texto lo confirma
 * (nunca color solo, por accesibilidad).
 */
export const ESTADO_PILL: Record<string, string> = {
  pendiente: 'bg-canvas text-ink-500 ring-1 ring-inset ring-line',
  rescatado: 'bg-ochre-50 text-ochre-700 ring-1 ring-inset ring-ochre-100',
  pagado: 'bg-pine-50 text-pine-700 ring-1 ring-inset ring-pine-100',
  confirmado: 'bg-pine-50 text-pine-700 ring-1 ring-inset ring-pine-100',
  // Descuentos de salario (/salario)
  omitido: 'bg-canvas text-ink-400 ring-1 ring-inset ring-line',
  terminado: 'bg-pine-50 text-pine-700 ring-1 ring-inset ring-pine-100',
  inactivo: 'bg-canvas text-ink-400 ring-1 ring-inset ring-line',
};

/** Barra vertical izquierda de la ficha en móvil — la "pestaña" del libro mayor. */
export const ESTADO_BARRA: Record<string, string> = {
  pendiente: 'bg-ink-300',
  rescatado: 'bg-ochre-600',
  pagado: 'bg-pine-600',
  confirmado: 'bg-pine-600',
  omitido: 'bg-ink-300',
  terminado: 'bg-pine-600',
  inactivo: 'bg-ink-300',
};

export default function StatusPill({ estado }: { estado: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
        ESTADO_PILL[estado] ?? ESTADO_PILL.pendiente
      }`}
    >
      {estado}
    </span>
  );
}
