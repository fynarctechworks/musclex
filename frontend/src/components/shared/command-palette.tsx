"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Search, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { useRouter } from "next/navigation";
import { useGymSlug } from "@/lib/hooks/use-gym-slug";

interface SearchResult {
  id: string;
  label: string;
  type: "member" | "class" | "staff" | "payment" | "page";
  href: string;
  description?: string;
}

const quickLinks: SearchResult[] = [
  { id: "nav-dashboard", label: "Dashboard", type: "page", href: "/dashboard" },
  { id: "nav-members", label: "Members", type: "page", href: "/members" },
  { id: "nav-checkin", label: "Check-in", type: "page", href: "/check-in" },
  { id: "nav-classes", label: "Classes", type: "page", href: "/schedule" },
  { id: "nav-finance", label: "Finance", type: "page", href: "/finance" },
  { id: "nav-staff", label: "Staff", type: "page", href: "/staff" },
  { id: "nav-settings", label: "Settings", type: "page", href: "/settings" },
  { id: "nav-ai", label: "AI Advisor", type: "page", href: "/ai" },
];

const typeLabels: Record<string, string> = {
  member: "Member",
  class: "Class",
  staff: "Staff",
  payment: "Payment",
  page: "Page",
};

/**
 * Global command palette — Cmd+K / Ctrl+K.
 * Hick's Law: shows results progressively as user types.
 * Doherty Threshold: instant local results, async API results.
 */
export function CommandPalette() {
  const open = useUiStore((s) => s.globalSearchOpen);
  const setOpen = useUiStore((s) => s.setGlobalSearchOpen);
  const router = useRouter();
  const { gymPath } = useGymSlug();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter quick links based on query
  const results: SearchResult[] = query.length === 0
    ? quickLinks
    : quickLinks.filter((r) =>
        r.label.toLowerCase().includes(query.toLowerCase())
      );

  // Keyboard shortcut: Cmd/Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset selection on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      router.push(gymPath(result.href));
    },
    [setOpen, router, gymPath]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />

      {/* Palette */}
      <div className="relative w-full max-w-lg rounded-lg border border-border bg-card shadow-level-5">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search or jump to..."
            className="flex-1 bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            role="combobox"
            aria-expanded={true}
            aria-controls="command-palette-results"
            aria-label="Search"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto p-2" role="listbox" id="command-palette-results">
          {results.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No results found.</p>
          ) : (
            results.map((result, i) => (
              <button
                key={result.id}
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setSelectedIndex(i)}
                role="option"
                aria-selected={i === selectedIndex}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
                  i === selectedIndex
                    ? "bg-canvas-soft text-foreground"
                    : "text-muted-foreground"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-foreground">{result.label}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {typeLabels[result.type]}
                  </span>
                </div>
                <ArrowRight className="h-3 w-3 opacity-40" />
              </button>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> select</span>
          <span><kbd className="font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
