'use client';

import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagBadgeProps {
  name: string;
  color?: string | null;
  onRemove?: () => void;
  className?: string;
}

export function TagBadge({ name, color, onRemove, className }: TagBadgeProps) {
  const bgColor = color || '#4A9FD4';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-on-primary',
        className,
      )}
      style={{ backgroundColor: bgColor }}
    >
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-canvas/25 transition-colors"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  );
}
