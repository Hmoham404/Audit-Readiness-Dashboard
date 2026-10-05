/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['Manrope', 'sans-serif'],
      },
      colors: {
        ink: '#17233f',
        navy: '#111d35',
        brand: '#4169f5',
        mint: '#15966a',
        amber: '#dc792f',
      },
      boxShadow: {
        panel: '0 8px 24px rgba(23, 43, 64, .055)',
        drawer: '-12px 0 44px rgba(17, 39, 60, .16)',
      },
    },
  },
  plugins: [],
};
