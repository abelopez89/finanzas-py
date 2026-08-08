/** Iconos de línea, 1.6px, trazo redondeado. Sin dependencias externas. */

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function IconInicio(p: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={p.className} {...base}>
      <path d="M4 19V9.5L12 4l8 5.5V19" />
      <path d="M4 19h16" />
      <path d="M10 19v-5h4v5" />
    </svg>
  );
}

export function IconMes(p: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={p.className} {...base}>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8.5 3v4M15.5 3v4" />
    </svg>
  );
}

export function IconExtras(p: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={p.className} {...base}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}

export function IconFondo(p: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={p.className} {...base}>
      <path d="M3.5 20h17" />
      <path d="M5.5 20v-7M10 20V8M14 20v-4M18.5 20V5" />
    </svg>
  );
}

export function IconPrevision(p: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={p.className} {...base}>
      <path d="M3.5 16.5l5-5 3.5 3.5 6-6.5" />
      <path d="M15 8h3.5v3.5" />
      <path d="M3.5 20h17" />
    </svg>
  );
}

export function IconAjustes(p: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={p.className} {...base}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1A1.7 1.7 0 008.9 19a1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1A1.7 1.7 0 004.6 8.9a1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V10a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </svg>
  );
}

export function IconSalir(p: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={p.className} {...base}>
      <path d="M9 20H5.5A1.5 1.5 0 014 18.5v-13A1.5 1.5 0 015.5 4H9" />
      <path d="M15 16l4-4-4-4M19 12H9" />
    </svg>
  );
}
