'use client';

import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useMembers } from '@/features/members';
import type { Member } from '@/types';
import { useMapDevicePin } from '../hooks';
import type { BiometricDevice } from '../types';
import { PIN_PATTERN } from '../types';

// ── Member picker (same pattern as plans/AssignPlanDialog) ──────

function MemberPicker({
  selected,
  onSelect,
  onClear,
}: {
  selected: Member | null;
  onSelect: (member: Member) => void;
  onClear: () => void;
}) {
  const [search, setSearch] = useState('');
  const { data: membersResponse } = useMembers({
    search: search || undefined,
    limit: 10,
  });
  const members = membersResponse?.data ?? [];

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
        <span className="font-medium">{selected.full_name}</span>
        <span className="font-mono text-xs text-muted-foreground">
          {selected.member_code}
        </span>
        <button
          type="button"
          onClick={() => {
            onClear();
            setSearch('');
          }}
          className="ml-auto text-xs text-muted-foreground hover:text-foreground"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search members..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-muted border-border text-foreground placeholder:text-muted-foreground"
        />
      </div>
      {search && members.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-card">
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m)}
              className="flex w-full items-center gap-3 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-canvas-soft-2 text-primary text-xs font-semibold">
                {m.full_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
              <div className="text-left">
                <p className="font-medium">{m.full_name}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {m.member_code}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Map device PIN → member ─────────────────────────────────────

interface MapPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device: BiometricDevice | null;
}

export function MapPinDialog({ open, onOpenChange, device }: MapPinDialogProps) {
  const mapMutation = useMapDevicePin();
  const [pin, setPin] = useState('');
  const [member, setMember] = useState<Member | null>(null);

  useEffect(() => {
    if (open) {
      setPin('');
      setMember(null);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!device) return;
    if (!PIN_PATTERN.test(pin.trim())) {
      toast.error('PIN must be 1-12 digits');
      return;
    }
    if (!member) {
      toast.error('Select a member');
      return;
    }
    mapMutation.mutate(
      {
        serial: device.hardware_id,
        data: { pin: pin.trim(), member_id: member.id },
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Map Member PIN</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Link a user PIN enrolled on &quot;{device?.device_name}&quot; to a
            member, so their fingerprint punches check them in. Tip: enroll the
            member on the device using their member code as the PIN.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-foreground">Device User PIN</Label>
            <Input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              inputMode="numeric"
              placeholder="e.g. 1024"
              className="bg-muted border-border font-mono text-foreground placeholder:text-muted-foreground placeholder:font-sans"
            />
            <p className="text-xs text-muted-foreground">
              The numeric user ID assigned when the fingerprint was enrolled on
              the device (1-12 digits).
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Member</Label>
            <MemberPicker
              selected={member}
              onSelect={setMember}
              onClear={() => setMember(null)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mapMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {mapMutation.isPending ? 'Mapping...' : 'Map PIN'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
