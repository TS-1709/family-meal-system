/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#f0faf3',
          100: '#d0f0de',
          200: '#a3e2bf',
          300: '#6bcc99',
          400: '#3ab373',
          500: '#1a8a52',
          600: '#1a5c2e',
          700: '#164d26',
          800: '#133d1f',
          900: '#0f321a',
        },
        gold: {
          400: '#fbbf24',
          500: '#f57f17',
          600: '#d97706',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      maxWidth: {
        app: '480px',
      },
      borderRadius: {
        card: '16px',
      }
    },
  },
  plugins: [],
}
