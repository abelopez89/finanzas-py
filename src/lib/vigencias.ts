export type Vigencia = {
  template_id: string;
  desde_periodo: string;
  activo: boolean;
  monto: number | string | null;
};

export type PlantillaBase = {
  id: string;
  monto: number | string;
  activo: boolean;
};

export type VigenciaResuelta = {
  activo: boolean;
  monto: number;
};

/**
 * Resuelve qué monto rige y si la plantilla aplica en un período dado.
 *
 * Se toma la ÚLTIMA regla cuyo `desde_periodo` sea menor o igual al
 * período consultado. Si ninguna regla llegó todavía, valen los valores
 * propios de la plantilla. Una regla con `monto` nulo cambia solo el
 * estado activo/inactivo y conserva el monto que ya venía rigiendo — así,
 * para volver a activar algo estacional no hace falta repetir el importe
 * si no cambió.
 */
export function resolverVigencia(
  plantilla: PlantillaBase,
  vigencias: Vigencia[],
  periodoISO: string
): VigenciaResuelta {
  const aplicables = vigencias
    .filter((v) => v.template_id === plantilla.id && v.desde_periodo <= periodoISO)
    .sort((a, b) => a.desde_periodo.localeCompare(b.desde_periodo));

  let activo = plantilla.activo;
  let monto = Number(plantilla.monto);

  for (const v of aplicables) {
    activo = v.activo;
    if (v.monto !== null && v.monto !== undefined) {
      monto = Number(v.monto);
    }
  }

  return { activo, monto };
}

/**
 * Aplica la resolución a una lista de plantillas y devuelve solo las que
 * están vigentes en ese período, ya con el monto que corresponde.
 */
export function plantillasVigentes<T extends PlantillaBase>(
  plantillas: T[],
  vigencias: Vigencia[],
  periodoISO: string
): Array<T & { montoVigente: number }> {
  return plantillas
    .map((p) => {
      const { activo, monto } = resolverVigencia(p, vigencias, periodoISO);
      return { ...p, activo, montoVigente: monto };
    })
    .filter((p) => p.activo);
}
