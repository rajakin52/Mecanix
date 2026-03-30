import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // MECANIX Brand — Golden amber from hex logo + dark charcoal
        primary: {
          50:  '#FEF9EE',
          100: '#FBF0D4',
          200: '#F7DDA8',
          300: '#F2C572',
          400: '#ECA83C',
          500: '#E5961F',  // Brand amber
          600: '#D47A14',
          700: '#B05C13',
          800: '#8F4917',
          900: '#763D16',
          950: '#431E09',
        },
        secondary: {
          50:  '#F5F5F7',
          100: '#E5E5EA',
          200: '#C7C7CC',
          300: '#AEAEB2',
          400: '#8E8E93',
          500: '#636366',
          600: '#48484A',
          700: '#363638',
          800: '#2B2D33',  // MECANIX dark charcoal
          900: '#1C1C1E',
          950: '#0A0A0C',
        },
        brand: {
          gold:    '#D4992A',  // Logo hexagons
          dark:    '#2B2D33',  // Logo text
          amber:   '#E5A82E',  // Lighter gold
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'SF Pro Display', '-apple-system', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'JetBrains Mono', 'SF Mono', 'monospace'],
      },
      borderRadius: {
        lg: '12px',
        md: '8px',
        sm: '4px',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08)',
        'sidebar': '2px 0 8px rgba(0,0,0,0.04)',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out',
        'slide-in': 'slideIn 200ms ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateY(-4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
