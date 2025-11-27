/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0d0d14',
        sidebar: '#12121a',
        card: '#16161f',
        border: '#1e1e2e',
        primary: '#6366f1',
        success: '#22c55e',
        warning: '#f97316',
        danger: '#ef4444',
      },
    },
  },
  plugins: [],
}
