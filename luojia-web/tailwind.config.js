/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        brand: {
          DEFAULT: 'var(--brand)',
          strong: 'var(--brand-strong)',
          soft: 'var(--brand-soft)'
        },
        ink: {
          DEFAULT: 'var(--ink)',
          2: 'var(--ink-2)',
          3: 'var(--ink-3)'
        },
        line: 'var(--line)',
        hot: 'var(--hot)'
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'PingFang SC', 'Noto Sans SC', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'Noto Serif SC', 'Songti SC', 'serif']
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
        pop: '0 4px 16px rgba(15, 23, 42, 0.08)'
      }
    }
  },
  plugins: []
}
