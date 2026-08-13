'use client';

import React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Archive, MoreHorizontal, Pencil, UserPlus } from 'lucide-react';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DietPlan, WorkoutPlan } from '../types';
import {
  dietGoalLabels,
  difficultyLabels,
  workoutGoalLabels,
} from '../types';

function TemplateChip() {
  return (
    <span className="ml-2 inline-flex items-center rounded-full bg-canvas-soft-2 px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-hairline">
      Template
    </span>
  );
}

function RowActions<T extends { is_active: boolean }>({
  row,
  onEdit,
  onAssign,
  onDeactivate,
}: {
  row: T;
  onEdit: (row: T) => void;
  onAssign: (row: T) => void;
  onDeactivate: (row: T) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => onEdit(row)}>
          <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAssign(row)} disabled={!row.is_active}>
          <UserPlus className="mr-2 h-3.5 w-3.5" /> Assign to Member
        </DropdownMenuItem>
        {row.is_active && (
          <DropdownMenuItem onClick={() => onDeactivate(row)}>
            <Archive className="mr-2 h-3.5 w-3.5" /> Deactivate
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Workout plan table ──────────────────────────────────────────

interface WorkoutPlanTableProps {
  plans: WorkoutPlan[];
  onEdit: (plan: WorkoutPlan) => void;
  onAssign: (plan: WorkoutPlan) => void;
  onDeactivate: (plan: WorkoutPlan) => void;
}

export function WorkoutPlanTable({
  plans,
  onEdit,
  onAssign,
  onDeactivate,
}: WorkoutPlanTableProps) {
  const columns: ColumnDef<WorkoutPlan, unknown>[] = [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <span className="font-medium text-foreground">
          {row.original.title}
          {row.original.is_template && <TemplateChip />}
        </span>
      ),
    },
    {
      accessorKey: 'goal',
      header: 'Goal',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.goal ? workoutGoalLabels[row.original.goal] : '—'}
        </span>
      ),
    },
    {
      accessorKey: 'difficulty',
      header: 'Difficulty',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.difficulty
            ? difficultyLabels[row.original.difficulty]
            : '—'}
        </span>
      ),
    },
    {
      id: 'exercises',
      header: 'Exercises',
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {row.original._count?.exercises ?? 0}
        </span>
      ),
    },
    {
      id: 'assigned',
      header: 'Assigned',
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {row.original._count?.assigned_workouts ?? 0}
        </span>
      ),
    },
    {
      id: 'created_by',
      header: 'Created By',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.created_by?.full_name ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge
          variant={row.original.is_active ? 'active' : 'inactive'}
          label={row.original.is_active ? 'Active' : 'Inactive'}
        />
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <RowActions
          row={row.original}
          onEdit={onEdit}
          onAssign={onAssign}
          onDeactivate={onDeactivate}
        />
      ),
    },
  ];

  return <DataTable columns={columns} data={plans} />;
}

// ── Diet plan table ─────────────────────────────────────────────

interface DietPlanTableProps {
  plans: DietPlan[];
  onEdit: (plan: DietPlan) => void;
  onAssign: (plan: DietPlan) => void;
  onDeactivate: (plan: DietPlan) => void;
}

export function DietPlanTable({
  plans,
  onEdit,
  onAssign,
  onDeactivate,
}: DietPlanTableProps) {
  const columns: ColumnDef<DietPlan, unknown>[] = [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <span className="font-medium text-foreground">
          {row.original.title}
          {row.original.is_template && <TemplateChip />}
        </span>
      ),
    },
    {
      accessorKey: 'goal',
      header: 'Goal',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.goal ? dietGoalLabels[row.original.goal] : '—'}
        </span>
      ),
    },
    {
      accessorKey: 'daily_calories',
      header: 'Daily kcal',
      cell: ({ row }) => (
        <span className="font-mono text-sm text-muted-foreground">
          {row.original.daily_calories != null
            ? row.original.daily_calories.toLocaleString()
            : '—'}
        </span>
      ),
    },
    {
      id: 'meals',
      header: 'Meals',
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {row.original._count?.meals ?? 0}
        </span>
      ),
    },
    {
      id: 'assigned',
      header: 'Assigned',
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {row.original._count?.assignments ?? 0}
        </span>
      ),
    },
    {
      id: 'created_by',
      header: 'Created By',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.created_by?.full_name ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge
          variant={row.original.is_active ? 'active' : 'inactive'}
          label={row.original.is_active ? 'Active' : 'Inactive'}
        />
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <RowActions
          row={row.original}
          onEdit={onEdit}
          onAssign={onAssign}
          onDeactivate={onDeactivate}
        />
      ),
    },
  ];

  return <DataTable columns={columns} data={plans} />;
}
