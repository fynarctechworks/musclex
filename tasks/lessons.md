# FitSync Pro — Lessons Learned

Track patterns and mistakes here so they don't repeat.

## Format
- **Date:** What went wrong → What the fix/rule is

---

- **2026-03-09:** shadcn/ui latest `init -d` uses "base-nova" style which requires Tailwind v4 + @base-ui/react → Use `"style": "new-york"` in components.json for Tailwind 3.x compatibility
- **2026-03-09:** shadcn v4 generates `@import "shadcn/tailwind.css"` and `@import "tw-animate-css"` in globals.css → For Tailwind 3, use standard `@tailwind base/components/utilities` directives + `tailwindcss-animate` plugin
- **2026-03-09:** CSS variables for shadcn + Tailwind 3 must use HSL format without `hsl()` wrapper in :root (e.g., `--primary: 202 61% 56%`) and reference as `hsl(var(--primary))` in tailwind.config.ts
- **2026-03-09:** Prisma 7.x requires Node 20+. Use `prisma@5` on Node 18 environments
- **2026-03-09:** Node 18 is the current environment — some latest packages may require Node 20+
