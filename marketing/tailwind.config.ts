import type { Config } from 'tailwindcss';

/**
 * MuscleX marketing — dark-first Tailwind config.
 *
 * Values resolve to the CSS vars in globals.css, which is the single source of
 * truth. Note this intentionally diverges from `frontend/tailwind.config.ts`
 * (and from design.md): the marketing surface is its own dark system.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: 'hsl(var(--canvas))',
          deep: 'hsl(var(--canvas-deep))',
          raised: 'hsl(var(--canvas-raised))',
        },
        glass: {
          1: 'hsl(var(--glass-1))',
          2: 'hsl(var(--glass-2))',
          3: 'hsl(var(--glass-3))',
        },
        hairline: {
          DEFAULT: 'hsl(var(--hairline))',
          strong: 'hsl(var(--hairline-strong))',
        },
        text: {
          DEFAULT: 'hsl(var(--text))',
          2: 'hsl(var(--text-2))',
          3: 'hsl(var(--text-3))',
          4: 'hsl(var(--text-4))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          bright: 'hsl(var(--accent-bright))',
          warm: 'hsl(var(--accent-warm))',
          amber: 'hsl(var(--accent-amber))',
          ink: 'hsl(var(--accent-ink))',
        },
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        danger: 'hsl(var(--danger))',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Display ladder — large and tightly tracked. Tracking is baked in so a
        // headline can never ship at default spacing.
        'display-1': ['84px', { lineHeight: '0.98', letterSpacing: '-0.04em', fontWeight: '600' }],
        'display-2': ['64px', { lineHeight: '1.03', letterSpacing: '-0.035em', fontWeight: '600' }],
        'display-3': ['52px', { lineHeight: '1.06', letterSpacing: '-0.032em', fontWeight: '600' }],
        'display-4': ['40px', { lineHeight: '1.1', letterSpacing: '-0.03em', fontWeight: '600' }],
        'display-5': ['30px', { lineHeight: '1.18', letterSpacing: '-0.025em', fontWeight: '600' }],
        'title': ['22px', { lineHeight: '1.28', letterSpacing: '-0.02em', fontWeight: '600' }],
        'title-sm': ['17px', { lineHeight: '1.35', letterSpacing: '-0.015em', fontWeight: '600' }],
        'lead': ['19px', { lineHeight: '30px', letterSpacing: '-0.005em' }],
        'body': ['16px', { lineHeight: '26px' }],
        'body-sm': ['14.5px', { lineHeight: '23px' }],
        'caption': ['13px', { lineHeight: '19px' }],
        'micro': ['11.5px', { lineHeight: '16px' }],
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '10px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '28px',
        '3xl': '36px',
        pill: '999px',
      },
      boxShadow: {
        // Soft neutral drops. On a white canvas elevation has to be carried by
        // a hairline ring plus a wide, low-opacity shadow — a heavy drop reads
        // as dirt rather than as depth.
        float: '0 1px 2px rgba(16,16,24,0.04), 0 18px 40px -16px rgba(16,16,24,0.16)',
        'float-lg':
          '0 1px 2px rgba(16,16,24,0.05), 0 24px 50px -20px rgba(16,16,24,0.20), 0 50px 90px -40px rgba(16,16,24,0.16)',
        panel: '0 1px 2px rgba(16,16,24,0.04), 0 20px 45px -24px rgba(16,16,24,0.18)',
        cta: '0 8px 22px -8px hsl(var(--accent) / 0.55)',
      },
      transitionDuration: {
        fast: 'var(--motion-fast)',
        medium: 'var(--motion-medium)',
        slow: 'var(--motion-slow)',
      },
      transitionTimingFunction: {
        out: 'var(--ease-out)',
        'in-out': 'var(--ease-in-out)',
      },
      keyframes: {
        'word-in': {
          '0%': { opacity: '0', transform: 'translateY(0.32em) rotateX(-40deg)' },
          '100%': { opacity: '1', transform: 'translateY(0) rotateX(0)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        'word-in': 'word-in var(--motion-slow) var(--ease-out) both',
        'fade-up': 'fade-up var(--motion-slow) var(--ease-out) both',
        marquee: 'marquee 42s linear infinite',
        'pulse-dot': 'pulse-dot 2.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
