/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#0f172a',
        panelBg: '#1e293b',
        accent1: '#38bdf8',
        accent2: '#f43f5e',
      }
    },
  },
  plugins: [],
}