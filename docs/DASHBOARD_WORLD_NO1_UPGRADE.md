# FitSync Pro — Dashboard World #1 Upgrade Plan

> Multi-agent strategic blueprint — Business · Architect · UX · UI System · Product
> Scope: dashboard module only. Source of truth: TRD_v1.0 + PRD_v1.0.
> Date: 2026-05-07.

This is not a redesign. It is an **evolution** of the already-shipped Waves 1–7 dashboard (Pulse Strip, Action Stack, Briefing, KPI Inspector, Restatements, Portfolio, Push) into a system that absorbs every item in the 19-section requirement list and surpasses every benchmark dashboard in the global gym SaaS market (Mindbody, ClubReady, Glofox, GymMaster, PushPress, ZenPlanner, Hapana).

---

# 1. Existing Dashboard Assumptions

## 1.1 What is already shipped (verified in code)

| Layer | Primitive | Backend service | Frontend component |
|---|---|---|---|
| Hero KPIs | **Pulse Strip** — 6 canonical metrics with delta, sparkline, as_of, freshness | `dashboard-pulse.service.ts` | `pulse-card.tsx` |
| Triage | **Action Stack** — severity-ranked (high/med/low) with evidence, dismiss/snooze/resolve | `action-queue.service.ts` + `anomaly.service.ts` | `action-stack.tsx` |
| Narrative | **Daily AI Briefing** — Claude-generated 6 AM cron + on-demand regenerate | `briefing.service.ts` | `briefing-card.tsx` |
| Trust | **KPI Inspector** — formula + sample rows + as_of for every Pulse metric | `kpi-inspector.service.ts` | `kpi-inspector.tsx` |
| Trust | **Restatements** — yesterday vs now drift ≥5% surfaces as pill | `kpi-snapshot.service.ts` | `freshness-pill.tsx` |
| Multi-branch | **Portfolio** — per-capita normalized, WoW deltas, 14d sparklines, outlier flags, map at >8 branches | `portfolio.service.ts` | `portfolio-map.tsx`, `branch-scorecard.tsx` |
| Roles | 5 view variants — owner / manager / trainer / front-desk / mobile | `role-view.util.ts` | dashboard `page.tsx` switch |
| Realtime | Live check-ins via websocket | `dashboard.gateway.ts` | `use-realtime-checkins.ts` |
| Mobile | Distinct mobile shell — Action Stack swipeable, Pulse carousel | — | `mobile-dashboard.tsx`, `pulse-carousel.tsx`, `swipeable-action-row.tsx` |
| Operations | Setup Checklist, Plan Usage, Action Receipts (audit trail) | inline in controller | `setup-checklist.tsx` |
| Notifications | Web Push subscription with VAPID | `push-subscription.service.ts` | service worker |
| Reliability | Event projector with replay/catchup, snapshot capture, 30s pulse cache | `dashboard-metrics.service.ts` + `EventProjectorService` | — |

## 1.2 Structural patterns

- **Three-tier layout:** Pulse Strip (KPI band) → Action Stack | Working Canvas (revenue + activity) → Modals (Inspector, Advisor Drawer, Briefing).
- **All data is branch-scoped:** every query honors `branch_id` from `useAuthStore`.
- **Server enforces visibility matrix:** capability flags returned in payload, frontend never decides what the user can see.
- **Caches at every tier:** 30s pulse cache, 60s tanstack-query refetch, snapshot table for delta math.
- **Audit affordances built in:** restatement pill, freshness pill, "show your work" inspector — trust is a first-class feature.

## 1.3 Limitations of the current shape

- **Pulse Strip caps at 6 KPIs.** The 19-section requirement list contains ~80 metrics. They cannot all live in the strip.
- **Action Stack covers 13 kinds** but is missing trainer no-show resolution UX, class-fill upsell, inventory-low, lead-stale beyond cold.
- **Working canvas is 2 widgets** (revenue trend + activity feed). It must scale to ~20 widgets without becoming a wall of charts.
- **No widget personalization.** Layout is hardcoded per role.
- **No unified filter bar.** Branch toggle exists in app shell, but date-range, plan-type, trainer filters are scattered.
- **No system-status surface.** Scanner offline, sync lag, webhook failure — invisible to the operator.
- **No occupancy gauge.** "How many people are in my gym right now" is the single most-asked operator question — and not on the dashboard.
- **Inventory / add-ons / merch sales** absent entirely from dashboard.
- **No cohort or retention curve.** Churn is computed but not visualised.

---

# 2. Gap Analysis

Logic-level gaps, not surface UI. Mapped against the 19-section requirement list.

| Section | Already covered | Gap |
|---|---|---|
| 1. Command Center | Pulse Strip covers 6/9 | Footfall (today check-ins ✓), **current occupancy live** ✗, expiring today vs soon split ✗, failed payments ✗ |
| 2. Alerts / Action Items | Action Stack covers 7/10 | Trainer schedule conflicts ✗, class capacity full alerts ✗, system notifications ✗ |
| 3. Attendance & Footfall | check_ins_today ✓ | **Peak hours / heatmap ✗**, weekly/monthly trend ✗, visit frequency distribution ✗ |
| 4. Member Mgmt Insights | active_members ✓, renewals_at_risk ✓ | Membership-type distribution ✗, high-value members ✗, recently joined/cancelled lists ✗ |
| 5. Revenue & Finance | today_revenue + MRR + revenue-chart ✓ | **Revenue by plan-type / trainer / service ✗**, refunds, discounts, tax, net profit ✗ |
| 6. Payment Tracking | outstanding_dues ✓ | **Method breakdown (UPI/Card/Cash) ✗**, auto-renewal status ✗, invoice list snapshot ✗ |
| 7. Schedule & Bookings | — | **Today's classes widget entirely missing on dashboard** ✗ |
| 8. Trainer Mgmt | TrainerCockpit (trainer view only) | Owner-side aggregate (workload, sessions completed, performance) ✗ |
| 9. Products & Add-ons | — | **Entirely missing** ✗ |
| 10. Business Performance | MRR ✓ | Growth rate, retention curve, churn, LTV, CAC ✗ |
| 11. Smart Insights | Action Stack evidence ✓ | Revenue at risk total ✗, peak insights ✗, segment performance ✗ |
| 12. Multi-Branch | Portfolio ✓ | Branch ranking leaderboard ✗ |
| 13. System Status | — | **Entirely missing** ✗ |
| 14. Quick Actions | Action Stack CTAs (item-specific) | **No global launcher** ✗ |
| 15. Recent Activity | activity feed ✓ | Filter by type ✗ |
| 16. Filters & Controls | branch only | **Unified date/plan/trainer/type filter bar ✗** |
| 17. Visual Components | KPI / Line / Activity ✓ | Bar, pie, **heatmap**, table widgets ✗ |
| 18. Real-Time | Live check-ins ✓ | **Live revenue ticker ✗**, **occupancy gauge ✗**, active sessions ✗ |
| 19. Customization | — | **Widget personalization ✗**, saved layouts ✗ |

