import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

/** Tiny local classnames joiner — the marketing app has no clsx dependency. */
export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

/* ────────────────────────────────────────────────────────────────────────────
 * Buttons
 *
 * On a dark canvas the primary CTA is the brightest object on the page. Two
 * carry conversion: a solid accent pill with a coloured glow, and a solid white
 * pill. Everything else is glass.
 * ──────────────────────────────────────────────────────────────────────────── */

type ButtonVariant = 'accent' | 'light' | 'glass' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

const buttonBase =
  'group/btn inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill font-medium transition-all duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright focus-visible:ring-offset-2 focus-visible:ring-offset-canvas';

const buttonVariants: Record<ButtonVariant, string> = {
  accent:
    'bg-accent text-accent-ink shadow-cta hover:bg-accent-bright hover:shadow-[0_10px_28px_-8px_hsl(var(--accent)/0.7)]',
  // The ink-pill alternative to the accent CTA, for pairings where a second
  // red button would compete.
  light: 'bg-text text-white hover:opacity-90',
  glass: 'glass glass-hover text-text hover:bg-glass-1',
  ghost: 'text-text-2 hover:bg-glass-1 hover:text-text',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-body-sm',
  md: 'h-11 px-5 text-body-sm',
  lg: 'h-[52px] px-7 text-body',
};

export function ButtonLink({
  href,
  variant = 'accent',
  size = 'lg',
  className,
  children,
  external,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: React.ReactNode;
  /** Product links point at another origin, so they bypass the Next router. */
  external?: boolean;
}) {
  const classes = cx(buttonBase, buttonVariants[variant], buttonSizes[size], className);

  if (external || href.startsWith('mailto:')) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}

/** Arrow that nudges on button hover. Pair with any ButtonLink. */
export function ArrowNudge() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4 transition-transform duration-fast ease-out group-hover/btn:translate-x-0.5"
      fill="none"
      aria-hidden
    >
      <path
        d="M3 8h10m0 0-4-4m4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Section chrome
 * ──────────────────────────────────────────────────────────────────────────── */

export function Section({
  id,
  tone = 'canvas',
  className,
  children,
}: {
  id?: string;
  tone?: 'canvas' | 'deep';
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={cx(
        'py-20 sm:py-28 lg:py-32',
        tone === 'deep' ? 'bg-canvas-deep' : 'bg-canvas',
        className,
      )}
      style={id ? { scrollMarginTop: '88px' } : undefined}
    >
      {children}
    </section>
  );
}

/** Eyebrow → display headline → lead. The page's standard section opener. */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = 'center',
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  align?: 'center' | 'left';
  className?: string;
}) {
  return (
    <div
      className={cx(
        'flex flex-col gap-5',
        align === 'center' ? 'mx-auto max-w-[760px] items-center text-center' : 'max-w-[780px]',
        className,
      )}
    >
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2 className="text-[34px] leading-[1.08] tracking-[-0.035em] sm:text-[44px] lg:text-display-2">
        {title}
      </h2>
      {lead ? <p className="max-w-[640px] text-lead text-text-2">{lead}</p> : null}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Surfaces
 * ──────────────────────────────────────────────────────────────────────────── */

export function Card({
  className,
  hover = false,
  children,
}: {
  className?: string;
  hover?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cx('glass rounded-lg p-6', hover && 'glass-hover', className)}>{children}</div>
  );
}

/** Small pill — announcements, trust markers, integration credits. */
export function Pill({
  children,
  icon: Icon,
  tone = 'glass',
  className,
}: {
  children: React.ReactNode;
  icon?: LucideIcon;
  tone?: 'glass' | 'accent';
  className?: string;
}) {
  return (
    <span
      className={cx(
        // `w-fit` matters: inside a `flex-col`, `align-items: stretch` would
        // blow an inline-flex span out to the full column width.
        'inline-flex w-fit items-center gap-2 rounded-pill px-3.5 py-1.5 text-caption',
        tone === 'accent'
          ? 'bg-accent/8 text-accent ring-1 ring-inset ring-accent/20'
          : 'glass text-text-2',
        className,
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
      {children}
    </span>
  );
}

/** Icon tile at the head of a feature card. */
export function IconTile({
  icon: Icon,
  tone = 'glass',
}: {
  icon: LucideIcon;
  tone?: 'glass' | 'accent';
}) {
  return (
    <span
      className={cx(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-md',
        tone === 'accent'
          ? 'bg-accent/8 text-accent ring-1 ring-inset ring-accent/20'
          : 'glass-2 text-text',
      )}
    >
      <Icon className="h-5 w-5" aria-hidden />
    </span>
  );
}

/** Live-status dot used in "live" labels. */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cx('relative flex h-1.5 w-1.5', className)} aria-hidden>
      <span className="absolute inline-flex h-full w-full animate-pulse-dot rounded-full bg-success" />
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Atmosphere
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Hero backdrop: faint engineering grid, an accent bloom above the fold, and a
 * fade so both dissolve into the page rather than ending on a hard edge.
 */
export function HeroBackdrop({ className }: { className?: string }) {
  const fade = 'linear-gradient(to bottom, #000 0%, #000 45%, transparent 100%)';

  return (
    <div aria-hidden className={cx('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div
        className="bg-grid absolute inset-0"
        style={{ maskImage: fade, WebkitMaskImage: fade }}
      />
      <div className="bg-bloom absolute inset-x-0 -top-40 h-[720px]" />
    </div>
  );
}

/** A softer bloom for mid-page bands. */
export function BandGlow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cx(
        'pointer-events-none absolute left-1/2 top-0 h-[420px] w-[900px] -translate-x-1/2',
        className,
      )}
      // Much weaker than the dark version: on white, accent at 0.22 reads as a
      // pink smudge rather than as light.
      style={{
        background:
          'radial-gradient(50% 50% at 50% 0%, hsl(var(--accent) / 0.08) 0%, transparent 70%)',
      }}
    />
  );
}

/**
 * Hairline-separated cell grid.
 *
 * Cells are separated by a 1px gap over a hairline-coloured background, so any
 * unfilled cell position shows as a hole. This pads the last row per
 * breakpoint — 2-up fillers between `sm` and `lg`, 3-up fillers at `lg`.
 */
export function CellGrid({
  children,
  count,
  columns = 3,
  /** Must match the cells' own background, or the filler shows as a patch. */
  cellClassName = 'bg-canvas',
  className,
}: {
  children: React.ReactNode;
  count: number;
  columns?: 2 | 3 | 4;
  cellClassName?: string;
  className?: string;
}) {
  const perRow = columns;
  const fillersAtTwo = (2 - (count % 2)) % 2;
  const fillersAtWide = (perRow - (count % perRow)) % perRow;

  const cols =
    perRow === 4 ? 'lg:grid-cols-4' : perRow === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2';

  return (
    <div
      className={cx(
        'grid gap-px overflow-hidden rounded-lg bg-hairline sm:grid-cols-2',
        cols,
        className,
      )}
    >
      {children}
      {Array.from({ length: fillersAtTwo }).map((_, i) => (
        <div key={`f2-${i}`} aria-hidden className={cx('hidden sm:block lg:hidden', cellClassName)} />
      ))}
      {Array.from({ length: fillersAtWide }).map((_, i) => (
        <div key={`fw-${i}`} aria-hidden className={cx('hidden lg:block', cellClassName)} />
      ))}
    </div>
  );
}
