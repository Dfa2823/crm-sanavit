/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    'w-60', 'w-16',
  ],
  theme: {
    extend: {
      animation: {
        'fadeInUp': 'fadeInUp 0.25s ease-out',
      },
      keyframes: {
        fadeInUp: {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      colors: {
        brand: {
          50:  '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        sanavit: {
          green:  '#16a34a',
          teal:   '#0d9488',
          blue:   '#1d4ed8',
          navy:   '#1e3a5f',
        }
      },
    },
  },
  plugins: [],
}