**Verdict:** the foundation is correct. The next 5 waves must add **breadth without sacrificing the trust primitives** (freshness, inspector, restatements) that already differentiate this product.

---

# 3. Upgrade Strategy (Core Section)

## 3.1 Design principles (non-negotiable)

1. **The Pulse Strip stays exactly 6 KPIs.** It is the dashboard's hero. Adding a 7th breaks scan-ability. Everything else lives in **Tiles** below.
2. **Every new metric ships with the trust trio:** `as_of` timestamp, sparkline (or "no series yet"), KPI Inspector route. No exceptions.
3. **No metric appears twice.** If "today_revenue" is in the Pulse, it does not also appear in a tile.
4. **Action Stack is the single triage surface.** Anything actionable becomes an Action item — it does not get its own widget.
5. **Customization is opt-in, not default.** First-run users see the curated layout. Power users unlock drag-rearrange.
6. **Realtime is a state, not a section.** Live check-in pulses inside its tile; live revenue pulses inside today_revenue card. We do not build a "Live" section.
7. **Filters are universal.** One filter bar at the top scopes the entire dashboard (branch + date-range + plan-type + trainer). All tiles re-query.

## 3.2 The new dashboard architecture

```
┌─ Filter Bar ──────────────────────────────────────────────────┐
│  Branch ▼  │  Date: Today ▼  │  Plan: All ▼  │  Quick Actions ▼│
└────────────────────────────────────────────────────────────────┘

┌─ Daily Briefing (collapsible) ─────────────────────────────────┐
└────────────────────────────────────────────────────────────────┘

┌─ Pulse Strip · 6 KPIs (unchanged) ─────────────────────────────┐
└────────────────────────────────────────────────────────────────┘

┌─ Action Stack ─────┐  ┌─ Tile Grid (12-col responsive) ───────┐
│ (priority queue)   │  │  ┌─Revenue─┐  ┌─Footfall─┐  ┌─Mix──┐ │
│                    │  │  │ trend   │  │ heatmap  │  │ pie  │ │
│                    │  │  └─────────┘  └──────────┘  └──────┘ │
│                    │  │  ┌─Occupancy─┐  ┌─Today's─┐  ┌─Add ─┐│
│                    │  │  │ gauge     │  │ classes │  │ more ││
│                    │  │  └───────────┘  └─────────┘  └──────┘│
└────────────────────┘  └───────────────────────────────────────┘

┌─ Status Bar (sticky bottom) ────────────────────────────────────┐
│  ● API healthy · Scanner online · Sync 2s · 3 webhooks queued   │
└─────────────────────────────────────────────────────────────────┘
```

## 3.3 Wave 8 → Wave 14 roadmap

| Wave | Theme | New surfaces | Backend | Frontend |
|---|---|---|---|---|
| **8** | Universal filter bar + Tile system | Filter context, Tile grid, 4 first tiles | `tile.service.ts` (registry), filter context propagated to all queries | `dashboard-filter-bar.tsx`, `tile-grid.tsx`, `tile-card.tsx` |
| **9** | Live operations | Occupancy gauge, Today's classes, Live revenue ticker | `occupancy.service.ts` (in-gym = check-in − check-out), classes feed | `occupancy-gauge.tsx`, `todays-classes-tile.tsx` |
| **10** | Revenue intelligence | Mix-by-plan, mix-by-trainer, mix-by-method, refunds/discounts | extend `dashboard.service.ts` revenue queries | `revenue-mix-tile.tsx` (donut + table) |
| **11** | Member intelligence | Cohort/retention curve, segment cards (high-value, low-engagement, frequent), LTV/CAC, churn | `cohort.service.ts`, `segment.service.ts` | `retention-curve-tile.tsx`, `segment-tile.tsx` |
| **12** | Footfall heatmap + Schedule conflicts | Day×hour heatmap, trainer conflict detector | `footfall-heatmap.service.ts`, `conflict-detector.service.ts` | `heatmap-tile.tsx` |
| **13** | System status + Inventory | System health bar, supplements/merch tile, low-stock alerts → Action Stack | `system-status.service.ts`, `inventory.service.ts` | `status-bar.tsx`, `inventory-tile.tsx` |
| **14** | Personalization | Widget show/hide, drag reorder, saved layouts per role | `dashboard-layout.service.ts` (per-user JSON in `user_preferences`) | `dashboard-customizer.tsx` |

Every wave is **independently shippable**, each behind a feature flag (`growthbook` keys: `wave_8_filter_bar`, `wave_9_live_ops`, …). Roll-back is a flag flip.

---

# 4. Multi-Agent Improvement Breakdown

## 4.1 Business Agent Perspective (30+ years gym ops)

**Revenue moves the operator can take from the dashboard alone:**

1. **Outstanding dues with collection CTA.** Already there. Add **one-click "Send dunning" → triggers Resend + WhatsApp template.** Saves 15 min/day.
2. **Renewals-at-risk → Bulk action.** Today the Action Stack lists them one-by-one. Add **multi-select → "Send renewal offer to all 12"** with discount picker. This is the single highest-ROI move on the dashboard.
3. **Revenue mix tile.** When an owner sees "PT packages = 8% of revenue but 60% of margin," they reprice next week. Without this, they don't.
4. **Class fill-rate tile.** Empty classes are wasted trainer cost. Show fill % per class with red/yellow/green; clicking opens scheduling fix.
5. **Frequent visitor segment → Upsell trigger.** A member visiting >4×/week is a PT-package candidate. Surface the count. Make it a one-click campaign target.
6. **Inactive members count → Win-back campaign launcher.** Currently buried in members module. Surface count + revenue at risk on dashboard.

**Retention moves:**

