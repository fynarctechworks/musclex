'use client';

import * as React from 'react';
import { Command } from 'cmdk';
import { useQuery } from '@tanstack/react-query';
import { Search, User as UserIcon, X } from 'lucide-react';
import { membersApi } from '@/features/members';

export interface PalettePickedMember {
  id: string;
  full_name: string;
  member_code: string;
  status?: string;
  profile_photo_url?: string | null;
}

interface MemberHotkeyPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId?: string;
  onPick: (member: PalettePickedMember) => void;
}

/**
 * Cmd-K / Ctrl-K member palette for reception desk power users.
 *
 * Pure keyboard workflow: open with Cmd+K, type, arrow keys to navigate,
 * Enter to pick, Esc to close. Uses cmdk for accessible list semantics
 * (aria-activedescendant, roving focus, "no results" state).
 *
 * Search is debounced 200ms; min 2 chars. Limit 8 results to keep the
 * palette readable and the network footprint trivial.
 */
export function MemberHotkeyPalette({
  open,
  onOpenChange,
  branchId,
  onPick,
}: MemberHotkeyPaletteProps) {
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 200);
    return () => clearTimeout(t);
  }, [search]);

  // Reset on open so each invocation starts clean.
  React.useEffect(() => {
    if (open) {
      setSearch('');
      setDebounced('');
    }
  }, [open]);

  const { data, isFetching } = useQuery({
    queryKey: ['checkin-palette', branchId ?? null, debounced],
    queryFn: () =>
      membersApi.list({
        search: debounced,
        branch_id: branchId,
        limit: 8,
      }),
    enabled: open && debounced.length >= 2,
    staleTime: 30_000,
  });

  const items: PalettePickedMember[] = (data?.data ?? []) as PalettePickedMember[];

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-background/80 backdrop-blur-sm pt-[15vh]"
      onClick={() => onOpenChange(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Member search"
    >
      <div
        className="w-full max-w-xl rounded-lg border border-border bg-popover shadow-level-5"
        onClick={(e) => e.stopPropagation()}
      >
        <Command
          shouldFilter={false}
          loop
          className="flex flex-col"
          onKeyDown={(e) => {
            if (e.key === 'Escape') onOpenChange(false);
          }}
        >
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Command.Input
              autoFocus
              value={search}
              onValueChange={setSearch}
              placeholder="Search by name, phone, or member ID…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden sm:inline rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              esc
            </kbd>
            <button
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-1">
            {debounced.length < 2 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search.
              </div>
            )}

            {debounced.length >= 2 && isFetching && (
              <div className="p-6 text-center text-sm text-muted-foreground">Searching…</div>
            )}

            {debounced.length >= 2 && !isFetching && items.length === 0 && (
              <Command.Empty className="p-6 text-center text-sm text-muted-foreground">
                No members match &ldquo;{debounced}&rdquo;.
              </Command.Empty>
            )}

            {items.map((m) => (
              <Command.Item
                key={m.id}
                value={`${m.full_name} ${m.member_code}`}
                onSelect={() => {
                  onPick(m);
                  onOpenChange(false);
                }}
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm aria-selected:bg-canvas-soft aria-selected:text-accent-foreground"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  {m.profile_photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.profile_photo_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <UserIcon className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">{m.full_name}</div>
                  <div className="truncate text-xs text-muted-foreground">{m.member_code}</div>
                </div>
                {m.status && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {m.status}
                  </span>
                )}
              </Command.Item>
            ))}
          </Command.List>

          <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            <span>↑↓ to navigate · ↵ to check in</span>
            <span>
              <kbd className="rounded border border-border bg-muted px-1 py-0.5">⌘K</kbd> anywhere
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}
