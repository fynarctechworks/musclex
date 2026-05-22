"use client";

import type { ExpenseCategory } from "@/types";

interface CategoryChipRowProps {
  categories: ExpenseCategory[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Horizontally scrolling chip row for quick category selection.
 * Falls back to a no-selection hint when the list is empty.
 */
export function CategoryChipRow({
  categories,
  selectedId,
  onSelect,
}: CategoryChipRowProps) {
  const active = categories.filter((c) => c.is_active);
  if (active.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No categories yet — add one from Categories.
      </p>
    );
  }
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {active.map((cat) => {
        const isSel = cat.id === selectedId;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              isSel
                ? "border-primary bg-canvas-soft-2 text-primary"
                : "border-border bg-background text-muted-foreground hover:border-primary/60"
            }`}
            style={
              isSel && cat.color
                ? {
                    borderColor: cat.color,
                    backgroundColor: `${cat.color}22`,
                    color: cat.color,
                  }
                : undefined
            }
          >
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}
