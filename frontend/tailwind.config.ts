import type { Config } from "tailwindcss";

/**
 * MuscleX — Tailwind config aligned with Design.md.
 *
 * - All colors resolve to CSS vars in globals.css (single source of truth).
 * - Spacing scale follows Design.md 4px base unit (xxs..section).
 * - Radius scale adds pill / pill-sm for marketing CTAs.
 * - Shadow ladder mirrors Design.md elevation Levels 1-5 (stacked offsets +
 *   inset hairline ring — never a single heavy drop).
 * - Typography mirrors Design.md hierarchy (display-xl..caption-mono).
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Raw Design.md tokens (use sparingly — prefer semantic aliases)
        ink: "hsl(var(--ink))",
        canvas: "hsl(var(--canvas))",
        "canvas-soft": "hsl(var(--canvas-soft))",
        "canvas-soft-2": "hsl(var(--canvas-soft-2))",
        hairline: "hsl(var(--hairline))",
        "hairline-strong": "hsl(var(--hairline-strong))",
        "body-ink": "hsl(var(--body-ink))",
        mute: "hsl(var(--mute))",
        "on-primary": "hsl(var(--on-primary))",
        link: {
          DEFAULT: "hsl(var(--link))",
          deep: "hsl(var(--link-deep))",
          soft: "hsl(var(--link-bg-soft))",
        },
        error: {
          DEFAULT: "hsl(var(--error))",
          soft: "hsl(var(--error-soft))",
          deep: "hsl(var(--error-deep))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          soft: "hsl(var(--warning-soft))",
          deep: "hsl(var(--warning-deep))",
          foreground: "hsl(var(--ink))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--on-primary))",
        },

        // shadcn semantic aliases (everything ultimately uses these)
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
        display: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Design.md hierarchy (size, lineHeight, weight + tracking)
        "display-xl": ["48px", { lineHeight: "48px", letterSpacing: "-0.05em", fontWeight: "600" }],
        "display-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.04em", fontWeight: "600" }],
        "display-md": ["24px", { lineHeight: "32px", letterSpacing: "-0.04em", fontWeight: "600" }],
        "display-sm": ["20px", { lineHeight: "28px", letterSpacing: "-0.03em", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "28px", letterSpacing: "0" }],
        "body-md": ["16px", { lineHeight: "24px", letterSpacing: "0" }],
        "body-sm": ["14px", { lineHeight: "20px", letterSpacing: "-0.02em" }],
        caption: ["12px", { lineHeight: "16px", letterSpacing: "0" }],
        code: ["13px", { lineHeight: "20px", letterSpacing: "0" }],
        "button-md": ["14px", { lineHeight: "20px", letterSpacing: "0", fontWeight: "500" }],
        "button-lg": ["16px", { lineHeight: "24px", letterSpacing: "0", fontWeight: "500" }],
        // Legacy alias preserved
        display: ["32px", { lineHeight: "1.25", fontWeight: "600" }],
      },
      letterSpacing: {
        "display-xl": "-0.05em",
        "display-lg": "-0.04em",
        "display-md": "-0.04em",
        "display-sm": "-0.03em",
        "body-sm": "-0.02em",
      },
      spacing: {
        // Design.md 4px base unit (multiples). Coexists with Tailwind defaults.
        xxs: "4px",
        "design-xs": "8px",
        "design-sm": "12px",
        "design-md": "16px",
        "design-lg": "24px",
        "design-xl": "32px",
        "design-2xl": "40px",
        "design-3xl": "48px",
        "design-4xl": "64px",
        "design-5xl": "96px",
        "design-6xl": "128px",
        section: "192px",
      },
      borderRadius: {
        none: "0px",
        xs: "4px",
        sm: "6px",                       // Geist --geist-radius
        DEFAULT: "8px",
        md: "calc(var(--radius) - 2px)", // 6px (shadcn-compat)
        lg: "var(--radius)",             // 8px (shadcn-compat)
        xl: "12px",
        "2xl": "16px",
        "pill-sm": "64px",
        pill: "100px",
        full: "9999px",
      },
      boxShadow: {
        // Design.md elevation ladder — stacked offsets + inset hairline.
        "level-1": "inset 0 0 0 1px rgba(0,0,0,0.08)",
        "level-2":
          "0 0 0 1px rgba(0,0,0,0.06), 0 1px 1px rgba(0,0,0,0.02), 0 2px 2px rgba(0,0,0,0.04)",
        "level-3":
          "0 0 0 1px rgba(0,0,0,0.06), 0 2px 2px rgba(0,0,0,0.04), 0 8px 8px -8px rgba(0,0,0,0.04)",
        "level-4":
          "0 0 0 1px rgba(0,0,0,0.06), 0 2px 2px rgba(0,0,0,0.04), 0 8px 16px -4px rgba(0,0,0,0.04)",
        "level-5":
          "0 0 0 1px rgba(0,0,0,0.06), 0 1px 1px rgba(0,0,0,0.02), 0 8px 16px -4px rgba(0,0,0,0.04), 0 24px 32px -8px rgba(0,0,0,0.06)",
        // Legacy alias — points at level-2 so any prior `shadow-card` use upgrades automatically.
        card:
          "0 0 0 1px rgba(0,0,0,0.06), 0 1px 1px rgba(0,0,0,0.02), 0 2px 2px rgba(0,0,0,0.04)",
      },
      // ── Motion language ───────────────────────────────────────
      // Bound to the CSS vars in globals.css so the brand has one place
      // to tune timing. Use `duration-fast / medium / slow / page` in
      // every transition. Never raw `duration-200`.
      transitionDuration: {
        fast: "var(--motion-fast)",
        medium: "var(--motion-medium)",
        slow: "var(--motion-slow)",
        page: "var(--motion-page)",
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
        "in-out": "var(--ease-in-out)",
        spring: "var(--ease-spring)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down var(--motion-medium) var(--ease-out)",
        "accordion-up": "accordion-up var(--motion-medium) var(--ease-out)",
        "fade-in": "fade-in var(--motion-medium) var(--ease-out)",
        "fade-in-up": "fade-in-up var(--motion-medium) var(--ease-out)",
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
