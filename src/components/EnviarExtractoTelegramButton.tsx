'use client';

import { useFormState, useFormStatus } from 'react-dom';
import type { ResultadoPrueba } from '@/components/TestTelegramButton';

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-secondary w-full sm:w-auto" disabled={pending}>
      {pending ? 'Enviando…' : 'Enviar por Telegram'}
    </button>
  );
}

export default function EnviarExtractoTelegramButton({
  accion,
  periodoISO,
}: {
  accion: (prev: ResultadoPrueba, formData: FormData) => Promise<ResultadoPrueba>;
  periodoISO: string;
}) {
  const [resultado, formAction] = useFormState(accion, null);

  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="periodo" value={periodoISO} />
        <Boton />
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
    </div>
  );
}
