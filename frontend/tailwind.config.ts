import type { Config } from 'tailwindcss'

/**
 * Iris & Ember theme. All colors resolve to CSS variables defined in
 * src/styles/tokens.css so light/dark (and future palettes) swap at runtime.
 * Forbidden: pure white, pure black, teal, cyan, gold/yellow/amber.
 */
const rgb = (name: string) => `rgb(var(${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        canvas: rgb('--canvas-rgb'),
        surface: rgb('--surface-rgb'),
        sunken: rgb('--sunken-rgb'),
        ink: rgb('--ink-rgb'),
        muted: rgb('--muted-rgb'),

        iris: {
          DEFAULT: rgb('--iris-rgb'),
          hover: rgb('--iris-hover-rgb'),
          active: rgb('--iris-active-rgb'),
          soft: 'rgb(var(--iris-rgb) / 0.12)',
        },
        ember: {
          DEFAULT: rgb('--ember-rgb'),
          soft: 'rgb(var(--ember-rgb) / 0.14)',
        },
        orchid: {
          DEFAULT: rgb('--orchid-rgb'),
          soft: 'rgb(var(--orchid-rgb) / 0.14)',
        },
        periwinkle: {
          DEFAULT: rgb('--periwinkle-rgb'),
          soft: 'rgb(var(--periwinkle-rgb) / 0.16)',
        },
        berry: {
          DEFAULT: rgb('--berry-rgb'),
          soft: 'rgb(var(--berry-rgb) / 0.14)',
        },
        leaf: {
          DEFAULT: rgb('--leaf-rgb'),
          soft: 'rgb(var(--leaf-rgb) / 0.14)',
        },

        line: 'rgb(var(--line-rgb) / 0.10)',
        'line-strong': 'rgb(var(--line-rgb) / 0.18)',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        ui: ['var(--font-ui)'],
        serif: ['var(--font-serif)'],
        mono: ['var(--font-mono)'],
        sans: ['var(--font-ui)'],
      },
      borderRadius: {
        card: '14px',
        input: '10px',
        pill: '999px',
        frame: '22px',
      },
      boxShadow: {
        soft: 'var(--shadow-1)',
        lift: 'var(--shadow-2)',
        inset: 'var(--shadow-inset)',
        focus: '0 0 0 2px rgb(var(--canvas-rgb)), 0 0 0 4px rgb(var(--iris-rgb))',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.5' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        caret: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0' } },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        aurora: {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(4%, -3%) scale(1.08)' },
          '66%': { transform: 'translate(-3%, 4%) scale(1.04)' },
        },
        drawLine: { from: { 'stroke-dashoffset': '1' }, to: { 'stroke-dashoffset': '0' } },
        growBar: { '0%': { transform: 'scaleY(0)' }, '100%': { transform: 'scaleY(1)' } },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.28s cubic-bezier(0.16,1,0.3,1)',
        'pulse-soft': 'pulseSoft 1.6s ease-in-out infinite',
        shimmer: 'shimmer 1.6s ease-in-out infinite',
        caret: 'caret 1s step-end infinite',
        float: 'float 6s ease-in-out infinite',
        aurora: 'aurora 18s ease-in-out infinite',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'in-out-soft': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        '150': '150ms',
        '250': '250ms',
        '400': '400ms',
      },
    },
  },
  plugins: [],
} satisfies Config
