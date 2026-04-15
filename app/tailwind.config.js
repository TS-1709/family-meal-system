/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        forest: { 50: '#e8f5e9', 100: '#c8e6c9', 200: '#a5d6a7', 300: '#81c784', 400: '#66bb6a', 500: '#4caf50', 600: '#43a047', 700: '#388e3c', 800: '#2e7d32', 900: '#1a5c2e' },
      },
      fontFamily: { sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'] },
    },
  },
  plugins: [],
}
