import {
  Bell,
  Bot,
  Building2,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  Megaphone,
  QrCode,
  Search,
  Settings,
  TrendingDown,
  TrendingUp,
  UserCog,
  Users,
} from 'lucide-react';
import { cx } from './ui';

/**
 * Product visuals, rendered as code rather than screenshots.
 *
 * `docs/screens/` in this repo is branded "FitSync Pro" in a purple design
 * language — those are concept mockups, not the shipped MuscleX UI, so putting
 * them here would advertise a different product's name.
 *
 * These deliberately use a self-contained LIGHT palette written as literal
 * values, NOT the page tokens (which are dark). A light product sitting on the
 * dark page is what makes it read as the brightest object on screen — and it
 * matches the actual MuscleX admin app, which is light.
 *
 * All figures are illustrative sample data for a fictional studio, labelled as
 * such in the surrounding copy. No number here describes a real customer.
 */

/* Light product palette, kept in one place. */
const P = {
  canvas: '#ffffff',
  soft: '#fafafa',
  soft2: '#f4f4f5',
  line: '#e9e9ec',
  ink: '#131316',
  body: '#4b4b53',
  mute: '#8a8a94',
  accent: '#E10600',
  good: '#0f9d76',
};

/* ── Frames ──────────────────────────────────────────────────────────────── */

export function BrowserFrame({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cx('overflow-hidden rounded-lg shadow-float-lg', className)}
      style={{ background: P.canvas, border: `1px solid ${P.line}` }}
    >
      <div
        className="flex items-center gap-3 px-4 py-2.5"
        style={{ background: P.soft, borderBottom: `1px solid ${P.line}` }}
      >
        <div className="flex gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ background: '#d6d6db' }} />
          ))}
        </div>
        <span
          className="truncate rounded px-2 py-0.5 text-[11px] leading-4"
          style={{ background: P.canvas, color: P.mute, border: `1px solid ${P.line}` }}
        >
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

/* ── Shared app chrome ───────────────────────────────────────────────────── */

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard' },
  { icon: Users, label: 'Members' },
  { icon: QrCode, label: 'Check-ins' },
  { icon: CalendarDays, label: 'Schedule' },
  { icon: CreditCard, label: 'Finance' },
  { icon: UserCog, label: 'Staff' },
  { icon: Megaphone, label: 'Marketing' },
  { icon: Bot, label: 'AI advisor' },
];

function AppSidebar({ active }: { active: string }) {
  return (
    <aside
      className="hidden w-[172px] shrink-0 flex-col gap-0.5 p-2.5 sm:flex"
      style={{ borderRight: `1px solid ${P.line}` }}
    >
      <div className="mb-3 flex items-center gap-2 px-2 py-1.5">
        <span
          className="flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold"
          style={{ background: P.accent, color: '#fff' }}
        >
          M
        </span>
        <span className="text-[13px] font-semibold tracking-[-0.02em]" style={{ color: P.ink }}>
          MuscleX
        </span>
      </div>
      {navItems.map((item) => {
        const isActive = item.label === active;
        return (
          <div
            key={item.label}
            className="flex items-center gap-2.5 rounded px-2 py-[7px] text-[12px] leading-4"
            style={
              isActive
                ? { background: P.soft2, color: P.ink, fontWeight: 500 }
                : { color: P.mute }
            }
          >
            <item.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{item.label}</span>
          </div>
        );
      })}
      <div
        className="mt-auto flex items-center gap-2.5 rounded px-2 py-[7px] text-[12px] leading-4"
        style={{ color: P.mute }}
      >
        <Settings className="h-3.5 w-3.5" aria-hidden />
        Settings
      </div>
    </aside>
  );
}

