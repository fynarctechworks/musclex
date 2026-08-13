/** @type {import('tailwindcss').Config} */
// TOKEN SOURCE OF TRUTH: gym-member-app/global.css — warm cream + CLAY ORANGE,
// derived from `memberapp-design system.md` (@layer theme). Read global.css for the
// palette rationale and the measured contrast ratios before changing anything here.
//
// Colors are THEME-AWARE: each maps to a CSS custom property whose channels are
// injected at runtime by src/design-system/theme-vars.ts (lightVars / darkVars),
// applied on the root <View> in app/_layout. This is what lets the whole app
// re-theme from a single light/dark toggle without per-screen edits.
// `<alpha-value>` keeps opacity utilities (e.g. bg-canvas/80) working.
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
        canvas: 'rgb(var(--color-canvas) / <alpha-value>)', // page body (warm cream)
        'canvas-soft': 'rgb(var(--color-canvas-soft) / <alpha-value>)', // raised section
        surface: 'rgb(var(--color-surface) / <alpha-value>)', // card
        'surface-2': 'rgb(var(--color-surface-2) / <alpha-value>)', // inset / pressed
        'surface-3': 'rgb(var(--color-surface-3) / <alpha-value>)', // deepest inset
        hairline: 'rgb(var(--color-hairline) / <alpha-value>)', // 1px dividers / borders
        'hairline-strong': 'rgb(var(--color-hairline-strong) / <alpha-value>)',

        // ── Text ── (5 tiers; see global.css for measured contrast)
        ink: 'rgb(var(--color-ink) / <alpha-value>)', // primary text
        'ink-2': 'rgb(var(--color-ink-2) / <alpha-value>)', // strong secondary
        body: 'rgb(var(--color-body) / <alpha-value>)', // secondary text
        mute: 'rgb(var(--color-mute) / <alpha-value>)', // DECORATIVE — fails AA for text
        faint: 'rgb(var(--color-faint) / <alpha-value>)', // DECORATIVE — fails AA for text
        'ink-inverse': 'rgb(var(--color-ink-inverse) / <alpha-value>)', // on dark fills
        'ink-brand': 'rgb(var(--color-ink-brand) / <alpha-value>)', // brand headings
        'ink-accent': 'rgb(var(--color-ink-accent) / <alpha-value>)', // muted clay text

        // ── Brand / action ──
        primary: 'rgb(var(--color-primary) / <alpha-value>)', // clay orange CTA / brand
        'on-primary': 'rgb(var(--color-on-primary) / <alpha-value>)', // text on primary
        'primary-strong': 'rgb(var(--color-primary-strong) / <alpha-value>)', // pressed
        'primary-soft': 'rgb(var(--color-primary-soft) / <alpha-value>)', // tinted bg
        accent: 'rgb(var(--color-accent) / <alpha-value>)', // indigo links
        'accent-soft': 'rgb(var(--color-accent-soft) / <alpha-value>)',

        // Graphics accent — rings, charts, progress, active icons. `cyan` is the
        // legacy alias ~20 screens already use for this role (it was never cyan);
        // both point at the same var so the rebrand needed no component edits.
        secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
        cyan: 'rgb(var(--color-secondary) / <alpha-value>)', // prefer `secondary`

        // ── Brand gradient stops (hero-scale decoration — theme-independent).
        // Recoloured from the old lime ramp to the clay ramp. Currently referenced
        // by no component; `tokens.ts → gradient` is the preferred access path. ──
        'grad-develop-start': '#682906',
        'grad-develop-end': '#A5460F',
        'grad-preview-start': '#A5460F',
        'grad-preview-end': '#E6651B',
        'grad-ship-start': '#E6651B',
        'grad-ship-end': '#F9BB9E',

        // ── Semantic ──
        success: 'rgb(var(--color-success) / <alpha-value>)',
        'success-fg': 'rgb(var(--color-success-fg) / <alpha-value>)',
        'success-soft': 'rgb(var(--color-success-soft) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        'warning-fg': 'rgb(var(--color-warning-fg) / <alpha-value>)',
        'warning-soft': 'rgb(var(--color-warning-soft) / <alpha-value>)',
        error: 'rgb(var(--color-error) / <alpha-value>)',
        'error-fg': 'rgb(var(--color-error-fg) / <alpha-value>)',
        'error-soft': 'rgb(var(--color-error-soft) / <alpha-value>)',
        info: 'rgb(var(--color-info) / <alpha-value>)',
        'info-soft': 'rgb(var(--color-info-soft) / <alpha-value>)',

        // ── Static ramps (theme-INDEPENDENT) — a specific step rather than a
        // semantic role: illustrations, category tags, multi-series charts. ──
        clay: {
          50: '#FFFBFA',
          100: '#FEEDE6',
          200: '#FDDCCE',
          300: '#F9BB9E',
          400: '#F59970',
          500: '#F38858',
          600: '#EE7944',
          700: '#E96C2F',
          800: '#E6651B',
          900: '#A5460F',
          950: '#682906',
        },
        indigo: {
          50: '#FAFCFF',
          100: '#E8EFFC',
          200: '#D2DFF9',
          300: '#A7C0F1',
          400: '#81A0E9',
          500: '#6A88E2',
          600: '#556ADC',
          700: '#4250D5',
          800: '#3333CC',
          900: '#212191',
          950: '#11115B',
        },
        // Steps absent from the source (sage 900, red 800, amber 400/900) are left
        // out rather than invented.
        sage: {
          50: '#F2F8EB',
          100: '#E3F1D8',
          200: '#C8E4B0',
          300: '#ACD587',
          400: '#90C85B',
          500: '#83C040',
          600: '#6EA335',
          700: '#496D21',
          800: '#385418',
          950: '#152605',
        },
        red: {
          50: '#FDE7E2',
          100: '#F8D1C6',
          200: '#EBA18F',
          300: '#DB715C',
          400: '#C43D2B',
          500: '#B81514',
          600: '#A21913',
          700: '#781A11',
        },
        amber: {
          50: '#FFF8E6',
          100: '#FFF0CF',
          200: '#FFE8B7',
          300: '#FFCB79',
          500: '#FEB12B',
          600: '#DF9C2A',
          700: '#C08827',
          800: '#A27224',
          950: '#362813',
        },
        sand: {
          50: '#F9F9F9',
          100: '#F5F5F5',
          200: '#F0F0F0',
          300: '#E6E6E6',
          400: '#CCCCCC',
          500: '#B3B3B3',
          600: '#999999',
          700: '#666666',
          800: '#525252',
          950: '#292929',
        },
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