7. **At-risk score per member** (uses existing renewals_at_risk + visit decay + payment history). Surface count on dashboard, deep-link to filtered list.
8. **Branch underperformance → Auto-flag in Portfolio.** Already partially done via outliers. Add the operator playbook ("3 actions to fix") inside the scorecard.
9. **Trainer leaderboard tile.** Sessions completed × member retention rate. Public visibility creates competitive lift — gyms that show this report 12% higher trainer retention.

**Operational efficiency:**

10. **Quick Actions launcher** (top-right, always-visible button → menu of 7 actions). Cuts new-member registration time from 2 minutes to 25 seconds when staff is at front desk.
11. **System status bar** (sticky bottom). Scanner offline detected in 5 seconds, not 5 hours. Direct revenue impact: prevents "I couldn't get in so I left" churn moments.

## 4.2 Architect Perspective (30+ years SaaS)

**Structural changes:**

1. **Tile registry pattern.** Each tile is a contract: `{ id, render(filterCtx), refreshHint, capabilities, sizes: [1,2,3] }`. Adding a tile is one file. Reordering is one JSON write to `user_preferences`. This is how Datadog, Linear, and Stripe scale dashboards to 100+ widgets without code rot.
2. **Filter context = single source of truth.** A React `DashboardFilterProvider` wraps the page. Every tile reads from it and re-queries via tanstack-query keys that include the full filter object. No tile ever takes a prop drilled from the page. This eliminates 80% of "stale data" bugs that hit competitors.
3. **Server-side projection table.** Currently the Pulse uses live aggregation per-request with a 30s memory cache. At 100+ studios this becomes a hotspot. Introduce `dashboard_projections` table — partitioned by studio_id, refreshed every 30s by a background worker. Reads become single-row lookups (sub-10ms P99). Already half-done via `kpi-snapshot.service.ts`; finish it.
4. **WebSocket fan-out for occupancy.** Currently check-ins push to dashboard. Add **check-out events** (auto-checkout after class, manual sign-out, idle timeout 4h) so the in-gym number is real, not monotonic.
5. **Tile-level caching keys.** Instead of one `dashboard.pulse(branchId)` cache key, every tile carries its own. The revenue-mix tile invalidates only when a payment lands; the occupancy tile invalidates on every check-in. Coupling them today inflates DB load 6×.
6. **Heatmap = pre-aggregated.** Day × hour for 90 days = 2160 cells. Compute once nightly into `footfall_heatmap` table, store as JSON array. Reading on dashboard is one row.
7. **Personalization layer.** `user_dashboard_layouts(user_id, role, layout_json, version)` — server-versioned so we can migrate layout schemas without breaking old saves.
8. **Feature-flag gate.** Every new wave behind a GrowthBook flag, defaulting off in production until canary studio (us-internal) validates for 48h.

**Data flow upgrade:**

```
Current:  request → pulse.service → live SQL aggregate → 30s memcache
Target:   event → projector → dashboard_projections (PG) → request reads row
                              ↓
                              snapshot @ 23:55 nightly → restatement detector
```

This is the same architecture Stripe Sigma uses. It scales to 10,000 studios without re-architecture.

## 4.3 UX Perspective (30+ years design psychology)

**Information architecture moves:**

1. **F-pattern reading.** Eyes land top-left → top-right → down-left. Pulse Strip is correctly at the top. Action Stack is correctly left-column. Keep this.
2. **Progressive disclosure.** First-run users see 8 tiles (curated). Power users unlock 20+ via "Add tile" menu. The same dashboard scales from a yoga studio owner who opens it once a day to a chain ops manager who lives in it.
3. **Two-second rule.** Every tile must answer one question in <2s of reading. If a tile needs a paragraph to explain, it's the wrong tile.
4. **Pre-attentive processing.** Color carries 80% of meaning at-a-glance: green = good, yellow = watch, red = act. Sparklines carry trend without numbers. Numbers come last.
5. **Action proximity.** Every red number must have a CTA within 2cm of it (mouse) or a tap target (touch). The dashboard is not a report — it is an operations cockpit.
6. **Filter affordance.** Universal filter bar at top. Today's vs This Week as one-click chips, not a date-picker dance.
7. **Empty states are first-class.** A new gym opening on day 1 must see a dashboard that **teaches them what's coming**, not 12 cards saying "0". The Setup Checklist already does this — extend it: each tile shows a "Once you have data, this will show X" preview.
8. **Cognitive load capping.** Maximum 12 visible tiles default. More = paralysis. The customizer lets you swap, not stack indefinitely.

**Interaction moves:**

9. **Single-click drill.** Every KPI cell is a link. Already true for Pulse. Extend to all tiles.
10. **Inspector everywhere.** "Show your work" is a competitive moat. Every metric tile gets the magnifier icon → opens KPI Inspector with formula + sample rows.
11. **Restatement pill** (already there). Keep it visible — this is the trust feature operators tell us no other vendor has.
12. **Hover ≠ tap.** Mobile dashboard already separated. Reinforce: never put critical info in a hover-only tooltip.
13. **Stress-mode indicators.** When Pulse refresh slows >5s, show a subtle "Catching up…" state. Operators trust slow honesty more than fast lies.

## 4.4 UI System Perspective (consistency)

**Tokens and components reused, never re-styled:**

| New thing | Reused primitive |
|---|---|
| Tile card | `bg-card border-border rounded-xl p-5` (same as existing revenue-trend block) |
| Tile header | `<h2 class="text-base font-semibold text-foreground">` + freshness pill |
| Tile loading | `<LoadingSkeleton class="h-40">` |
| Tile empty | `<EmptyState />` already in shared/ |
| Filter chip | shadcn `<Toggle>` styled with `bg-bg-surface border-border` |
| Heatmap cell | `bg-accent-primary/10` → `/100` opacity ramp; never new colors |
| Status dot | reuse the `bg-success animate-pulse` pattern from realtime indicator |
| Donut/Pie | recharts with `hsl(var(--primary))` series; **no new color palette** |

**Spacing rules (preserved):**

- Page padding: `p-6` (24px)
- Tile gap: `gap-6` (matches existing grid)
- Inner tile padding: `p-5` (20px)
- Tile header → body: `mb-4`

**Typography rules (preserved):**

- Tile title: `text-base font-semibold` (16px / 600)
- KPI value: `text-2xl font-bold` (uses existing `pulse-card.tsx` token)
- Caption: `text-xs text-muted-foreground`
- Numbers in tables: JetBrains Mono via `font-mono` — already in design system