function AppTopBar({ branch = 'Indiranagar' }: { branch?: string }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5"
      style={{ borderBottom: `1px solid ${P.line}` }}
    >
      <div
        className="flex min-w-0 flex-1 items-center gap-2 rounded px-2.5 py-1.5"
        style={{ background: P.soft }}
      >
        <Search className="h-3.5 w-3.5 shrink-0" style={{ color: P.mute }} aria-hidden />
        <span className="truncate text-[12px] leading-4" style={{ color: P.mute }}>
          Search members, classes or payments
        </span>
      </div>
      <div
        className="hidden items-center gap-1.5 rounded px-2.5 py-1.5 sm:flex"
        style={{ border: `1px solid ${P.line}` }}
      >
        <Building2 className="h-3.5 w-3.5" style={{ color: P.mute }} aria-hidden />
        <span className="text-[12px] leading-4" style={{ color: P.ink }}>
          {branch}
        </span>
      </div>
      <Bell className="h-4 w-4 shrink-0" style={{ color: P.mute }} aria-hidden />
    </div>
  );
}

function StatTile({
  label,
  value,
  delta,
  positive = true,
}: {
  label: string;
  value: string;
  delta: string;
  positive?: boolean;
}) {
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <div className="rounded-md p-3" style={{ border: `1px solid ${P.line}` }}>
      <p className="text-[9.5px] font-medium uppercase leading-4 tracking-[0.08em]" style={{ color: P.mute }}>
        {label}
      </p>
      <p
        className="mt-1 text-[21px] font-semibold leading-7 tracking-[-0.03em] tabular-nums"
        style={{ color: P.ink }}
      >
        {value}
      </p>
      <p
        className="mt-0.5 flex items-center gap-1 text-[11px] leading-4 tabular-nums"
        style={{ color: positive ? P.good : P.accent }}
      >
        <Icon className="h-3 w-3" aria-hidden />
        {delta}
      </p>
    </div>
  );
}

/* ── Revenue chart ───────────────────────────────────────────────────────── */

const revenueSeries = [38, 44, 41, 52, 49, 58, 63, 61, 72, 78, 74, 88];

function RevenueChart({ height = 96 }: { height?: number }) {
  const width = 340;
  const max = Math.max(...revenueSeries);
  const min = Math.min(...revenueSeries);
  const points = revenueSeries.map((v, i) => {
    const x = (i / (revenueSeries.length - 1)) * width;
    const y = height - ((v - min) / (max - min)) * (height - 14) - 7;
    return [x, y] as const;
  });

  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ height, width: '100%' }}
      preserveAspectRatio="none"
      role="img"
      aria-label="Sample monthly revenue trend, rising across twelve months"
    >
      <defs>
        <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={P.accent} stopOpacity="0.16" />
          <stop offset="100%" stopColor={P.accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#rev-fill)" />
      <path
        d={line}
        fill="none"
        stroke={P.accent}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0]} cy={last[1]} r="3.25" fill={P.accent} />
    </svg>
  );
}

/* ── Dashboard ───────────────────────────────────────────────────────────── */

const alerts = [
  { title: '14 memberships expire within 7 days', meta: 'Renewals · Indiranagar', tag: 'Action' },
  { title: '3 classes under 20% capacity tomorrow', meta: 'Schedule · All branches', tag: 'Review' },
  { title: '6 payments failed on retry', meta: 'Finance · Razorpay', tag: 'Urgent' },
];

