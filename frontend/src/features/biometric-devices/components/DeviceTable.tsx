'use client';

import React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { format, formatDistanceToNow } from 'date-fns';
import { KeyRound, MoreHorizontal, Trash2 } from 'lucide-react';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { BiometricDevice } from '../types';

interface DeviceTableProps {
  devices: BiometricDevice[];
  /** branch_id → branch name, for the Branch column. */
  branchNames: Record<string, string>;
  onMapPin: (device: BiometricDevice) => void;
  onRemove: (device: BiometricDevice) => void;
}

function safeFormat(value: string | null | undefined, fmt: string): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : format(d, fmt);
}

function lastSeenLabel(value: string | null): string {
  if (!value) return 'Never';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Never';
  return formatDistanceToNow(d, { addSuffix: true });
}

export function DeviceTable({
  devices,
  branchNames,
  onMapPin,
  onRemove,
}: DeviceTableProps) {
  const columns: ColumnDef<BiometricDevice, unknown>[] = [
    {
      accessorKey: 'device_name',
      header: 'Device',
      cell: ({ row }) => (
        <span className="font-medium text-foreground">
          {row.original.device_name}
        </span>
      ),
    },
    {
      accessorKey: 'hardware_id',
      header: 'Serial',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.hardware_id}
        </span>
      ),
    },
    {
      accessorKey: 'branch_id',
      header: 'Branch',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {branchNames[row.original.branch_id] ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge
          variant={row.original.status === 'active' ? 'active' : 'inactive'}
          label={row.original.status === 'active' ? 'Active' : 'Disabled'}
        />
      ),
    },
    {
      accessorKey: 'routed',
      header: 'Routing',
      cell: ({ row }) =>
        row.original.routed ? (
          <StatusBadge variant="active" label="Receiving" />
        ) : (
          <StatusBadge variant="pending" label="Not routed" />
        ),
    },
    {
      accessorKey: 'last_seen_at',
      header: 'Last Seen',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {lastSeenLabel(row.original.last_seen_at)}
        </span>
      ),
    },
    {
      accessorKey: 'registered_at',
      header: 'Registered',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {safeFormat(row.original.registered_at, 'd MMM yyyy')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onMapPin(row.original)}>
              <KeyRound className="mr-2 h-3.5 w-3.5" /> Map member PIN
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRemove(row.original)}>
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return <DataTable columns={columns} data={devices} />;
}
