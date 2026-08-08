'use client';

import { useState, useRef, useEffect } from 'react';

interface MontoInputProps {
  name: string;
  defaultValue?: number | string | null;
  placeholder?: string;
  required?: boolean;
  className?: string;
  /** Muestra el símbolo ₲ fijo dentro del campo. */
  conSimbolo?: boolean;
}

function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

function formatearConMiles(digitos: string): string {
  if (!digitos) return '';
  return Number(digitos).toLocaleString('es-PY');
}

/**
 * Campo de monto en guaraníes: muestra separador de miles mientras se
 * escribe (2.673.000) pero envía el valor numérico limpio en un campo
 * oculto con el `name` real. Teclado numérico en móvil.
 * Los guaraníes no usan decimales, así que trabaja solo con enteros.
 */
export default function MontoInput({
  name,
  defaultValue,
  placeholder,
  required,
  className,
  conSimbolo = true,
}: MontoInputProps) {
  const valorInicial =
    defaultValue !== undefined && defaultValue !== null && defaultValue !== ''
      ? soloDigitos(String(Math.round(Number(defaultValue))))
      : '';

  const [digitos, setDigitos] = useState(valorInicial);
  const inputRef = useRef<HTMLInputElement>(null);

  // Como el valor vive en estado de React, form.reset() no lo limpiaría
  // solo: hay que escuchar el evento y volver al valor inicial a mano.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const alResetear = () => setDigitos(valorInicial);
    form.addEventListener('reset', alResetear);
    return () => form.removeEventListener('reset', alResetear);
  }, [valorInicial]);

  return (
    <div className="relative">
      {conSimbolo && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-ink-400">
          ₲
        </span>
      )}
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={formatearConMiles(digitos)}
        onChange={(e) => setDigitos(soloDigitos(e.target.value))}
        placeholder={placeholder}
        required={required}
        className={`${className ?? 'field'} amount ${conSimbolo ? 'pl-7' : ''}`}
      />
      <input type="hidden" name={name} value={digitos} />
    </div>
  );
}
