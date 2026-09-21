import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';

// iOS aplica su propio recorte de esquinas al agregar a pantalla de inicio,
// por eso este va sin border-radius (a diferencia de icon.tsx). Ver icon.tsx
// para por qué la fuente se empaqueta local en vez de dejarla resolver sola.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default async function AppleIcon() {
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
          color: '#F4F6F8',
          fontSize: 110,
          fontFamily: 'IBM Plex Mono',
        }}
      >
        ₲
      </div>
    ),
    { ...size, fonts: [{ name: 'IBM Plex Mono', data: fontData, weight: 600 }] }
  );
}
