import { diaFinDeSemana } from '@/lib/period';

/**
 * "· cae sábado/domingo" para la línea gris bajo el nombre de un gasto
 * pendiente: los fines de semana no se pueden hacer rescates del fondo, y
 * los días fijos de las plantillas caen en sábado o domingo según el mes.
 * Es solo aviso; la fecha se corrige a mano con la edición de la fila.
 */
export default function AvisoFinDeSemana({ fechaISO }: { fechaISO: string | null }) {
  const dia = fechaISO ? diaFinDeSemana(fechaISO) : null;
  if (!dia) return null;
  return (
    <span
      className="whitespace-nowrap font-medium text-ochre-700"
      title="Ese día no se puede rescatar del fondo: conviene mover la fecha"
    >
      {' · '}cae {dia}
    </span>
  );
}
