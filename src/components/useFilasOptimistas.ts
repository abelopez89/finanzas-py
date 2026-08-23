'use client';

import { useEffect, useState, useTransition } from 'react';

export type ParcheFila = {
  estado?: string;
  monto?: number;
  dia?: number;
  eliminado?: boolean;
};

export type AccionServidor = (formData: FormData) => void | Promise<void>;

/**
 * Actualización optimista para las grillas de gastos e ingresos.
 *
 * El problema: al tocar "Rescatar"/"Pagar"/"Eliminar" se disparaba una server
 * action y la fila no cambiaba hasta que volvía la respuesta Y se re-renderizaba
 * toda la página en el servidor. Desde el celular eso es fácilmente 1-2
 * segundos mirando una pantalla que no reacciona — se siente roto, y el reflejo
 * es volver a tocar el botón.
 *
 * La solución: se parchea la fila en el acto (estado nuevo, monto nuevo, o
 * desaparece si se borró) y recién después se manda la acción al servidor
 * dentro de una transición. Cuando el servidor devuelve los datos frescos, los
 * parches locales se descartan: la verdad siempre es la del servidor, esto es
 * puramente cosmético mientras dura el viaje.
 */
export function useFilasOptimistas<T extends { id: string }>(filas: T[]) {
  const [parches, setParches] = useState<Record<string, ParcheFila>>({});
  const [enCurso, setEnCurso] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  // Llegaron datos nuevos del servidor → se sueltan los parches locales.
  useEffect(() => {
    setParches({});
    setEnCurso({});
  }, [filas]);

  // Red de seguridad: si la acción se cae (sin señal, sesión vencida) la fila
  // no puede quedar atenuada para siempre. A los 10 segundos se libera y se
  // vuelve a mostrar el dato del servidor.
  const hayEnCurso = Object.keys(enCurso).length > 0;
  useEffect(() => {
    if (!hayEnCurso) return;
    const t = setTimeout(() => {
      setParches({});
      setEnCurso({});
    }, 10_000);
    return () => clearTimeout(t);
  }, [hayEnCurso]);

  function ejecutar(
    id: string,
    accion: AccionServidor,
    formData: FormData,
    parche: ParcheFila = {}
  ) {
    setParches((p) => ({ ...p, [id]: { ...p[id], ...parche } }));
    setEnCurso((p) => ({ ...p, [id]: true }));
    // La transición mantiene la UI vieja "viva" (sin suspender la pantalla)
    // mientras Next revalida y trae el HTML nuevo.
    startTransition(() => {
      accion(formData);
    });
  }

  const visibles = filas
    .map((f) => ({ ...f, ...(parches[f.id] ?? {}) }) as T & ParcheFila)
    .filter((f) => !f.eliminado);

  return { visibles, enCurso, ejecutar };
}

/** FormData armado a mano para los botones de acción (ya no hay un <form>
 * por botón: eran 4 formularios por fila, o sea ~160 nodos extra en un mes
 * típico, cada uno con su propio handler de submit). */
export function datosDe(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}
