'use client';

import { useState } from 'react';

interface MontoInputProps {
  name: string;
  defaultValue?: number | string | null;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

function soloDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

function formatearConMiles(digitos: string): string {
  if (!digitos) return '';
  return Number(digitos).toLocaleString('es-PY');
}

/**
 * Input de monto en guaraníes: muestra separador de miles mientras se
 * escribe (ej: 2.673.000) pero envía el valor numérico sin formato en un
 * campo oculto con el `name` real, para que los server actions lo lean
 * igual que antes con `Number(formData.get('monto'))`.
 *
 * Los guaraníes no usan decimales en la práctica, así que este input solo
 * trabaja con números enteros.
 */
export default function MontoInput({
  name,
  defaultValue,
  placeholder,
  required,
  className,
}: MontoInputProps) {
  const [digitos, setDigitos] = useState(() =>
    defaultValue !== undefined && defaultValue !== null && defaultValue !== ''
      ? soloDigitos(String(Math.round(Number(defaultValue))))
      : ''
  );

  return (
    <>
      <input
        type="text"
        inputMode="numeric"
        value={formatearConMiles(digitos)}
        onChange={(e) => setDigitos(soloDigitos(e.target.value))}
        placeholder={placeholder}
        required={required}
        className={className}
      />
      <input type="hidden" name={name} value={digitos} />
    </>
  );
}
