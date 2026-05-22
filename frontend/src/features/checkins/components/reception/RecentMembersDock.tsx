'use client';

import * as React from 'react';
import { History, User as UserIcon } from 'lucide-react';

export interface RecentMember {
  member_id: string;
  full_name: string;
  member_code: string;
  profile_photo_url?: string | null;
  last_seen_at: string; // ISO
}

interface RecentMembersDockProps {
  members: RecentMember[];
  onPick: (member: RecentMember) => void;
  maxItems?: number;
}

/**
 * Quick-repeat dock for reception staff: shows the last N successfully
 * checked-in members as tap-once tiles. Optimized for the common "family
 * member just stepped out and is coming back" / "trainer-and-client come
 * in together" patterns.
 *
 * Source data comes from the live feed (already in memory), deduped by
 * member_id, with the most recent first. Persistence is intentionally
 * absent — the dock resets on refresh because staleness is worse than
 * emptiness here.
 */
export function RecentMembersDock({ members, onPick, maxItems = 8 }: RecentMembersDockProps) {
  const deduped = React.useMemo(() => {
    const seen = new Map<string, RecentMember>();
    for (const m of members) {
      const existing = seen.get(m.member_id);
      if (!existing || new Date(m.last_seen_at) > new Date(existing.last_seen_at)) {
        seen.set(m.member_id, m);
      }
    }
    return Array.from(seen.values())
      .sort((a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime())
      .slice(0, maxItems);
  }, [members, maxItems]);

  if (deduped.length === 0) return null;

  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <History className="h-3.5 w-3.5" />
        Repeat last check-in
      </h4>
      <div className="flex flex-wrap gap-2">
        {deduped.map((m) => (
          <button
            key={m.member_id}
            onClick={() => onPick(m)}
            className="group flex max-w-[12rem] items-center gap-2 rounded-full border border-border bg-card px-2 py-1 text-xs transition hover:border-primary hover:bg-canvas-soft"
            title={`Repeat: ${m.full_name}`}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              {m.profile_photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.profile_photo_url} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <UserIcon className="h-3 w-3" />
              )}
            </span>
            <span className="truncate text-foreground group-hover:text-foreground">
              {m.full_name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
