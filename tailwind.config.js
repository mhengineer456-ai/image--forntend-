/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        cyber: {
          bg: '#07090e',
          card: '#121a2b',
          input: '#0a101c',
          border: 'rgba(0, 242, 254, 0.15)',
        }
      }
    },
  },
  plugins: [],
}
