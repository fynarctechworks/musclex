/** @type {import('tailwindcss').Config} */
// Token source: docs/design.md (Vercel/Geist system) translated to a mobile-dark-first
// theme. design.md is light-first; the member app leads dark (gym context, OLED, premium
// feel per PRD) but keeps the same ink/gray ladder + the single mesh gradient as the
// only decorative chrome. Colors resolve through CSS-less RN, so we inline hex values.
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  // The app is dark-first via literal color tokens (no `dark:` variants). NativeWind's
  // web runtime defaults darkMode to 'media' and throws when the forced-dark scheme is
  // applied ("Cannot manually set color scheme, as dark mode is type 'media'"). 'class'
  // lets us control the scheme without that crash; harmless on native (no dark: utilities).
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Surfaces (dark-first ladder; mirrors design.md canvas ladder inverted) ──
        canvas: '#0A0A0A', // page body (deep ink)
        'canvas-soft': '#121212', // raised section
        surface: '#171717', // card (design.md primary ink, used as card here)
        'surface-2': '#1F1F1F', // inset / pressed
        hairline: '#2A2A2A', // 1px dividers / borders
        'hairline-strong': '#3A3A3A',

        // ── Text ──
        ink: '#FAFAFA', // primary text (canvas-soft inverted)
        body: '#A1A1A1', // secondary text (design.md gray-500)
        mute: '#6E6E6E', // lowest-priority text

        // ── Brand / action ──
        // Inverted polarity: on dark, the conversion target is a light/accent fill.
        primary: '#FAFAFA', // primary CTA fill (light pill on dark)
        'on-primary': '#0A0A0A', // text on primary
        accent: '#0070F3', // design.md link blue — interactive accent
        'accent-soft': '#10243E',

        // ── Brand gradient stops (the only decoration — hero scale only) ──
        'grad-develop-start': '#007CF0',
        'grad-develop-end': '#00DFD8',
        'grad-preview-start': '#7928CA',
        'grad-preview-end': '#FF0080',
        'grad-ship-start': '#FF4D4D',
        'grad-ship-end': '#F9CB28',
        cyan: '#50E3C2',

        // ── Semantic ──
        success: '#0070F3',
        'success-fg': '#3291FF',
        warning: '#F5A623',
        'warning-soft': '#2A2008',
        error: '#FF4D4D',
        'error-soft': '#2A1010',
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
        // Geist substitutes (design.md "Note on Font Substitutes"), bundled via
        // @expo-google-fonts/inter + jetbrains-mono and loaded in app/_layout. RN can't
        // synthesise weights for a custom family, so each weight is its own family; the
        // Txt component picks the family from its `weight` prop. Falls back to System.
        sans: ['Inter_400Regular', 'System'],
        'sans-medium': ['Inter_500Medium', 'System'],
        'sans-semibold': ['Inter_600SemiBold', 'System'],
        mono: ['JetBrainsMono_400Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};
