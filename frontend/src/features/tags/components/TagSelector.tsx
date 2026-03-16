'use client';

import React, { useState } from 'react';
import { ChevronsUpDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { useAllTags } from '../hooks';
import type { MemberTag } from '../types';

interface TagSelectorProps {
  /** Tags already assigned — these are excluded from the dropdown */
  assignedTagIds: string[];
  onSelect: (tag: MemberTag) => void;
  onCreateNew?: () => void;
}

export function TagSelector({ assignedTagIds, onSelect, onCreateNew }: TagSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data: allTags } = useAllTags();

  const available = (allTags ?? []).filter(
    (t) =>
      !assignedTagIds.includes(t.id) &&
      t.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 border-dashed border-border text-muted-foreground text-xs"
        >
          <Plus className="h-3 w-3" />
          Add Tag
          <ChevronsUpDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2 bg-card border-border" align="start">
        <Input
          placeholder="Search tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 mb-2 bg-muted border-border text-sm text-foreground placeholder:text-muted-foreground"
        />
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          {available.length === 0 && (
            <p className="py-3 text-center text-xs text-muted-foreground">
              No tags found
            </p>
          )}
          {available.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => {
                onSelect(tag);
                setOpen(false);
                setSearch('');
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: tag.color || '#4A9FD4' }}
              />
              {tag.name}
              {tag._count && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {tag._count.assignments}
                </span>
              )}
            </button>
          ))}
        </div>
        {onCreateNew && (
          <>
            <div className="my-1.5 border-t border-border" />
            <button
              type="button"
              onClick={() => {
                onCreateNew();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-primary hover:bg-muted transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Create new tag
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
