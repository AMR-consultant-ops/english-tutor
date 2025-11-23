/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eefcf5',
          100: '#d5f7e3',
          200: '#aef0cd',
          300: '#7ce4b0',
          400: '#43d08c',
          500: '#08843f',
          600: '#066a32',
          700: '#055428',
          800: '#044322',
          900: '#022412',
        },
        slate: {
          50: '#f4f6f8',
          100: '#e3e7eb',
          200: '#c5ccd3',
          300: '#c0c0c0', 
          400: '#aaaaaa',
          500: '#888888',
          600: '#5c6f82',
          700: '#3a4d60',
          800: '#2a3a4a',
          900: '#1d2b3b',
          950: '#0f1720',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'wave': 'wave 1.5s ease-in-out infinite',
      },
      keyframes: {
        wave: {
          '0%, 100%': { height: '10%' },
          '50%': { height: '100%' },
        }
      }
    },
  },
  plugins: [],
}