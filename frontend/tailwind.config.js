/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vitalink: {
          navy: '#0f172a',
          blue: '#0284c7',
          'blue-dark': '#0369a1',
          teal: '#0d9488',
          cyan: '#06b6d4',
          surface: '#f8fafc',
          border: '#e2e8f0',
          text: '#1e293b',
          muted: '#64748b'
        }
      }
    },
  },
  plugins: [],
}
