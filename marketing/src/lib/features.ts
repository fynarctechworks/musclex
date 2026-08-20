/**
 * Feature content for the marketing site.
 *
 * Every capability listed here maps to a module that exists in the repo —
 * `backend/src/<module>` and/or `frontend/src/features/<module>` — so the site
 * never advertises something the product doesn't ship. The `evidence` field
 * records where each group comes from; keep it accurate when editing copy.
 */

import {
  Activity,
  BadgeIndianRupee,
  BarChart3,
  Bot,
  Boxes,
  Building2,
  CalendarDays,
  CreditCard,
  Fingerprint,
  Gift,
  LayoutDashboard,
  MessageSquare,
  QrCode,
  ScanFace,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Users,
  UserCog,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface FeatureGroup {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  icon: LucideIcon;
  /** Repo modules this group is drawn from — internal note, not rendered. */
  evidence: string;
  items: { title: string; description: string }[];
}

export const featureGroups: FeatureGroup[] = [
  {
    id: 'members',
    eyebrow: 'members',
    title: 'Members and memberships',
    summary:
      'One record per member, from the first enquiry to the renewal that keeps them. Plans, freezes, upgrades and proration are handled by the system rather than by a spreadsheet someone forgot to update.',
    icon: Users,
    evidence: 'backend/src/members, backend/src/plans, frontend/src/features/{members,memberships,plans,tags}',
    items: [
      {
        title: 'Complete member profiles',
        description:
          'Contact details, documents, membership history, attendance, payments and notes on a single profile, not scattered across four tools.',
      },
      {
        title: 'Membership plans',
        description:
          'Build the plan catalogue your studio actually sells: durations, pricing, session packs, joining fees and taxes.',
      },
      {
        title: 'Renewals and expiry tracking',
        description:
          'Expiring memberships surface before they lapse, with automated reminders so renewal is a conversation, not an archaeology exercise.',
      },
      {
        title: 'Plan changes and proration',
        description:
          'Upgrades, downgrades and mid-cycle changes are priced automatically, so the invoice matches what the member was told.',
      },
      {
        title: 'Tags and segments',
        description:
          'Tag members by behaviour, plan or interest and reuse those segments in campaigns and reports.',
      },
      {
        title: 'Leads and CRM',
        description:
          'Capture walk-ins, trials and enquiries, track them through your pipeline, and convert without re-keying anything.',
      },
    ],
  },
  {
    id: 'check-in',
    eyebrow: 'attendance',
    title: 'Check-in and attendance',
    summary:
      'The check-in is the single most valuable signal your gym produces. MuscleX captures it four different ways so it is never skipped, then feeds it straight into retention and analytics.',
    icon: QrCode,
    evidence: 'backend/src/check-ins/{qr,facial,biometric,devices,policy}, frontend/src/app/[gymSlug]/{check-in,kiosk}',
    items: [
      {
        title: 'QR check-in',
        description:
          'Members scan at the door from their phone. No queue at the desk, no paper register.',
      },
      {
        title: 'Facial recognition',
        description:
          'On-device face matching for a hands-free entry lane, with descriptors treated as protected data and never returned by the API.',
      },
      {
        title: 'Biometric device support',
        description:
          'Register the access-control hardware you already own and stream its events into the same attendance log.',
      },
      {
        title: 'Front-desk and kiosk modes',
        description:
          'A dedicated kiosk view per branch for tablets at the entrance, plus manual check-in for the desk.',
      },
      {
        title: 'Access policy',
        description:
          'Rules decide who gets in: expired memberships, dues outstanding, branch entitlements and class bookings, all enforced at the door.',
      },
      {
        title: 'Live attendance',
        description:
          'A real-time feed over websockets: who is in the building right now, and how today compares to last week.',
      },
    ],
  },
  {
    id: 'classes',
    eyebrow: 'scheduling',
    title: 'Classes and scheduling',
    summary:
      'Run the timetable your studio actually operates: recurring sessions, capacity limits, trainer assignment and the waitlist that fills the empty spot.',
    icon: CalendarDays,
    evidence: 'backend/src/classes, frontend/src/features/classes',
    items: [
      {
        title: 'Class schedule',
        description:
          'Weekly and daily views of every session across every branch, with trainers and rooms assigned.',
      },
      {
        title: 'Bookings and rosters',
        description:
          'Members book from the app; staff see the roster, mark attendance and handle no-shows.',
      },
      {
        title: 'Waitlists',
        description:
          'When a full class frees up, the next member on the list is promoted automatically.',
      },
      {
        title: 'Capacity and cancellation rules',
        description:
          'Set per-class capacity, booking windows and cancellation cut-offs once and let the system hold the line.',
      },
    ],
  },
  {
    id: 'finance',
    eyebrow: 'money',
    title: 'Payments, billing and finance',
    summary:
      'Collect online or at the desk, invoice correctly, and see the financial picture across every branch without exporting anything.',
    icon: BadgeIndianRupee,
    evidence: 'backend/src/{payments,invoices,wallet,inventory}, frontend/src/features/{payments,expenses,wallet,pos,inventory}',
    items: [
      {
        title: 'Online payments',
        description:
          'Razorpay-backed collection with a hosted checkout members can open from their phone, and webhook-verified confirmation.',
      },
      {
        title: 'Invoices and tax invoices',
        description:
          'Generate compliant invoices with your studio branding, tax configuration and numbering series.',
      },
      {
        title: 'Expenses',
        description:
          'Record and categorise outgoings so profitability is a number you can read, not one you have to assemble.',
      },
      {
        title: 'Point of sale and store',
        description:
          'Sell supplements, merchandise and add-ons at the desk, with stock movements posted against inventory.',
      },
      {
        title: 'Inventory',
        description:
          'Track stock, bundles and reorder points across branches.',
      },
      {
        title: 'Member wallet',
        description:
          'Store credit and prepaid balances that settle against dues, sessions and store purchases.',
      },
    ],
  },
  {
    id: 'staff',
    eyebrow: 'team',
    title: 'Staff, trainers and permissions',
    summary:
      'Who works when, who can see what, and which trainers are actually retaining their members.',
    icon: UserCog,
    evidence: 'backend/src/{staff,roles}, frontend/src/features/staff, frontend/src/app/[gymSlug]/settings/{roles,permissions}',
    items: [
      {
        title: 'Staff directory and profiles',
        description:
          'Every trainer, manager and desk staffer with role, branch assignment and employment details.',
      },
      {
        title: 'Shifts and leave',
        description:
          'Publish shift schedules, handle leave requests and see who is covering the floor.',
      },
      {
        title: 'Custom roles and permissions',
        description:
          'Build the roles your organisation uses instead of bending it to a fixed three-tier model.',
      },
      {
        title: 'Trainer analytics',
        description:
          'Sessions delivered, members retained and class fill rates per trainer.',
      },
      {
        title: 'Branch-scoped access',
        description:
          'Branch managers see their branch; owners see everything. The scope is enforced server-side, not hidden in the UI.',
      },
    ],
  },
  {
    id: 'growth',
    eyebrow: 'growth',
    title: 'Marketing, referrals and retention',
    summary:
      'The campaigns and automations that bring members back, triggered by what members actually do rather than by a calendar reminder someone has to remember.',
    icon: MessageSquare,
    evidence: 'backend/src/{marketing,referrals,whatsapp,email,push}, frontend/src/features/{marketing,automations,referrals,whatsapp-inbox}',
    items: [
      {
        title: 'Campaigns',
        description:
          'Build and send targeted campaigns to the member segments you defined, across email, WhatsApp and push.',
      },
      {
        title: 'Automations',
        description:
          'Rules that fire on real events like a lapsed check-in streak, an expiring plan or a missed payment, and act without anyone watching.',
      },
      {
        title: 'WhatsApp messaging',
        description:
          'Meta WhatsApp Business integration with approved templates and a shared inbox for replies.',
      },
      {
        title: 'Message templates',
        description:
          'Reusable templates with member variables, so every reminder reads like your studio wrote it.',
      },
      {
        title: 'Referral programs',
        description:
          'Member-get-member schemes with tracked codes, attribution and reward payout.',
      },
      {
        title: 'Loyalty',
        description:
          'Reward the behaviour you want more of: attendance streaks, class bookings and renewals.',
      },
    ],
  },
  {
    id: 'ai',
    eyebrow: 'intelligence',
    title: 'AI business advisor',
    summary:
      'An advisor that reads your own operational data and tells you what needs attention this morning, grounded in your numbers rather than in generic fitness advice.',
    icon: Bot,
    evidence: 'backend/src/ai (ai-tool-runner.service.ts, ai-tools.ts), frontend/src/features/ai',
    items: [
      {
        title: 'Ask your data',
        description:
          'Question your studio in plain language. The advisor runs real, gym-scoped queries against your own data to answer.',
      },
      {
        title: 'Morning briefing',
        description:
          'A daily summary of what changed overnight and what needs a decision today.',
      },
      {
        title: 'Churn risk',
        description:
          'Members drifting away are surfaced early, with the attendance and payment signals behind the score shown alongside it.',
      },
      {
        title: 'Suggested actions',
        description:
          'Concrete next steps like a follow-up, an offer or a trainer check-in, all of which you can act on from the same screen.',
      },
    ],
  },
  {
    id: 'analytics',
    eyebrow: 'analytics',
    title: 'Dashboards and reporting',
    summary:
      'Live operational dashboards plus the reports you need at month end, consistent across every branch.',
    icon: BarChart3,
    evidence: 'backend/src/{dashboard,analytics}, frontend/src/features/{dashboard,reports}',
    items: [
      {
        title: 'Live dashboard',
        description:
          'Members, revenue, check-ins and growth updating in real time over websockets.',
      },
      {
        title: 'Branch comparison',
        description:
          'Put branches side by side on the metrics that matter and see which location is drifting.',
      },
      {
        title: 'Revenue and collection reports',
        description:
          'Collections, dues, refunds and expenses in one reconcilable view.',
      },
      {
        title: 'Attendance and retention',
        description:
          'Visit frequency, active-member trends and cohort retention built on verified check-ins.',
      },
    ],
  },
  {
    id: 'multi-branch',
    eyebrow: 'scale',
    title: 'Multi-branch and organisation',
    summary:
      'Built for chains from day one. Add a branch without adding a second system, and keep one consolidated view across all of them.',
    icon: Building2,
    evidence: 'backend/src/{branches,organization}, frontend/src/features/branches',
    items: [
      {
        title: 'Branches',
        description:
          'Each location gets its own staff, schedule, inventory and targets, all under one organisation.',
      },
      {
        title: 'Consolidated view',
        description:
          'Owners see the whole group; the branch switcher scopes everything below it in one click.',
      },
      {
        title: 'Per-branch settings',
        description:
          'Operating hours, access rules, payment gateways and templates configured per location.',
      },
      {
        title: 'Organisation-wide reporting',
        description:
          'Roll every branch up into one set of numbers without exporting to a spreadsheet.',
      },
    ],
  },
  {
    id: 'platform',
    eyebrow: 'platform',
    title: 'Platform and integrations',
    summary:
      'The plumbing that makes MuscleX usable as infrastructure rather than as an island.',
    icon: Settings2,
    evidence: 'backend/src/{search,uploads,documents,audit,compliance,platform,queue}, frontend/src/features/{integrations,documents}',
    items: [
      {
        title: 'REST API access',
        description:
          'A documented API surface on Pro and Enterprise for the integrations you need to build yourself.',
      },
      {
        title: 'Fast search',
        description:
          'Meilisearch-backed search across members, classes and transactions.',
      },
      {
        title: 'Documents and uploads',
        description:
          'Member documents and studio files stored in private buckets and served through short-lived signed URLs.',
      },
      {
        title: 'Audit logs',
        description:
          'A record of who changed what, available from Starter upward.',
      },
      {
        title: 'Integrations',
        description:
          'Payment gateways, messaging providers and email delivery configured per studio.',
      },
      {
        title: 'Background processing',
        description:
          'Queued jobs handle campaign sends, report builds and heavy work without blocking the desk.',
      },
    ],
  },
  {
    id: 'member-app',
    eyebrow: 'members',
    title: 'The member mobile app',
    summary:
      'A member-facing super-app that turns your gym into something members open every day, not only when a payment is due.',
    icon: Smartphone,
    evidence: 'member-app/, backend/src/member (10 BFF controllers)',
    items: [
      {
        title: 'Workouts and exercises',
        description:
          'Assigned programmes and an exercise library members can follow between sessions.',
      },
      {
        title: 'Nutrition logging',
        description:
          'Daily meal and water logging that keeps the habit loop going outside the gym.',
      },
      {
        title: 'Trainer chat',
        description:
          'A direct line to their trainer, inside the app rather than in a personal WhatsApp thread.',
      },
      {
        title: 'Class booking and check-in',
        description:
          'Book a class, scan in at the door and see their attendance streak.',
      },
      {
        title: 'Progress and health',
        description:
          'Body metrics, activity, heart and sleep data in one progress view.',
      },
      {
        title: 'Community',
        description:
          'A studio feed that makes membership feel like belonging to something.',
      },
    ],
  },
];

/** The condensed 8-card grid used on the home page. */
export const homeFeatures: { icon: LucideIcon; title: string; description: string; href: string }[] = [
  {
    icon: Users,
    title: 'Member management',
    description: 'Profiles, plans, renewals and proration in one record per member, always current.',
    href: '/features#members',
  },
  {
    icon: ScanFace,
    title: 'Check-in four ways',
    description: 'QR, facial recognition, biometric devices and the front desk, all in one log.',
    href: '/features#check-in',
  },
  {
    icon: CalendarDays,
    title: 'Classes and waitlists',
    description: 'Recurring schedules, capacity rules and automatic waitlist promotion.',
    href: '/features#classes',
  },
  {
    icon: CreditCard,
    title: 'Payments and invoicing',
    description: 'Razorpay collection, compliant invoices, expenses and member wallets.',
    href: '/features#finance',
  },
  {
    icon: Bot,
    title: 'AI business advisor',
    description: 'Ask your own data a question. Get the morning briefing and the churn list.',
    href: '/features#ai',
  },
  {
    icon: MessageSquare,
    title: 'Campaigns and automations',
    description: 'WhatsApp, email and push triggered by what members actually do.',
    href: '/features#growth',
  },
  {
    icon: Building2,
    title: 'Multi-branch',
    description: 'Every location under one organisation, with a consolidated owner view.',
    href: '/features#multi-branch',
  },
  {
    icon: Smartphone,
    title: 'Member mobile app',
    description: 'Workouts, nutrition, bookings, trainer chat and community in members’ pockets.',
    href: '/member-app',
  },
];

/** The five-step "how it works" band on the home page. */
export const howItWorks: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Building2,
    title: 'Set up your studio',
    description:
      'Guided onboarding takes you through studio details, your first branch, admin profile and membership plans.',
  },
  {
    icon: Users,
    title: 'Bring your members across',
    description:
      'Add members with their plans, dues and documents so day one in MuscleX matches day zero outside it.',
  },
  {
    icon: Fingerprint,
    title: 'Turn on check-in',
    description:
      'Pick QR, facial recognition, a biometric device or the front desk, or run all of them at once.',
  },
  {
    icon: Wallet,
    title: 'Start collecting online',
    description:
      'Connect your payment gateway and let renewals settle themselves instead of chasing them.',
  },
  {
    icon: Sparkles,
    title: 'Let the data work',
    description:
      'Dashboards, churn risk and automations turn every check-in into something that keeps members longer.',
  },
];

/** Small capability chips used in the hero and elsewhere. */
export const capabilityChips: { icon: LucideIcon; label: string }[] = [
  { icon: LayoutDashboard, label: 'Live dashboards' },
  { icon: QrCode, label: 'QR check-in' },
  { icon: ScanFace, label: 'Face recognition' },
  { icon: BadgeIndianRupee, label: 'Razorpay billing' },
  { icon: ShoppingCart, label: 'POS & inventory' },
  { icon: Gift, label: 'Referrals & loyalty' },
  { icon: Boxes, label: 'Multi-branch' },
  { icon: Activity, label: 'Retention analytics' },
  { icon: ShieldCheck, label: 'Per-studio isolation' },
];