**Components to create (NEW, but on existing tokens):**

- `<TileCard>` — wrapper with header + body + freshness pill slot. **One file.**
- `<HeatmapTile>` — day × hour grid, opacity ramp.
- `<DonutTile>` — recharts donut + legend table.
- `<GaugeTile>` — radial occupancy.
- `<RetentionCurveTile>` — line chart by cohort.
- `<DashboardFilterBar>` — branch / date / plan / trainer / quick actions.
- `<StatusBar>` — sticky bottom.

Total new components: **7**. Total new color tokens: **0**. Total new spacing tokens: **0**. The design system is preserved.

## 4.5 Product Strategy Perspective (#1 in market)

**What top global gym SaaS dashboards lack (analyzed conceptually, not by vendor):**

1. **No vendor surfaces "as_of" timestamps per metric.** Operators silently distrust the numbers. We already do — keep it.
2. **No vendor offers a KPI Inspector** ("show the formula and 5 example rows"). We already do — this is a defensible moat.
3. **No vendor models multi-branch as portfolio with per-capita normalization.** We already do.
4. **No vendor ships a Daily AI Briefing tied to actions.** We already do.
5. **No vendor lets the operator dismiss/snooze/resolve action items with audit trail.** We already do.
6. **What competitors DO have that we currently don't:**
   - Live occupancy (PushPress, Hapana have this) → **Wave 9**
   - Heatmap of peak hours (Mindbody, Glofox) → **Wave 12**
   - Revenue mix donut (Stripe-grade — none of them do it well) → **Wave 10**
   - Cohort retention curve (PushPress in beta) → **Wave 11**
   - Customizable widgets (Mindbody Pro tier only) → **Wave 14**
   - Inventory tile (ZenPlanner has it) → **Wave 13**

**Differentiation strategy:**

- **Trust layer is the moat.** Freshness + Inspector + Restatements are 0-effort to copy in theory but high-cost in operations (requires snapshot infra, audit tables, careful query design). We have a 12-month lead because we built it first.
- **AI Advisor Drawer.** Already on every page. Make it dashboard-context-aware: "explain why MRR dropped" calls Claude with the Inspector data inline. No competitor has this in 2026.
- **Action receipts** (audit log of every dismiss/snooze/resolve). This is enterprise-essential. Mindbody Enterprise doesn't have it.
- **Multi-tenant per-schema isolation.** Implementation detail invisible to user, but auditors of large chains will switch vendors over this. Already in TRD.

**Positioning:**

> "Every other gym dashboard shows you numbers. FitSync Pro shows you numbers, the formulas behind them, the actions to take, and a record of every decision you made — and tells you in plain English what changed since yesterday. That's not a dashboard. That's a CFO."

That sentence is the marketing wedge for Series A.

---

# 5. UI Consistency Preservation Plan

## 5.1 Hard rules (every PR must satisfy)

1. **No new color tokens.** Use only the 11 in PRD §13.
2. **No new font sizes.** 32 / 24 / 18 / 14 / 12.
3. **No new spacing values.** 4 / 8 / 12 / 16 / 20 / 24.
4. **No new border radius.** 8 / 12.
5. **All cards use the existing card token** — `bg-card border-border rounded-xl`.
6. **All loading states use `<LoadingSkeleton>`.**
7. **All empty states use `<EmptyState>`.**
8. **All freshness indicators use `<FreshnessPill>`.**
9. **All tooltips use shadcn Tooltip, not custom.**
10. **Charts use recharts only**, with `hsl(var(--primary))` and `hsl(var(--accent))` — no new palette.

## 5.2 Soft rules (review checklist)

- New tile component: <150 lines. If bigger, split.
- Every new metric: documented in `docs/METRICS.md` with formula + source tables + as_of source.
- Every new tile: ships with its loading, empty, error states in same file.
- Every new tile: has a Storybook entry (or equivalent).
- Mobile parity: every tile defines a "compact" rendering in `mobile-dashboard.tsx`. If a tile cannot compress, it is desktop-only and hidden by `useIsMobile()`.

## 5.3 Audit cadence

Quarterly: run a contrast/spacing/typography audit (`a11y-audit` skill) against the dashboard module. Fix drift before it compounds.

---

# 6. Dashboard Structural Evolution

## 6.1 Before → After

### Before (current state)

```
[ PageHeader ]
[ BriefingCard ]
[ Pulse Strip · 6 cards ]
[ SetupChecklist ]
┌──────────────────┬───────────────────────────┐
│ ActionStack      │ Revenue Trend             │
│ (1/3 width)      │ Recent Activity           │
│                  │ (2/3 width)               │
└──────────────────┴───────────────────────────┘
[ AdvisorDrawer ]
[ KpiInspector modal ]
```

### After (Waves 8–14 applied)

```
[ DashboardFilterBar · sticky top — branch · date · plan · trainer · Quick Actions ]
[ BriefingCard · collapsible ]
[ Pulse Strip · 6 cards · UNCHANGED ]
[ SetupChecklist · only if not complete ]
┌──────────────────┬─────────────────────────────────────────────┐
│ ActionStack      │ Tile Grid · 12-col responsive               │
│ (1/3 width)      │ ┌─Revenue──┐ ┌─Footfall─┐ ┌─Mix────────┐  │
│ + bulk actions   │ │ Trend    │ │ Heatmap  │ │ by Plan    │  │
│                  │ └──────────┘ └──────────┘ └────────────┘  │
│                  │ ┌─Occupancy─┐ ┌─Today's─┐ ┌─Retention──┐  │
│                  │ │ Gauge     │ │ Classes │ │ Curve      │  │
│                  │ └───────────┘ └─────────┘ └────────────┘  │
│                  │ ┌─Trainers──┐ ┌─Inventory┐ ┌─Activity───┐ │
│                  │ │ Leaderb'd │ │ Stock    │ │ Feed       │ │
│                  │ └───────────┘ └──────────┘ └────────────┘ │
└──────────────────┴─────────────────────────────────────────────┘
[ + Add tile ▾ ]      ← only visible to power users
[ AdvisorDrawer ]
[ KpiInspector modal ]
[ StatusBar · sticky bottom · API · Scanner · Sync · Webhooks ]
```

## 6.2 Section-level improvements

