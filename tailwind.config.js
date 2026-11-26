/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: { nav: '768px' },
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'] },
      colors: {
        brand: { DEFAULT: '#0b5c5c', 50: '#e7f2f2', 100: '#c4e0e0', 300: '#9fb9b9', 700: '#084848' },
        canvas: '#f2f4f5',
        line: '#ebebeb',
        muted: '#5f5c5a',
        sub: '#3d3a38',
        danger: '#c62828',
        ok: '#1f7a2a',
        warn: { DEFAULT: '#f2c94c', bg: '#fff8e1' },
      },
      boxShadow: { card: 'rgba(0,0,0,0.1) 0 4px 6px -1px, rgba(0,0,0,0.1) 0 2px 4px -2px' },
      borderRadius: { '3xl': '24px', '4xl': '28px' },
      letterSpacing: { tightest: '-0.05em' },
    },
  },
  plugins: [],
};
