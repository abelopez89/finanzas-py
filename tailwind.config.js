/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefbf3',
          100: '#d6f5e2',
          500: '#1f9d5a',
          600: '#178048',
          700: '#136639',
        },
      },
    },
  },
  plugins: [],
};
