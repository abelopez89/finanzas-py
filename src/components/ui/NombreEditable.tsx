'use client';

import { useLayoutEffect, useRef } from 'react';

/**
 * Nombre editable con aspecto de texto, para la celda del nombre de una
 * tabla de escritorio. Es un <textarea> que crece con el contenido, no un
 * <input>: un input es de una sola línea y cortaba los nombres largos ("Deuda
 * TC GNB (Cierre Oc…"), cuando antes, como texto, pasaban a un segundo
 * renglón. Enter no agrega un salto de línea: envía el form de la fila,
 * como en un campo común.
 */
export default function NombreEditable({
  form,
  name,
  defaultValue,
  className,
}: {
  /** id del form de la fila (el textarea vive en otra celda). */
  form: string;
  name: string;
  defaultValue: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const ajustarAlto = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  useLayoutEffect(ajustarAlto, [defaultValue]);

  return (
    <textarea
      ref={ref}
      form={form}
      name={name}
      defaultValue={defaultValue}
      rows={1}
      required
      aria-label="Nombre"
      title="Editar nombre"
      onInput={ajustarAlto}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.form?.requestSubmit();
        }
      }}
      className={`block w-full resize-none overflow-hidden ${className ?? ''}`}
    />
  );
}
