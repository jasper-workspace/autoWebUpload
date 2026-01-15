/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e8f4ff',
          100: '#d1e9ff',
          200: '#a6d4ff',
          300: '#7abfff',
          400: '#4faaff',
          500: '#2395ff',
          600: '#0077ff',
          700: '#0066e6',
          800: '#0058cc',
          900: '#004cb3',
        },
      }
    },
  },
  plugins: [],
}
