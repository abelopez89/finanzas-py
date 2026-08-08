'use client';

import { useFormState, useFormStatus } from 'react-dom';

export type ResultadoPrueba = { ok: boolean; mensaje: string } | null;

function Boton({ cantidad }: { cantidad: number }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-secondary w-full sm:w-auto" disabled={pending}>
      {pending ? 'Enviando…' : 'Enviar aviso de prueba'}
    </button>
  );
}

/**
 * Botón de prueba de Telegram. El resultado (éxito o error) se muestra acá
 * mismo en vez de romper la pantalla: un fallo de notificación no debería
 * tirar abajo la página de configuración.
 */
export default function TestTelegramButton({
  accion,
  cantidad,
}: {
  accion: (prev: ResultadoPrueba, formData: FormData) => Promise<ResultadoPrueba>;
  cantidad: number;
}) {
  const [resultado, formAction] = useFormState(accion, null);

  return (
    <div className="mb-6">
      <form action={formAction}>
        <Boton cantidad={cantidad} />
      </form>

      {resultado && (
        <p
          className={`mt-3 rounded-lg px-3.5 py-3 text-sm ring-1 ring-inset ${
            resultado.ok
              ? 'bg-pine-50 text-pine-700 ring-pine-100'
              : 'bg-brick-50 text-brick-700 ring-brick-100'
          }`}
        >
          {resultado.mensaje}
        </p>
      )}

      <p className="mt-2 text-xs text-ink-400">
        Manda el mismo mensaje que enviaría el aviso diario, a los {cantidad} destinatario
        {cantidad === 1 ? '' : 's'} activo{cantidad === 1 ? '' : 's'}, aunque hoy no haya
        vencimientos.
      </p>
    </div>
  );
}
