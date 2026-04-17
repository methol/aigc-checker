import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.ts'],
  theme: {
    extend: {
      colors: {
        bg: '#0A0E1A',
        card: '#141B2D',
        surface: '#1E293B',
        'text-primary': '#F8FAFC',
        'text-secondary': '#94A3B8',
        'text-muted': '#64748B',
        'accent-cyan': '#22D3EE',
        'accent-green': '#22C55E',
        'accent-amber': '#F59E0B',
        'accent-red': '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
} satisfies Config
