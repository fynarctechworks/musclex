import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { IconName } from '../../design-system';
import type { ChatThreadList, HomeDashboard } from '../../api/types';
import { formatDate, relativeFromNow } from '../../lib/format';

/**
 * ────────────────────────────────────────────────────────────────
 * NOTIFICATION INBOX (member app)
 * ────────────────────────────────────────────────────────────────
 *
 * The app has push DELIVERY (Phase 3) and a settings screen for opt-ins, but no
 * server-side notification HISTORY table yet (that would need a schema change).
 * Rather than fabricate a feed, this builds an honest, actionable inbox by
 * DERIVING notifications from data the app already loads — the Home dashboard
 * (membership/streak/class/workout/check-in) and trainer-chat unread counts.
 * Every item is real and deep-links to where the member can act on it.
 *
 * Read-state is tracked on-device (no server round-trip): tapping a notification
 * marks its stable id read, so the unread dot clears the way the reference shows.
 * When fresh activity arrives (e.g. a newer trainer message), the id changes and
 * the item legitimately becomes unread again.
 */

export type NotificationTone = 'neutral' | 'success' | 'warning' | 'danger' | 'brand';

export interface AppNotification {
  /** Stable, content-derived id (drives read-state + React keys). */
  id: string;
  icon: IconName;
  tone: NotificationTone;
  title: string;
  body: string;
  /** ISO timestamp when known (drives ordering + relative time); else null. */
  at: string | null;
  /** Optional deep-link action shown in the detail sheet. */
  cta?: { label: string; route: string };
}

/** Derive the inbox from real, already-loaded data. Pure + side-effect free. */
export function buildNotifications(
  home: HomeDashboard | undefined,
  threads: ChatThreadList | undefined,
): AppNotification[] {
  const out: AppNotification[] = [];

  // ── Trainer messages (one per thread with unread > 0) ──
  for (const t of threads?.threads ?? []) {
    if ((t.unreadCount ?? 0) > 0 && t.trainerId) {
      const who = t.trainerName ?? 'your trainer';
      out.push({
        id: `chat:${t.trainerId}:${t.lastMessageAt ?? ''}`,
        icon: 'message',
        tone: 'brand',
        title: `New message from ${who}`,
        body: t.lastMessage ?? 'You have a new message.',
        at: t.lastMessageAt ?? null,
        cta: { label: 'Open chat', route: `/chat/${t.trainerId}` },
      });
    }
  }

  // ── Membership status ──
  const m = home?.membership;
  if (m?.status === 'expiring') {
    const d = m.daysLeft;
    out.push({
      id: `membership:expiring:${m.expiresOn ?? ''}`,
      icon: 'alert',
      tone: 'warning',
      title: 'Your membership is expiring soon',
      body:
        d != null
          ? `Only ${d} day${d === 1 ? '' : 's'} left${
              m.expiresOn ? ` — expires ${formatDate(m.expiresOn)}` : ''
            }. Renew now to keep checking in.`
          : 'Renew soon to keep uninterrupted access to your gym.',
      at: null,
      cta: { label: 'Renew membership', route: '/membership' },
    });
  } else if (m?.status === 'expired') {
    out.push({
      id: `membership:expired:${m.expiresOn ?? ''}`,
      icon: 'alert',
      tone: 'danger',
      title: 'Your membership has expired',
      body: `${
        m.expiresOn ? `Expired ${formatDate(m.expiresOn)}. ` : ''
      }Renew to check in and book classes again.`,
      at: null,
      cta: { label: 'Renew membership', route: '/membership' },
    });
  } else if (m?.status === 'frozen') {
    out.push({
      id: 'membership:frozen',
      icon: 'alert',
      tone: 'neutral',
      title: 'Your membership is on hold',
      body: 'Your plan is currently frozen. Contact your gym to resume it.',
      at: null,
    });
  }

  // ── Streak at risk ──
  const streakDays = home?.streak?.days ?? 0;
  if (home?.today?.streakAtRisk && streakDays > 0) {
    out.push({
      id: 'streak:at-risk',
      icon: 'flame',
      tone: 'warning',
      title: "Don't break your streak!",
      body: `You're on a ${streakDays}-day streak. Log a check-in, workout, or meal today to keep it alive.`,
      at: null,
      cta: { label: 'Check in now', route: '/checkin' },
    });
  }

  // ── Next class ──
  const c = home?.nextClass;
  if (c?.id) {
    const seats =
      c.seatsLeft != null ? ` • ${c.seatsLeft} seat${c.seatsLeft === 1 ? '' : 's'} left` : '';
    out.push({
      id: `class:${c.id}`,
      icon: 'calendar',
      tone: 'brand',
      title: 'Upcoming class',
      body: `${c.title ?? 'Your class'} starts ${relativeFromNow(c.startsAt)}${seats}.`,
      at: c.startsAt ?? null,
      cta: { label: 'View classes', route: '/classes' },
    });
  }

  // ── Today's workout ready ──
  const w = home?.todayWorkout;
  if (w?.id) {
    const count =
      w.exerciseCount != null
        ? ` • ${w.exerciseCount} exercise${w.exerciseCount === 1 ? '' : 's'}`
        : '';
    out.push({
      id: `workout:${w.id}`,
      icon: 'dumbbell',
      tone: 'brand',
      title: "Today's workout is ready",
      body: `${w.title ?? 'Your session'}${count}${w.assignedBy ? ` from ${w.assignedBy}` : ''}.`,
      at: null,
      cta: { label: 'Start workout', route: '/workout' },
    });
  }

  // ── Checked in today (positive confirmation) ──
  if (home?.today?.checkedIn) {
    out.push({
      id: 'checkin:today',
      icon: 'check',
      tone: 'success',
      title: "You're checked in today",
      body: 'Nice work showing up. Your streak is safe for today.',
      at: null,
    });
  }

  // Timestamped items first (newest first), then status items in insertion order.
  return out.sort((a, b) => {
    if (a.at && b.at) return new Date(b.at).getTime() - new Date(a.at).getTime();
    if (a.at) return -1;
    if (b.at) return 1;
    return 0;
  });
}

// ── On-device read-state ──────────────────────────────────────────
const READ_KEY = 'musclex.notif.read.v1';
const MAX_REMEMBERED = 200;

interface ReadState {
  readIds: string[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  markRead: (ids: string[]) => Promise<void>;
}

export const useNotificationReads = create<ReadState>((set, get) => ({
  readIds: [],
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(READ_KEY);
      if (raw) set({ readIds: JSON.parse(raw) as string[] });
    } catch {
      /* corrupt — start empty */
    }
    set({ hydrated: true });
  },
  markRead: async (ids) => {
    if (ids.length === 0) return;
    const next = Array.from(new Set([...get().readIds, ...ids])).slice(-MAX_REMEMBERED);
    set({ readIds: next });
    try {
      await AsyncStorage.setItem(READ_KEY, JSON.stringify(next));
    } catch {
      /* best-effort */
    }
  },
}));