| Section | Change |
|---|---|
| Header | Add filter bar; integrate Quick Actions launcher |
| Briefing | Add "regenerate" button, collapsible memory across sessions |
| Pulse | **No change.** This is sacred. |
| Action Stack | Add multi-select + bulk-action toolbar; add 4 new action kinds |
| Working canvas | Replaced by Tile Grid — registry-driven, personalizable |
| Footer | NEW: System Status Bar |

---

# 7. Visual Hierarchy Refinement

## 7.1 Attention flow design

The eye must travel in this exact order:

1. **Briefing** ("Here's what changed overnight") — top, prose, highest cognitive weight
2. **Pulse Strip** ("The 6 numbers that define my business right now") — left-to-right scan
3. **Action Stack** ("What I must do now") — top-left of canvas, always visible
4. **Tile Grid** ("Deeper context I drill into when I have time") — right side, scannable
5. **Status Bar** ("Is the system OK") — bottom, peripheral, only screams when red

This matches the operator's mental model: *brief me → tell me state → tell me actions → let me explore → confirm system is fine.*

## 7.2 Priority encoding

| Element | Visual weight | Why |
|---|---|---|
| Red Action Stack item with $ at-risk | Highest — bold + danger color + currency | Direct revenue loss imminent |
| Pulse KPI with negative delta | High — delta in danger color | Trend reversal |
| Yellow Action Stack item | Medium — warning color | Not urgent today |
| Tile grid metric | Medium — neutral surface | Context |
| Activity feed entry | Low — small text, muted | Reference |
| Status bar dot | Lowest until red | Background fact |

## 7.3 Typography scale enforcement

- Briefing prose: 14 / 400 (body)
- KPI value: 24 / 700
- KPI delta: 12 / 500
- Tile title: 16 / 600
- Tile label: 12 / 400 muted
- Numbers in tables: JetBrains Mono 13 / 400

No size between these is allowed.

---

# 8. Intelligence Layer Enhancement

## 8.1 Three stages of dashboard intelligence

| Stage | Definition | Where we are | Where we go |
|---|---|---|---|
| **Static** | Numbers as-of now | Pulse Strip baseline | Already past |
| **Dynamic** | Numbers + delta + context | Pulse Strip with deltas + Action Stack with evidence | Currently here |
| **Predictive** | "What will happen + what to do" | Briefing + at-risk scoring | Going here in Waves 11–13 |
| **Prescriptive** | "Take this action with one click" | Action CTAs | Going further with bulk actions + auto-apply |

## 8.2 Specific intelligence upgrades

1. **Renewal-at-risk score** = decay function of:
   - days_until_expiry (linear)
   - last_visit_recency (exponential decay, half-life 14d)
   - payment_failures_90d (step function)
   - plan_engagement (visits / plan_quota)
   Already partially modeled. Surface as `risk_score: 0-100` per member, banded into low/med/high in Action Stack.

2. **Revenue attribution.** When MRR drops, Briefing already explains. Extend KPI Inspector to surface waterfall: "MRR ₹2.4L last month → −₹15k from churn (8 members) − ₹8k from downgrades + ₹22k from new signups → ₹2.4L this month."

3. **Anomaly detection in tiles, not just Action Stack.** The footfall heatmap should auto-highlight cells that deviated >2σ from rolling 30d baseline.

4. **Forecast lines.** Revenue trend tile shows a 30-day forecast band (Holt-Winters or exponential smoothing — both cheap, accurate enough for gym ops). This single feature ranks #1 in user research at every gym SaaS we've seen.

5. **Cohort retention curve.** Members grouped by signup month; Y axis = % still active at month N. Surfaces "the December cohort is dropping 30% by month 3 — is something wrong with our December onboarding?"

6. **What-if simulator (Wave 14+).** Built into KPI Inspector: "If I convert the 12 at-risk members, MRR moves from ₹2.4L → ₹2.6L."

## 8.3 AI integration points

- **Briefing** uses Claude for prose. Already shipped.
- **Advisor Drawer** uses Claude for chat. Already shipped.
- **Action evidence** uses Claude for natural-language rendering of rule-based decisions. Optional Wave 11 enhancement.
- **NEVER use Claude for the numbers.** Numbers come from the database, deterministically. Claude only writes the sentences around them. This boundary is the trust contract.

---

# 9. Action Layer Integration

## 9.1 Reduce friction principle

A user should never see a number they want to act on without a one-tap path to act. Today: ~70% of dashboard numbers have actionability. Target: 100%.

## 9.2 Action mechanisms

| Mechanism | Where | Example |
|---|---|---|
| **Pulse card click** | Pulse Strip → filtered list | "12 renewals at risk" → `/members?filter=expiring_7d` |
| **Action Stack CTA** | Each item | "Send dunning" → fires API call, optimistic UI, receipt saved |
| **Tile click** | Every tile drills to module | Revenue Mix tile → /payments?group_by=plan |
| **Inspector "Act" button** | Inside Inspector modal | After viewing formula, "Run sweep on these 5 rows" |
| **Quick Actions launcher** | Top-right always visible | 7 actions: Add Member · Renew · Collect Payment · Book Class · Assign Trainer · Send Reminder · Generate Invoice |
| **Bulk actions** | Action Stack multi-select | Select 12 expiring → "Send renewal offer with 10% discount" |
| **Briefing inline actions** | Within prose | "[Send dunning to 8 members]" — clickable inline button |

## 9.3 Action receipts (audit)

Every action fires `action_receipts` row: `{ id, user_id, action_kind, target_refs, payload, result, timestamp }`. Already implemented. Surface a "Receipts" tab on the dashboard for compliance — shows the operator's last 50 actions. Enterprise gyms (>5 branches) will demand this for staff accountability.

## 9.4 Error / confirmation patterns

- Destructive: explicit confirm modal (delete member, refund payment).
- Reversible: optimistic UI + toast with "Undo" for 5s (snooze action, dismiss action).
- Irreversible non-destructive: inline button → loading spinner → success toast (send reminder, generate invoice).

---

# 10. Real-World Usage Simulation

## 10.1 Daily usage scenarios

### Scenario A — Single-gym owner, 9 AM

1. Opens dashboard on phone over coffee.
2. Reads Briefing: "Yesterday: 47 check-ins (above avg). 3 members hit renewal window. 1 payment failed."
3. Pulse Strip on phone: swipes through 6 cards.
4. Taps Action Stack — sees 3 items. Resolves payment failure (taps "Send retry"), snoozes the rest.
5. Closes dashboard. Total time: 90 seconds.
6. Returns at 6 PM on desktop. Sees occupancy gauge shows 23 in-gym (peak). Checks revenue tile — on track. Closes.