export function DashboardMockup({ className }: { className?: string }) {
  return (
    <BrowserFrame label="app.musclex.com/dashboard" className={className}>
      <div className="flex">
        <AppSidebar active="Dashboard" />
        <div className="min-w-0 flex-1" style={{ background: P.soft }}>
          <AppTopBar />
          <div className="space-y-3 p-4">
            <div>
              <p className="text-[15px] font-semibold leading-5 tracking-[-0.03em]" style={{ color: P.ink }}>
                Good morning, Aditi
              </p>
              <p className="text-[12px] leading-4" style={{ color: P.mute }}>
                Here is what is happening across your studio today.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" style={{ background: P.canvas }}>
              <StatTile label="Members" value="1,284" delta="+12.5%" />
              <StatTile label="Check-ins today" value="156" delta="+5.2%" />
              <StatTile label="Revenue MTD" value="₹4.25L" delta="+8.4%" />
              <StatTile label="At risk" value="23" delta="-2.1%" positive={false} />
            </div>

            <div className="grid gap-2 lg:grid-cols-[1.55fr_1fr]">
              <div className="rounded-md p-3" style={{ background: P.canvas, border: `1px solid ${P.line}` }}>
                <div className="mb-1 flex items-baseline justify-between">
                  <p className="text-[12px] font-medium leading-4" style={{ color: P.ink }}>
                    Revenue trend
                  </p>
                  <p className="text-[10px] leading-4" style={{ color: P.mute }}>
                    12 months
                  </p>
                </div>
                <RevenueChart />
              </div>

              <div className="rounded-md p-3" style={{ background: P.canvas, border: `1px solid ${P.line}` }}>
                <p className="mb-2.5 text-[12px] font-medium leading-4" style={{ color: P.ink }}>
                  Branch comparison
                </p>
                <div className="space-y-2">
                  {[
                    { name: 'Indiranagar', pct: 92 },
                    { name: 'Koramangala', pct: 74 },
                    { name: 'HSR Layout', pct: 58 },
                    { name: 'Whitefield', pct: 41 },
                  ].map((b) => (
                    <div key={b.name} className="space-y-1">
                      <div className="flex items-baseline justify-between text-[11px] leading-4">
                        <span style={{ color: P.body }}>{b.name}</span>
                        <span className="tabular-nums" style={{ color: P.mute }}>
                          {b.pct}%
                        </span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-pill" style={{ background: P.soft2 }}>
                        <div
                          className="h-full rounded-pill"
                          style={{ width: `${b.pct}%`, background: P.ink }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-md" style={{ background: P.canvas, border: `1px solid ${P.line}` }}>
              <div
                className="flex items-center justify-between px-3 py-2"
                style={{ borderBottom: `1px solid ${P.line}` }}
              >
                <p className="text-[12px] font-medium leading-4" style={{ color: P.ink }}>
                  Priority alerts
                </p>
                <span className="text-[10px] leading-4" style={{ color: P.mute }}>
                  View all
                </span>
              </div>
              {alerts.map((a, i) => (
                <div
                  key={a.title}
                  className="flex items-center gap-2.5 px-3 py-2"
                  style={i < alerts.length - 1 ? { borderBottom: `1px solid ${P.line}` } : undefined}
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: a.tag === 'Urgent' ? P.accent : '#d6d6db' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] leading-4" style={{ color: P.ink }}>
                      {a.title}
                    </p>
                    <p className="truncate text-[11px] leading-4" style={{ color: P.mute }}>
                      {a.meta}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-pill px-2 py-0.5 text-[10px] leading-4"
                    style={{ background: P.soft2, color: P.body }}
                  >
                    {a.tag}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

/* ── Churn / AI advisor ──────────────────────────────────────────────────── */

const churnRows = [
  { name: 'S. Iyer', since: '2021', visits: '0.4 / wk', dues: 'Overdue', risk: 92 },
  { name: 'M. Rao', since: '2022', visits: '0.8 / wk', dues: 'Paid', risk: 81 },
  { name: 'E. Chen', since: '2023', visits: '2.1 / wk', dues: 'Paid', risk: 45 },
  { name: 'D. Wilson', since: '2020', visits: '4.5 / wk', dues: 'Paid', risk: 12 },
];

export function ChurnMockup({ className }: { className?: string }) {
  return (
    <BrowserFrame label="app.musclex.com/ai/churn-risk" className={className}>
      <div className="grid lg:grid-cols-[1.6fr_1fr]">
        <div className="min-w-0 p-4">
          <p className="text-[15px] font-semibold leading-5 tracking-[-0.03em]" style={{ color: P.ink }}>
            Churn risk
          </p>
          <p className="mb-3 text-[12px] leading-4" style={{ color: P.mute }}>
            Members drifting away, scored from attendance and payment signals.
          </p>

          <div className="overflow-hidden rounded-md" style={{ border: `1px solid ${P.line}` }}>
            <div
              className="grid grid-cols-[1.3fr_1fr_0.9fr_1.1fr] gap-2 px-3 py-2"
              style={{ background: P.soft }}
            >
              {['Member', 'Visits', 'Dues', 'Risk'].map((h) => (
                <span
                  key={h}
                  className="text-[9.5px] font-medium uppercase leading-4 tracking-[0.08em]"
                  style={{ color: P.mute }}
                >
                  {h}
                </span>
              ))}
            </div>
            {churnRows.map((row) => (
              <div
                key={row.name}
                className="grid grid-cols-[1.3fr_1fr_0.9fr_1.1fr] items-center gap-2 px-3 py-2.5"
                style={{ borderTop: `1px solid ${P.line}` }}
              >
                <div className="min-w-0">
                  <p className="truncate text-[12px] leading-4" style={{ color: P.ink }}>
                    {row.name}
                  </p>
                  <p className="text-[10px] leading-4" style={{ color: P.mute }}>
                    Since {row.since}
                  </p>
                </div>
                <span className="text-[11px] leading-4 tabular-nums" style={{ color: P.body }}>
                  {row.visits}
                </span>
                <span
                  className="w-fit rounded-pill px-1.5 py-0.5 text-[10px] leading-4"
                  style={
                    row.dues === 'Overdue'
                      ? { background: 'rgba(225,6,0,0.08)', color: P.accent }
                      : { background: P.soft2, color: P.body }
                  }
                >
                  {row.dues}
                </span>
                <div className="flex items-center gap-1.5">
                  <div
                    className="h-1 w-full max-w-[52px] overflow-hidden rounded-pill"
                    style={{ background: P.soft2 }}
                  >
                    <div
                      className="h-full rounded-pill"
                      style={{ width: `${row.risk}%`, background: row.risk >= 70 ? P.accent : P.ink }}
                    />
                  </div>
                  <span className="text-[11px] leading-4 tabular-nums" style={{ color: P.body }}>
                    {row.risk}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4" style={{ background: P.soft, borderLeft: `1px solid ${P.line}` }}>
          <div className="mb-3 flex items-center gap-1.5">
            <Bot className="h-3.5 w-3.5" style={{ color: P.accent }} aria-hidden />
            <p className="text-[12px] font-medium leading-4" style={{ color: P.ink }}>
              Suggested actions
            </p>
          </div>
          <div className="space-y-2">
            {[
              {
                title: 'Offer a 3-month discount',
                body: 'S. Iyer responded to a price offer in 2023 and has not visited in 14 days.',
              },
              {
                title: 'Send a personal message',
                body: 'Reference her last yoga session rather than a generic reminder.',
              },
              {
                title: 'Assign a trainer follow-up',
                body: 'Flag for a free assessment with her usual coach this week.',
              },
            ].map((s) => (
              <div
                key={s.title}
                className="rounded-md p-3"
                style={{ background: P.canvas, border: `1px solid ${P.line}` }}
              >
                <p className="text-[12px] font-medium leading-4" style={{ color: P.ink }}>
                  {s.title}
                </p>
                <p className="mt-1 text-[11px] leading-4" style={{ color: P.mute }}>
                  {s.body}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-4" style={{ color: P.mute }}>
            Scored on this studio&apos;s own data only
          </p>
        </div>
      </div>
    </BrowserFrame>
  );
}

/* ── Check-in ────────────────────────────────────────────────────────────── */

const checkInFeed = [
  { name: 'Rahul K.', method: 'QR', time: '07:12', ok: true },
  { name: 'Neha S.', method: 'Face', time: '07:14', ok: true },
  { name: 'Imran A.', method: 'QR', time: '07:15', ok: false },
  { name: 'Priya M.', method: 'Device', time: '07:18', ok: true },
  { name: 'Vikram J.', method: 'Desk', time: '07:21', ok: true },
];

export function CheckInMockup({ className }: { className?: string }) {
  return (
    <BrowserFrame label="app.musclex.com/check-in/live" className={className}>
      <div className="grid sm:grid-cols-[1fr_1.2fr]">
        <div
          className="flex flex-col items-center justify-center gap-3 p-6"
          style={{ background: P.soft, borderRight: `1px solid ${P.line}` }}
        >
          <div
            className="flex h-[104px] w-[104px] items-center justify-center rounded-lg"
            style={{ background: P.canvas, border: `1px solid ${P.line}` }}
          >
            <QrCode className="h-12 w-12" style={{ color: P.ink }} aria-hidden />
          </div>
          <div className="text-center">
            <p className="text-[13px] font-medium leading-5" style={{ color: P.ink }}>
              Scan to check in
            </p>
            <p className="text-[11px] leading-4" style={{ color: P.mute }}>
              Kiosk · Indiranagar · Door 1
            </p>
          </div>
          <div className="flex gap-1.5">
            {['QR', 'Face', 'Device', 'Desk'].map((m, i) => (
              <span
                key={m}
                className="rounded-pill px-2 py-0.5 text-[10px] leading-4"
                style={
                  i === 0
                    ? { background: P.ink, color: '#fff' }
                    : { background: P.soft2, color: P.body }
                }
              >
                {m}
              </span>
            ))}
          </div>
        </div>

        <div className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12px] font-medium leading-4" style={{ color: P.ink }}>
              Live check-ins
            </p>
            <span className="flex items-center gap-1.5 text-[10px] leading-4" style={{ color: P.mute }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: P.good }} aria-hidden />
              live
            </span>
          </div>
          <div className="overflow-hidden rounded-md" style={{ border: `1px solid ${P.line}` }}>
            {checkInFeed.map((row, i) => (
              <div
                key={row.name}
                className="flex items-center gap-2.5 px-3 py-2"
                style={i < checkInFeed.length - 1 ? { borderBottom: `1px solid ${P.line}` } : undefined}
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium"
                  style={{ background: P.soft2, color: P.body }}
                >
                  {row.name.charAt(0)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] leading-4" style={{ color: P.ink }}>
                  {row.name}
                </span>
                <span className="shrink-0 text-[10px] leading-4" style={{ color: P.mute }}>
                  {row.method}
                </span>
                <span className="shrink-0 text-[10px] leading-4 tabular-nums" style={{ color: P.mute }}>
                  {row.time}
                </span>
                <span
                  className="shrink-0 rounded-pill px-1.5 py-0.5 text-[10px] leading-4"
                  style={
                    row.ok
                      ? { background: 'rgba(15,157,118,0.1)', color: P.good }
                      : { background: 'rgba(225,6,0,0.08)', color: P.accent }
                  }
                >
                  {row.ok ? 'In' : 'Dues'}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-4" style={{ color: P.mute }}>
            Access policy blocked 1 entry · dues outstanding
          </p>
        </div>
      </div>
    </BrowserFrame>
  );
}

/* ── Member app phone ────────────────────────────────────────────────────── */

/**
 * Modelled on the shipped member-app home screen: greeting, weekly progress,
 * check-in row, activity tiles and a five-tab bar. Rebuilt in code rather than
 * screenshotted — the source screenshot in the repo shows a real person's name.
 */
export function PhoneMockup({ className }: { className?: string }) {
  return (
    <div
      className={cx('w-[252px] shrink-0 overflow-hidden rounded-[34px] p-2 shadow-float-lg', className)}
      style={{ background: '#1b1b1f' }}
    >
      <div className="overflow-hidden rounded-[27px]" style={{ background: P.soft }}>
        <div className="flex items-center justify-between px-4 pb-1 pt-2.5">
          <span className="text-[9.5px] font-medium leading-3" style={{ color: P.ink }}>
            9:41
          </span>
          <span className="text-[9px] leading-3" style={{ color: P.mute }}>
            ▪▪▪
          </span>
        </div>

        <div className="space-y-2.5 px-3.5 pb-3">
          <div className="flex items-center gap-2 pt-1">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold"
              style={{ background: P.soft2, color: P.body }}
            >
              A
            </span>
            <div className="min-w-0">
              <p className="text-[9.5px] leading-3" style={{ color: P.mute }}>
                Good evening
              </p>
              <p
                className="truncate text-[13px] font-semibold leading-4 tracking-[-0.02em]"
                style={{ color: P.ink }}
              >
                Member
              </p>
            </div>
          </div>

          <div
            className="flex items-center justify-between rounded-xl p-3.5"
            style={{ background: P.ink, color: '#fff' }}
          >
            <div>
              <p className="text-[9px] uppercase leading-3 tracking-[0.1em]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                This week
              </p>
              <p className="mt-0.5 text-[17px] font-semibold leading-5 tracking-[-0.03em]">4 sessions</p>
              <p className="text-[9.5px] leading-3" style={{ color: 'rgba(255,255,255,0.55)' }}>
                2-week streak
              </p>
            </div>
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums"
              style={{ border: `2px solid ${P.accent}` }}
            >
              80%
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl p-3" style={{ background: P.canvas }}>
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: 'rgba(225,6,0,0.08)' }}
            >
              <QrCode className="h-4 w-4" style={{ color: P.accent }} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] font-medium leading-4" style={{ color: P.ink }}>
                Check in to your gym
              </p>
              <p className="text-[9.5px] leading-3" style={{ color: P.mute }}>
                Scan the QR at the door
              </p>
            </div>
            <span style={{ color: P.mute }} aria-hidden>
              ›
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Steps', value: '7,420', of: 'of 10,000' },
              { label: 'Water', value: '6', of: 'of 10 glasses' },
            ].map((t) => (
              <div key={t.label} className="rounded-xl p-3" style={{ background: P.canvas }}>
                <p className="text-[9px] uppercase leading-3 tracking-[0.1em]" style={{ color: P.mute }}>
                  {t.label}
                </p>
                <p className="mt-0.5 text-[14px] font-semibold leading-4 tabular-nums" style={{ color: P.ink }}>
                  {t.value}
                </p>
                <p className="text-[9px] leading-3" style={{ color: P.mute }}>
                  {t.of}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-xl p-3" style={{ background: P.canvas }}>
            <p className="mb-1.5 text-[9px] uppercase leading-3 tracking-[0.1em]" style={{ color: P.mute }}>
              Next class
            </p>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[11.5px] font-medium leading-4" style={{ color: P.ink }}>
                  HIIT · Studio 2
                </p>
                <p className="truncate text-[9.5px] leading-3" style={{ color: P.mute }}>
                  Tomorrow 07:00 · Coach Meera
                </p>
              </div>
              <span
                className="shrink-0 rounded-pill px-2 py-0.5 text-[9px] leading-4"
                style={{ background: 'rgba(15,157,118,0.1)', color: P.good }}
              >
                Booked
              </span>
            </div>
          </div>
        </div>

        <div
          className="flex items-center justify-around px-1 py-2"
          style={{ background: P.canvas, borderTop: `1px solid ${P.line}` }}
        >
          {['Home', 'Workout', 'Classes', 'Progress', 'Community'].map((t, i) => (
            <span
              key={t}
              className="text-[8px] leading-3"
              style={i === 0 ? { color: P.accent, fontWeight: 600 } : { color: P.mute }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Hero composition: the dashboard with the member app overlapping its corner.
 * One object showing both halves of the product — the desk and the pocket.
 */
export function HeroComposition() {
  return (
    <div className="relative">
      <DashboardMockup />
      <div className="pointer-events-none absolute -bottom-10 right-2 hidden lg:block xl:-right-6">
        <PhoneMockup className="w-[212px] rotate-[3deg]" />
      </div>
    </div>
  );
}
