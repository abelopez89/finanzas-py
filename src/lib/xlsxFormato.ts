import * as XLSX from 'xlsx';

/**
 * Aplica formato de miles ("2.673.000", sin decimales) a las celdas
 * numéricas de una columna. El separador exacto que se ve depende de la
 * configuración regional de quien abre el archivo, pero el agrupado por
 * miles queda siempre activado.
 *
 * `filaInicial` es la primera fila de DATOS en notación 0-indexada (0 si
 * no hay encabezado, 1 si la fila 0 es el encabezado de json_to_sheet).
 */
export function formatearColumnaMiles(
  hoja: XLSX.WorkSheet,
  columnaIndex: number,
  cantidadFilasDeDatos: number,
  filaInicial = 1
) {
  for (let i = 0; i < cantidadFilasDeDatos; i++) {
    const ref = XLSX.utils.encode_cell({ r: filaInicial + i, c: columnaIndex });
    const celda = hoja[ref];
    if (celda && typeof celda.v === 'number') {
      celda.z = '#,##0';
    }
  }
}
