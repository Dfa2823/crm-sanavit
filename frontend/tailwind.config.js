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
        'loginFadeIn': 'loginFadeIn 0.7s ease-out both',
        'loginShake': 'loginShake 0.5s ease-in-out',
        'spinSlow': 'spinSlow 18s linear infinite',
        'fadeIn': 'fadeIn 0.3s ease-out both',
        'fadeInScale': 'fadeInScale 0.2s ease-out',
        'slideInRight': 'slideInRight 0.3s ease-out',
        'staggerFadeIn': 'staggerFadeIn 0.4s ease-out both',
        'countUp': 'countUp 0.5s ease-out both',
        'softPulse': 'softPulse 2s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        loginFadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        loginShake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '15%':      { transform: 'translateX(-8px)' },
          '30%':      { transform: 'translateX(8px)' },
          '45%':      { transform: 'translateX(-5px)' },
          '60%':      { transform: 'translateX(5px)' },
          '75%':      { transform: 'translateX(-2px)' },
          '90%':      { transform: 'translateX(2px)' },
        },
        spinSlow: {
          '0%':   { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInScale: {
          '0%':   { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInRight: {
          '0%':   { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        staggerFadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        countUp: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        softPulse: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.7' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
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
