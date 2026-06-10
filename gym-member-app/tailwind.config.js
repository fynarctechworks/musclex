/** @type {import('tailwindcss').Config} */
// Token source: gym-member-app/mobile-app-design.md — the Kraken-inspired system
// (purple #7132f5 brand, light-first). Colors are now THEME-AWARE: each maps to a
// CSS custom property whose channels are injected at runtime by src/design-system/
// theme-vars.ts (lightVars / darkVars), applied on the root <View> in app/_layout.
// This is what lets the whole app re-theme from a single light/dark toggle without
// per-screen edits. `<alpha-value>` keeps opacity utilities (e.g. bg-canvas/80) working.
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  // 'class' lets us drive the scheme manually (NativeWind's web runtime defaults to
  // 'media' and throws when a scheme is forced). The light/dark switch toggles it.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Surfaces ──
        canvas: 'rgb(var(--color-canvas) / <alpha-value>)', // page body
        'canvas-soft': 'rgb(var(--color-canvas-soft) / <alpha-value>)', // raised section
        surface: 'rgb(var(--color-surface) / <alpha-value>)', // card
        'surface-2': 'rgb(var(--color-surface-2) / <alpha-value>)', // inset / pressed
        hairline: 'rgb(var(--color-hairline) / <alpha-value>)', // 1px dividers / borders
        'hairline-strong': 'rgb(var(--color-hairline-strong) / <alpha-value>)',

        // ── Text ──
        ink: 'rgb(var(--color-ink) / <alpha-value>)', // primary text
        body: 'rgb(var(--color-body) / <alpha-value>)', // secondary text
        mute: 'rgb(var(--color-mute) / <alpha-value>)', // lowest-priority text

        // ── Brand / action ──
        primary: 'rgb(var(--color-primary) / <alpha-value>)', // Kraken Purple CTA / brand
        'on-primary': 'rgb(var(--color-on-primary) / <alpha-value>)', // text on primary
        accent: 'rgb(var(--color-accent) / <alpha-value>)', // links / interactive accent
        'accent-soft': 'rgb(var(--color-accent-soft) / <alpha-value>)',

        // ── Brand gradient stops (the hero-scale decoration — theme-independent) ──
        'grad-develop-start': '#1F5E0A',
        'grad-develop-end': '#6FAE1E',
        'grad-preview-start': '#3E8214',
        'grad-preview-end': '#9DD12A',
        'grad-ship-start': '#9DD12A',
        'grad-ship-end': '#E9F8C5',
        cyan: '#5E9415',

        // ── Semantic ──
        success: 'rgb(var(--color-success) / <alpha-value>)',
        'success-fg': 'rgb(var(--color-success-fg) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        'warning-soft': 'rgb(var(--color-warning-soft) / <alpha-value>)',
        error: 'rgb(var(--color-error) / <alpha-value>)',
        'error-soft': 'rgb(var(--color-error-soft) / <alpha-value>)',
      },
      borderRadius: {
        // design.md radius scale
        none: '0px',
        xs: '4px',
        sm: '6px', // --geist-radius (in-app base)
        md: '8px', // --geist-marketing-radius (cards)
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        'pill-sm': '64px',
        pill: '100px',
        full: '9999px',
      },
      spacing: {
        // 4px base unit (design.md --geist-space)
        xxs: '4px',
        xs: '8px',
        sm: '12px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        '2xl': '40px',
        '3xl': '48px',
        '4xl': '64px',
        '5xl': '96px',
      },
      fontSize: {
        // design.md type hierarchy (size / lineHeight). Negative tracking is applied
        // per-component via letterSpacing since NativeWind tracking is limited.
        'display-2xl': ['52px', { lineHeight: '56px' }],
        'display-xl': ['40px', { lineHeight: '44px' }],
        'display-lg': ['30px', { lineHeight: '38px' }],
        'display-md': ['24px', { lineHeight: '32px' }],
        'display-sm': ['20px', { lineHeight: '28px' }],
        'body-lg': ['18px', { lineHeight: '28px' }],
        'body-md': ['16px', { lineHeight: '24px' }],
        'body-sm': ['14px', { lineHeight: '20px' }],
        caption: ['12px', { lineHeight: '16px' }],
        code: ['13px', { lineHeight: '20px' }],
      },
      fontFamily: {
        // Two-family system (loaded in app/_layout). PRIMARY = Manrope for display
        // / headings / large numbers (the premium fitness feel — Nike/Peloton/WHOOP);
        // SECONDARY = Inter for body & captions (readability for data). RN can't
        // synthesise weights for a custom family, so each weight is its own family;
        // the Txt component picks the family from its variant + `weight`. Falls back
        // to System.
        // Secondary — body / caption (Inter).
        sans: ['Inter_400Regular', 'System'],
        'sans-medium': ['Inter_500Medium', 'System'],
        'sans-semibold': ['Inter_600SemiBold', 'System'],
        // Primary — display / headings / numbers (Manrope).
        heading: ['Manrope_400Regular', 'System'],
        'heading-medium': ['Manrope_500Medium', 'System'],
        'heading-semibold': ['Manrope_600SemiBold', 'System'],
        'heading-bold': ['Manrope_700Bold', 'System'],
        mono: ['JetBrainsMono_400Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};