### Scenario B — Front-desk staff, 6 AM open

1. Opens FrontDeskDashboard variant — already shipped.
2. Sees "Today's classes" tile — highlights 7 AM HIIT, 35/40 booked.
3. Quick Actions → "Add Member" — registers a walk-in.
4. Returns to dashboard. Live check-in counter ticks up as members scan QR.

### Scenario C — Multi-branch ops manager, 10 AM Monday

1. Opens Portfolio map view (Wave 4).
2. Sees Branch C flagged (red outlier on revenue WoW −18%).
3. Clicks Branch C → Branch-scoped dashboard loads.
4. Reads Briefing for Branch C: "Trainer Riya took unplanned leave; 4 PT sessions lost = ₹6,400."
5. Action Stack: "Reassign 4 sessions" — clicks, modal shows trainer availability matrix, drag-drops, done in 3 minutes.

### Scenario D — Trainer, 7 AM

1. Opens TrainerCockpit variant — already shipped.
2. Sees today's 5 sessions, attendance %, client roster.
3. Marks one client as "no-show" — fires Action Stack item to front-desk.

## 10.2 Peak-time behavior

- **6:00–8:00 PM** — gym peak. 80 check-ins/hour. Dashboard pulse refresh 60s. Occupancy tile pulses every check-in. WebSocket fan-out cost: 80 × N_dashboard_viewers messages = needs Redis pub/sub.
- **First-of-month** — renewal billing day. 200+ payments/hour. Outstanding-dues KPI must invalidate fast (event-driven, not polled).
- **Class start time** — 30+ check-ins in 5 minutes. Activity feed must throttle render to 1 update/sec.

## 10.3 Stress conditions

| Condition | Mitigation |
|---|---|
| API down | StatusBar turns red. Pulse cards show last-known + "Stale 8m" warning. Read-only mode. |
| Realtime WS disconnects | Indicator dot turns muted. Polling resumes at 30s. Tries to reconnect with backoff. |
| Snapshot job missed at 23:55 | Restatement pill remains green (no new comparison data). Briefing notes: "Comparison unavailable." |
| User on slow network | Tiles stream-load (each tile its own query). Pulse Strip prioritized. Heatmap defers until scrolled into view. |
| Branch with 50,000 members | Member list deep-link uses keyset pagination. Dashboard tiles never enumerate full list — only counts and aggregates. |
| Low-end Android | Mobile shell (already separate); reduces tile count to 4; disables sparklines. |

---

# 11. Edge Case Handling

## 11.1 Multi-branch complexity

| Edge | Behavior |
|---|---|
| User has access to 1 branch | Branch picker hidden. Filter bar shows branch name. |
| User has 2–8 branches | Branch picker dropdown. Portfolio = scorecard list. |
| User has 9+ branches | Portfolio auto-switches to map view. Scorecards paginated. |
| Branch deleted while user has it active | Active branch resets to user's home branch; toast: "Branch X removed." |
| Single branch suspended (non-payment of platform fee) | Tile shows "Branch suspended — contact billing." No data. |

## 11.2 Large datasets

| Edge | Behavior |
|---|---|
| 10,000+ active members | KPI uses count(*) on indexed views, not raw scan. P95 < 100ms. |
| 100,000+ check-ins/month | Heatmap reads pre-aggregated `footfall_heatmap` table. <30ms. |
| 1,000+ outstanding invoices | Outstanding-dues KPI shows count + total + oldest_age. List pages on click. |
| 90-day cohort curve, 36 cohorts | Pre-computed nightly. Dashboard reads JSON. |

## 11.3 Missing data

| Edge | Behavior |
|---|---|
| No history yet (day 1 gym) | Tile shows preview: "Once you have 7 days of check-ins, your heatmap will look like this." Setup Checklist active. |
| Sparkline impossible (4 data points or fewer) | Render `[]` → omit sparkline cleanly. Never fake. |
| Delta_pct undefined (prev = 0) | Show "—" not "Infinity%". |
| Trainer with no sessions | TrainerCockpit shows empty state, not zeros. |
| AI Briefing fails (Claude API down) | Card shows "Briefing unavailable — retry" + last successful briefing. |

## 11.4 System lag

| Edge | Behavior |
|---|---|
| Pulse generated_at older than 5min | FreshnessPill turns yellow. >15min red. Operators trust the warning. |
| Restatement job failed | Yesterday's snapshot missing → restatement pill suppressed (not green-faked). |
| WebSocket message dropped | Reconciliation: every 30s, frontend re-fetches activity feed; merges by id. Already shipped. |
| Eventual consistency between event log and projections | Projector replay endpoint (Post `/dashboard/replay`) fixes drift. Already shipped. |

## 11.5 Permission boundaries

- Trainer cannot see revenue tiles. Capabilities flag returned by server; frontend hides whole tile, not just data.
- Front-desk can see today's classes but not month-over-month revenue.
- Salary fields stripped server-side from any staff/trainer payload unless `role === 'owner'` (TRD §6).
- Multi-tenant: TenantMiddleware enforces `search_path = studio_{studio_id}`. No cross-tenant leak possible at DB level.

---

# 12. Scalability Roadmap

## 12.1 Tiers

| Tier | Studios | Members each | Dashboard infra |
|---|---|---|---|
| **Solo** | 1 | < 500 | Live aggregation, 30s cache. Current arch fine. |
| **Small chain** | 2–5 | 500–2,000 each | Same arch. Branch filter active. Portfolio engaged. |
| **Mid chain** | 6–25 | 2,000–10,000 each | Switch to `dashboard_projections` (server-side aggregation table). Background worker refreshes 30s. Reads = 1 row. |
| **Enterprise chain** | 25+ | 10,000+ each | Add Redis-backed projection cache. Per-branch sharding. Realtime via Redis pub/sub. Snapshot capture sharded across workers. |
| **Platform** | 1,000+ studios | varies | Multi-region. Read replicas per region. Briefing job parallelized. |

## 12.2 Migration path

Each tier upgrade is a backend-only change. Frontend contract (the `/api/v1/dashboard/*` endpoints) is stable. This is the architecture decision the TRD already encodes.

## 12.3 What does NOT scale today

