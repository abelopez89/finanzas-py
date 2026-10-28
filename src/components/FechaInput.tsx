'use client';

import { useEffect, useRef, useState } from 'react';

interface FechaInputProps {
  name: string;
  /** Para enlazar un <label htmlFor>. Va en el campo de texto visible. */
  id?: string;
  /** 'sm' para grillas y filas editables, 'base' para formularios. */
  tamano?: 'sm' | 'base';
  /** Fecha ISO (aaaa-mm-dd). */
  defaultValue?: string | null;
  required?: boolean;
  className?: string;
  'aria-label'?: string;
}

function isoADigitos(iso?: string | null): string {
  if (!iso) return '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return a && m && d ? `${d}${m}${a}` : '';
}

/** "27102026" → "27/10/2026" (parcial mientras se escribe). */
function formatear(digitos: string): string {
  const d = digitos.slice(0, 2);
  const m = digitos.slice(2, 4);
  const a = digitos.slice(4, 8);
  return [d, m, a].filter(Boolean).join('/');
}

/** Devuelve el ISO solo si la fecha está completa y existe (no 31/02). */
function digitosAIso(digitos: string): string {
  if (digitos.length !== 8) return '';
  const d = Number(digitos.slice(0, 2));
  const m = Number(digitos.slice(2, 4));
  const a = Number(digitos.slice(4, 8));
  const fecha = new Date(Date.UTC(a, m - 1, d));
  if (fecha.getUTCFullYear() !== a || fecha.getUTCMonth() !== m - 1 || fecha.getUTCDate() !== d) {
    return '';
  }
  return `${digitos.slice(4, 8)}-${digitos.slice(2, 4)}-${digitos.slice(0, 2)}`;
}

/**
 * Campo de fecha que siempre se lee dd/mm/aaaa. El <input type="date">
 * nativo muestra el formato del idioma del navegador/sistema (en un
 * Chrome en inglés, mm/dd/aaaa) y no hay atributo que lo cambie. Acá se
 * escribe en texto con las barras automáticas y se envía el ISO en un
 * campo oculto con el `name` real, igual que MontoInput con el monto.
 * El botón de calendario abre el selector nativo (oculto) para quien
 * prefiera elegir con el mouse.
 */
export default function FechaInput({
  name,
  id,
  tamano = 'sm',
  defaultValue,
  required,
  className,
  'aria-label': ariaLabel,
}: FechaInputProps) {
  const valorInicial = isoADigitos(defaultValue);
  const [digitos, setDigitos] = useState(valorInicial);
  const textoRef = useRef<HTMLInputElement>(null);
  const nativoRef = useRef<HTMLInputElement>(null);
  const iso = digitosAIso(digitos);

  // Mismo motivo que en MontoInput: form.reset() no limpia estado de React.
  useEffect(() => {
    const form = textoRef.current?.form;
    if (!form) return;
    const alResetear = () => setDigitos(valorInicial);
    form.addEventListener('reset', alResetear);
    return () => form.removeEventListener('reset', alResetear);
  }, [valorInicial]);

  // Una fecha a medio escribir o inexistente frena el envío del formulario
  // con el aviso nativo, en vez de mandar un campo vacío.
  useEffect(() => {
    const incompleta = digitos.length > 0 && !iso;
    textoRef.current?.setCustomValidity(incompleta ? 'Ingresá una fecha válida (dd/mm/aaaa).' : '');
  }, [digitos, iso]);

  const abrirCalendario = () => {
    const nativo = nativoRef.current;
    if (!nativo) return;
    try {
      nativo.showPicker();
    } catch {
      textoRef.current?.focus();
    }
  };

  return (
    <div className={`relative ${className ?? ''}`}>
      <input
        ref={textoRef}
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        value={formatear(digitos)}
        onChange={(e) => setDigitos(e.target.value.replace(/\D/g, '').slice(0, 8))}
        required={required}
        aria-label={ariaLabel}
        className={`${tamano === 'base' ? 'field' : 'field-sm'} amount w-full pr-9`}
      />
      <button
        type="button"
        onClick={abrirCalendario}
        aria-label="Elegir en el calendario"
        className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-ink-400 hover:bg-canvas hover:text-ink"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
          <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
          <path d="M3.5 10h17M8.5 3v4M15.5 3v4" />
        </svg>
      </button>
      {/* Selector nativo invisible, anclado abajo del campo para que el
          calendario se abra en el lugar correcto. Sin `name`: lo que se
          envía es el campo oculto de abajo. */}
      <input
        ref={nativoRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        value={iso}
        onChange={(e) => setDigitos(isoADigitos(e.target.value))}
        className="pointer-events-none absolute bottom-0 left-0 h-px w-full opacity-0"
      />
      <input type="hidden" name={name} value={iso} />
    </div>
  );
}
