/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Tinta: texto y superficies oscuras
        ink: {
          DEFAULT: '#0B1220',
          800: '#16202F',
          700: '#2A3648',
          500: '#556479',
          400: '#7A8899',
          300: '#A3AEBC',
        },
        canvas: '#F4F6F8',
        surface: '#FFFFFF',
        line: '#E2E7ED',
        // Verde pino: acento principal (fondo, ingresos, confirmado)
        pine: {
          50: '#ECF5F0',
          100: '#D3E8DD',
          200: '#A8D1BC',
          600: '#17603F',
          700: '#0F4A30',
        },
        // Ladrillo: egresos
        brick: {
          50: '#FBEEED',
          100: '#F5D9D7',
          600: '#B4322B',
          700: '#8E2721',
        },
        // Ocre: estado intermedio (rescatado), avisos
        ochre: {
          50: '#FBF3E4',
          100: '#F3E3C4',
          600: '#A66A15',
          700: '#845311',
        },
      },
      fontFamily: {
        // Respaldo del sistema si la fuente web no carga: en iPhone cae en
        // SF Pro, que ya trae cifras tabulares y es una base sólida.
        sans: [
          '"IBM Plex Sans"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          '"IBM Plex Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ],
      },
      fontSize: {
        // 16px mínimo en inputs evita que iOS haga zoom al enfocar
        input: ['16px', { lineHeight: '1.4' }],
      },
      borderRadius: {
        card: '14px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(11, 18, 32, 0.04), 0 1px 3px rgba(11, 18, 32, 0.06)',
        lift: '0 4px 16px rgba(11, 18, 32, 0.08)',
      },
      spacing: {
        safe: 'env(safe-area-inset-bottom)',
      },
    },
  },
  plugins: [],
};