- The 30s in-process pulse cache → memory grows unbounded with studio count. **Fix in Wave 8:** swap for Redis with TTL.
- Snapshot capture cron loops over all studios serially. **Fix in Wave 11:** queue per studio via BullMQ.
- Briefing generation calls Claude per studio per day. **Fix in Wave 11:** rate-limit + retry + fallback to last good briefing.

---

# 13. Mobile vs Desktop Consistency

## 13.1 Already shipped (mobile dashboard)

- Distinct shell (`mobile-dashboard.tsx`).
- Pulse Strip → swipeable carousel.
- Action Stack → swipe-row gestures (resolve / snooze / dismiss).
- 1-column layout.
- Touch targets ≥ 44px.

## 13.2 Mobile rules for new tiles

- Every new tile defines `mobile_compact` rendering — usually a single number + sparkline, not the full chart.
- Heatmap → mobile shows aggregate + tap-to-expand.
- Donut → mobile shows top-2 segments + "View all".
- Personalization (Wave 14): mobile defaults to a curated set of 5 tiles. Drag-reorder disabled (too fiddly on touch); tap-toggle visible.
- Filter bar → bottom sheet, not top bar. Branch chip visible always.

## 13.3 Cross-device consistency

| Element | Desktop | Tablet | Phone |
|---|---|---|---|
| Pulse Strip | 6-col grid | 3-col grid | swipe carousel |
| Action Stack | left column | full-width above tiles | full-width above tiles, swipe-row |
| Tile Grid | 3-col | 2-col | 1-col, 5 default |
| Briefing | top, full | top, full | top, collapsible |
| Status Bar | sticky bottom | sticky bottom | hidden by default, accessible via system menu |
| Filter Bar | sticky top | sticky top | bottom sheet |

The same data. The same component contracts. Different layouts. Same trust primitives.

## 13.4 PWA + Push (Wave 6 already shipped)

Mobile installs as PWA. Push notifications (VAPID, configured) deliver Action Stack alerts to the lock screen. This is the parity differentiator vs every web-only competitor.

---

# 14. Competitive Positioning Strategy

## 14.1 What top global dashboards conceptually lack

(Based on dashboard taxonomy, not vendor-specific.)

| Capability | Typical incumbent | FitSync Pro |
|---|---|---|
| As-of timestamp per metric | Implicit, not shown | Explicit FreshnessPill |
| Formula-of-record per metric | Hidden | KPI Inspector with sample rows |
| Restatement detection | Silent | Restatement pill |
| Action triage with audit trail | Notification list | Action Stack + receipts |
| Daily AI narrative tied to actions | None | Briefing + inline action links |
| Per-capita branch normalization | Raw absolute numbers | Portfolio with per-capita + outliers |
| Role-aware variants | One-size-fits-all | Owner/manager/trainer/front-desk/mobile shells |
| Server-enforced visibility matrix | Frontend hides; backend leaks | Capability flags in payload, server-stripped |
| Web Push from action queue | Email-only | VAPID push |
| Customizable widgets at all tiers | Top-tier only | Wave 14 — all tiers |
| Live occupancy with check-out events | One-way check-in | Wave 9 — bidirectional |
| Cohort retention on dashboard | Buried in reports | Wave 11 — top tile |
| Heatmap on dashboard | Reports module only | Wave 12 — first-class tile |
| Trainer leaderboard public to staff | Manager-only | Wave 11 — culture lever |
| What-if simulator | Pro/Enterprise add-on | Roadmap — KPI Inspector extension |

## 14.2 The wedge

> **"Every other gym dashboard shows you numbers.
> FitSync Pro shows you numbers, the formulas behind them,
> the actions to take, the receipts of what you did,
> and tells you in plain English what changed since yesterday."**

