import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'finanzas-py',
  description: 'Control del fondo mutuo familiar',
  // Permite "Agregar a pantalla de inicio" en iOS y que abra sin barra del navegador
  appleWebApp: {
    capable: true,
    title: 'finanzas-py',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // viewport-fit=cover + safe-area insets = uso correcto del área bajo el notch
  // y sobre el indicador de inicio del iPhone
  viewportFit: 'cover',
  themeColor: '#F4F6F8',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        {/*
          Las fuentes se cargan en runtime (no con next/font) a propósito:
          next/font las descarga durante el build, así que una caída de
          Google Fonts rompería el deploy entero. Así, si la fuente no
          carga, la app sigue funcionando con la pila del sistema —
          SF Pro en iPhone, que es una base excelente.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
