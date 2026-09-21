import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';

// Favicon generado en runtime a partir del mismo signo ₲ que usa la pantalla
// de login como marca, para no depender de un archivo de imagen aparte.
// La fuente se empaqueta local (en vez de dejar que satori la resuelva sola)
// porque su fallback dinámico para el glifo ₲ pega a Google Fonts en build
// y a veces devuelve 400 — el mismo motivo por el que layout.tsx no usa
// next/font para el resto de la app.
export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default async function Icon() {
  const fontData = await readFile(path.join(process.cwd(), 'src/app/fonts/ibm-plex-mono-600.ttf'));

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#17603F',
          borderRadius: 14,
          color: '#F4F6F8',
          fontSize: 40,
          fontFamily: 'IBM Plex Mono',
        }}
      >
        ₲
      </div>
    ),
    { ...size, fonts: [{ name: 'IBM Plex Mono', data: fontData, weight: 600 }] }
  );
}