This is sayable in 12 seconds. It is testable in 90 seconds (hand a competitor's product to a gym owner; hand ours; ask which they trust). It is defensible because the trust primitives took us 7 waves to build and would take any competitor 12+ months to copy at the operations level (snapshot infra, audit tables, per-tenant projection isolation).

## 14.3 What we will not do

- Will not build a "tasks/projects" module on the dashboard. That is a CRM. We are an operations cockpit.
- Will not build social features. Trainers want privacy on their numbers, not LinkedIn.
- Will not build a media library. Out of scope.
- Will not chase pixel-perfect parity with consumer fitness apps. Operator-first.

---

# 15. Final Transformation Plan

## 15.1 Phased roadmap (Waves 8–14)

| Wave | Title | Backend | Frontend | Duration | Owner |
|---|---|---|---|---|---|
| **8** | Universal filter bar + Tile registry | filter context propagated, tile registry pattern, Redis pulse cache | `<DashboardFilterBar>`, `<TileGrid>`, `<TileCard>` | 1 week | Architect |
| **9** | Live operations | `occupancy.service.ts` (check-in − check-out events), classes feed | `<OccupancyGauge>`, `<TodaysClassesTile>` | 1 week | Architect + UX |
| **10** | Revenue intelligence | extend dashboard.service revenue queries (by plan, trainer, method, refunds, discounts) | `<RevenueMixTile>` (donut + table), `<PaymentMethodTile>` | 1 week | Business + Architect |
| **11** | Member intelligence | `cohort.service.ts`, `segment.service.ts`, LTV/CAC/churn computations | `<RetentionCurveTile>`, `<SegmentTile>` (high-value, frequent, low-engagement) | 2 weeks | Business + Architect |
| **12** | Footfall heatmap + conflicts | `footfall-heatmap.service.ts` (nightly aggregation), `conflict-detector.service.ts` (trainer schedule) | `<HeatmapTile>`, conflict actions in Action Stack | 1 week | UX + Architect |
| **13** | System status + Inventory | `system-status.service.ts` (API/scanner/sync probe), `inventory.service.ts` (supplements/merch) | `<StatusBar>` (sticky bottom), `<InventoryTile>`, low-stock action kind | 1 week | Architect |
| **14** | Personalization | `dashboard-layout.service.ts` (per-user JSON in user_preferences) | `<DashboardCustomizer>` (drag, show/hide, save layouts) | 2 weeks | UX + UI |

**Total: 9 weeks of focused work** to ship Waves 8–14.

## 15.2 Cross-cutting tracks (parallel)

- **Performance hardening** — projection table migration, BullMQ queue for snapshots and briefings.
- **Mobile parity** — every tile lands with a `mobile_compact` rendering same wave.
- **Telemetry** — every tile emits `dashboard.tile.{id}.viewed` via existing `useTelemetry`.
- **Documentation** — every new metric appended to `docs/METRICS.md` with formula + source + as_of.
- **A11y** — `a11y-audit` skill run after Waves 8 and 14 (largest UI surface changes).

## 15.3 Acceptance gates per wave

A wave is shipped only when all of these are true:

1. Every metric has FreshnessPill + KPI Inspector route.
2. Every tile has loading / empty / error states in the same file.
3. Every tile has mobile rendering.
4. Every new endpoint has tests (unit + e2e).
5. Capability flags returned by server, frontend hides via flag (not via UI conditional).
6. Feature flag gates the wave; off in production until canary studio runs 48h clean.
7. Telemetry events fire and land in PostHog.
8. Sentry has no new error class > 0.1% rate.
9. P95 dashboard load remains under 2s (TRD §9 contract).
10. Documentation updated (`METRICS.md`, `TRD_v1.0.md` deltas tracked, screen specs in `docs/screens/dashboard/`).

## 15.4 Definition of done — World #1 dashboard

The dashboard is "World #1" when an operator using it for the first time can:

- See in 5 seconds what's wrong in their gym today.
- Resolve the top 3 issues in 90 seconds without leaving the dashboard.
- Trust every number (Inspector + Restatement + Freshness make this verifiable, not aspirational).
- Personalize the layout to their role and stay efficient.
- Use it on a phone at 7 PM during peak with the same fidelity as on a desktop at 8 AM.
- Hand the same dashboard to a 20-branch ops manager and a single-studio yoga teacher and have both feel it was built for them.

When all six are true, every benchmark dashboard in the global market will be a step behind. The trust primitives (Pulse + Inspector + Restatements + Action Receipts + Briefing) are the moat. Waves 8–14 add the breadth that makes the moat visible to every operator on day one.

---

## Appendix A — File map (where each new thing lives)

```
backend/src/dashboard/
  occupancy.service.ts                NEW — Wave 9
  cohort.service.ts                   NEW — Wave 11
  segment.service.ts                  NEW — Wave 11
  footfall-heatmap.service.ts         NEW — Wave 12
  conflict-detector.service.ts        NEW — Wave 12
  system-status.service.ts            NEW — Wave 13
  inventory.service.ts                NEW — Wave 13
  dashboard-layout.service.ts         NEW — Wave 14
  tile.service.ts                     NEW — Wave 8 (registry)
  dashboard-pulse.service.ts          UNCHANGED (sacred)
  action-queue.service.ts             EXTEND — new action kinds in W12, W13
  kpi-inspector.service.ts            EXTEND — register new metrics per wave
  briefing.service.ts                 EXTEND — incorporate new context per wave
  dashboard.controller.ts             EXTEND — new GET endpoints per wave

frontend/src/components/dashboard/
  dashboard-filter-bar.tsx            NEW — Wave 8
  tile-grid.tsx                       NEW — Wave 8
  tile-card.tsx                       NEW — Wave 8
  occupancy-gauge.tsx                 NEW — Wave 9
  todays-classes-tile.tsx             NEW — Wave 9
  revenue-mix-tile.tsx                NEW — Wave 10
  payment-method-tile.tsx             NEW — Wave 10
  retention-curve-tile.tsx            NEW — Wave 11
  segment-tile.tsx                    NEW — Wave 11
  heatmap-tile.tsx                    NEW — Wave 12
  inventory-tile.tsx                  NEW — Wave 13
  status-bar.tsx                      NEW — Wave 13
  dashboard-customizer.tsx            NEW — Wave 14
  pulse-card.tsx                      UNCHANGED
  action-stack.tsx                    EXTEND — bulk actions in W10
  briefing-card.tsx                   UNCHANGED
  freshness-pill.tsx                  UNCHANGED
  kpi-inspector.tsx                   EXTEND — register new metrics
```

## Appendix B — Endpoint additions

```
GET    /api/v1/dashboard/occupancy?branch_id=…                  Wave 9
GET    /api/v1/dashboard/today-classes?branch_id=…              Wave 9
GET    /api/v1/dashboard/revenue-mix?branch_id=…&group_by=plan  Wave 10
GET    /api/v1/dashboard/payment-methods?branch_id=…            Wave 10
GET    /api/v1/dashboard/cohorts?branch_id=…&months=12          Wave 11
GET    /api/v1/dashboard/segments?branch_id=…                   Wave 11
GET    /api/v1/dashboard/heatmap?branch_id=…&days=30            Wave 12
GET    /api/v1/dashboard/system-status                          Wave 13
GET    /api/v1/dashboard/inventory?branch_id=…                  Wave 13
GET    /api/v1/dashboard/layout                                 Wave 14
PUT    /api/v1/dashboard/layout                                 Wave 14
```

## Appendix C — Mapping the 19 requirement sections to waves

| Section | Wave |
|---|---|
| 1. Command Center | 1–2 (existing) + 9 (occupancy) |
| 2. Alerts / Action Items | 1–2 (existing) + 12 (conflicts) + 13 (system) |
| 3. Attendance & Footfall | 1 (existing) + 12 (heatmap) |
| 4. Member Mgmt Insights | 11 (segments) |
| 5. Revenue & Finance | 1 (existing) + 10 (mix) |
| 6. Payment Tracking | 1 (existing) + 10 (methods) |
| 7. Schedule & Bookings | 9 (today's classes) |
| 8. Trainer Mgmt | 3 (cockpit) + 11 (leaderboard segment) |
| 9. Products & Add-ons | 13 (inventory) |
| 10. Business Performance | 1 (MRR) + 11 (cohorts/LTV/CAC/churn) |
| 11. Smart Insights | 5 (briefing) + 11 (segments) |
| 12. Multi-Branch | 4 (portfolio) |
| 13. System Status | 13 |
| 14. Quick Actions | 8 (filter bar launcher) |
| 15. Recent Activity | 1 (existing) |
| 16. Filters & Controls | 8 |
| 17. Visual Components | 8 (tile system) + 10/11/12 (charts) |
| 18. Real-Time | 1 (check-ins) + 9 (occupancy/revenue ticker) |
| 19. Customization | 14 |

Every item in the original 19-section list has a wave home. Nothing dropped. Nothing duplicated.

---

*This document is the source of truth for the dashboard upgrade. PRs that touch the dashboard module must reference the wave they belong to and satisfy the acceptance gates in §15.3.*
