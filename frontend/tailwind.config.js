/**
 * SAT Tutoring Platform - Tailwind CSS Configuration
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Semantic theme tokens — defined as CSS variables in index.css so
        // both light and dark values stay in one place. Use these instead
        // of `bg-white dark:bg-slate-800` patterns.
        surface: {
          page: 'var(--surface-page)',
          card: 'var(--surface-card)',
          muted: 'var(--surface-muted)',
          input: 'var(--surface-input)',
          overlay: 'var(--surface-overlay)',
        },
        ink: {
          body: 'var(--ink-body)',
          muted: 'var(--ink-muted)',
          subtle: 'var(--ink-subtle)',
          faint: 'var(--ink-faint)',
          inverse: 'var(--ink-inverse)',
        },
        edge: {
          DEFAULT: 'var(--edge-default)',
          subtle: 'var(--edge-subtle)',
          strong: 'var(--edge-strong)',
        },
        // Brand: amber/bronze — warm, editorial, personality-forward.
        // 600/700 are deep enough to pass contrast on white for text/icons.
        brand: {
          50:  '#fbf6ed',
          100: '#f6e9d2',
          200: '#ecd0a3',
          300: '#e0b06b',
          400: '#d4933e',
          500: '#bf7724',  // bronze-amber, primary
          600: '#a25f1c',  // text/icons on light, button bg
          700: '#824a19',
          800: '#6a3d1a',
          900: '#583419',
          950: '#321b0c',
        },
        // Accent: pine/evergreen — muted, grown-up; strengths & upward progress.
        // Deliberately distinct from the pure-emerald "correct" feedback color.
        accent: {
          50:  '#eef4ef',
          100: '#d6e6d9',
          200: '#aecdb5',
          300: '#7fae8a',
          400: '#558d64',
          500: '#3a7249',  // pine, primary
          600: '#2c5b39',
          700: '#26492f',
          800: '#213b29',
          900: '#1c3123',
        },
      },
      fontFamily: {
        // UI / body / data
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        // Display: warm optical serif for headings, scores, hero numbers
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
      },
      fontVariantNumeric: {
        tabular: 'tabular-nums',
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
      boxShadow: {
        // Soft-depth elevation — low-contrast, layered, never harsh
        card:       '0 1px 2px -1px rgb(15 23 42 / 0.08), 0 2px 6px -1px rgb(15 23 42 / 0.05)',
        'card-md':  '0 2px 4px -2px rgb(15 23 42 / 0.08), 0 6px 16px -4px rgb(15 23 42 / 0.08)',
        'card-lg':  '0 4px 8px -4px rgb(15 23 42 / 0.08), 0 16px 32px -8px rgb(15 23 42 / 0.12)',
        'card-xl':  '0 8px 16px -8px rgb(15 23 42 / 0.10), 0 32px 56px -16px rgb(15 23 42 / 0.18)',
        // Brand-tinted ambient glow (amber) — soft lamplight behind focal surfaces
        glow:       '0 0 0 1px rgb(191 119 36 / 0.08), 0 8px 32px -8px rgb(191 119 36 / 0.30)',
        'glow-accent': '0 0 0 1px rgb(58 114 73 / 0.08), 0 8px 32px -8px rgb(58 114 73 / 0.26)',
        // Inset ring for focus-visible affordances
        focus:      '0 0 0 2px var(--surface-card), 0 0 0 4px rgb(191 119 36 / 0.55)',
      },
      backgroundImage: {
        // Ambient radial glows for hero/focal surfaces (warm lamplight, not gradient-text)
        'glow-brand': 'radial-gradient(120% 120% at 100% 0%, rgb(212 147 62 / 0.20) 0%, transparent 55%)',
        'glow-soft': 'radial-gradient(100% 100% at 0% 0%, rgb(191 119 36 / 0.10) 0%, transparent 60%)',
      },
      transitionTimingFunction: {
        'out-quart': 'cubic-bezier(0.25, 1, 0.5, 1)',
        'out-quint': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'out-expo':  'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      zIndex: {
        dropdown: '1000',
        sticky: '1100',
        overlay: '1200',
        modal: '1300',
        toast: '1400',
        tooltip: '1500',
      },
      keyframes: {
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%':   { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.55' },
          '50%':      { opacity: '1' },
        },
        'sig-wipe': {
          '0%':   { transform: 'scaleX(0)', opacity: '0' },
          '100%': { transform: 'scaleX(1)', opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fade-in 0.5s ease both',
        'scale-in': 'scale-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 1.6s infinite',
        'glow-pulse': 'glow-pulse 3.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
