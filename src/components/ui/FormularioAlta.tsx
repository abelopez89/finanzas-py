'use client';

import { useRef } from 'react';

/**
 * Formulario de alta que se limpia solo cuando la acción termina bien.
 * Sirve para cargar varios ítems seguidos sin tener que borrar los campos
 * a mano. Si la acción falla (lanza), los datos se conservan para que no
 * haya que reescribirlos.
 */
export default function FormularioAlta({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<void> | void;
  className?: string;
  children: React.ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      className={className}
      action={async (formData) => {
        await action(formData);
        // Dispara el evento 'reset' del formulario: limpia los campos
        // nativos y avisa a los controlados (ver MontoInput).
        formRef.current?.reset();
      }}
    >
      {children}
    </form>
  );
}
