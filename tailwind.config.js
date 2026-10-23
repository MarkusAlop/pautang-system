/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{svelte,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        emerald: {
          50: '#eff6ed',
          100: '#dcebd5',
          200: '#c3ddb7',
          300: '#a3c894',
          400: '#7eae70',
          500: '#5d9254',
          600: '#477744',
          700: '#385f38',
          800: '#2f4c30',
          900: '#283f2b',
          950: '#142419',
        },
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
    },
  },
  plugins: [],
}
